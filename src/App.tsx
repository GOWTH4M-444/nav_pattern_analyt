/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  parseServerLogs,
  runNavigationPatternPipeline,
  SessionizationOptions,
} from './utils/navigationMining';
import { PRESET_DATASETS, PresetDataset } from './utils/sampleLogs';
import { NavigationFlowView } from './components/NavigationFlowView';
import { MarkovMatrixView } from './components/MarkovMatrixView';
import { SequentialPatternsView } from './components/SequentialPatternsView';
import { LogIngestionView } from './components/LogIngestionView';
import { PySparkPipelineView } from './components/PySparkPipelineView';
import { KafkaStreamLatencyView } from './components/KafkaStreamLatencyView';
import { MatplotlibChartViewer } from './components/MatplotlibChartViewer';
import { soundFX } from './utils/soundEffects';
import { detectHorizontalSwipe } from './utils/gestures';
import {
  Download,
  Database,
  FileJson,
  FileText,
  Volume2,
  VolumeX,
  RotateCcw,
} from 'lucide-react';

type ActiveWorkspaceTab = 'flow' | 'markov' | 'patterns' | 'pyspark' | 'logs' | 'kafka';
type TelemetrySliceFilter = 'all' | 'deep' | 'converted' | 'bounced' | 'anomalous';

const WORKSPACE_TABS: { id: ActiveWorkspaceTab; label: string }[] = [
  { id: 'flow', label: 'Flow Topology' },
  { id: 'markov', label: 'Markov Matrix' },
  { id: 'patterns', label: 'Sequential Patterns' },
  { id: 'pyspark', label: 'PySpark + JDK' },
  { id: 'logs', label: 'Log Parser' },
  { id: 'kafka', label: 'Kafka Stream Latency' },
];

