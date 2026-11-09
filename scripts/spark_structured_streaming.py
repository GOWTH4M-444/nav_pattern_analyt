#!/usr/bin/env python3
"""
NavPattern Studio — High-Throughput Kafka + Spark Structured Streaming Pipeline
Features:
  1. RocksDB State Store Backend (Off-Heap NVMe SSD State Management)
  2. 15-Minute Event-Time Watermarking for Late-Arriving Clickstream Events
  3. Stateful Sessionization via mapGroupsWithState / applyInPandasWithState
     with automatic expired state eviction to prevent Executor JVM OOM errors.
"""

from typing import Iterator, Tuple
import pandas as pd
from pyspark.sql import SparkSession, DataFrame
from pyspark.sql import functions as F
from pyspark.sql import types as T
from pyspark.sql.streaming.state import GroupState, GroupStateTimeout


def create_streaming_spark_session(
    app_name: str = "NavPattern_Kafka_RocksDB_Streaming",
    shuffle_partitions: int = 200,
) -> SparkSession:
    """
    Configures SparkSession with RocksDBStateStoreProvider to offload millions of active
    concurrent visitor session states from JVM heap to fast local NVMe SSDs.
    """
    return (
        SparkSession.builder.appName(app_name)
        .config(
            "spark.sql.streaming.stateStore.providerClass",
            "org.apache.spark.sql.execution.streaming.state.RocksDBStateStoreProvider",
        )
        .config("spark.sql.streaming.stateStore.rocksdb.changelogCheckpointing.enabled", "true")
        .config("spark.sql.streaming.stateStore.rocksdb.WriteBufferSizeMB", "64")
        .config("spark.sql.streaming.stateStore.rocksdb.blockCacheSizeMB", "256")
        .config("spark.sql.streaming.stateStore.rocksdb.compactOnCommit", "false")
        .config("spark.sql.streaming.stateStore.minDeltasForSnapshot", "10")
        .config("spark.sql.shuffle.partitions", str(shuffle_partitions))
        .config("spark.sql.adaptive.enabled", "true")
        .config("spark.serializer", "org.apache.spark.serializer.KryoSerializer")
        .getOrCreate()
    )


CLICKSTREAM_EVENT_SCHEMA = T.StructType(
    [
        T.StructField("tenant_id", T.StringType(), nullable=False),
        T.StructField("session_id", T.StringType(), nullable=False),
        T.StructField("client_ip", T.StringType(), nullable=False),
        T.StructField("event_timestamp", T.TimestampType(), nullable=False),
        T.StructField("http_method", T.StringType(), nullable=False),
        T.StructField("page_path", T.StringType(), nullable=False),
        T.StructField("http_status", T.IntegerType(), nullable=False),
        T.StructField("bytes_sent", T.LongType(), nullable=True),
        T.StructField("scroll_depth_pct", T.DoubleType(), nullable=True),
        T.StructField("user_agent", T.StringType(), nullable=True),
    ]
)

SESSION_OUTPUT_SCHEMA = T.StructType(
    [
        T.StructField("tenant_id", T.StringType(), nullable=False),
        T.StructField("session_id", T.StringType(), nullable=False),
        T.StructField("client_ip", T.StringType(), nullable=False),
        T.StructField("session_start", T.TimestampType(), nullable=False),
        T.StructField("session_end", T.TimestampType(), nullable=False),
        T.StructField("hit_count", T.IntegerType(), nullable=False),
        T.StructField("ordered_pages", T.ArrayType(T.StringType()), nullable=False),
        T.StructField("evicted_by_watermark", T.BooleanType(), nullable=False),
    ]
)

SESSION_STATE_SCHEMA = T.StructType(
    [
        T.StructField("session_id", T.StringType(), nullable=False),
        T.StructField("session_start", T.TimestampType(), nullable=False),
        T.StructField("last_event_ts", T.TimestampType(), nullable=False),
        T.StructField("hit_count", T.IntegerType(), nullable=False),
        T.StructField("ordered_pages", T.ArrayType(T.StringType()), nullable=False),
    ]
)


