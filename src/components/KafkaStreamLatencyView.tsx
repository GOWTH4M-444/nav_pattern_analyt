import React, { useMemo, useState } from 'react';
import { AnalysisSummary, ReconstructedSession } from '../utils/navigationMining';
import { computeRocksDbStateMetrics } from '../utils/enterpriseBigData';
import { soundFX } from '../utils/soundEffects';
import {
  Activity,
  Cpu,
  RefreshCw,
  Layers,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
} from 'lucide-react';

interface KafkaStreamLatencyViewProps {
  summary: AnalysisSummary;
  sessions: ReconstructedSession[];
  domain: string;
}

interface PartitionTelemetry {
  partitionId: number;
  brokerNode: string;
  currentOffset: number;
  endOffset: number;
  consumerLag: number;
  throughputEventsSec: number;
  p99LatencyMs: number;
  activeSessionsInState: number;
  skewStatus: 'Balanced' | 'High Traffic' | 'Rebalancing';
}

export const KafkaStreamLatencyView: React.FC<KafkaStreamLatencyViewProps> = ({
  summary,
  sessions,
  domain,
}) => {
  const [selectedConsumerGroup, setSelectedConsumerGroup] = useState<
    'cg-spark-stateful-sessionizer' | 'cg-delta-bronze-ingestor' | 'cg-isolation-forest-scorer'
  >('cg-spark-stateful-sessionizer');
  const [batchIntervalSec, setBatchIntervalSec] = useState<2 | 5 | 10>(5);
  const [watermarkMinutes, setWatermarkMinutes] = useState<10 | 15 | 30>(15);
  const [rebalanceTick, setRebalanceTick] = useState<number>(0);

  const rocksDbMetrics = useMemo(
    () => computeRocksDbStateMetrics(summary, sessions, watermarkMinutes, rebalanceTick),
    [summary, sessions, watermarkMinutes, rebalanceTick]
  );

  // Derive deterministic partition metrics from the active dataset & consumer group
  const partitionMetrics: PartitionTelemetry[] = useMemo(() => {
    const baseHits = summary.totalRawHits * 120;
    const groupMultiplier =
      selectedConsumerGroup === 'cg-spark-stateful-sessionizer'
        ? 1.0
        : selectedConsumerGroup === 'cg-delta-bronze-ingestor'
        ? 0.65
        : 1.35;

    return Array.from({ length: 8 }, (_, idx) => {
      const share = idx === 2 ? 0.19 : idx === 5 ? 0.16 : 0.108;
      const partOffset = Math.round(baseHits * share) + idx * 1420 + rebalanceTick * 85;
      const baseLag =
        rebalanceTick % 2 === 1
          ? Math.round((18 + (idx % 3) * 11) * groupMultiplier)
          : Math.round(((idx === 2 ? 145 : 32 + idx * 9) * groupMultiplier) / (batchIntervalSec / 5));

      const throughput = Math.round((420 + idx * 55 + (idx === 2 ? 190 : 0)) / (batchIntervalSec / 5));
      const p99Latency = Math.round(14 + (baseLag / 12) + (idx === 2 ? 9 : 2));
      const activeSess = Math.max(2, Math.round((sessions.length / 8) * (idx === 2 ? 1.4 : 0.95)));

      return {
        partitionId: idx,
        brokerNode: `kafka-broker-0${(idx % 3) + 1}.prod:9092`,
        currentOffset: partOffset - baseLag,
        endOffset: partOffset,
        consumerLag: baseLag,
        throughputEventsSec: throughput,
        p99LatencyMs: p99Latency,
        activeSessionsInState: activeSess,
        skewStatus: baseLag > 110 ? 'High Traffic' : 'Balanced',
      };
    });
  }, [summary.totalRawHits, sessions.length, selectedConsumerGroup, batchIntervalSec, rebalanceTick]);

  const totalLag = useMemo(
    () => partitionMetrics.reduce((acc, p) => acc + p.consumerLag, 0),
    [partitionMetrics]
  );
  const totalThroughput = useMemo(
    () => partitionMetrics.reduce((acc, p) => acc + p.throughputEventsSec, 0),
    [partitionMetrics]
  );
  const avgP99Latency = useMemo(
    () =>
      Math.round(
        partitionMetrics.reduce((acc, p) => acc + p.p99LatencyMs, 0) / partitionMetrics.length
      ),
    [partitionMetrics]
  );

  // Micro-batch latency timeline history (last 10 batches)
  const microBatchTimeline = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => {
      const batchId = 1040 + i + rebalanceTick;
      const procTimeMs = Math.round(avgP99Latency * (0.85 + ((i * 7) % 5) * 0.08));
      const records = Math.round(totalThroughput * batchIntervalSec * (0.9 + ((i * 3) % 4) * 0.05));
      return { batchId, procTimeMs, records };
    });
  }, [avgP99Latency, totalThroughput, batchIntervalSec, rebalanceTick]);

  return (
    <div className="space-y-6">
      {/* Header & Consumer Group Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E5E0D5]">
        <div>
          <h2 className="text-base font-semibold text-[#2C2825]">
            Kafka Stream Latency, RocksDB State Store &amp; Watermark Tuning
          </h2>
          <p className="text-xs text-[#78716C] mt-0.5">
            Real-time telemetry for topic <span className="font-mono text-[#2C2825]">web-clickstream-access-logs</span> ({domain}) with <span className="font-mono text-[#2C2825]">RocksDBStateStoreProvider</span> and <span className="font-mono text-[#2C2825]">withWatermark(&quot;event_timestamp&quot;, &quot;{watermarkMinutes} minutes&quot;)</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Select Kafka Consumer Group"
            value={selectedConsumerGroup}
            onChange={(e) => {
              soundFX.playPop();
              setSelectedConsumerGroup(e.target.value as typeof selectedConsumerGroup);
            }}
            className="px-3 py-1.5 text-xs font-mono border border-[#E5E0D5] rounded-lg bg-[#FFFFFF] text-[#2C2825]"
          >
            <option value="cg-spark-stateful-sessionizer">Group: cg-spark-stateful-sessionizer</option>
            <option value="cg-delta-bronze-ingestor">Group: cg-delta-bronze-ingestor</option>
            <option value="cg-isolation-forest-scorer">Group: cg-isolation-forest-scorer</option>
          </select>

          {/* Event-Time Watermark Delay Selector */}
          <div className="flex items-center gap-1 p-1 bg-[#EFECE4] rounded-lg border border-[#E5E0D5]">
            {([10, 15, 30] as const).map((min) => (
              <button
                key={min}
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  setWatermarkMinutes(min);
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  watermarkMinutes === min
                    ? 'bg-[#FFFFFF] text-[#2C2825] shadow-xs font-semibold'
                    : 'text-[#78716C] hover:text-[#2C2825]'
                }`}
              >
                {min}m Watermark
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#EFECE4] rounded-lg border border-[#E5E0D5]">
            {([2, 5, 10] as const).map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  setBatchIntervalSec(sec);
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  batchIntervalSec === sec
                    ? 'bg-[#FFFFFF] text-[#2C2825] shadow-xs font-semibold'
                    : 'text-[#78716C] hover:text-[#2C2825]'
                }`}
              >
                {sec}s Trigger
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              soundFX.playChime();
              setRebalanceTick((t) => t + 1);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-[#FFFFFF] bg-[#B45309] hover:bg-[#92400E] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Trigger Partition Rebalance
          </button>
        </div>
      </div>

      {/* 4-Column Streaming KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-[#E5E0D5] bg-[#F9F8F4]">
          <div className="flex items-center justify-between text-xs text-[#78716C]">
            <span>Total Consumer Group Lag</span>
            <Activity className="w-3.5 h-3.5 text-[#D97706]" />
          </div>
          <div className="text-xl font-mono font-bold text-[#2C2825] tabular-nums mt-1">
            {totalLag.toLocaleString()} msgs
          </div>
          <div className="text-[11px] font-mono text-[#78716C] mt-0.5">
            Across 8 Kafka topic partitions
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[#E5E0D5] bg-[#F9F8F4]">
          <div className="flex items-center justify-between text-xs text-[#78716C]">
            <span>Ingestion Throughput</span>
            <Cpu className="w-3.5 h-3.5 text-[#15803D]" />
          </div>
          <div className="text-xl font-mono font-bold text-[#15803D] tabular-nums mt-1">
            {totalThroughput.toLocaleString()} ev/s
          </div>
          <div className="text-[11px] font-mono text-[#78716C] mt-0.5">
            MaxOffsetsPerTrigger: 250,000
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[#E5E0D5] bg-[#F9F8F4]">
          <div className="flex items-center justify-between text-xs text-[#78716C]">
            <span>Micro-Batch p99 Latency</span>
            <Layers className="w-3.5 h-3.5 text-[#B45309]" />
          </div>
          <div className="text-xl font-mono font-bold text-[#2C2825] tabular-nums mt-1">
            {avgP99Latency} ms
          </div>
          <div className="text-[11px] font-mono text-[#78716C] mt-0.5">
            Trigger interval: {batchIntervalSec}.0s
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[#E5E0D5] bg-[#F9F8F4]">
          <div className="flex items-center justify-between text-xs text-[#78716C]">
            <span>RocksDB State Store Keys</span>
            <HardDrive className="w-3.5 h-3.5 text-[#15803D]" />
          </div>
          <div className="text-xl font-mono font-bold text-[#2C2825] tabular-nums mt-1">
            {rocksDbMetrics.activeStateKeys} active · {rocksDbMetrics.evictedExpiredSessionKeys} evicted
          </div>
          <div className="text-[11px] font-mono text-[#78716C] mt-0.5">
            SSD Off-Heap: {rocksDbMetrics.rocksDbSsdFootprintMb} MB ({rocksDbMetrics.jvmHeapSavedMb} MB JVM saved)
          </div>
        </div>
      </div>

      {/* RocksDB State Backend & Watermark Eviction Telemetry Bar */}
      <div className="p-3.5 rounded-xl border border-[#E5E0D5] bg-[#F7F4EB] flex flex-wrap items-center justify-between gap-4 text-xs font-mono tabular-nums">
        <div className="text-[#2C2825]">
          <span className="font-semibold text-[#B45309]">State Backend:</span>{' '}
          <span>{rocksDbMetrics.providerClass}</span>
        </div>
        <div className="flex flex-wrap items-center gap-5 text-[#78716C]">
          <span>
            Watermark: <strong className="text-[#2C2825]">{rocksDbMetrics.watermarkDelayMinutes} minutes</strong>
          </span>
          <span>
            Block Cache Hit: <strong className="text-[#15803D]">{rocksDbMetrics.blockCacheHitRatePct}%</strong>
          </span>
          <span>
            Late Events Dropped: <strong className="text-[#B45309]">{rocksDbMetrics.lateEventsDroppedByWatermark}</strong>
          </span>
          <span>
            Changelog Checkpointing: <strong className="text-[#15803D]">Enabled</strong>
          </span>
        </div>
      </div>

      {/* Visual Partition Distribution & Micro-Batch Latency Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Partition Throughput & Lag Distribution Bars */}
        <div className="border border-[#E5E0D5] rounded-xl p-4 bg-[#F9F8F4] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#2C2825]">
              Kafka Topic Partition Load &amp; Consumer Offset Lag Distribution
            </h3>
            <span className="text-[11px] font-mono text-[#78716C]">8 Partitions · Replication Factor 3</span>
          </div>

          <div className="space-y-2.5">
            {partitionMetrics.map((part) => {
              const maxThroughput = Math.max(1, ...partitionMetrics.map((p) => p.throughputEventsSec));
              const widthPct = Math.round((part.throughputEventsSec / maxThroughput) * 100);

              return (
                <div key={part.partitionId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                    <span className="font-semibold text-[#2C2825]">
                      Partition-{part.partitionId}{' '}
                      <span className="text-[#78716C] font-normal">({part.brokerNode})</span>
                    </span>
                    <span className="text-[#2C2825]">
                      {part.throughputEventsSec} ev/s ·{' '}
                      <span
                        className={
                          part.consumerLag > 100
                            ? 'text-[#B45309] font-semibold'
                            : 'text-[#78716C]'
                        }
                      >
                        Lag: {part.consumerLag}
                      </span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#EFECE4] rounded-sm overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        part.consumerLag > 100 ? 'bg-[#B45309]' : 'bg-[#D97706]'
                      }`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Micro-Batch Processing Latency SVG Curve */}
        <div className="border border-[#E5E0D5] rounded-xl p-4 bg-[#F9F8F4] flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#2C2825]">
              Structured Streaming Micro-Batch Processing Duration (ms)
            </h3>
            <span className="text-[11px] font-mono text-[#78716C]">
              SLA Threshold: {batchIntervalSec * 1000}ms
            </span>
          </div>

          <div className="bg-[#FDFBF7] border border-[#E5E0D5] rounded-lg p-3">
            <svg
              viewBox="0 0 460 175"
              className="w-full h-[165px]"
              role="img"
              aria-label="Kafka Micro-Batch Processing Latency Chart"
            >
              {[35, 75, 115, 150].map((y) => (
                <line
                  key={y}
                  x1="36"
                  y1={y}
                  x2="440"
                  y2={y}
                  stroke="#E5E0D5"
                  strokeDasharray="3 3"
                />
              ))}
              {microBatchTimeline.map((b, i) => {
                const x = 52 + i * 40;
                const barH = Math.min(125, Math.max(14, b.procTimeMs * 3.2));
                const y = 150 - barH;
                return (
                  <g key={b.batchId}>
                    <rect
                      x={x - 10}
                      y={y}
                      width="20"
                      height={barH}
                      rx="2"
                      fill="#D97706"
                      stroke="#B45309"
                    />
                    <text
                      x={x}
                      y={y - 5}
                      textAnchor="middle"
                      className="text-[9px] font-mono fill-[#2C2825] font-semibold"
                    >
                      {b.procTimeMs}ms
                    </text>
                    <text
                      x={x}
                      y="164"
                      textAnchor="middle"
                      className="text-[8.5px] font-mono fill-[#78716C]"
                    >
                      #{b.batchId}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex items-center justify-between text-xs text-[#78716C] font-mono tabular-nums">
            <span>RocksDB Checkpoint: s3a://navpattern-lakehouse/checkpoints/rocksdb_sessionizer</span>
            <span>Zero JVM OOM Events</span>
          </div>
        </div>
      </div>

      {/* Detailed Partition Offset & Lag Table */}
      <div className="border border-[#E5E0D5] rounded-xl overflow-hidden bg-[#FFFFFF]">
        <div className="px-4 py-3 border-b border-[#E5E0D5] bg-[#F9F8F4] flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[#2C2825]">
            Kafka Partition Offset Watermarks &amp; RocksDB Stateful Session Store Distribution
          </h3>
          <span className="text-xs font-mono text-[#78716C]">{selectedConsumerGroup}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E0D5] bg-[#F7F4EB] text-[#78716C] font-medium">
                <th className="py-2.5 px-4">Partition</th>
                <th className="py-2.5 px-4">Broker Leader</th>
                <th className="py-2.5 px-4 text-right">Committed Offset</th>
                <th className="py-2.5 px-4 text-right">Log End Offset</th>
                <th className="py-2.5 px-4 text-right">Consumer Lag</th>
                <th className="py-2.5 px-4 text-right">Throughput</th>
                <th className="py-2.5 px-4 text-right">p99 Latency</th>
                <th className="py-2.5 px-4">Partition Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E0D5] font-mono tabular-nums">
              {partitionMetrics.map((part) => (
                <tr key={part.partitionId} className="hover:bg-[#F9F8F4] transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-[#2C2825]">
                    partition-{part.partitionId}
                  </td>
                  <td className="py-2.5 px-4 text-[#78716C]">{part.brokerNode}</td>
                  <td className="py-2.5 px-4 text-right text-[#2C2825]">
                    {part.currentOffset.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 text-right text-[#2C2825]">
                    {part.endOffset.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 text-right font-semibold text-[#B45309]">
                    {part.consumerLag} msgs
                  </td>
                  <td className="py-2.5 px-4 text-right text-[#2C2825]">
                    {part.throughputEventsSec} ev/s
                  </td>
                  <td className="py-2.5 px-4 text-right text-[#2C2825]">
                    {part.p99LatencyMs} ms
                  </td>
                  <td className="py-2.5 px-4 font-sans">
                    {part.skewStatus === 'High Traffic' ? (
                      <span className="inline-flex items-center gap-1 text-[#B45309] font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        High Traffic Skew
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[#15803D] font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Balanced
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
