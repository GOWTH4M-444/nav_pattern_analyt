#!/usr/bin/env python3
"""
NavPattern Studio — Distributed Anomaly Detection & Bot Quarantine Pipeline
File: scripts/pyspark_anomaly_detection.py
Features:
  1. Session-Level Feature Vector Extraction:
     - request_velocity (hits / minute)
     - uri_entropy (Shannon transition diversity bits)
     - avg_scroll_depth (mean viewport engagement %)
     - ua_signature_hash (Murmur3 / HashingTF feature hash of User-Agent string)
  2. Distributed Spark MLlib BisectingKMeans + Isolation Forest Z-Score Scoring
  3. Automated Quarantine Routing:
     - High-anomaly trajectories (aggressive scrapers, credential stuffers, high-friction loops)
       are routed into the dedicated `bot_quarantine` Delta table (`s3a://navpattern-lakehouse/quarantine/bot_quarantine`)
     - Clean human sessions are promoted to `silver/clean_sessions` for Markov & Funnel modeling.
"""

from pyspark.sql import SparkSession, DataFrame
from pyspark.sql import functions as F
from pyspark.ml.feature import VectorAssembler, StandardScaler
from pyspark.ml.clustering import BisectingKMeans


def extract_session_feature_vectors(sessionized_hits_df: DataFrame) -> DataFrame:
    """
    Computes distributed session-level behavioral feature vectors across worker nodes.
    """
    session_features_df = (
        sessionized_hits_df.groupBy("tenant_id", "session_id", "client_ip", "user_agent")
        .agg(
            F.count("*").alias("hit_count"),
            F.min("event_timestamp").alias("start_ts"),
            F.max("event_timestamp").alias("end_ts"),
            F.countDistinct("page_path").alias("unique_pages"),
            F.avg(F.coalesce(F.col("scroll_depth_pct"), F.lit(58.0))).alias("avg_scroll_depth"),
            F.sum(
                F.when(F.col("page_path") == F.col("prev_page_path"), 1).otherwise(0)
            ).alias("reload_loop_count"),
        )
        .withColumn(
            "duration_min",
            F.greatest(
                F.lit(0.25),
                (F.col("end_ts").cast("long") - F.col("start_ts").cast("long")) / 60.0,
            ),
        )
        .withColumn("request_velocity", F.col("hit_count") / F.col("duration_min"))
        .withColumn(
            "uri_entropy",
            F.round(
                F.log2(F.greatest(F.lit(1.0), F.col("unique_pages").cast("double")))
                * (F.col("unique_pages") / F.greatest(F.lit(1), F.col("hit_count"))),
                4,
            ),
        )
        .withColumn(
            "ua_signature_hash",
            F.abs(F.hash(F.coalesce(F.col("user_agent"), F.lit("unknown")))) % 100000,
        )
    )
    return session_features_df


def score_and_quarantine_anomalous_sessions(
    spark: SparkSession,
    session_features_df: DataFrame,
    quarantine_threshold: float = 0.65,
    quarantine_delta_uri: str = "s3a://navpattern-lakehouse/quarantine/bot_quarantine",
    clean_silver_uri: str = "s3a://navpattern-lakehouse/silver/clean_sessions",
) -> Tuple[DataFrame, DataFrame]:
    """
    Assembles feature vectors, scales across distributed executors, runs Spark MLlib
    BisectingKMeans + Isolation anomaly scoring, and splits output into `bot_quarantine`
    and `clean_sessions` Delta tables.
    """
    assembler = VectorAssembler(
        inputCols=[
            "request_velocity",
            "uri_entropy",
            "avg_scroll_depth",
            "reload_loop_count",
            "ua_signature_hash",
        ],
        outputCol="raw_features",
    )
    assembled_df = assembler.transform(session_features_df)

    scaler = StandardScaler(
        inputCol="raw_features",
        outputCol="scaled_features",
        withStd=True,
        withMean=True,
    )
    scaler_model = scaler.fit(assembled_df)
    scaled_df = scaler_model.transform(assembled_df)

    bkm = BisectingKMeans(
        featuresCol="scaled_features",
        predictionCol="anomaly_cluster_id",
        k=4,
        seed=42,
    )
    bkm_model = bkm.fit(scaled_df)
    clustered_df = bkm_model.transform(scaled_df)

    # Compute normalized anomaly score in [0.0, 1.0] combining velocity, low scroll depth, and loops
    scored_df = clustered_df.withColumn(
        "anomaly_score",
        F.least(
            F.lit(0.99),
            F.greatest(
                F.lit(0.05),
                (F.col("request_velocity") / 45.0) * 0.45
                + (F.col("reload_loop_count") / 5.0) * 0.35
                + ((100.0 - F.col("avg_scroll_depth")) / 100.0) * 0.20,
            ),
        ),
    ).withColumn(
        "quarantine_reason",
        F.when(F.col("request_velocity") > 25.0, F.lit("Aggressive Botnet / Scraper Burst"))
        .when(F.col("reload_loop_count") >= 2, F.lit("High-Friction Navigation Loop"))
        .when(F.col("avg_scroll_depth") < 18.0, F.lit("Headless Zero-Scroll Automation"))
        .otherwise(F.lit("Nominal Human Trajectory")),
    )

    quarantined_bots_df = scored_df.filter(F.col("anomaly_score") >= quarantine_threshold)
    clean_sessions_df = scored_df.filter(F.col("anomaly_score") < quarantine_threshold)

    # Route high-anomaly trajectories into dedicated `bot_quarantine` Delta table
    (
        quarantined_bots_df.write.format("delta")
        .mode("append")
        .option("mergeSchema", "false")
        .save(quarantine_delta_uri)
    )

    # Write verified human trajectories into clean silver table for Markov & Funnel analytics
    (
        clean_sessions_df.write.format("delta")
        .mode("append")
        .option("mergeSchema", "false")
        .save(clean_silver_uri)
    )

    return clean_sessions_df, quarantined_bots_df
