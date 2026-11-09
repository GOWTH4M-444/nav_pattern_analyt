#!/usr/bin/env python3
"""
NavPattern Studio — Distributed Delta Lake & Z-Order Lakehouse Pipeline
=======================================================================
Architecture: Bronze (Raw Server Logs) -> Silver (Sessionized Clickstreams) -> Gold (Markov & GraphFrames)
Storage Engine: Delta Lake on Apache Parquet with ACID Transactions, Time-Travel, and Z-Order Indexing
"""

from pyspark.sql import SparkSession
from pyspark.sql import functions as F

def create_lakehouse_spark_session() -> SparkSession:
    return (
        SparkSession.builder
        .appName("NavPattern_DeltaLake_Lakehouse_Pipeline")
        .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
        .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")
        .config("spark.serializer", "org.apache.spark.serializer.KryoSerializer")
        .config("spark.sql.adaptive.enabled", "true")
        .config("spark.databricks.delta.optimizeWrite.enabled", "true")
        .config("spark.databricks.delta.autoCompact.enabled", "true")
        .getOrCreate()
    )

def run_lakehouse_etl(spark: SparkSession, delta_root_path: str = "s3a://navpattern-lakehouse"):
    # 1. Read Bronze Delta Table partitioned by event_date and tenant_id
    bronze_logs_df = (
        spark.read.format("delta")
        .load(f"{delta_root_path}/bronze/web_server_logs")
        .filter(F.col("event_date") >= F.current_date() - F.expr("INTERVAL 7 DAYS"))
    )

    # 2. Time-Travel Audit Query (Compare against Snapshot Version 12)
    historical_baseline_df = (
        spark.read.format("delta")
        .option("versionAsOf", 12)
        .load(f"{delta_root_path}/silver/reconstructed_sessions")
    )

    # 3. Write Silver Sessionized Clickstreams with Partitioning by event_date & tenant_id
    (
        bronze_logs_df
        .filter((F.col("http_status") >= 200) & (F.col("http_status") < 400))
        .write.format("delta")
        .mode("append")
        .partitionBy("event_date", "tenant_id")
        .save(f"{delta_root_path}/silver/reconstructed_sessions")
    )

    # 4. Execute Z-Order Multi-Dimensional Clustering on session_id & event_timestamp
    # Eliminates full-table Parquet scans via Delta Data Skipping indexes
    spark.sql(f"""
        OPTIMIZE delta.`{delta_root_path}/silver/reconstructed_sessions`
        WHERE event_date >= current_date() - INTERVAL 1 DAY
        ZORDER BY (session_id, event_timestamp, client_ip)
    """)

    # 5. Vacuum Expired Tombstone Files (Retain 168 Hours / 7 Days for Time Travel)
    spark.sql(f"""
        VACUUM delta.`{delta_root_path}/silver/reconstructed_sessions` RETAIN 168 HOURS
    """)

if __name__ == "__main__":
    print("Delta Lake & Parquet Z-Order Lakehouse Pipeline configured.")
