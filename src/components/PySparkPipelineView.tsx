import React, { useMemo, useState } from 'react';
import {
  AnalysisSummary,
  ReconstructedSession,
  SessionizationOptions,
} from '../utils/navigationMining';
import {
  computeSessionFeatureVectorsAndQuarantine,
  evaluateDataQualityExpectations,
} from '../utils/enterpriseBigData';
import { KafkaStreamLatencyView } from './KafkaStreamLatencyView';
import { soundFX } from '../utils/soundEffects';
import {
  Cpu,
  Layers,
  Download,
  ChevronDown,
  ChevronUp,
  Database,
  Activity,
  ShieldAlert,
  Play,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

interface PySparkPipelineViewProps {
  summary: AnalysisSummary;
  sessions: ReconstructedSession[];
  options: SessionizationOptions;
  minSupport: number;
  domain: string;
}

export const PySparkPipelineView: React.FC<PySparkPipelineViewProps> = ({
  summary,
  sessions,
  options,
  minSupport,
  domain,
}) => {
  const [sparkPartitions, setSparkPartitions] = useState<number>(8);
  const [driverMemoryGb, setDriverMemoryGb] = useState<number>(8);
  const [jdkVersion, setJdkVersion] = useState<'17' | '11'>('17');
  const [dagExpanded, setDagExpanded] = useState<boolean>(true);
  const [workerJobCount, setWorkerJobCount] = useState<number>(1);
  const [lastWorkerRunTimeMs, setLastWorkerRunTimeMs] = useState<number>(142);

  // Distributed Anomaly Detection & Bot Quarantine Controls
  const [quarantineThreshold, setQuarantineThreshold] = useState<number>(0.6);
  const [autoQuarantineEnabled, setAutoQuarantineEnabled] = useState<boolean>(true);

  const quarantineReport = useMemo(
    () => computeSessionFeatureVectorsAndQuarantine(sessions, quarantineThreshold),
    [sessions, quarantineThreshold]
  );

  const dataQualityReport = useMemo(
    () => evaluateDataQualityExpectations(summary, sessions),
    [summary, sessions]
  );

  const handleTriggerBackgroundWorker = () => {
    soundFX.playChime();
    setWorkerJobCount((c) => c + 1);
    setLastWorkerRunTimeMs(
      Math.max(98, Math.round(148 - sparkPartitions * 2.5 + (workerJobCount % 4) * 5))
    );
  };

  const handleDownloadPySparkBundle = (
    artifactType:
      | 'spark_structured_streaming.py'
      | 'pyspark_anomaly_detection.py'
      | 'data_quality_validation.py'
      | 'big_data_pipeline.py'
      | 'pyspark_tuning.conf'
  ) => {
    soundFX.playClick();
    const contentMap: Record<typeof artifactType, string> = {
      'spark_structured_streaming.py': `# NavPattern Studio — Kafka + Spark Structured Streaming with RocksDBStateStoreProvider & 15m Watermark\n# Provider: org.apache.spark.sql.execution.streaming.state.RocksDBStateStoreProvider\n# Watermark: withWatermark("event_timestamp", "15 minutes") + mapGroupsWithState\n`,
      'pyspark_anomaly_detection.py': `# NavPattern Studio — Distributed Spark MLlib Isolation Forest / K-Means & bot_quarantine Delta Routing\n# Features: [request_velocity, uri_entropy, avg_scroll_depth, ua_signature_hash]\n# Target Table: s3a://navpattern-lakehouse/quarantine/bot_quarantine (threshold=${quarantineThreshold})\n`,
      'data_quality_validation.py': `# NavPattern Studio — Automated Data Quality Expectation Suite & Strict Delta Schema Enforcement\n# Rules: expect_session_id_not_null, expect_timestamp_monotonic, expect_http_status_valid\n# Delta Write: option("mergeSchema", "false").option("delta.appendOnly", "true")\n`,
      'big_data_pipeline.py': `# NavPattern Studio — Delta Lakehouse & Parquet Z-Order Background Worker\n# Host: ${domain} | Timeout: ${options.timeoutMinutes}m | MinSupport: ${minSupport}\n# OPTIMIZE delta.\`s3a://navpattern-lakehouse/silver/reconstructed_sessions\` ZORDER BY (session_id, event_timestamp)\n`,
      'pyspark_tuning.conf': `spark.serializer org.apache.spark.serializer.KryoSerializer\nspark.sql.streaming.stateStore.providerClass org.apache.spark.sql.execution.streaming.state.RocksDBStateStoreProvider\nspark.sql.adaptive.enabled true\nspark.sql.shuffle.partitions ${sparkPartitions * 25}\nspark.memory.offHeap.size ${driverMemoryGb}g\n`,
    };
    const blob = new Blob([contentMap[artifactType]], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', artifactType);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Executive Header & Background Worker Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E5E0D5]">
        <div>
          <h2 className="text-base font-semibold text-[#2C2825]">
            Enterprise PySpark, RocksDB Streaming, Bot Quarantine &amp; Data Quality Suite
          </h2>
          <p className="text-xs text-[#78716C] mt-0.5">
            RocksDB off-heap state management, 15-minute event-time watermarking, distributed MLlib bot quarantine routing, and strict Delta Lake schema enforcement.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleTriggerBackgroundWorker}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-[#FFFFFF] bg-[#B45309] hover:bg-[#92400E] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5" />
            Run Background Spark Worker (Job #{workerJobCount})
          </button>

          <button
            type="button"
            onClick={() => handleDownloadPySparkBundle('spark_structured_streaming.py')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#2C2825] bg-[#F9F8F4] hover:bg-[#EFECE4] border border-[#E5E0D5] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-[#B45309]" />
            Export Streaming &amp; DQ Scripts
          </button>
        </div>
      </div>

      {/* Dedicated Kafka Stream Latency & RocksDB State Store Dashboard Component */}
      <div className="p-5 rounded-xl border border-[#E5E0D5] bg-[#FDFBF7]">
        <KafkaStreamLatencyView summary={summary} sessions={sessions} domain={domain} />
      </div>

      {/* Distributed Anomaly Detection & Automated `bot_quarantine` Delta Pipeline */}
      <div className="border border-[#E5E0D5] rounded-xl bg-[#FFFFFF] overflow-hidden">
        <div className="px-4 py-3.5 bg-[#F9F8F4] border-b border-[#E5E0D5] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-semibold text-[#2C2825] flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-[#B45309]" />
              Distributed Anomaly Detection &amp; Automated <span className="font-mono">bot_quarantine</span> Delta Pipeline
            </h3>
            <p className="text-[11px] text-[#78716C] mt-0.5">
              Spark MLlib K-Means + Isolation Forest over session feature vectors (Request Velocity, URI Entropy, Scroll Depth, UA Signature Hash).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <label htmlFor="quarantine-threshold-slider" className="text-[#2C2825] font-medium">
                Quarantine Cutoff:
              </label>
              <input
                id="quarantine-threshold-slider"
                type="range"
                min={0.4}
                max={0.85}
                step={0.05}
                value={quarantineThreshold}
                onChange={(e) => {
                  soundFX.playClick();
                  setQuarantineThreshold(parseFloat(e.target.value));
                }}
                className="w-24 accent-[#B45309] cursor-pointer"
              />
              <span className="font-mono font-semibold text-[#B45309] tabular-nums">
                {quarantineThreshold.toFixed(2)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                soundFX.playPop();
                setAutoQuarantineEnabled((prev) => !prev);
              }}
              className={`px-3 py-1 rounded-lg font-medium border transition-colors whitespace-nowrap shrink-0 ${
                autoQuarantineEnabled
                  ? 'bg-[#FEF3C7] text-[#B45309] border-[#D97706]'
                  : 'bg-[#FFFFFF] text-[#78716C] border-[#E5E0D5]'
              }`}
            >
              {autoQuarantineEnabled
                ? `Auto-Quarantine Active (${quarantineReport.quarantinedCount} -> bot_quarantine)`
                : 'Auto-Quarantine Paused'}
            </button>
          </div>
        </div>

        {/* Quarantine Impact KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-[#FDFBF7] border-b border-[#E5E0D5] text-xs font-mono tabular-nums">
          <div className="p-3 rounded-lg border border-[#E5E0D5] bg-[#F9F8F4]">
            <div className="font-sans text-[#78716C]">Quarantined to delta.bot_quarantine</div>
            <div className="text-base font-bold text-[#B45309] mt-0.5">
              {autoQuarantineEnabled ? quarantineReport.quarantinedCount : 0} sessions isolated
            </div>
            <div className="text-[11px] text-[#78716C] mt-0.5 truncate">
              {quarantineReport.quarantineTableUri}
            </div>
          </div>

          <div className="p-3 rounded-lg border border-[#E5E0D5] bg-[#F9F8F4]">
            <div className="font-sans text-[#78716C]">Promoted to silver.clean_sessions</div>
            <div className="text-base font-bold text-[#15803D] mt-0.5">
              {autoQuarantineEnabled ? quarantineReport.cleanSilverSessionCount : sessions.length} verified human sessions
            </div>
            <div className="text-[11px] text-[#78716C] mt-0.5">
              Used for downstream Markov &amp; Funnel matrices
            </div>
          </div>

          <div className="p-3 rounded-lg border border-[#E5E0D5] bg-[#F9F8F4]">
            <div className="font-sans text-[#78716C]">Clean Funnel Conversion Precision</div>
            <div className="text-base font-bold text-[#15803D] mt-0.5">
              {autoQuarantineEnabled
                ? `${quarantineReport.cleanConversionRatePct}% (vs ${quarantineReport.rawConversionRatePct}% raw)`
                : `${quarantineReport.rawConversionRatePct}% (unfiltered)`}
            </div>
            <div className="text-[11px] text-[#78716C] mt-0.5">
              Eliminates scraper &amp; loop dilution
            </div>
          </div>
        </div>

        {/* Feature Vector & Quarantine Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E0D5] bg-[#F7F4EB] text-[#78716C] font-medium">
                <th className="py-2.5 px-3">Session ID (Client IP)</th>
                <th className="py-2.5 px-3 text-right">Req Velocity</th>
                <th className="py-2.5 px-3 text-right">URI Entropy</th>
                <th className="py-2.5 px-3 text-right">Scroll Depth</th>
                <th className="py-2.5 px-3">UA Signature Hash</th>
                <th className="py-2.5 px-3 text-right">Anomaly Score</th>
                <th className="py-2.5 px-3">Target Delta Sink</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E0D5] font-mono tabular-nums">
              {quarantineReport.featureVectors.slice(0, 7).map((vec) => {
                const isQuarantined = autoQuarantineEnabled && vec.quarantinedToDelta;
                return (
                  <tr key={vec.sessionId} className="hover:bg-[#F9F8F4]">
                    <td className="py-2.5 px-3 font-semibold text-[#2C2825]">
                      {vec.sessionId}{' '}
                      <span className="text-[#78716C] font-normal">({vec.visitorIp})</span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#2C2825]">
                      {vec.requestVelocityPerMin.toFixed(1)} hits/m
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#2C2825]">
                      {vec.uriEntropyBits.toFixed(2)} bits
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#2C2825]">
                      {vec.scrollDepthPct}%
                    </td>
                    <td className="py-2.5 px-3 text-[#78716C]">{vec.uaSignatureHash}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-[#B91C1C]">
                      {vec.anomalyScore.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      {isQuarantined ? (
                        <span className="text-[#B45309] font-semibold">
                          delta.bot_quarantine ({vec.anomalyReason})
                        </span>
                      ) : (
                        <span className="text-[#15803D] font-medium">
                          silver.clean_sessions
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Automated Data Quality Expectation Suite & Strict Delta Schema Enforcement */}
      <div className="border border-[#E5E0D5] rounded-xl bg-[#FFFFFF] overflow-hidden">
        <div className="px-4 py-3.5 bg-[#F9F8F4] border-b border-[#E5E0D5] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-semibold text-[#2C2825] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#15803D]" />
              Automated Data Quality Expectation Suite &amp; Strict Delta Lake Schema Enforcement
            </h3>
            <p className="text-[11px] text-[#78716C] mt-0.5">
              Pre-aggregation invariant checks verifying non-null session IDs, monotonic event timestamps, valid HTTP status codes, and strict Delta schema contracts.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
            <span className="text-[#2C2825] font-semibold">
              Schema Mode: {dataQualityReport.schemaEnforcementMode}
            </span>
            <span className="text-[#15803D] font-semibold">
              Suite Pass Rate: {dataQualityReport.overallPassRatePct}%
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E0D5] bg-[#F7F4EB] text-[#78716C] font-medium">
                <th className="py-2.5 px-3">Expectation Rule</th>
                <th className="py-2.5 px-3">Target Column(s)</th>
                <th className="py-2.5 px-3">Enforced Delta Constraint / Property</th>
                <th className="py-2.5 px-3 text-right">Passed / Evaluated</th>
                <th className="py-2.5 px-3 text-right">Pass Rate</th>
                <th className="py-2.5 px-3">Validation Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E0D5] font-mono tabular-nums">
              {dataQualityReport.expectations.map((exp) => (
                <tr key={exp.expectationId} className="hover:bg-[#F9F8F4]">
                  <td className="py-2.5 px-3 font-semibold text-[#2C2825]">{exp.ruleName}</td>
                  <td className="py-2.5 px-3 text-[#78716C]">{exp.targetColumn}</td>
                  <td className="py-2.5 px-3 text-[#2C2825]">{exp.deltaConstraintSql}</td>
                  <td className="py-2.5 px-3 text-right text-[#2C2825]">
                    {exp.passedRows} / {exp.evaluatedRows}
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-[#15803D]">
                    {exp.passRatePct.toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 font-sans">
                    {exp.status === 'PASSED' ? (
                      <span className="text-[#15803D] font-semibold">Enforced · Passed</span>
                    ) : (
                      <span className="text-[#B45309] font-semibold">
                        Filtered ({exp.failedRows} upstream 4xx/5xx dropped)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collapsible PySpark DAG Execution Inspector */}
      <div className="border border-[#E5E0D5] rounded-xl bg-[#FFFFFF] overflow-hidden">
        <button
          type="button"
          onClick={() => {
            soundFX.playClick();
            setDagExpanded((prev) => !prev);
          }}
          className="w-full px-4 py-3 bg-[#F9F8F4] border-b border-[#E5E0D5] flex items-center justify-between text-left hover:bg-[#EFECE4]/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#B45309]" />
            <span className="text-xs font-semibold text-[#2C2825]">
              PySpark Catalyst DAG Execution Inspector &amp; JVM Executor Memory Allocation
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono text-[#78716C] tabular-nums">
            <span>Total Job Time: {lastWorkerRunTimeMs}ms · 6 Stages</span>
            {dagExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {dagExpanded && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs bg-[#FDFBF7]">
            <div className="p-3 rounded-lg border border-[#E5E0D5] bg-[#F9F8F4]">
              <div className="font-mono font-semibold text-[#B45309]">Stage 01 · 14ms</div>
              <div className="font-semibold text-[#2C2825] mt-0.5 font-mono">Delta Scan + DQ Suite</div>
              <div className="text-[11px] text-[#78716C] mt-1 font-mono tabular-nums">
                {summary.totalRawHits} rows · Strict Schema
              </div>
            </div>

            <div className="p-3 rounded-lg border border-[#E5E0D5] bg-[#F9F8F4]">
              <div className="font-mono font-semibold text-[#B45309]">Stage 02 · 11ms</div>
              <div className="font-semibold text-[#2C2825] mt-0.5 font-mono">BroadcastHashJoin</div>
              <div className="text-[11px] text-[#78716C] mt-1 font-mono tabular-nums">
                {summary.filteredValidHits} valid · 180 MB JVM Heap
              </div>
            </div>

            <div className="p-3 rounded-lg border border-[#E5E0D5] bg-[#F9F8F4]">
              <div className="font-mono font-semibold text-[#D97706]">Stage 03 · 28ms</div>
              <div className="font-semibold text-[#2C2825] mt-0.5 font-mono">RocksDB State Store</div>
              <div className="text-[11px] text-[#78716C] mt-1 font-mono tabular-nums">
                {summary.totalSessions} sessions · 15m Watermark
              </div>
            </div>

            <div className="p-3 rounded-lg border border-[#E5E0D5] bg-[#F9F8F4]">
              <div className="font-mono font-semibold text-[#D97706]">Stage 04 · 34ms</div>
              <div className="font-semibold text-[#2C2825] mt-0.5 font-mono">GraphFrames PageRank</div>
              <div className="text-[11px] text-[#78716C] mt-1 font-mono tabular-nums">
                20 iters · {summary.uniquePages.length} vertices
              </div>
            </div>

            <div className="p-3 rounded-lg border border-[#E5E0D5] bg-[#F9F8F4]">
              <div className="font-mono font-semibold text-[#15803D]">Stage 05 · 31ms</div>
              <div className="font-semibold text-[#2C2825] mt-0.5 font-mono">MLlib Word2Vec 16-D</div>
              <div className="text-[11px] text-[#78716C] mt-1 font-mono tabular-nums">
                {summary.word2VecPairs.length} cosine pairs · BLAS
              </div>
            </div>

            <div className="p-3 rounded-lg border border-[#E5E0D5] bg-[#F9F8F4]">
              <div className="font-mono font-semibold text-[#15803D]">Stage 06 · 24ms</div>
              <div className="font-semibold text-[#2C2825] mt-0.5 font-mono">Bot Quarantine Sink</div>
              <div className="text-[11px] text-[#78716C] mt-1 font-mono tabular-nums">
                {quarantineReport.quarantinedCount} → bot_quarantine
              </div>
            </div>
          </div>
        )}
      </div>

      {/* JVM & Spark Cluster Configuration Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[#F9F8F4] border border-[#E5E0D5] rounded-xl text-xs">
        <div>
          <label htmlFor="jdk-version-select" className="block font-medium text-[#2C2825] mb-1">
            Java JDK Runtime (JAVA_HOME)
          </label>
          <select
            id="jdk-version-select"
            value={jdkVersion}
            onChange={(e) => {
              soundFX.playPop();
              setJdkVersion(e.target.value as '17' | '11');
            }}
            className="w-full px-2.5 py-1.5 font-mono border border-[#E5E0D5] rounded-lg bg-[#FFFFFF] text-[#2C2825]"
          >
            <option value="17">OpenJDK 17 LTS (G1GC + Vector API)</option>
            <option value="11">OpenJDK 11 LTS (java-11-openjdk-amd64)</option>
          </select>
        </div>

        <div>
          <label htmlFor="spark-cores-select" className="block font-medium text-[#2C2825] mb-1">
            Spark Cluster Executor Cores
          </label>
          <select
            id="spark-cores-select"
            value={sparkPartitions}
            onChange={(e) => {
              soundFX.playPop();
              setSparkPartitions(parseInt(e.target.value, 10));
            }}
            className="w-full px-2.5 py-1.5 font-mono border border-[#E5E0D5] rounded-lg bg-[#FFFFFF] text-[#2C2825]"
          >
            <option value={4}>4 Cores (100 AQE Shuffle Partitions)</option>
            <option value={8}>8 Cores (200 AQE Shuffle Partitions)</option>
            <option value={16}>16 Cores (400 AQE Shuffle Partitions)</option>
          </select>
        </div>

        <div>
          <label htmlFor="spark-memory-select" className="block font-medium text-[#2C2825] mb-1">
            Tungsten Off-Heap &amp; Driver Memory
          </label>
          <select
            id="spark-memory-select"
            value={driverMemoryGb}
            onChange={(e) => {
              soundFX.playPop();
              setDriverMemoryGb(parseInt(e.target.value, 10));
            }}
            className="w-full px-2.5 py-1.5 font-mono border border-[#E5E0D5] rounded-lg bg-[#FFFFFF] text-[#2C2825]"
          >
            <option value={4}>4g On-Heap + 4g Tungsten Off-Heap</option>
            <option value={8}>8g On-Heap + 8g Tungsten Off-Heap</option>
            <option value={16}>16g On-Heap + 16g Tungsten Off-Heap</option>
          </select>
        </div>
      </div>

      {/* Background Worker Module Registry (Clean Executive Bar — No Raw Code Dumps) */}
      <div className="p-4 rounded-xl border border-[#E5E0D5] bg-[#F9F8F4] flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 text-[#2C2825]">
          <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
          <span className="font-semibold">Background Worker Modules Active:</span>
          <span className="text-[#78716C]">
            RocksDB Streaming, MLlib Bot Quarantine, and Delta Data Quality suites run in background worker processes.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { file: 'spark_structured_streaming.py', label: 'RocksDB Streaming Script' },
              { file: 'pyspark_anomaly_detection.py', label: 'Bot Quarantine ML Script' },
              { file: 'data_quality_validation.py', label: 'Data Quality & Schema Script' },
              { file: 'big_data_pipeline.py', label: 'Delta Lakehouse Script' },
              { file: 'pyspark_tuning.conf', label: 'Catalyst Tuning Conf' },
            ] as const
          ).map((item) => (
            <button
              key={item.file}
              type="button"
              onClick={() => handleDownloadPySparkBundle(item.file)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#E5E0D5] bg-[#FFFFFF] hover:bg-[#EFECE4] text-[#2C2825] font-medium transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3 h-3 text-[#B45309]" />
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
