import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MarkovTransitionCell,
  PageNodeMetrics,
  ReconstructedSession,
} from '../utils/navigationMining';
import {
  ReplayCohortMode,
  buildSessionReplaySteps,
  interpolatePointOnCubicBezier,
  selectReplayableSessions,
} from '../utils/sessionReplay';
import { calculateTouchDistance } from '../utils/gestures';
import { soundFX } from '../utils/soundEffects';
import {
  ArrowRight,
  Filter,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Move,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Sparkles,
  AlertTriangle,
  X,
} from 'lucide-react';

interface NavigationFlowViewProps {
  pageMetrics: PageNodeMetrics[];
  transitions: MarkovTransitionCell[];
  sessions: ReconstructedSession[];
  conversionTargetPath: string;
  selectedNode: string | null;
  onSelectNode: (path: string | null) => void;
}

export const NavigationFlowView: React.FC<NavigationFlowViewProps> = ({
  pageMetrics,
  transitions,
  sessions,
  conversionTargetPath,
  selectedNode,
  onSelectNode,
}) => {
  const [minProbFilter, setMinProbFilter] = useState<number>(0.08);
  const [hoveredEdge, setHoveredEdge] = useState<MarkovTransitionCell | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, { dx: number; dy: number }>>({});
  const [draggingState, setDraggingState] = useState<{
    type: 'pan' | 'node';
    nodePath?: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const [pinchStartDist, setPinchStartDist] = useState<number | null>(null);
  const [pinchStartZoom, setPinchStartZoom] = useState<number>(1);

  // Session Replay State
  const [replayActive, setReplayActive] = useState<boolean>(false);
  const [replayCohort, setReplayCohort] = useState<ReplayCohortMode>('anomalous');
  const [selectedReplaySessionId, setSelectedReplaySessionId] = useState<string>('');
  const [replayStepIdx, setReplayStepIdx] = useState<number>(0);
  const [isPlayingReplay, setIsPlayingReplay] = useState<boolean>(false);
  const [replaySpeed, setReplaySpeed] = useState<1 | 2>(1);
  const [stepProgress, setStepProgress] = useState<number>(0);

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Candidate sessions for Session Replay
  const replayCandidates = useMemo(
    () => selectReplayableSessions(sessions, replayCohort),
    [sessions, replayCohort]
  );

  // Ensure a valid session ID is selected when candidates change
  const activeReplaySession = useMemo(() => {
    if (replayCandidates.length === 0) return null;
    return (
      replayCandidates.find((s) => s.sessionId === selectedReplaySessionId) ||
      replayCandidates[0]
    );
  }, [replayCandidates, selectedReplaySessionId]);

  const replaySteps = useMemo(
    () => buildSessionReplaySteps(activeReplaySession, conversionTargetPath),
    [activeReplaySession, conversionTargetPath]
  );

  const currentReplayStep = useMemo(() => {
    if (!replayActive || replaySteps.length === 0) return null;
    const clampedIdx = Math.min(replayStepIdx, replaySteps.length - 1);
    return replaySteps[clampedIdx] || null;
  }, [replayActive, replaySteps, replayStepIdx]);

  // Smooth step interpolation & auto-advance loop when playing
  useEffect(() => {
    if (!replayActive || !isPlayingReplay || replaySteps.length === 0) {
      return;
    }

    let animFrame: number;
    const stepDurationMs = replaySpeed === 2 ? 750 : 1400;
    const startTime = performance.now();

    const animateStep = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / stepDurationMs);
      setStepProgress(t);

      if (t < 1) {
        animFrame = requestAnimationFrame(animateStep);
      } else {
        setReplayStepIdx((prev) => {
          if (prev < replaySteps.length - 1) {
            soundFX.playPop();
            setStepProgress(0);
            return prev + 1;
          } else {
            soundFX.playChime();
            setIsPlayingReplay(false);
            return prev;
          }
        });
      }
    };

    animFrame = requestAnimationFrame(animateStep);
    return () => cancelAnimationFrame(animFrame);
  }, [replayActive, isPlayingReplay, replayStepIdx, replaySteps.length, replaySpeed]);

  const visibleNodes = useMemo(() => pageMetrics.slice(0, 8), [pageMetrics]);

  // Assign nodes into 4 logical columns
  const stagedNodes = useMemo(() => {
    const stages: { stageTitle: string; nodes: (PageNodeMetrics & { isExitSink?: boolean })[] }[] = [
      { stageTitle: '01. Landing & Entry', nodes: [] },
      { stageTitle: '02. Discovery & Catalog', nodes: [] },
      { stageTitle: '03. High-Intent & Action', nodes: [] },
      { stageTitle: '04. Goal & Exit Sink', nodes: [] },
    ];

    visibleNodes.forEach((node) => {
      const p = node.path.toLowerCase();
      if (p === conversionTargetPath.toLowerCase() || p.includes('confirm') || p.includes('created')) {
        stages[3].nodes.push(node);
      } else if (
        node.entryCount >= node.totalVisits * 0.35 ||
        p === '/home' ||
        p === '/landing' ||
        p === '/portal'
      ) {
        stages[0].nodes.push(node);
      } else if (
        p.includes('cart') ||
        p.includes('checkout') ||
        p.includes('signup') ||
        p.includes('onboard') ||
        p.includes('schedule')
      ) {
        stages[2].nodes.push(node);
      } else {
        stages[1].nodes.push(node);
      }
    });

    if (stages[0].nodes.length === 0 && stages[1].nodes.length > 0) {
      stages[0].nodes.push(stages[1].nodes.shift()!);
    }

    const totalExits = visibleNodes.reduce((acc, n) => acc + n.exitCount, 0);
    stages[3].nodes.push({
      path: 'EXIT',
      label: '[Session Exit]',
      totalVisits: totalExits,
      uniqueSessions: totalExits,
      entryCount: 0,
      exitCount: totalExits,
      exitRate: 1,
      bounceCount: 0,
      bounceRate: 0,
      avgDwellSec: 0,
      entropy: 0,
      pageRank: 0,
      inDegree: visibleNodes.length,
      outDegree: 0,
      betweennessCentrality: 0,
      expectedStepsToConversion: null,
      conversionAbsorptionProb: 0,
      exitAbsorptionProb: 1,
      sparklineBuckets: [0, 0, 0, 0, 0, 0, 0, 0],
      embedding16D: [],
      isExitSink: true,
    });

    return stages;
  }, [visibleNodes, conversionTargetPath]);

  // Compute SVG coordinates and logarithmic node radii
  const layoutGeometry = useMemo(() => {
    const width = 940;
    const height = 475;
    const colX = [115, 360, 605, 830];
    const maxSessions = Math.max(1, ...visibleNodes.map((n) => n.uniqueSessions));
    const maxEdgeCount = Math.max(1, ...transitions.map((t) => t.count));

    const nodePositions = new Map<
      string,
      {
        x: number;
        y: number;
        radius: number;
        heatRatio: number;
        node: PageNodeMetrics & { isExitSink?: boolean };
        stageIdx: number;
      }
    >();

    stagedNodes.forEach((stage, sIdx) => {
      const count = stage.nodes.length;
      const verticalSpan = height - 135;
      stage.nodes.forEach((node, nIdx) => {
        const baseY = count === 1 ? height / 2 : 55 + (nIdx * verticalSpan) / Math.max(1, count - 1);
        const offset = nodeOffsets[node.path] || { dx: 0, dy: 0 };

        // Logarithmic radius scaling with total session volume: 18px to 30px
        const logRatio = Math.log1p(node.uniqueSessions) / Math.log1p(maxSessions);
        const radius = Math.round(18 + 12 * Math.min(1, Math.max(0.15, logRatio)));

        nodePositions.set(node.path, {
          x: colX[sIdx] + offset.dx,
          y: baseY + offset.dy,
          radius,
          heatRatio: Math.min(1, node.uniqueSessions / maxSessions),
          node,
          stageIdx: sIdx,
        });
      });
    });

    // When Session Replay is active, ensure all edges used by the replayed session are included even if below minProbFilter
    const replayEdgeKeys = new Set<string>();
    if (replayActive && replaySteps.length > 0) {
      replaySteps.forEach((s) => {
        if (s.nextPagePath) {
          replayEdgeKeys.add(`${s.pagePath}->${s.nextPagePath}`);
        }
      });
    }

    const filteredEdges = transitions.filter((t) => {
      const key = `${t.fromPage}->${t.toPage}`;
      if (!nodePositions.has(t.fromPage) || !nodePositions.has(t.toPage)) return false;
      if (replayEdgeKeys.has(key)) return true;
      if (t.probability < minProbFilter) return false;
      if (selectedNode && t.fromPage !== selectedNode && t.toPage !== selectedNode) return false;
      return true;
    });

    return { width, height, colX, nodePositions, filteredEdges, maxEdgeCount };
  }, [
    stagedNodes,
    transitions,
    minProbFilter,
    selectedNode,
    visibleNodes,
    nodeOffsets,
    replayActive,
    replaySteps,
  ]);

  const activeNodeDetail = useMemo(() => {
    if (!selectedNode) return null;
    return pageMetrics.find((m) => m.path === selectedNode) || null;
  }, [selectedNode, pageMetrics]);

  // Helper to compute cubic Bezier control points for any transition edge
  const computeEdgeCurveGeometry = (fromPage: string, toPage: string) => {
    const fromPos = layoutGeometry.nodePositions.get(fromPage);
    const toPos = layoutGeometry.nodePositions.get(toPage);
    if (!fromPos || !toPos) return null;

    const isSelfLoop = fromPage === toPage;
    const isBacktrack =
      toPos.stageIdx < fromPos.stageIdx ||
      (toPos.stageIdx === fromPos.stageIdx && toPos.y < fromPos.y);

    if (isSelfLoop) {
      const x = fromPos.x;
      const y = fromPos.y - fromPos.radius - 4;
      const p0 = { x: x - 16, y };
      const p1 = { x: x - 32, y: y - 38 };
      const p2 = { x: x + 32, y: y - 38 };
      const p3 = { x: x + 16, y };
      return {
        pathD: `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`,
        labelX: x,
        labelY: y - 32,
        isSelfLoop,
        isBacktrack,
        p0,
        p1,
        p2,
        p3,
      };
    }

    const startX = isBacktrack
      ? fromPos.x - fromPos.radius - 8
      : fromPos.x + fromPos.radius + 8;
    const startY = fromPos.y;
    const endX = isBacktrack
      ? toPos.x + toPos.radius + 8
      : toPos.x - toPos.radius - 8;
    const endY = toPos.y;
    const ctrlOffset = Math.max(45, Math.abs(endX - startX) * 0.45);
    const c1x = isBacktrack ? startX - ctrlOffset : startX + ctrlOffset;
    const c2x = isBacktrack ? endX + ctrlOffset : endX - ctrlOffset;
    const arcLift = isBacktrack ? -26 : 0;

    const p0 = { x: startX, y: startY };
    const p1 = { x: c1x, y: startY + arcLift };
    const p2 = { x: c2x, y: endY + arcLift };
    const p3 = { x: endX, y: endY };

    return {
      pathD: `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`,
      labelX: (startX + endX) / 2,
      labelY: (startY + endY) / 2 + (isBacktrack ? -15 : -6),
      isSelfLoop,
      isBacktrack,
      p0,
      p1,
      p2,
      p3,
    };
  };

  // Compute animated visitor token coordinates during Session Replay
  const replayTokenPosition = useMemo(() => {
    if (!replayActive || !currentReplayStep) return null;
    const fromNode = layoutGeometry.nodePositions.get(currentReplayStep.pagePath);
    if (!fromNode) return null;

    if (!currentReplayStep.nextPagePath) {
      return { x: fromNode.x, y: fromNode.y };
    }

    const curve = computeEdgeCurveGeometry(
      currentReplayStep.pagePath,
      currentReplayStep.nextPagePath
    );
    if (!curve) return { x: fromNode.x, y: fromNode.y };

    const t = isPlayingReplay ? stepProgress : 0.5;
    return interpolatePointOnCubicBezier(t, curve.p0, curve.p1, curve.p2, curve.p3);
  }, [replayActive, currentReplayStep, layoutGeometry, isPlayingReplay, stepProgress]);

  // Link-Weight Heatmap Color & Stroke Width Helper
  const getLinkHeatmapStyle = (
    edge: MarkovTransitionCell,
    isExit: boolean,
    isBacktrack: boolean
  ) => {
    const volRatio = edge.count / layoutGeometry.maxEdgeCount;
    const heatScore = 0.55 * edge.probability + 0.45 * volRatio;
    const strokeWidth = Number((2.0 + Math.pow(heatScore, 0.85) * 7.5).toFixed(2));

    if (isExit) {
      return {
        stroke: '#A8A29E',
        marker: 'url(#arrow-cool)',
        heatLabel: 'Exit Sink',
        strokeWidth: Math.max(1.5, strokeWidth * 0.7),
      };
    }
    if (isBacktrack) {
      return {
        stroke: '#C2410C',
        marker: 'url(#arrow-warm)',
        heatLabel: 'Loop / Backtrack',
        strokeWidth,
      };
    }
    if (heatScore >= 0.62) {
      return {
        stroke: 'url(#grad-hot)',
        badgeColor: '#B45309',
        marker: 'url(#arrow-hot)',
        heatLabel: 'Critical High-Volume Corridor',
        strokeWidth,
      };
    }
    if (heatScore >= 0.35) {
      return {
        stroke: 'url(#grad-warm)',
        badgeColor: '#D97706',
        marker: 'url(#arrow-warm)',
        heatLabel: 'Moderate Traffic Flow',
        strokeWidth,
      };
    }
    return {
      stroke: '#78716C',
      badgeColor: '#78716C',
      marker: 'url(#arrow-taupe)',
      heatLabel: 'Standard Path',
      strokeWidth,
    };
  };

  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target === svgRef.current || (e.target as SVGElement).tagName === 'svg') {
      setDraggingState({
        type: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        origX: pan.x,
        origY: pan.y,
      });
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    soundFX.playClick();
    const cur = nodeOffsets[path] || { dx: 0, dy: 0 };
    setDraggingState({
      type: 'node',
      nodePath: path,
      startX: e.clientX,
      startY: e.clientY,
      origX: cur.dx,
      origY: cur.dy,
    });
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggingState) return;
    const dx = (e.clientX - draggingState.startX) / zoom;
    const dy = (e.clientY - draggingState.startY) / zoom;

    if (draggingState.type === 'pan') {
      setPan({ x: draggingState.origX + dx, y: draggingState.origY + dy });
    } else if (draggingState.type === 'node' && draggingState.nodePath) {
      setNodeOffsets((prev) => ({
        ...prev,
        [draggingState.nodePath!]: {
          dx: draggingState.origX + dx,
          dy: draggingState.origY + dy,
        },
      }));
    }
  };

  const handleSvgMouseUp = () => {
    setDraggingState(null);
  };

  // Touch & Pinch-to-Zoom Handlers
  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 2) {
      setPinchStartDist(calculateTouchDistance(e.touches));
      setPinchStartZoom(zoom);
    } else if (e.touches.length === 1) {
      setDraggingState({
        type: 'pan',
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        origX: pan.x,
        origY: pan.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 2 && pinchStartDist) {
      const dist = calculateTouchDistance(e.touches);
      if (dist > 0) {
        const ratio = dist / pinchStartDist;
        setZoom(Math.min(1.65, Math.max(0.65, Number((pinchStartZoom * ratio).toFixed(2)))));
      }
    } else if (e.touches.length === 1 && draggingState) {
      const dx = (e.touches[0].clientX - draggingState.startX) / zoom;
      const dy = (e.touches[0].clientY - draggingState.startY) / zoom;
      if (draggingState.type === 'pan') {
        setPan({ x: draggingState.origX + dx, y: draggingState.origY + dy });
      }
    }
  };

  const handleTouchEnd = () => {
    setPinchStartDist(null);
    setDraggingState(null);
  };

  const handleResetTopologyView = () => {
    soundFX.playClick();
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setNodeOffsets({});
    onSelectNode(null);
  };

  const handleExportSvgSnapshot = () => {
    soundFX.playChime();
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgRef.current);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'navpattern-topology-heatmap.svg');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleStartOrToggleReplay = (cohort?: ReplayCohortMode) => {
    soundFX.playChime();
    if (cohort) {
      setReplayCohort(cohort);
    }
    setReplayActive(true);
    setReplayStepIdx(0);
    setStepProgress(0);
    setIsPlayingReplay(true);
  };

  return (
    <div className="space-y-6">
      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E5E0D5]">
        <div>
          <h2 className="text-base font-semibold text-[#2C2825]">
            Session Volume Node-Size &amp; Link-Weight Heatmap Topology
          </h2>
          <p className="text-xs text-[#78716C] mt-0.5">
            Node radii scale logarithmically with session volume. Link stroke weight and warm terracotta gradients encode transition traffic intensity. Drag any node or launch Session Replay.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[#78716C]" />
            <label htmlFor="min-prob-slider" className="text-xs font-medium text-[#2C2825] whitespace-nowrap">
              Min Prob:
            </label>
            <input
              id="min-prob-slider"
              type="range"
              min={0.02}
              max={0.4}
              step={0.02}
              value={minProbFilter}
              onChange={(e) => setMinProbFilter(parseFloat(e.target.value))}
              className="w-24 accent-[#D97706] cursor-pointer"
            />
            <span className="text-xs font-mono font-semibold text-[#2C2825] tabular-nums w-10">
              {Math.round(minProbFilter * 100)}%
            </span>
          </div>

          {/* Interactive Pan / Zoom / Export Controls */}
          <div className="flex items-center gap-1 bg-[#EFECE4] p-1 rounded-lg border border-[#E5E0D5]">
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                setZoom((z) => Math.min(1.6, Number((z + 0.15).toFixed(2))));
              }}
              className="p-1.5 text-[#2C2825] hover:bg-[#FFFFFF] rounded transition-colors"
              aria-label="Zoom in topology graph"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-1.5 text-[#2C2825] tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                setZoom((z) => Math.max(0.65, Number((z - 0.15).toFixed(2))));
              }}
              className="p-1.5 text-[#2C2825] hover:bg-[#FFFFFF] rounded transition-colors"
              aria-label="Zoom out topology graph"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetTopologyView}
              className="px-2 py-1 text-xs font-medium text-[#2C2825] hover:bg-[#FFFFFF] rounded transition-colors flex items-center gap-1 whitespace-nowrap"
              title="Reset Pan, Zoom, and Node Positions"
            >
              <RotateCcw className="w-3 h-3" />
              Reset View
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportSvgSnapshot}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#2C2825] bg-[#FFFFFF] border border-[#E5E0D5] hover:bg-[#F7F4EB] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-[#B45309]" />
            Snapshot SVG
          </button>
        </div>
      </div>

      {/* Session Replay Interactive Studio Bar */}
      <div className="p-4 rounded-xl border border-[#E5E0D5] bg-[#F7F4EB] space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-[#B45309]" />
            <div>
              <h3 className="text-xs font-semibold text-[#2C2825]">
                Session Replay Playback Studio (Step-by-Step Topology Trajectory)
              </h3>
              <p className="text-[11px] text-[#78716C]">
                Select an anomalous loop trajectory or a high-conversion buyer session to animate page-by-page transitions directly on the topology graph.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Cohort Filter Buttons */}
            <div className="flex items-center gap-1 p-1 bg-[#EFECE4] rounded-lg border border-[#E5E0D5]">
              <button
                type="button"
                onClick={() => {
                  soundFX.playPop();
                  setReplayCohort('anomalous');
                  setSelectedReplaySessionId('');
                  setReplayStepIdx(0);
                  setReplayActive(true);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  replayCohort === 'anomalous'
                    ? 'bg-[#FFFFFF] text-[#B45309] shadow-xs font-semibold'
                    : 'text-[#78716C] hover:text-[#2C2825]'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" />
                Anomalous / Loop Sessions
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFX.playPop();
                  setReplayCohort('high_conversion');
                  setSelectedReplaySessionId('');
                  setReplayStepIdx(0);
                  setReplayActive(true);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  replayCohort === 'high_conversion'
                    ? 'bg-[#FFFFFF] text-[#15803D] shadow-xs font-semibold'
                    : 'text-[#78716C] hover:text-[#2C2825]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#15803D]" />
                High-Conversion Sessions
              </button>
            </div>

            {/* Session Selector Dropdown */}
            <select
              aria-label="Select Session for Replay"
              value={activeReplaySession?.sessionId || ''}
              onChange={(e) => {
                soundFX.playPop();
                setSelectedReplaySessionId(e.target.value);
                setReplayStepIdx(0);
                setStepProgress(0);
                setReplayActive(true);
              }}
              className="px-3 py-1.5 text-xs font-mono border border-[#E5E0D5] rounded-lg bg-[#FFFFFF] text-[#2C2825]"
            >
              {replayCandidates.map((s) => (
                <option key={s.sessionId} value={s.sessionId}>
                  {s.sessionId} ({s.visitorIp}) · {s.pathSequence.length} steps ·{' '}
                  {s.converted
                    ? 'Converted'
                    : `Anomaly ${s.anomalyScore.toFixed(2)} (${s.anomalyReason})`}
                </option>
              ))}
            </select>

            {/* Playback Transport Controls */}
            <div className="flex items-center gap-1 bg-[#FFFFFF] px-2 py-1 rounded-lg border border-[#E5E0D5]">
              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  setReplayActive(true);
                  setIsPlayingReplay(false);
                  setReplayStepIdx((idx) => Math.max(0, idx - 1));
                  setStepProgress(0.5);
                }}
                disabled={replaySteps.length === 0}
                className="p-1 text-[#2C2825] hover:bg-[#F7F4EB] rounded disabled:opacity-40"
                aria-label="Previous Replay Step"
                title="Previous Step"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!replayActive) {
                    handleStartOrToggleReplay();
                  } else if (isPlayingReplay) {
                    soundFX.playClick();
                    setIsPlayingReplay(false);
                  } else {
                    soundFX.playChime();
                    if (replayStepIdx >= replaySteps.length - 1) {
                      setReplayStepIdx(0);
                    }
                    setStepProgress(0);
                    setIsPlayingReplay(true);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-[#FFFFFF] bg-[#B45309] hover:bg-[#92400E] rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                {replayActive && isPlayingReplay ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    Pause Replay
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    {replayActive ? 'Resume Replay' : 'Play Session Replay'}
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  setReplayActive(true);
                  setIsPlayingReplay(false);
                  setReplayStepIdx((idx) => Math.min(replaySteps.length - 1, idx + 1));
                  setStepProgress(0.5);
                }}
                disabled={replaySteps.length === 0}
                className="p-1 text-[#2C2825] hover:bg-[#F7F4EB] rounded disabled:opacity-40"
                aria-label="Next Replay Step"
                title="Next Step"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  setReplaySpeed((s) => (s === 1 ? 2 : 1));
                }}
                className="px-2 py-0.5 text-[11px] font-mono font-semibold text-[#2C2825] bg-[#F7F4EB] hover:bg-[#EFECE4] rounded border border-[#E5E0D5]"
                aria-label="Toggle Replay Playback Speed"
              >
                {replaySpeed}x
              </button>

              {replayActive && (
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playClick();
                    setIsPlayingReplay(false);
                    setReplayActive(false);
                  }}
                  className="p-1 text-[#78716C] hover:text-[#2C2825] rounded"
                  aria-label="Exit Session Replay Mode"
                  title="Exit Replay Mode"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Step-by-Step Interactive Timeline Strip when Replay is Active */}
        {activeReplaySession && (
          <div className="pt-2 border-t border-[#E5E0D5] space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
              <div className="text-[#2C2825]">
                <span className="font-semibold">{activeReplaySession.sessionId}</span> · Device:{' '}
                <span>{activeReplaySession.device}</span> · Cluster:{' '}
                <span>{activeReplaySession.embeddingCluster}</span> · Anomaly Score:{' '}
                <span className="font-semibold text-[#B45309]">
                  {activeReplaySession.anomalyScore.toFixed(2)} ({activeReplaySession.anomalyReason})
                </span>
              </div>
              <div className="text-[#78716C]">
                {replayActive && currentReplayStep ? (
                  <span className="text-[#2C2825] font-semibold">
                    Step {currentReplayStep.stepIndex + 1} of {replaySteps.length}:{' '}
                    {currentReplayStep.pagePath} → {currentReplayStep.nextPagePath || 'GOAL REACHED'}{' '}
                    (Dwell: {currentReplayStep.dwellSec}s · T+{currentReplayStep.cumulativeTimeSec}s)
                  </span>
                ) : (
                  <span>Click &ldquo;Play Session Replay&rdquo; or any step below to inspect trajectory</span>
                )}
              </div>
            </div>

            {/* Interactive Step Breadcrumb Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              {replaySteps.map((step) => {
                const isCurrent = replayActive && currentReplayStep?.stepIndex === step.stepIndex;
                const isVisited = replayActive && (currentReplayStep?.stepIndex ?? -1) > step.stepIndex;

                return (
                  <React.Fragment key={step.stepIndex}>
                    <button
                      type="button"
                      onClick={() => {
                        soundFX.playPop();
                        setReplayActive(true);
                        setIsPlayingReplay(false);
                        setReplayStepIdx(step.stepIndex);
                        setStepProgress(0.5);
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all whitespace-nowrap shrink-0 border ${
                        isCurrent
                          ? 'bg-[#B45309] text-[#FFFFFF] border-[#92400E] font-semibold shadow-xs'
                          : isVisited
                          ? 'bg-[#FEF3C7] text-[#2C2825] border-[#D97706]'
                          : 'bg-[#FFFFFF] text-[#78716C] border-[#E5E0D5] hover:text-[#2C2825]'
                      }`}
                    >
                      #{step.stepIndex + 1} {step.pagePath} ({step.dwellSec}s)
                    </button>
                    {step.nextPagePath && (
                      <ArrowRight className="w-3 h-3 text-[#78716C] shrink-0" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Interactive SVG Flow Diagram */}
      <div className="bg-[#F9F8F4] border border-[#E5E0D5] rounded-xl p-4 overflow-x-auto">
        <div className="min-w-[860px]">
          {/* Stage Column Headers */}
          <div className="grid grid-cols-4 gap-4 mb-2 px-4">
            {stagedNodes.map((stage) => (
              <div key={stage.stageTitle} className="text-xs font-semibold text-[#78716C]">
                {stage.stageTitle}
              </div>
            ))}
          </div>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${layoutGeometry.width} ${layoutGeometry.height}`}
            onMouseDown={handleSvgMouseDown}
            onMouseMove={handleSvgMouseMove}
            onMouseUp={handleSvgMouseUp}
            onMouseLeave={handleSvgMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="w-full h-[430px] select-none cursor-grab active:cursor-grabbing bg-[#FDFBF7] rounded-lg border border-[#E5E0D5] touch-none"
            role="img"
            aria-label="Website Navigation Flow Heatmap Graph"
          >
            <defs>
              {/* Link-Weight Thermal Heatmap Gradients */}
              <linearGradient id="grad-hot" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#D97706" />
                <stop offset="50%" stopColor="#C2410C" />
                <stop offset="100%" stopColor="#9A3412" />
              </linearGradient>
              <linearGradient id="grad-warm" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#78716C" />
                <stop offset="100%" stopColor="#D97706" />
              </linearGradient>

              <marker
                id="arrow-hot"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#9A3412" />
              </marker>
              <marker
                id="arrow-warm"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#D97706" />
              </marker>
              <marker
                id="arrow-taupe"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#78716C" />
              </marker>
              <marker
                id="arrow-cool"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#A8A29E" />
              </marker>
              <marker
                id="arrow-replay"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#B45309" />
              </marker>
            </defs>

            <g
              transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
              style={{ transformOrigin: 'center center' }}
            >
              {/* Edges */}
              {layoutGeometry.filteredEdges.map((edge) => {
                const curve = computeEdgeCurveGeometry(edge.fromPage, edge.toPage);
                if (!curve) return null;

                const isExit = edge.toPage === 'EXIT';
                const heatStyle = getLinkHeatmapStyle(
                  edge,
                  isExit,
                  curve.isBacktrack || curve.isSelfLoop
                );

                const isHovered =
                  hoveredEdge?.fromPage === edge.fromPage && hoveredEdge?.toPage === edge.toPage;

                // Determine if this edge is part of the active Session Replay
                const isCurrentReplayEdge =
                  replayActive &&
                  currentReplayStep?.pagePath === edge.fromPage &&
                  currentReplayStep?.nextPagePath === edge.toPage;

                const isPastReplayEdge =
                  replayActive &&
                  replaySteps.some(
                    (s) =>
                      s.stepIndex < (currentReplayStep?.stepIndex ?? 0) &&
                      s.pagePath === edge.fromPage &&
                      s.nextPagePath === edge.toPage
                  );

                const edgeOpacity = replayActive
                  ? isCurrentReplayEdge
                    ? 1
                    : isPastReplayEdge
                    ? 0.85
                    : 0.16
                  : isHovered
                  ? 0.98
                  : isExit
                  ? 0.45
                  : 0.85;

                return (
                  <g
                    key={`${edge.fromPage}->${edge.toPage}`}
                    onMouseEnter={() => setHoveredEdge(edge)}
                    onMouseLeave={() => setHoveredEdge(null)}
                    className="cursor-pointer"
                  >
                    <path
                      d={curve.pathD}
                      fill="none"
                      stroke={
                        isCurrentReplayEdge
                          ? '#B45309'
                          : isPastReplayEdge
                          ? '#D97706'
                          : heatStyle.stroke
                      }
                      strokeWidth={
                        isCurrentReplayEdge
                          ? Math.max(5.5, heatStyle.strokeWidth + 2)
                          : isHovered
                          ? heatStyle.strokeWidth + 2
                          : heatStyle.strokeWidth
                      }
                      strokeOpacity={edgeOpacity}
                      strokeDasharray={
                        isCurrentReplayEdge
                          ? '8 4'
                          : curve.isBacktrack || curve.isSelfLoop
                          ? '5 3'
                          : undefined
                      }
                      markerEnd={isCurrentReplayEdge ? 'url(#arrow-replay)' : heatStyle.marker}
                    />
                    {((!replayActive && edge.probability >= 0.16) ||
                      isHovered ||
                      isCurrentReplayEdge) && (
                      <g transform={`translate(${curve.labelX}, ${curve.labelY})`}>
                        <rect
                          x="-30"
                          y="-9"
                          width="60"
                          height="16"
                          rx="3"
                          fill={isCurrentReplayEdge ? '#FEF3C7' : '#FFFFFF'}
                          stroke={
                            isCurrentReplayEdge
                              ? '#B45309'
                              : heatStyle.badgeColor || '#78716C'
                          }
                          strokeWidth={isCurrentReplayEdge ? '1.5' : '1'}
                        />
                        <text
                          x="0"
                          y="2"
                          textAnchor="middle"
                          className="text-[9.5px] font-mono fill-[#2C2825] font-semibold"
                        >
                          {Math.round(edge.probability * 100)}% ({edge.count})
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Volume-Scaled Nodes */}
              {Array.from(layoutGeometry.nodePositions.values()).map(
                ({ x, y, radius, heatRatio, node }) => {
                  const isSelected = selectedNode === node.path;
                  const isGoal = node.path === conversionTargetPath;
                  const isExit = node.isExitSink;

                  // Replay highlight states
                  const isCurrentReplayNode =
                    replayActive && currentReplayStep?.pagePath === node.path;
                  const isNextReplayNode =
                    replayActive && currentReplayStep?.nextPagePath === node.path;
                  const visitedStepsForNode = replayActive
                    ? replaySteps.filter(
                        (s) =>
                          s.pagePath === node.path &&
                          s.stepIndex <= (currentReplayStep?.stepIndex ?? 0)
                      )
                    : [];

                  const circleFill = isCurrentReplayNode
                    ? '#FDE68A'
                    : isGoal
                    ? '#ECFDF5'
                    : isExit
                    ? '#F7F4EB'
                    : heatRatio >= 0.75
                    ? '#FEF3C7'
                    : heatRatio >= 0.45
                    ? '#F9F8F4'
                    : '#FFFFFF';

                  const circleStroke = isCurrentReplayNode
                    ? '#B45309'
                    : isNextReplayNode
                    ? '#D97706'
                    : isSelected
                    ? '#2C2825'
                    : isGoal
                    ? '#15803D'
                    : isExit
                    ? '#A8A29E'
                    : heatRatio >= 0.75
                    ? '#B45309'
                    : heatRatio >= 0.45
                    ? '#D97706'
                    : '#78716C';

                  const nodeOpacity =
                    replayActive &&
                    !isCurrentReplayNode &&
                    !isNextReplayNode &&
                    visitedStepsForNode.length === 0
                      ? 0.4
                      : 1;

                  return (
                    <g
                      key={node.path}
                      transform={`translate(${x}, ${y})`}
                      opacity={nodeOpacity}
                      onMouseDown={(e) => handleNodeMouseDown(e, node.path)}
                      onClick={() => {
                        if (!isExit) {
                          soundFX.playPop();
                          onSelectNode(isSelected ? null : node.path);
                        }
                      }}
                      className={isExit ? 'cursor-default' : 'cursor-pointer'}
                    >
                      {/* Active Replay Node Halo */}
                      {isCurrentReplayNode && (
                        <circle
                          r={radius + 9}
                          fill="none"
                          stroke="#B45309"
                          strokeWidth="2.5"
                          strokeDasharray="4 2"
                        />
                      )}

                      {/* Outer Ring for Conversion Goal */}
                      {isGoal && (
                        <circle
                          r={radius + 6}
                          fill="none"
                          stroke="#15803D"
                          strokeWidth="1.5"
                          strokeOpacity="0.45"
                          strokeDasharray="3 2"
                        />
                      )}

                      {/* Logarithmic Session Volume Circle */}
                      <circle
                        r={radius}
                        fill={circleFill}
                        stroke={circleStroke}
                        strokeWidth={
                          isCurrentReplayNode || isSelected || isGoal ? 2.75 : 1.75
                        }
                      />

                      {/* Session Volume Count Inside Circle */}
                      <text
                        x="0"
                        y="-2"
                        textAnchor="middle"
                        className="text-[11px] font-mono font-bold fill-[#2C2825]"
                      >
                        {node.uniqueSessions}
                      </text>
                      <text
                        x="0"
                        y="9"
                        textAnchor="middle"
                        className="text-[8.5px] font-mono fill-[#78716C]"
                      >
                        sess
                      </text>

                      {/* Replay Step Number Badge on Visited Nodes */}
                      {visitedStepsForNode.length > 0 && (
                        <g transform={`translate(${radius - 4}, ${-radius + 4})`}>
                          <circle r="10" fill="#B45309" stroke="#FFFFFF" strokeWidth="1.5" />
                          <text
                            x="0"
                            y="3"
                            textAnchor="middle"
                            className="text-[8.5px] font-mono font-bold fill-[#FFFFFF]"
                          >
                            #{visitedStepsForNode[visitedStepsForNode.length - 1].stepIndex + 1}
                          </text>
                        </g>
                      )}

                      {/* URI Path Label Box Below Node */}
                      <g transform={`translate(0, ${radius + 14})`}>
                        <rect
                          x="-56"
                          y="-9"
                          width="112"
                          height="18"
                          rx="3"
                          fill="#FFFFFF"
                          stroke={isCurrentReplayNode ? '#B45309' : '#E5E0D5'}
                          strokeWidth={isCurrentReplayNode ? '1.5' : '1'}
                        />
                        <text
                          x="0"
                          y="3"
                          textAnchor="middle"
                          className="text-[10px] font-mono font-semibold fill-[#2C2825]"
                        >
                          {node.path.length > 15 ? node.path.slice(0, 14) + '…' : node.path}
                        </text>
                      </g>
                    </g>
                  );
                }
              )}

              {/* Animated Visitor Session Replay Token Traveling Along Active Transition */}
              {replayActive && replayTokenPosition && currentReplayStep && (
                <g
                  transform={`translate(${replayTokenPosition.x}, ${replayTokenPosition.y})`}
                  className="pointer-events-none"
                >
                  <circle r="13" fill="#B45309" fillOpacity="0.22" />
                  <circle r="8" fill="#B45309" stroke="#FFFFFF" strokeWidth="2" />
                  <rect
                    x="-42"
                    y="-28"
                    width="84"
                    height="16"
                    rx="4"
                    fill="#2C2825"
                  />
                  <text
                    x="0"
                    y="-17"
                    textAnchor="middle"
                    className="text-[9px] font-mono font-bold fill-[#FFFFFF]"
                  >
                    Step #{currentReplayStep.stepIndex + 1} · {currentReplayStep.dwellSec}s
                  </text>
                </g>
              )}
            </g>
          </svg>

          {/* Heatmap Legend & Hover Readout */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-[#E5E0D5] text-xs text-[#78716C]">
            <div className="flex flex-wrap items-center gap-5">
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-1.5 rounded-xs bg-gradient-to-r from-[#D97706] to-[#9A3412] inline-block" />
                Hot Corridor (High Volume)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-1 rounded-xs bg-gradient-to-r from-[#78716C] to-[#D97706] inline-block" />
                Warm Flow (Moderate)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-0.5 bg-[#78716C] inline-block" />
                Standard Flow
              </span>
              <span className="flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-[#78716C]" />
                Node Radius ∝ log(Unique Sessions)
              </span>
            </div>

            <div className="font-mono text-xs text-[#2C2825] tabular-nums">
              {hoveredEdge ? (
                <span>
                  Path: <strong>{hoveredEdge.fromPage}</strong> →{' '}
                  <strong>{hoveredEdge.toPage}</strong> · Vol:{' '}
                  <strong>{hoveredEdge.count} hits</strong> · Prob:{' '}
                  <strong>{(hoveredEdge.probability * 100).toFixed(1)}%</strong> · Dwell:{' '}
                  {hoveredEdge.avgDwellSec}s
                </span>
              ) : (
                <span>Drag nodes or pinch-zoom · Click any node to isolate state transitions</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Node Inspection Panel or Page Node Summary Table */}
      {activeNodeDetail ? (
        <div className="border border-[#E5E0D5] rounded-xl p-5 bg-[#FFFFFF] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E0D5] pb-3">
            <div>
              <span className="text-xs text-[#78716C]">
                Selected State Node · GraphFrames Centrality &amp; Markov Absorption
              </span>
              <h3 className="text-base font-mono font-semibold text-[#2C2825]">
                {activeNodeDetail.path}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-xs font-mono tabular-nums">
              <div>
                <span className="text-[#78716C] block">PageRank Score</span>
                <span className="text-[#B45309] font-semibold">
                  {activeNodeDetail.pageRank.toFixed(4)}
                </span>
              </div>
              <div>
                <span className="text-[#78716C] block">Betweenness</span>
                <span className="text-[#2C2825] font-semibold">
                  {activeNodeDetail.betweennessCentrality.toFixed(3)}
                </span>
              </div>
              <div>
                <span className="text-[#78716C] block">Expected Steps to Goal</span>
                <span className="text-[#15803D] font-semibold">
                  {activeNodeDetail.expectedStepsToConversion !== null
                    ? `${activeNodeDetail.expectedStepsToConversion} steps`
                    : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-[#78716C] block">Goal Absorption Prob</span>
                <span className="text-[#15803D] font-semibold">
                  {(activeNodeDetail.conversionAbsorptionProb * 100).toFixed(1)}%
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  onSelectNode(null);
                }}
                className="px-2.5 py-1 font-sans text-xs font-medium text-[#2C2825] bg-[#EFECE4] hover:bg-[#E5E0D5] rounded"
              >
                Show All Nodes
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-xs font-semibold text-[#2C2825] mb-2">
                Incoming Referrer States → {activeNodeDetail.path} (In-Degree: {activeNodeDetail.inDegree})
              </h4>
              <div className="space-y-1.5">
                {transitions
                  .filter((t) => t.toPage === activeNodeDetail.path)
                  .slice(0, 5)
                  .map((t) => (
                    <div
                      key={t.fromPage}
                      className="flex items-center justify-between text-xs py-1.5 px-2.5 bg-[#F9F8F4] border border-[#E5E0D5] rounded font-mono tabular-nums"
                    >
                      <span className="text-[#2C2825]">{t.fromPage}</span>
                      <span className="text-[#78716C]">
                        {t.count} transitions ({(t.probability * 100).toFixed(1)}%)
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-[#2C2825] mb-2">
                Outgoing Next-Page States from {activeNodeDetail.path} (Out-Degree: {activeNodeDetail.outDegree})
              </h4>
              <div className="space-y-1.5">
                {transitions
                  .filter((t) => t.fromPage === activeNodeDetail.path)
                  .slice(0, 5)
                  .map((t) => (
                    <div
                      key={t.toPage}
                      className="flex items-center justify-between text-xs py-1.5 px-2.5 bg-[#F9F8F4] border border-[#E5E0D5] rounded font-mono tabular-nums"
                    >
                      <span className="flex items-center gap-1.5 text-[#2C2825]">
                        <ArrowRight className="w-3 h-3 text-[#B45309]" />
                        {t.toPage}
                      </span>
                      <span className="font-semibold text-[#B45309]">
                        P = {(t.probability * 100).toFixed(1)}% ({t.count} hits)
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-[#E5E0D5] rounded-xl overflow-hidden bg-[#FFFFFF]">
          <div className="px-4 py-3 border-b border-[#E5E0D5] bg-[#F9F8F4] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#2C2825]">
              Page Node GraphFrames Centrality, Markov Absorption &amp; Temporal Sparkline Matrix
            </h3>
            <span className="text-xs text-[#78716C]">
              Click any row to isolate node on topology heatmap
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E0D5] bg-[#F7F4EB] text-[#78716C] font-medium">
                  <th className="py-2.5 px-3">Page URI Path</th>
                  <th className="py-2.5 px-3 text-right">Sessions (Hits)</th>
                  <th className="py-2.5 px-3 text-right">PageRank</th>
                  <th className="py-2.5 px-3 text-right">In / Out Deg</th>
                  <th className="py-2.5 px-3 text-right">Betweenness</th>
                  <th className="py-2.5 px-3 text-right">Steps to Goal</th>
                  <th className="py-2.5 px-3 text-right">Goal Absorption</th>
                  <th className="py-2.5 px-3 text-right">Session Traffic Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D5] font-mono tabular-nums">
                {pageMetrics.map((node) => {
                  const maxBucket = Math.max(1, ...node.sparklineBuckets);
                  const points = node.sparklineBuckets
                    .map((v, i) => `${i * 11},${22 - Math.round((v / maxBucket) * 18)}`)
                    .join(' ');

                  return (
                    <tr
                      key={node.path}
                      onClick={() => {
                        soundFX.playPop();
                        onSelectNode(node.path);
                      }}
                      className="hover:bg-[#F9F8F4] cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3 font-semibold text-[#2C2825]">
                        {node.path}
                        {node.path === conversionTargetPath && (
                          <span className="ml-2 font-sans text-[11px] font-normal text-[#15803D]">
                            · Goal
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#2C2825]">
                        {node.uniqueSessions} ({node.totalVisits})
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-[#B45309]">
                        {node.pageRank.toFixed(3)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#78716C]">
                        {node.inDegree} / {node.outDegree}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#2C2825]">
                        {node.betweennessCentrality.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#2C2825]">
                        {node.expectedStepsToConversion !== null
                          ? `${node.expectedStepsToConversion}`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-[#15803D]">
                        {(node.conversionAbsorptionProb * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <svg
                          width="80"
                          height="24"
                          viewBox="0 0 80 24"
                          className="inline-block overflow-visible"
                          aria-label={`Traffic trend for ${node.path}`}
                        >
                          <polyline
                            fill="none"
                            stroke="#D97706"
                            strokeWidth="1.75"
                            points={points}
                          />
                        </svg>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
