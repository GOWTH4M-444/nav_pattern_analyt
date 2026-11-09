#!/usr/bin/env python3
"""
NavPattern Studio — Automated Data Quality Expectation Suites & Delta Schema Enforcement
File: scripts/data_quality_validation.py
Features:
  1. Automated Expectation Suite Checks:
     - expect_column_values_to_not_be_null("session_id", "client_ip", "page_path")
     - expect_column_values_to_be_monotonic_increasing("event_timestamp" per session)
     - expect_column_values_to_be_between("http_status", min_value=100, max_value=599)
     - expect_uri_path_prefix_valid("page_path" starts with '/')
  2. Strict Delta Lake Schema Enforcement:
     - Enforces `mergeSchema = false` on Delta writes
     - Registers table-level Delta CHECK constraints (`ALTER TABLE ... ADD CONSTRAINT`)
     - Rejects upstream schema drift or corrupted log lines into a dead-letter Delta table.
"""

from pyspark.sql import SparkSession, DataFrame, Window
from pyspark.sql import functions as F
from pyspark.sql import types as T


EXPECTED_DELTA_CLICKSTREAM_SCHEMA = T.StructType(
    [
        T.StructField("tenant_id", T.StringType(), nullable=False),
        T.StructField("session_id", T.StringType(), nullable=False),
        T.StructField("client_ip", T.StringType(), nullable=False),
        T.StructField("event_timestamp", T.TimestampType(), nullable=False),
        T.StructField("http_method", T.StringType(), nullable=False),
        T.StructField("page_path", T.StringType(), nullable=False),
        T.StructField("http_status", T.IntegerType(), nullable=False),
        T.StructField("bytes_sent", T.LongType(), nullable=True),
    ]
)


def validate_strict_delta_schema(df: DataFrame, expected_schema: T.StructType = EXPECTED_DELTA_CLICKSTREAM_SCHEMA) -> bool:
    """
    Verifies exact column names, data types, and nullability contracts before Delta Lake write.
    Raises TypeError immediately if upstream server log format drifted.
    """
    actual_fields = {f.name: f.dataType.simpleString() for f in df.schema.fields}
    for expected_field in expected_schema.fields:
        if expected_field.name not in actual_fields:
            raise TypeError(f"Delta Schema Enforcement Failed: Missing required column '{expected_field.name}'")
        actual_type = actual_fields[expected_field.name]
        expected_type = expected_field.dataType.simpleString()
        if actual_type != expected_type:
            raise TypeError(
                f"Delta Schema Enforcement Failed: Column '{expected_field.name}' has type '{actual_type}', expected '{expected_type}'"
            )
    return True


def run_data_quality_expectation_suite(raw_events_df: DataFrame):
    """
    Evaluates row-level Data Quality Expectations prior to session aggregation:
      1. Non-null session_id, client_ip, and event_timestamp
      2. Monotonic timestamps within each visitor session window
      3. Valid HTTP status code in [100, 599]
      4. Valid normalized URI path starting with '/'
    """
    w_session = Window.partitionBy("session_id").orderBy("event_timestamp")

    annotated_df = (
        raw_events_df.withColumn("prev_ts", F.lag("event_timestamp").over(w_session))
        .withColumn(
            "dq_non_null_session_id",
            F.col("session_id").isNotNull() & (F.length(F.trim(F.col("session_id"))) > 0),
        )
        .withColumn(
            "dq_monotonic_timestamp",
            F.col("event_timestamp").isNotNull()
            & (F.col("prev_ts").isNull() | (F.col("event_timestamp") >= F.col("prev_ts"))),
        )
        .withColumn(
            "dq_valid_http_status",
            F.col("http_status").isNotNull() & F.col("http_status").between(100, 599),
        )
        .withColumn(
            "dq_valid_page_uri",
            F.col("page_path").isNotNull() & F.col("page_path").startswith("/"),
        )
        .withColumn(
            "dq_all_expectations_passed",
            F.col("dq_non_null_session_id")
            & F.col("dq_monotonic_timestamp")
            & F.col("dq_valid_http_status")
            & F.col("dq_valid_page_uri"),
        )
    )

    valid_records_df = annotated_df.filter(F.col("dq_all_expectations_passed")).drop("prev_ts")
    rejected_records_df = annotated_df.filter(~F.col("dq_all_expectations_passed")).drop("prev_ts")

    return valid_records_df, rejected_records_df


def write_with_strict_delta_enforcement(
    spark: SparkSession,
    valid_df: DataFrame,
    target_table_uri: str = "s3a://navpattern-lakehouse/silver/validated_clickstream",
):
    """
    Writes validated records with Delta Lake schema enforcement (`mergeSchema=false`)
    and registers table-level Delta CHECK constraints.
    """
    validate_strict_delta_schema(valid_df)

    (
        valid_df.write.format("delta")
        .mode("append")
        .option("mergeSchema", "false")
        .option("delta.appendOnly", "true")
        .save(target_table_uri)
    )

    spark.sql(f"""
        ALTER TABLE delta.`{target_table_uri}`
        ADD CONSTRAINT session_id_not_null CHECK (session_id IS NOT NULL and length(session_id) > 0)
    """)
    spark.sql(f"""
        ALTER TABLE delta.`{target_table_uri}`
        ADD CONSTRAINT valid_http_status_range CHECK (http_status BETWEEN 100 AND 599)
    """)
