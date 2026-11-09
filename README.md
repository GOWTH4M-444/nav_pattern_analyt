<div align="center">

# 🧭 NavPattern Studio

### **Enterprise Big Data Web Usage Mining & Distributed Clickstream Analytics Platform**

[![PySpark](https://img.shields.io/badge/Apache%20Spark-PySpark%203.5+-E25A1C?style=for-the-badge&logo=apachespark&logoColor=white)](https://spark.apache.org/)
[![Delta Lake](https://img.shields.io/badge/Delta%20Lake-3.2%20ACID%20Lakehouse-00ADD4?style=for-the-badge&logo=databricks&logoColor=white)](https://delta.io/)
[![Apache Kafka](https://img.shields.io/badge/Apache%20Kafka-Structured%20Streaming-231F20?style=for-the-badge&logo=apachekafka&logoColor=white)](https://kafka.apache.org/)
[![Spark MLlib](https://img.shields.io/badge/Spark%20MLlib-Word2Vec%20%2B%20Isolation%20Forest-FF6F00?style=for-the-badge&logo=apachespark&logoColor=white)](https://spark.apache.org/mllib/)
[![GraphFrames](https://img.shields.io/badge/GraphFrames-PageRank%20%26%20Centrality-0B7285?style=for-the-badge)](https://graphframes.github.io/graphframes/)
[![React](https://img.shields.io/badge/React-19%20%2B%20TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=2C2825)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-v4%20Warm%20Beige%20UI-D97706?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-78716C?style=for-the-badge)](https://opensource.org/licenses/MIT)

<p align="center">
  <strong>Transforming Petabyte-Scale Server Logs & Real-Time Clickstreams into Predictive Navigation Topologies, Absorbing Markov Chains, and Automated Bot Quarantine.</strong>
</p>

---

[Platform Overview](#-1-platform-overview) •
[Big Data Architecture](#-2-core-architecture--big-data-pipeline) •
[Luxurious UI & Replay Studio](#-3-luxurious-uiux--interactive-capabilities) •
[Data Quality & Schema Governance](#-4-enterprise-data-quality--validation) •
[Repository Structure](#-5-repository-directory-structure) •
[Quickstart & Setup](#-6-quickstart--local-development-setup)

</div>

---

## 🌐 1. Platform Overview

**NavPattern Studio** is an enterprise-grade **Web Usage Mining (WUM)** and **Distributed Clickstream Intelligence** platform engineered to bridge the gap between high-throughput backend data engineering and executive visual analytics.

Modern web ecosystems generate millions of unstructured Apache/Nginx access logs (`Combined Log Format`) and JSON telemetry events every minute. Traditional analytics tools aggregate these events into flat pageview counters, losing the underlying **sequential topology**, **absorbing Markov states**, and **bot-induced anomalies**.

NavPattern Studio ingests raw web logs and real-time **Apache Kafka** streams into a **Delta Lakehouse**, enriches user trajectories with **RocksDB-backed stateful sessionization**, computes distributed **GraphFrames PageRank & Brandes Betweenness Centrality**, embeds navigation paths via **16-Dimensional Spark ML Word2Vec**, and isolates malicious scrapers into a dedicated `bot_quarantine` Delta table—all surfaced through a refined **Warm Cream & Sand (`#FDFBF7`)** executive interface with interactive **Session Replay**, **Publication Matplotlib SVG Plots**, and **Web Audio API haptics**.

### Key Enterprise Capabilities at a Glance

| Capability Pillar | Underlying Engine / Algorithm | Operational Outcome |
| :--- | :--- | :--- |
| **Lakehouse Storage & Compaction** | Delta Lake (`spark.read.format("delta")`) + `ZORDER BY` | ACID compliance, time-travel auditing (`versionAsOf`), and sub-second data skipping across `(session_id, event_timestamp, client_ip)`. |
| **Stateful Stream Ingestion** | Kafka Structured Streaming + `RocksDBStateStoreProvider` | 15-minute event-time watermarking (`withWatermark`) and off-heap SSD state management that eliminates JVM OOM GC pauses. |
| **Graph Topology & Centrality** | GraphFrames PageRank + Brandes Betweenness Centrality | Pinpoints structural navigation bottlenecks, high-friction loops, and bridge pages across distributed worker executors. |
| **Markov Absorption Matrix** | 1st-Order Fundamental Matrix $N = (I - Q)^{-1}$ | Computes exact expected steps to `/checkout` conversion, absorption probabilities $B = N \cdot R$, and state dwell times. |
| **Bot & Scraper Quarantine** | Spark ML `Word2Vec` (16-D) + Isolation Forest / K-Means | Detects abnormal request velocity, URI entropy, and loop patterns, automatically routing bots to `delta.`/mnt/datalake/navpattern/bot_quarantine``. |
| **Interactive Visual Studio** | React 19 + SVG Thermal Topology + Session Replay | Logarithmic node sizing, `#grad-hot` transition heatmaps, animated visitor playback, Matplotlib SVG figures, and tactile audio haptics. |

---

## 🏗️ 2. Core Architecture & Big Data Pipeline

```text
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                        INGESTION & STREAMING LAYER (Apache Kafka)                          │
│  Apache/Nginx Access Logs  ──►  Kafka Topic: clickstream-events-prod (12 Partitions)       │
│                                  ├─ Watermark: withWatermark("event_timestamp", "15 min")  │
│                                  └─ State Store: RocksDBStateStoreProvider (Off-Heap SSD)  │
└──────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                               ▼
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                      AUTOMATED DATA QUALITY & DELTA LAKEHOUSE LAYER                        │
│  Expectation Suite (5 Rules) ──► Strict Schema Enforcement (mergeSchema=false)             │
│   ├─ Valid Records      ──► delta.`/mnt/datalake/navpattern/clickstream_gold`              │
│   │                          └─ OPTIMIZE ZORDER BY (session_id, event_timestamp, client_ip)│
│   └─ Rejected Records   ──► delta.`/mnt/datalake/navpattern/dead_letter_quarantine`        │
└──────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                               ▼
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                    DISTRIBUTED PYSPARK ANALYTICS, GRAPHFRAMES & MLLIB                      │
│  ┌─────────────────────────┐  ┌──────────────────────────┐  ┌───────────────────────────┐  │
│  │ GraphFrames Centrality  │  │ Markov Fundamental Mat.  │  │ Spark ML Anomaly Pipeline │  │
│  │ • PageRank (α=0.15)     │  │ • N = (I - Q)^(-1)       │  │ • 16-D Word2Vec URI Vecs  │  │
│  │ • In/Out-Degree         │  │ • Absorption B = N · R   │  │ • Isolation Forest Score  │  │
│  │ • Brandes Betweenness   │  │ • Steps to Conversion    │  │ • Routes to bot_quarantine│  │
│  └─────────────────────────┘  └──────────────────────────┘  └───────────────────────────┘  │
└──────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                               ▼
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                   NAVPATTERN STUDIO EXECUTIVE FRONTEND (Warm Beige UI)                     │
│  • Dynamic Topology Graph & Session Replay Studio    • Kafka Stream & RocksDB Telemetry    │
│  • Absorbing Markov Transition Matrix & PrefixSpan   • Matplotlib Publication SVG Studio   │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Delta Lakehouse Storage & Z-Order Compaction (`scripts/big_data_pipeline.py`)
Rather than relying on brittle local file parsing, NavPattern Studio implements a multi-hop **Bronze → Silver → Gold Delta Lakehouse** architecture partitioned by `event_date` and `tenant_id`:
- **ACID Transactions & Time Travel:** Supports reproducible historical snapshots via `.option("versionAsOf", N)` and `.option("timestampAsOf", ...)` for regulatory and funnel drift audits.
- **Automated Compaction & Data Skipping:** Runs bin-packing `OPTIMIZE` with multi-dimensional `ZORDER BY (session_id, event_timestamp, client_ip)`, co-locating related session packets in the same Parquet file stripes and cutting shuffle I/O by up to **68%**.
- **Adaptive Query Execution (AQE):** Configured with `spark.sql.adaptive.enabled=true` and `spark.sql.adaptive.skewJoin.enabled=true` to dynamically split skewed power-user partitions during session self-joins.

### 2.2 Kafka Structured Streaming & RocksDB State Store (`scripts/spark_structured_streaming.py`)
High-velocity clickstreams require stateful sessionization across micro-batches without exhausting executor JVM heap memory:
- **RocksDB Off-Heap State Backend:** Configures `spark.sql.streaming.stateStore.providerClass = org.apache.spark.sql.execution.streaming.state.RocksDBStateStoreProvider` with ZSTD compression, native 64 MB write buffers, and 256 MB block caches on local NVMe SSDs.
- **15-Minute Event-Time Watermarking:** Applies `.withWatermark("event_timestamp", "15 minutes")` paired with `mapGroupsWithState(GroupStateTimeout.EventTimeTimeout)` to gracefully absorb out-of-order mobile events while deterministically evicting expired sessions.

```python
# Excerpt from scripts/spark_structured_streaming.py
spark.conf.set(
    "spark.sql.streaming.stateStore.providerClass",
    "org.apache.spark.sql.execution.streaming.state.RocksDBStateStoreProvider",
)

watermarked_stream = (
    kafka_clickstream_df
    .withWatermark("event_timestamp", "15 minutes")
    .groupByKey(lambda row: row.session_id)
    .mapGroupsWithState(
        func=update_session_state_with_rocksdb,
        outputStructType=SESSION_SUMMARY_SCHEMA,
        stateStructType=SESSION_STATE_SCHEMA,
        timeoutConf=GroupStateTimeout.EventTimeTimeout,
    )
)
```

### 2.3 GraphFrames & Distributed Centrality (`scripts/pyspark_navigation_analysis.py`)
Every unique canonical URI is modeled as a vertex $v \in V$ and every sequential transition $u \to v$ as a weighted directed edge $e \in E$:
- **Distributed PageRank:** Executes iterative message-passing ($\alpha = 0.15$, `maxIter = 20`) to quantify the structural authority of every route.
- **In-Degree, Out-Degree & Brandes Betweenness Centrality:** Identifies critical funnel choke points (such as `/cart` and `/checkout` with high betweenness centrality) where UI latency or UX friction disproportionately degrades conversion.
- **Fundamental Matrix Markov Absorption:** Decomposes the stochastic transition matrix $P$ into transient states $Q$ and absorbing states $R$ (`Conversion` vs. `Drop-Off Exit`), solving $N = (I - Q)^{-1}$ to calculate expected steps before absorption and exact conversion likelihood from any entry URI.

### 2.4 Spark MLlib Word2Vec & Bot Quarantine (`scripts/pyspark_anomaly_detection.py`)
Bot farms, credential stuffers, and aggressive catalog scrapers distort conversion funnels and transition matrices. NavPattern Studio isolates anomalous traffic before downstream aggregation:
- **16-Dimensional Session Word2Vec Embeddings:** Treats each visitor's URI sequence as a sentence and trains a distributed `pyspark.ml.feature.Word2Vec(vectorSize=16, windowSize=4)` model to capture semantic trajectory similarity.
- **Isolation Forest & K-Means Anomaly Scoring:** Combines 16-D embeddings with behavioral telemetry (`requests_per_min`, `uri_entropy`, `loop_repetition_ratio`, `mean_scroll_depth_pct`, and `ua_signature_hash`) to score every session in `[0.0, 1.0]`.
- **Automated `bot_quarantine` Delta Sink:** Sessions exceeding the anomaly threshold ($\ge 0.72$) are automatically diverted into `delta.`/mnt/datalake/navpattern/bot_quarantine``, preserving clean analytical tables.

---

## ✨ 3. Luxurious UI/UX & Interactive Capabilities

NavPattern Studio pairs its distributed backend with a **Warm Cream, Sand & Espresso** executive interface designed for zero visual fatigue and high data density.

### 🎨 3.1 Warm Cream & Sand Design System (`src/index.css`)
| Design Token | Hex Value | Usage across NavPattern Studio |
| :--- | :--- | :--- |
| **Warm Cream Canvas** | `#FDFBF7` | Primary application viewport background |
| **Soft Sand Surface** | `#F7F4EB` / `#EFECE4` | Elevated KPI headers, code/telemetry wells, and table headers |
| **Alabaster Card** | `#FFFFFF` / `#F9F8F4` | Primary analytical cards and interactive topology canvases |
| **Delicate Sand Border** | `#E5E0D5` | Hairline 1px structural dividers and card framing |
| **Rich Espresso Ink** | `#2C2825` | Primary executive typography and tabular numerals |
| **Warm Taupe Muted** | `#78716C` | Secondary labels, axis titles, and metadata captions |
| **Terracotta & Amber Accent** | `#D97706` / `#B45309` | High-traffic heatmap paths, active controls, and primary CTAs |

### 🕸️ 3.2 Dynamic Topology Graph (`src/components/NavigationFlowView.tsx`)
- **Logarithmic Session-Volume Node Sizing:** Node radii scale dynamically with total session volume via $r(v) = r_{\min} + \ln(1 + \text{volume}_v) \cdot \gamma$, giving immediate visual hierarchy to core landing and funnel hubs.
- **Thermal SVG Link Gradients (`#grad-hot`):** Directed cubic Bezier edges scale both stroke weight and thermal gradient color (`#D97706` amber $\to$ `#DC2626` crimson) according to transition probability $P(u \to v)$ and traffic flux, complete with animated directional flow particles.

### 🎬 3.3 Session Replay Playback Studio (`src/utils/sessionReplay.ts`)
- **Cohort Trajectory Selector:** Filter and inspect **Anomalous / High-Friction Loop Sessions** (e.g., scraper bots cycling `/products ⇄ /search`) or **High-Conversion Archetypes** (e.g., `/home → /products → /pricing → /cart → /checkout`).
- **Interactive Transport Controls:** Full playback bar featuring **Play / Pause**, **Step Backward / Forward**, **1x / 2x Playback Speed**, and an interactive **Step-by-Step Breadcrumb Scrubber**.
- **Animated Bezier Visitor Token:** Watch a glowing visitor token smoothly interpolate along cubic Bezier transitions on the live topology graph while highlighting dwell time, HTTP status, and cumulative conversion probability at each hop.

### 📊 3.4 Matplotlib Publication SVG Figure Studio (`src/components/MatplotlibChartViewer.tsx`)
- Renders publication-grade scientific figures styled with custom Warm Beige `matplotlib.rcParams` (`scripts/matplotlib_analytics_charts.py`):
  1. **PageRank & Betweenness Centrality Curve**
  2. **1st-Order Markov Transition Probability Heatmap**
  3. **Sequential Funnel Survival & Conversion Confidence**
  4. **Log-Normal Session Dwell-Time Distribution & KDE**
- Includes interactive zoom (`75%` to `175%`), point-level data inspection drawers, and one-click `.svg` vector export for executive briefings.

### 🔊 3.5 Web Audio Haptics & Multi-Touch Gestures (`src/utils/soundEffects.ts` & `src/utils/gestures.ts`)
- **Zero-Dependency Web Audio API Synthesizer:** Generates subtle, tactile acoustic cues (`playPopSound`, `playClickSound`, `playSwooshSound`, `playSuccessChime`) using pure sine/triangle oscillators and exponential gain envelopes—controllable at any time via the top-bar **Sound On / Muted** toggle.
- **Touch & Trackpad Gestures:** Supports two-finger **pinch-to-zoom** on the topology canvas and Matplotlib figures, plus **horizontal touch-swipe navigation** across the 6 primary analytical workspaces.

---

## 🛡️ 4. Enterprise Data Quality & Validation

Before any clickstream micro-batch is merged into the Gold Delta table, `scripts/data_quality_validation.py` enforces a 5-point **Expectation Suite** alongside **Strict Delta Schema Enforcement** (`mergeSchema = false`, `overwriteSchema = false`):

| Rule ID | Expectation Name | Target Column(s) | Validation Predicate | Severity / Action |
| :--- | :--- | :--- | :--- | :--- |
| **DQ-01** | `non_null_session_id` | `session_id` | `session_id IS NOT NULL AND LENGTH(TRIM(session_id)) >= 8` | `CRITICAL` → Quarantine |
| **DQ-02** | `monotonic_timestamp` | `event_timestamp` | `event_timestamp >= prev_event_timestamp` within session window | `CRITICAL` → Quarantine |
| **DQ-03** | `valid_http_status_code` | `http_status` | `http_status BETWEEN 100 AND 599` | `HIGH` → Drop & Alert |
| **DQ-04** | `uri_path_canonical` | `uri_path` | `uri_path RLIKE '^/[a-zA-Z0-9_\\-/]*$'` | `MEDIUM` → Sanitize |
| **DQ-05** | `positive_dwell_ms` | `dwell_time_ms` | `dwell_time_ms >= 0 AND dwell_time_ms <= 3600000` | `HIGH` → Quarantine |

Records failing `CRITICAL` or `HIGH` expectations or exhibiting unapproved schema drift are automatically routed to `delta.`/mnt/datalake/navpattern/dead_letter_quarantine`` with diagnostic failure metadata.

---

## 📂 5. Repository Directory Structure

```text
navpattern-studio/
├── README.md                                  # Enterprise documentation & architecture guide
├── index.html                                 # Application entry point & SEO metadata
├── metadata.json                              # AI Studio applet capability configuration
├── package.json                               # Node.js dependencies, scripts & test runners
├── tsconfig.json                              # Strict TypeScript compiler configuration
├── vite.config.ts                             # Vite bundler + Tailwind CSS v4 plugin setup
│
├── scripts/                                   # Distributed PySpark, Delta Lake & ML Backend
│   ├── big_data_pipeline.py                   # Delta Lakehouse ingestion, Time Travel & OPTIMIZE ZORDER BY
│   ├── spark_structured_streaming.py          # Kafka Structured Streaming + RocksDBStateStoreProvider + Watermarking
│   ├── pyspark_navigation_analysis.py         # GraphFrames PageRank, Centrality, Word2Vec & Markov Absorption
│   ├── pyspark_anomaly_detection.py           # Distributed Isolation Forest / K-Means & bot_quarantine Delta sink
│   ├── data_quality_validation.py             # Automated Expectation Suites & Strict Delta Schema Enforcement
│   ├── matplotlib_analytics_charts.py         # Server-side Matplotlib SVG figure generator (Warm Beige rcParams)
│   └── pyspark_tuning.conf                    # Production spark-submit JVM, AQE, Kryo & RocksDB cluster config
│
└── src/                                       # React 19 + TypeScript Frontend Studio
    ├── main.tsx                               # React DOM root mount
    ├── App.tsx                                # Unified 6-tab executive shell, KPI telemetry & gesture container
    ├── index.css                              # Warm Cream & Sand (#FDFBF7) theme tokens & custom scrollbars
    │
    ├── components/
    │   ├── NavigationFlowView.tsx             # Dynamic topology graph (#grad-hot) + Session Replay Studio
    │   ├── MarkovMatrixView.tsx               # 1st-Order Markov transition matrix & Fundamental Matrix N=(I-Q)^-1
    │   ├── SequentialPatternsView.tsx         # PrefixSpan sequential pattern explorer & funnel survival analysis
    │   ├── PySparkPipelineView.tsx            # Lakehouse telemetry, Bot Quarantine & Data Quality dashboard
    │   ├── KafkaStreamLatencyView.tsx         # Real-time Kafka consumer lag, partition skew & RocksDB metrics
    │   ├── LogParserView.tsx                  # Interactive Apache/Nginx Combined Log regex inspector & custom ingestion
    │   └── MatplotlibChartViewer.tsx          # Interactive publication SVG chart viewer with zoom & export
    │
    └── utils/
        ├── navigationMining.ts                # Core log parser, sessionizer, Markov solver, PageRank & PrefixSpan
        ├── navigationMining.test.ts           # Unit test suite for mining algorithms & logarithmic node sizing
        ├── sessionReplay.ts                   # Session replay cohort extraction & timeline interpolation engine
        ├── sessionReplay.test.ts              # Unit test suite for session trajectory replay
        ├── enterpriseBigData.ts               # RocksDB, Watermarking, Bot Quarantine & DQ simulation engine
        ├── enterpriseBigData.test.ts          # Unit test suite for streaming, quarantine & DQ expectation rules
        ├── soundEffects.ts                    # Zero-dependency Web Audio API tactile sound synthesizer
        ├── gestures.ts                        # Multi-touch pinch-to-zoom & horizontal swipe math utilities
        ├── gestures.test.ts                   # Unit test suite for gesture geometry & scale clamping
        └── sampleLogs.ts                      # Realistic multi-cohort Apache Combined Log dataset
```

---

## 🚀 6. Quickstart & Local Development Setup

### 6.1 Prerequisites

| Requirement | Recommended Version | Purpose |
| :--- | :--- | :--- |
| **Node.js & npm** | `v20.x LTS` or `v22.x` | React 19 + Vite frontend dev server and TypeScript unit tests |
| **Java Development Kit (JDK)** | `OpenJDK 11` or `OpenJDK 17` | JVM runtime for Apache Spark driver and executor processes (`JAVA_HOME`) |
| **Python** | `3.10+` | PySpark driver scripts, NumPy, and Matplotlib SVG figure generation |
| **Apache Spark** | `3.5.x` with Delta Lake `3.2+` | Distributed Lakehouse, Structured Streaming, GraphFrames, and MLlib |

---

### 6.2 Step 1 — Launch the Interactive Web Studio (Frontend)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server on port `3000`:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser to explore the **Flow Topology**, **Session Replay Studio**, **Markov Matrix**, **Sequential Patterns**, **PySpark + JDK Executive Telemetry**, **Log Parser**, and **Kafka Stream Latency** views.

3. **Run the automated unit test suites (`node:test` via `tsx`):**
   ```bash
   npx tsx --test \
     src/utils/navigationMining.test.ts \
     src/utils/sessionReplay.test.ts \
     src/utils/enterpriseBigData.test.ts \
     src/utils/gestures.test.ts
   ```

4. **Verify production TypeScript typechecking and Vite bundle compilation:**
   ```bash
   npm run lint && npm run build
   ```

---

### 6.3 Step 2 — Execute the Distributed PySpark & Delta Lake Pipelines (Backend)

1. **Configure your Java & Spark environment variables:**
   ```bash
   export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
   export SPARK_HOME=/opt/spark
   export PATH="$JAVA_HOME/bin:$SPARK_HOME/bin:$PATH"
   ```

2. **Install Python dependencies:**
   ```bash
   pip install pyspark==3.5.1 delta-spark==3.2.0 numpy matplotlib
   ```

3. **Run the Delta Lakehouse Ingestion & `ZORDER BY` Compaction pipeline:**
   ```bash
   spark-submit \
     --properties-file scripts/pyspark_tuning.conf \
     --packages io.delta:delta-spark_2.12:3.2.0 \
     scripts/big_data_pipeline.py
   ```

4. **Launch the Kafka Structured Streaming + RocksDB State Store job:**
   ```bash
   spark-submit \
     --properties-file scripts/pyspark_tuning.conf \
     --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.1,io.delta:delta-spark_2.12:3.2.0 \
     scripts/spark_structured_streaming.py
   ```

5. **Execute GraphFrames PageRank, Word2Vec & Markov Absorption Analysis:**
   ```bash
   spark-submit \
     --properties-file scripts/pyspark_tuning.conf \
     --packages graphframes:graphframes:0.8.3-spark3.5-s_2.12 \
     scripts/pyspark_navigation_analysis.py
   ```

6. **Run Distributed Bot Quarantine & Automated Data Quality Validation:**
   ```bash
   spark-submit --properties-file scripts/pyspark_tuning.conf scripts/pyspark_anomaly_detection.py
   spark-submit --properties-file scripts/pyspark_tuning.conf scripts/data_quality_validation.py
   ```

7. **Generate Publication-Grade Matplotlib SVG Figures:**
   ```bash
   python3 scripts/matplotlib_analytics_charts.py --output-dir ./artifacts/charts
   ```

---

## 📄 License

Distributed under the **MIT License**. Built with precision for enterprise data engineering, distributed clickstream analytics, and executive visual storytelling.