export default function App() {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESET_DATASETS[0].id);
  const [rawLogBuffer, setRawLogBuffer] = useState<string>(PRESET_DATASETS[0].rawLogText);
  const [committedLogText, setCommittedLogText] = useState<string>(PRESET_DATASETS[0].rawLogText);

  const [sessionOptions, setSessionOptions] = useState<SessionizationOptions>({
    timeoutMinutes: 30,
    excludeBots: true,
    excludeStaticAssets: true,
    excludeErrorCodes: true,
    conversionTargetPath: PRESET_DATASETS[0].defaultConversionPath,
  });

  const [funnelSteps, setFunnelSteps] = useState<string[]>(PRESET_DATASETS[0].defaultFunnelSteps);
  const [minSupport, setMinSupport] = useState<number>(0.05);
  const [activeTab, setActiveTab] = useState<ActiveWorkspaceTab>('flow');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [telemetryFilter, setTelemetryFilter] = useState<TelemetrySliceFilter>('all');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [animProgress, setAnimProgress] = useState<number>(1);

  const touchStartRef = useRef<{ startX: number; startY: number; startTime: number } | null>(null);

  const activePreset: PresetDataset = useMemo(
    () => PRESET_DATASETS.find((d) => d.id === selectedPresetId) || PRESET_DATASETS[0],
    [selectedPresetId]
  );

  // Run mining pipeline whenever committedLogText, sessionOptions, or minSupport updates
  const { summary, sessions } = useMemo(() => {
    const rawHits = parseServerLogs(committedLogText);
    return runNavigationPatternPipeline(rawHits, sessionOptions, minSupport);
  }, [committedLogText, sessionOptions, minSupport]);

  // Smooth counting animation trigger on dataset/filter change
  useEffect(() => {
    let frameId: number;
    const start = performance.now();
    const duration = 260;

    const tick = (now: number) => {
      const p = Math.max(0, Math.min(1, (now - start) / duration));
      setAnimProgress(1 - Math.pow(1 - p, 3));
      if (p < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [selectedPresetId, telemetryFilter, committedLogText]);

  // Filter sessions when user clicks one of the 5 KPI telemetry cards
  const filteredSessions = useMemo(() => {
    if (telemetryFilter === 'all') return sessions;
    if (telemetryFilter === 'deep') return sessions.filter((s) => s.pathSequence.length >= 4);
    if (telemetryFilter === 'converted') return sessions.filter((s) => s.converted);
    if (telemetryFilter === 'bounced') return sessions.filter((s) => s.bounced);
    if (telemetryFilter === 'anomalous') {
      return sessions.filter((s) => s.loopDetected || s.anomalyScore >= 0.4);
    }
    return sessions;
  }, [sessions, telemetryFilter]);

  const handleSelectPreset = (presetId: string) => {
    const found = PRESET_DATASETS.find((p) => p.id === presetId);
    if (!found) return;
    soundFX.playChime();
    setSelectedPresetId(found.id);
    setRawLogBuffer(found.rawLogText);
    setCommittedLogText(found.rawLogText);
    setSessionOptions((prev) => ({
      ...prev,
      conversionTargetPath: found.defaultConversionPath,
    }));
    setFunnelSteps(found.defaultFunnelSteps);
    setSelectedNode(null);
    setTelemetryFilter('all');
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundFX.setEnabled(next);
    if (next) {
      soundFX.playChime();
    }
  };

  const handleSwitchTab = (tab: ActiveWorkspaceTab) => {
    soundFX.playPop();
    setActiveTab(tab);
  };

  const handleMainTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        startTime: Date.now(),
      };
    }
  };

  const handleMainTouchEnd = (e: React.TouchEvent<HTMLElement>) => {
    if (!touchStartRef.current || e.changedTouches.length === 0) return;
    const endTouch = e.changedTouches[0];
    const dir = detectHorizontalSwipe(
      touchStartRef.current,
      endTouch.clientX,
      endTouch.clientY
    );
    touchStartRef.current = null;
    if (!dir) return;

    const currentIdx = WORKSPACE_TABS.findIndex((t) => t.id === activeTab);
    if (dir === 'left' && currentIdx < WORKSPACE_TABS.length - 1) {
      handleSwitchTab(WORKSPACE_TABS[currentIdx + 1].id);
    } else if (dir === 'right' && currentIdx > 0) {
      handleSwitchTab(WORKSPACE_TABS[currentIdx - 1].id);
    }
  };

  const handleExportCsvReport = () => {
    soundFX.playChime();
    const header = [
      'Pattern_ID',
      'Sequence_Path',
      'Length',
      'Classification',
      'Session_Count',
      'Support_Pct',
      'Confidence_Pct',
      'Avg_Duration_Sec',
      'Goal_Conversion_Pct',
    ];
    const rows = summary.patterns.map((p) => [
      p.id,
      `"${p.sequenceKey}"`,
      p.length,
      `"${p.classification}"`,
      p.count,
      (p.support * 100).toFixed(2),
      (p.confidence * 100).toFixed(2),
      p.avgDurationSec,
      (p.conversionRate * 100).toFixed(2),
    ]);

    const csvContent = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `navigation-patterns-${selectedPresetId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportJsonBundle = () => {
    soundFX.playChime();
    const bundle = {
      generatedAt: new Date().toISOString(),
      dataset: activePreset.name,
      domain: activePreset.domain,
      pipelineConfig: sessionOptions,
      summaryMetrics: {
        totalRawHits: summary.totalRawHits,
        filteredValidHits: summary.filteredValidHits,
        totalSessions: summary.totalSessions,
        avgPathLength: summary.avgPathLength,
        overallConversionRate: summary.overallConversionRate,
        anomalousSessionCount: summary.anomalousSessionCount,
      },
      graphFramesCentralityAndAbsorption: summary.pageMetrics,
      markovTransitions: summary.transitions,
      word2VecSimilarityPairs: summary.word2VecPairs,
      sequentialPatterns: summary.patterns,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `navpattern-analytics-bundle-${selectedPresetId}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportSparkExecutionLog = () => {
    soundFX.playChime();
    const logLines = [
      `2026-11-09 01:30:00 INFO  SparkContext: Running Spark version 3.5.1 on OpenJDK 17.0.10 (64-Bit Server VM)`,
      `2026-11-09 01:30:00 INFO  SparkContext: Submitted application: NavPattern_Enterprise_Lakehouse_${activePreset.domain}`,
      `2026-11-09 01:30:01 INFO  DeltaLog: Loading Delta Lake table version 42 from s3a://navpattern-lakehouse/bronze/web_server_logs`,
      `2026-11-09 01:30:01 INFO  AdaptiveSparkPlanExec: AQE enabled (spark.sql.adaptive.enabled=true, KryoSerializer, OffHeap=8g)`,
      `2026-11-09 01:30:01 INFO  DAGScheduler: Stage 1 (Delta Scan + Z-Order Pruning) finished in 0.014 s (${summary.totalRawHits} raw records)`,
      `2026-11-09 01:30:01 INFO  DAGScheduler: Stage 2 (BroadcastHashJoin Page Dimension) finished in 0.011 s (${summary.filteredValidHits} valid hits)`,
      `2026-11-09 01:30:01 INFO  DAGScheduler: Stage 3 (Stateful Window Sessionization) finished in 0.028 s (${summary.totalSessions} reconstructed sessions)`,
      `2026-11-09 01:30:01 INFO  GraphFrame: Stage 4 (PageRank maxIter=20, resetProb=0.15) finished in 0.034 s (${summary.uniquePages.length} vertices)`,
      `2026-11-09 01:30:01 INFO  Word2Vec: Stage 5 (16-D Session Sequence Embeddings) finished in 0.031 s (${summary.word2VecPairs.length} cosine pairs)`,
      `2026-11-09 01:30:01 INFO  IsolationForest: Stage 6 (Anomaly Detection) flagged ${summary.anomalousSessionCount} anomalous trajectories in 0.024 s`,
      `2026-11-09 01:30:02 INFO  SparkContext: Successfully stopped SparkContext.`,
    ];
    const blob = new Blob([logLines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `pyspark-execution-${selectedPresetId}.log`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2C2825] flex flex-col">
      {/* Single Unified Navigation Header */}
      <header className="flex items-center justify-between gap-6 px-4 sm:px-6 lg:px-8 py-3.5 bg-[#FFFFFF] border-b border-[#E5E0D5] sticky top-0 z-20">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            handleSwitchTab('flow');
          }}
          className="text-base font-bold tracking-tight text-[#2C2825] font-display whitespace-nowrap shrink-0"
        >
          NavPattern Studio
        </a>

        {/* Zone 2: Single Unified Navigation Bar */}
        <nav
          aria-label="Primary Workspace Navigation"
          className="flex items-center gap-5 text-sm font-medium text-[#78716C] overflow-x-auto"
        >
          {WORKSPACE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSwitchTab(tab.id)}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === tab.id
                  ? 'border-[#B45309] text-[#2C2825] font-semibold'
                  : 'border-transparent hover:text-[#2C2825]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: Discreet Audio Toggle & Primary Export Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleToggleSound}
            aria-label={soundEnabled ? 'Mute acoustic audio feedback' : 'Unmute acoustic audio feedback'}
            title={soundEnabled ? 'Audio Haptics: On (Click to Mute)' : 'Audio Haptics: Muted (Click to Unmute)'}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#2C2825] bg-[#F9F8F4] hover:bg-[#EFECE4] border border-[#E5E0D5] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-[#D97706]" />
                <span>Sound On</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-[#78716C]" />
                <span>Muted</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleExportCsvReport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#FFFFFF] bg-[#2C2825] rounded-lg hover:bg-[#443E3A] transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-[#D97706]" />
            Export Pattern CSV
          </button>
        </div>
      </header>

      {/* Main Workspace Layout with Fluid Edge-to-Edge Spacing */}
      <div className="flex-1 w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 px-4 sm:px-6 lg:px-8 py-6">
        {/* Left Analytical Control Sidebar */}
        <aside className="lg:col-span-3 space-y-5">
          {/* Dataset & Domain Selector */}
          <div className="bg-[#FFFFFF] border border-[#E5E0D5] rounded-xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#2C2825]">
              <Database className="w-3.5 h-3.5 text-[#B45309]" />
              <span>Delta Lakehouse Log Dataset</span>
            </div>

            <div className="space-y-1.5">
              {PRESET_DATASETS.map((preset) => {
                const isSelected = preset.id === selectedPresetId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-[#F7F4EB] border-[#B45309] text-[#2C2825]'
                        : 'bg-[#FFFFFF] border-[#E5E0D5] text-[#2C2825] hover:bg-[#F9F8F4]'
                    }`}
                  >
                    <div className="text-xs font-semibold">{preset.name}</div>
                    <div className="text-[11px] font-mono text-[#78716C] mt-0.5">
                      Host: {preset.domain} · Goal: {preset.defaultConversionPath}
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-[#78716C] leading-relaxed pt-2 border-t border-[#E5E0D5]">
              {activePreset.description}
            </p>
          </div>

          {/* Mining Pipeline Parameters */}
          <div className="bg-[#FFFFFF] border border-[#E5E0D5] rounded-xl p-4 space-y-3.5 shadow-xs">
            <h2 className="text-xs font-semibold text-[#2C2825]">
              Sessionization &amp; Spark Parameters
            </h2>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <label htmlFor="sidebar-timeout" className="text-[#78716C]">
                  Inactivity Window:
                </label>
                <span className="font-mono font-semibold text-[#2C2825] tabular-nums">
                  {sessionOptions.timeoutMinutes} min
                </span>
              </div>
              <input
                id="sidebar-timeout"
                type="range"
                min={5}
                max={60}
                step={5}
                value={sessionOptions.timeoutMinutes}
                onChange={(e) => {
                  soundFX.playClick();
                  setSessionOptions((prev) => ({
                    ...prev,
                    timeoutMinutes: parseInt(e.target.value, 10),
                  }));
                }}
                className="w-full accent-[#B45309] cursor-pointer"
              />
            </div>

            <div className="space-y-2 text-xs pt-2 border-t border-[#E5E0D5]">
              <label htmlFor="sidebar-goal-select" className="block text-[#78716C]">
                Target Conversion State:
              </label>
              <select
                id="sidebar-goal-select"
                value={sessionOptions.conversionTargetPath}
                onChange={(e) => {
                  soundFX.playPop();
                  setSessionOptions((prev) => ({
                    ...prev,
                    conversionTargetPath: e.target.value,
                  }));
                }}
                className="w-full px-2.5 py-1.5 text-xs font-mono border border-[#E5E0D5] rounded-lg bg-[#FDFBF7] text-[#2C2825]"
              >
                {summary.uniquePages.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#E5E0D5] text-xs">
              <label className="flex items-center justify-between cursor-pointer text-[#2C2825]">
                <span>Exclude Crawler Bots</span>
                <input
                  type="checkbox"
                  checked={sessionOptions.excludeBots}
                  onChange={(e) => {
                    soundFX.playClick();
                    setSessionOptions((prev) => ({
                      ...prev,
                      excludeBots: e.target.checked,
                    }));
                  }}
                  className="accent-[#B45309] rounded"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer text-[#2C2825]">
                <span>Strip Static Assets (.js/.css)</span>
                <input
                  type="checkbox"
                  checked={sessionOptions.excludeStaticAssets}
                  onChange={(e) => {
                    soundFX.playClick();
                    setSessionOptions((prev) => ({
                      ...prev,
                      excludeStaticAssets: e.target.checked,
                    }));
                  }}
                  className="accent-[#B45309] rounded"
                />
              </label>
            </div>
          </div>

          {/* Preprocessing Telemetry Breakdown */}
          <div className="bg-[#FFFFFF] border border-[#E5E0D5] rounded-xl p-4 space-y-2.5 text-xs shadow-xs">
            <h2 className="font-semibold text-[#2C2825]">
              PySpark + Delta Lake Summary
            </h2>
            <div className="space-y-1.5 font-mono tabular-nums text-[#78716C]">
              <div className="flex justify-between">
                <span>Raw Log Requests:</span>
                <span className="font-semibold text-[#2C2825]">{summary.totalRawHits}</span>
              </div>
              <div className="flex justify-between">
                <span>Valid Pageview Hits:</span>
                <span className="font-semibold text-[#2C2825]">{summary.filteredValidHits}</span>
              </div>
              <div className="flex justify-between">
                <span>Crawler / Static Filtered:</span>
                <span className="text-[#2C2825]">
                  {summary.botHitsRemoved + summary.staticAssetHitsRemoved + summary.errorHitsRemoved}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Word2Vec 16-D Vectors:</span>
                <span className="font-semibold text-[#2C2825]">{summary.uniquePages.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Isolation Forest Alerts:</span>
                <span className="font-semibold text-[#B45309]">{summary.anomalousSessionCount}</span>
              </div>
            </div>
          </div>

          {/* Export & Report Suite */}
          <div className="bg-[#FFFFFF] border border-[#E5E0D5] rounded-xl p-4 space-y-2.5 text-xs shadow-xs">
            <h2 className="font-semibold text-[#2C2825]">Export &amp; Report Suite</h2>
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleExportJsonBundle}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-[#E5E0D5] bg-[#F9F8F4] hover:bg-[#EFECE4] text-[#2C2825] font-medium transition-colors"
              >
                <span className="flex items-center gap-2">
                  <FileJson className="w-3.5 h-3.5 text-[#B45309]" />
                  Analytics Bundle (.json)
                </span>
                <Download className="w-3.5 h-3.5 text-[#78716C]" />
              </button>

              <button
                type="button"
                onClick={handleExportSparkExecutionLog}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-[#E5E0D5] bg-[#F9F8F4] hover:bg-[#EFECE4] text-[#2C2825] font-medium transition-colors"
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-[#15803D]" />
                  PySpark DAG Logs (.log)
                </span>
                <Download className="w-3.5 h-3.5 text-[#78716C]" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Analytical Viewport (Supports Horizontal Swipe Between Tabs) */}
        <main
          onTouchStart={handleMainTouchStart}
          onTouchEnd={handleMainTouchEnd}
          className="lg:col-span-9 space-y-6"
        >
          {/* Document Header & Interactive Animated KPI Telemetry Cards */}
          <div className="bg-[#FFFFFF] border border-[#E5E0D5] rounded-xl p-5 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E0D5] pb-3">
              <div>
                <div className="text-xs text-[#78716C]">
                  Enterprise Web Usage Mining · Delta Lake + Kafka Streaming + GraphFrames · Host: {activePreset.domain}
                </div>
                <h1 className="text-xl font-bold text-[#2C2825] font-display mt-0.5">
                  Website Navigation Pattern Analysis
                </h1>
              </div>

              {/* Telemetry Slice Reset */}
              <div className="flex items-center gap-2">
                {telemetryFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playClick();
                      setTelemetryFilter('all');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#B45309] bg-[#FEF3C7] border border-[#F59E0B] rounded-lg hover:bg-[#FDE68A] transition-colors whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Slice: {telemetryFilter.toUpperCase()} ({filteredSessions.length} sessions) · Reset
                  </button>
                )}
              </div>
            </div>

            {/* 5-Column Interactive Animated KPI Telemetry Cards (Click-to-Filter) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
              {/* Card 1: Reconstructed Sessions */}
              <button
                type="button"
                onClick={() => {
                  soundFX.playPop();
                  setTelemetryFilter('all');
                }}
                className={`text-left p-3.5 rounded-xl border transition-all ${
                  telemetryFilter === 'all'
                    ? 'bg-[#F7F4EB] border-[#B45309] shadow-xs'
                    : 'bg-[#F9F8F4] border-[#E5E0D5] hover:bg-[#F7F4EB]'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-[#78716C]">
                  <span>Reconstructed Sessions</span>
                  <svg width="44" height="16" viewBox="0 0 44 16" aria-hidden="true">
                    <polyline
                      fill="none"
                      stroke="#B45309"
                      strokeWidth="1.6"
                      points="2,13 11,10 20,11 29,6 42,3"
                    />
                  </svg>
                </div>
                <div className="text-lg font-mono font-bold text-[#2C2825] tabular-nums mt-1">
                  {Math.round(summary.totalSessions * animProgress)}
                </div>
                <div className="text-[11px] text-[#78716C] font-mono tabular-nums mt-0.5">
                  {summary.filteredValidHits} pageviews · All
                </div>
              </button>

              {/* Card 2: Avg Path Depth (Filter Deep Sessions 4+ pages) */}
              <button
                type="button"
                onClick={() => {
                  soundFX.playPop();
                  setTelemetryFilter((prev) => (prev === 'deep' ? 'all' : 'deep'));
                }}
                className={`text-left p-3.5 rounded-xl border transition-all ${
                  telemetryFilter === 'deep'
                    ? 'bg-[#F7F4EB] border-[#B45309] shadow-xs'
                    : 'bg-[#F9F8F4] border-[#E5E0D5] hover:bg-[#F7F4EB]'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-[#78716C]">
                  <span>Avg Path Depth</span>
                  <svg width="44" height="16" viewBox="0 0 44 16" aria-hidden="true">
                    <polyline
                      fill="none"
                      stroke="#D97706"
                      strokeWidth="1.6"
                      points="2,12 12,8 22,9 32,5 42,4"
                    />
                  </svg>
                </div>
                <div className="text-lg font-mono font-bold text-[#2C2825] tabular-nums mt-1">
                  {(summary.avgPathLength * animProgress).toFixed(2)} pages
                </div>
                <div className="text-[11px] text-[#78716C] font-mono tabular-nums mt-0.5">
                  Avg {summary.avgSessionDurationSec}s · Filter 4+ hits
                </div>
              </button>

              {/* Card 3: Goal Conversion Rate */}
              <button
                type="button"
                onClick={() => {
                  soundFX.playPop();
                  setTelemetryFilter((prev) => (prev === 'converted' ? 'all' : 'converted'));
                }}
                className={`text-left p-3.5 rounded-xl border transition-all ${
                  telemetryFilter === 'converted'
                    ? 'bg-[#F7F4EB] border-[#15803D] shadow-xs'
                    : 'bg-[#F9F8F4] border-[#E5E0D5] hover:bg-[#F7F4EB]'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-[#78716C]">
                  <span>Goal Conversion Rate</span>
                  <svg width="44" height="16" viewBox="0 0 44 16" aria-hidden="true">
                    <polyline
                      fill="none"
                      stroke="#15803D"
                      strokeWidth="1.6"
                      points="2,14 12,11 22,8 32,6 42,2"
                    />
                  </svg>
                </div>
                <div className="text-lg font-mono font-bold text-[#15803D] tabular-nums mt-1">
                  {(summary.overallConversionRate * 100 * animProgress).toFixed(1)}%
                </div>
                <div className="text-[11px] text-[#78716C] font-mono truncate mt-0.5">
                  Goal: {sessionOptions.conversionTargetPath}
                </div>
              </button>

              {/* Card 4: Single-Page Bounce Rate */}
              <button
                type="button"
                onClick={() => {
                  soundFX.playPop();
                  setTelemetryFilter((prev) => (prev === 'bounced' ? 'all' : 'bounced'));
                }}
                className={`text-left p-3.5 rounded-xl border transition-all ${
                  telemetryFilter === 'bounced'
                    ? 'bg-[#F7F4EB] border-[#B45309] shadow-xs'
                    : 'bg-[#F9F8F4] border-[#E5E0D5] hover:bg-[#F7F4EB]'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-[#78716C]">
                  <span>Single-Page Bounce</span>
                  <svg width="44" height="16" viewBox="0 0 44 16" aria-hidden="true">
                    <polyline
                      fill="none"
                      stroke="#78716C"
                      strokeWidth="1.6"
                      points="2,5 12,7 22,6 32,10 42,12"
                    />
                  </svg>
                </div>
                <div className="text-lg font-mono font-bold text-[#2C2825] tabular-nums mt-1">
                  {(summary.overallBounceRate * 100 * animProgress).toFixed(1)}%
                </div>
                <div className="text-[11px] text-[#78716C] font-mono tabular-nums mt-0.5">
                  Filter 1-hit exits
                </div>
              </button>

              {/* Card 5: Backtrack & Anomaly Rate */}
              <button
                type="button"
                onClick={() => {
                  soundFX.playPop();
                  setTelemetryFilter((prev) => (prev === 'anomalous' ? 'all' : 'anomalous'));
                }}
                className={`text-left p-3.5 rounded-xl border transition-all ${
                  telemetryFilter === 'anomalous'
                    ? 'bg-[#F7F4EB] border-[#B45309] shadow-xs'
                    : 'bg-[#F9F8F4] border-[#E5E0D5] hover:bg-[#F7F4EB]'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-[#78716C]">
                  <span>Backtrack Loop Rate</span>
                  <svg width="44" height="16" viewBox="0 0 44 16" aria-hidden="true">
                    <polyline
                      fill="none"
                      stroke="#D97706"
                      strokeWidth="1.6"
                      points="2,11 12,12 22,7 32,9 42,4"
                    />
                  </svg>
                </div>
                <div className="text-lg font-mono font-bold text-[#B45309] tabular-nums mt-1">
                  {(summary.loopingSessionRate * 100 * animProgress).toFixed(1)}%
                </div>
                <div className="text-[11px] text-[#78716C] font-mono tabular-nums mt-0.5">
                  {summary.anomalousSessionCount} anomaly alerts
                </div>
              </button>
            </div>
          </div>

          {/* Primary Active Analytical View */}
          <div className="bg-[#FFFFFF] border border-[#E5E0D5] rounded-xl p-5 shadow-xs">
            {activeTab === 'flow' && (
              <NavigationFlowView
                pageMetrics={summary.pageMetrics}
                transitions={summary.transitions}
                sessions={filteredSessions}
                conversionTargetPath={sessionOptions.conversionTargetPath}
                selectedNode={selectedNode}
                onSelectNode={setSelectedNode}
              />
            )}

            {activeTab === 'markov' && (
              <MarkovMatrixView
                uniquePages={summary.uniquePages}
                transitions={summary.transitions}
                patterns={summary.patterns}
              />
            )}

            {activeTab === 'patterns' && (
              <SequentialPatternsView
                patterns={summary.patterns}
                sessions={filteredSessions}
                funnelSteps={funnelSteps}
                uniquePages={summary.uniquePages}
                minSupport={minSupport}
                onChangeMinSupport={setMinSupport}
                onUpdateFunnelSteps={setFunnelSteps}
              />
            )}

            {activeTab === 'pyspark' && (
              <PySparkPipelineView
                summary={summary}
                sessions={filteredSessions}
                options={sessionOptions}
                minSupport={minSupport}
                domain={activePreset.domain}
              />
            )}

            {activeTab === 'logs' && (
              <LogIngestionView
                rawLogText={rawLogBuffer}
                onChangeRawLogText={setRawLogBuffer}
                options={sessionOptions}
                onChangeOptions={setSessionOptions}
                onRunPipeline={() => setCommittedLogText(rawLogBuffer)}
                onResetToPreset={() => {
                  setRawLogBuffer(activePreset.rawLogText);
                  setCommittedLogText(activePreset.rawLogText);
                }}
                summary={summary}
                sessions={filteredSessions}
              />
            )}

            {activeTab === 'kafka' && (
              <KafkaStreamLatencyView
                summary={summary}
                sessions={filteredSessions}
                domain={activePreset.domain}
              />
            )}
          </div>

          {/* Matplotlib Analytical Figure Viewer (Publication SVG Output) */}
          <MatplotlibChartViewer
            summary={summary}
            sessions={filteredSessions}
            funnelSteps={funnelSteps}
          />
        </main>
      </div>
    </div>
  );
}