def map_groups_with_state_sessionizer(
    key: Tuple[str, str],
    pdf_iter: Iterator[pd.DataFrame],
    state: GroupState,
) -> Iterator[pd.DataFrame]:
    """
    Stateful sessionization callback backed by RocksDB state store.
    Automatically evicts expired session states once the 15-minute event-time
    watermark advances past the state's timeout timestamp, preventing JVM OOM.
    """
    tenant_id, client_ip = key

    if state.hasTimedOut:
        prior = state.get
        state.remove()
        yield pd.DataFrame(
            [
                {
                    "tenant_id": tenant_id,
                    "session_id": prior[0],
                    "client_ip": client_ip,
                    "session_start": prior[1],
                    "session_end": prior[2],
                    "hit_count": prior[3],
                    "ordered_pages": list(prior[4]),
                    "evicted_by_watermark": True,
                }
            ]
        )
        return

    events_df = pd.concat(list(pdf_iter), ignore_index=True)
    events_df = events_df.sort_values("event_timestamp")

    if state.exists:
        session_id, start_ts, last_ts, hits, pages = state.get
        pages = list(pages)
    else:
        first_row = events_df.iloc[0]
        session_id = str(first_row["session_id"])
        start_ts = first_row["event_timestamp"]
        last_ts = start_ts
        hits = 0
        pages = []

    for _, row in events_df.iterrows():
        last_ts = max(last_ts, row["event_timestamp"])
        hits += 1
        pages.append(str(row["page_path"]))

    state.update((session_id, start_ts, last_ts, hits, pages))
    # Set 15-minute event-time timeout aligned with the 15-minute watermark
    if state.getCurrentWatermarkMs() > 0:
        state.setTimeoutTimestamp(state.getCurrentWatermarkMs() + 15 * 60 * 1000)

    yield pd.DataFrame(
        [
            {
                "tenant_id": tenant_id,
                "session_id": session_id,
                "client_ip": client_ip,
                "session_start": start_ts,
                "session_end": last_ts,
                "hit_count": hits,
                "ordered_pages": pages,
                "evicted_by_watermark": False,
            }
        ]
    )


def build_kafka_rocksdb_streaming_pipeline(
    spark: SparkSession,
    kafka_bootstrap_servers: str = "kafka-01.prod:9092,kafka-02.prod:9092",
    topic: str = "web-clickstream-access-logs",
    checkpoint_uri: str = "s3a://navpattern-lakehouse/checkpoints/rocksdb_sessionizer",
    silver_table_uri: str = "s3a://navpattern-lakehouse/silver/reconstructed_sessions",
):
    raw_kafka_df: DataFrame = (
        spark.readStream.format("kafka")
        .option("kafka.bootstrap.servers", kafka_bootstrap_servers)
        .option("subscribe", topic)
        .option("maxOffsetsPerTrigger", 250000)
        .option("startingOffsets", "latest")
        .load()
    )

    # Parse clickstream payload & apply 15-minute event-time watermark
    watermarked_events_df = (
        raw_kafka_df.select(
            F.from_json(F.col("value").cast("string"), CLICKSTREAM_EVENT_SCHEMA).alias("event")
        )
        .select("event.*")
        .withWatermark("event_timestamp", "15 minutes")
    )

    # Stateful sessionization using RocksDB state backend + EventTimeTimeout
    stateful_sessions_df = watermarked_events_df.groupBy("tenant_id", "client_ip").applyInPandasWithState(
        map_groups_with_state_sessionizer,
        outputStructType=SESSION_OUTPUT_SCHEMA,
        stateStructType=SESSION_STATE_SCHEMA,
        outputMode="update",
        timeoutConf=GroupStateTimeout.EventTimeTimeout,
    )

    return (
        stateful_sessions_df.writeStream.format("delta")
        .outputMode("append")
        .option("checkpointLocation", checkpoint_uri)
        .trigger(processingTime="5 seconds")
        .start(silver_table_uri)
    )
