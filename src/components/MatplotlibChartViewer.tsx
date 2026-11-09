import React, { useMemo, useRef, useState } from 'react';
import {
  AnalysisSummary,
  ReconstructedSession,
  evaluateFunnelSteps,
} from '../utils/navigationMining';
import { soundFX } from '../utils/soundEffects';
import { ZoomIn, ZoomOut, RotateCcw, Download, BarChart3 } from 'lucide-react';

interface MatplotlibChartViewerProps {
  summary: AnalysisSummary;
  sessions: ReconstructedSession[];
  funnelSteps: string[];
}

type MatplotlibPlotType = 'pagerank' | 'markov' | 'funnel' | 'dwell';

export const MatplotlibChartViewer: React.FC<MatplotlibChartViewerProps> = ({
  summary,
  sessions,
  funnelSteps,
}) => {
  const [activePlot, setActivePlot] = useState<MatplotlibPlotType>('pagerank');
  const [zoom, setZoom] = useState<number>(1);
  const [inspectedPoint, setInspectedPoint] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const funnelMetrics = useMemo(
    () => evaluateFunnelSteps(sessions, funnelSteps),
    [sessions, funnelSteps]
  );

  // Compute dwell-time histogram bins across sessions
  const dwellHistogram = useMemo(() => {
    const bins = [
      { label: '0–30s', min: 0, max: 30, count: 0 },
      { label: '31–60s', min: 31, max: 60, count: 0 },
      { label: '61–120s', min: 61, max: 120, count: 0 },
      { label: '121–180s', min: 121, max: 180, count: 0 },
      { label: '181–240s', min: 181, max: 240, count: 0 },
      { label: '240s+', min: 241, max: 99999, count: 0 },
    ];
    for (const s of sessions) {
      const d = s.totalDurationSec;
      const bin = bins.find((b) => d >= b.min && d <= b.max) || bins[bins.length - 1];
      bin.count += 1;
    }
    return bins;
  }, [sessions]);

  const handleExportSvg = () => {
    soundFX.playChime();
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgRef.current);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `matplotlib-${activePlot}-figure.svg`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const topPages = summary.pageMetrics.slice(0, 6);

  return (
    <div className="border border-[#E5E0D5] rounded-xl bg-[#F9F8F4] p-5 space-y-4 shadow-xs">
      {/* Header & Plot Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E0D5] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#B45309]" />
            <h3 className="text-sm font-semibold text-[#2C2825]">
              Matplotlib Analytical Figure Studio (Publication SVG Output)
            </h3>
          </div>
          <p className="text-xs text-[#78716C] mt-0.5">
            High-resolution scientific plots rendered with Matplotlib rcParams styling. Click any data bar or cell to inspect exact telemetry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented Figure Selector */}
          <div className="flex items-center gap-1 p-1 bg-[#EFECE4] rounded-lg border border-[#E5E0D5]">
            {(
              [
                { id: 'pagerank', label: 'PageRank Curve' },
                { id: 'markov', label: 'Markov Heatmap' },
                { id: 'funnel', label: 'Funnel Drop-Off' },
                { id: 'dwell', label: 'Dwell Histogram' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  soundFX.playPop();
                  setActivePlot(tab.id);
                  setInspectedPoint(null);
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activePlot === tab.id
                    ? 'bg-[#FFFFFF] text-[#2C2825] shadow-xs'
                    : 'text-[#78716C] hover:text-[#2C2825]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Zoom & Export Controls */}
          <div className="flex items-center gap-1 bg-[#EFECE4] p-1 rounded-lg border border-[#E5E0D5]">
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                setZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(2))));
              }}
              className="p-1 text-[#2C2825] hover:bg-[#FFFFFF] rounded"
              aria-label="Zoom in Matplotlib figure"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-1 text-[#2C2825] tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                setZoom((z) => Math.max(0.8, Number((z - 0.1).toFixed(2))));
              }}
              className="p-1 text-[#2C2825] hover:bg-[#FFFFFF] rounded"
              aria-label="Zoom out Matplotlib figure"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                setZoom(1);
                setInspectedPoint(null);
              }}
              className="p-1 text-[#2C2825] hover:bg-[#FFFFFF] rounded"
              aria-label="Reset Matplotlib figure zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportSvg}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#2C2825] bg-[#FFFFFF] border border-[#E5E0D5] hover:bg-[#F7F4EB] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-[#B45309]" />
            Export Figure SVG
          </button>
        </div>
      </div>

      {/* Matplotlib SVG Figure Viewport */}
      <div className="bg-[#FDFBF7] border border-[#E5E0D5] rounded-lg p-4 overflow-x-auto">
        <div className="min-w-[680px] flex justify-center">
          <svg
            ref={svgRef}
            viewBox="0 0 760 280"
            className="w-full h-[270px] select-none"
            role="img"
            aria-label={`Matplotlib ${activePlot} analytical plot`}
          >
            <g
              transform={`scale(${zoom})`}
              style={{ transformOrigin: 'center center' }}
            >
              {/* Figure Background & Matplotlib Axes Box */}
              <rect x="0" y="0" width="760" height="280" fill="#FDFBF7" rx="6" />
              <rect
                x="110"
                y="36"
                width="600"
                height="194"
                fill="#F9F8F4"
                stroke="#2C2825"
                strokeWidth="1"
              />

              {/* Subtle Matplotlib Dashed Gridlines */}
              {[0.25, 0.5, 0.75].map((ratio) => (
                <line
                  key={ratio}
                  x1="110"
                  y1={36 + 194 * ratio}
                  x2="710"
                  y2={36 + 194 * ratio}
                  stroke="#E5E0D5"
                  strokeDasharray="3 3"
                />
              ))}

              {/* PLOT 1: PageRank & Betweenness Centrality Distribution */}
              {activePlot === 'pagerank' && (
                <g>
                  <text
                    x="410"
                    y="22"
                    textAnchor="middle"
                    className="text-[12px] font-bold fill-[#2C2825]"
                  >
                    Fig 1. GraphFrames PageRank &amp; Betweenness Centrality by Page URI
                  </text>
                  {topPages.map((p, idx) => {
                    const y = 52 + idx * 29;
                    const maxPr = Math.max(0.05, ...topPages.map((n) => n.pageRank));
                    const barW = Math.round((p.pageRank / maxPr) * 460);
                    const betW = Math.round(p.betweennessCentrality * 220);

                    return (
                      <g
                        key={p.path}
                        className="cursor-pointer"
                        onClick={() => {
                          soundFX.playClick();
                          setInspectedPoint(
                            `${p.path} — PageRank: ${p.pageRank.toFixed(4)} | Betweenness: ${p.betweennessCentrality.toFixed(3)} | Goal Absorption: ${(p.conversionAbsorptionProb * 100).toFixed(1)}%`
                          );
                        }}
                      >
                        <text
                          x="102"
                          y={y + 12}
                          textAnchor="end"
                          className="text-[10px] font-mono fill-[#2C2825]"
                        >
                          {p.path.slice(0, 14)}
                        </text>
                        <rect
                          x="110"
                          y={y}
                          width={Math.max(6, barW)}
                          height="11"
                          fill="#D97706"
                          stroke="#B45309"
                          strokeWidth="0.8"
                        />
                        <rect
                          x="110"
                          y={y + 12}
                          width={Math.max(4, betW)}
                          height="7"
                          fill="#78716C"
                          opacity="0.75"
                        />
                        <text
                          x={116 + barW}
                          y={y + 10}
                          className="text-[9.5px] font-mono fill-[#2C2825] font-semibold"
                        >
                          PR={p.pageRank.toFixed(3)}
                        </text>
                      </g>
                    );
                  })}
                  <text
                    x="410"
                    y="258"
                    textAnchor="middle"
                    className="text-[10px] font-mono fill-[#78716C]"
                  >
                    Amber Bar: Normalized PageRank Score · Taupe Bar: Brandes Betweenness Centrality
                  </text>
                </g>
              )}

              {/* PLOT 2: Markov State Transition Heatmap */}
              {activePlot === 'markov' && (
                <g>
                  <text
                    x="410"
                    y="22"
                    textAnchor="middle"
                    className="text-[12px] font-bold fill-[#2C2825]"
                  >
                    Fig 2. First-Order Markov Transition Probability Matrix P(Xₜ₊₁ | Xₜ)
                  </text>
                  {topPages.slice(0, 5).map((rowPage, rIdx) => {
                    const cols = [...topPages.slice(0, 5).map((n) => n.path), 'EXIT'];
                    return (
                      <g key={rowPage.path}>
                        <text
                          x="104"
                          y={64 + rIdx * 36}
                          textAnchor="end"
                          className="text-[10px] font-mono fill-[#2C2825]"
                        >
                          {rowPage.path.slice(0, 13)}
                        </text>
                        {cols.map((colPath, cIdx) => {
                          const cell = summary.transitions.find(
                            (t) => t.fromPage === rowPage.path && t.toPage === colPath
                          );
                          const prob = cell ? cell.probability : 0;
                          const fill =
                            prob >= 0.55
                              ? '#B45309'
                              : prob >= 0.25
                              ? '#D97706'
                              : prob > 0
                              ? '#FDE68A'
                              : '#F9F8F4';
                          const textFill = prob >= 0.25 ? '#FFFFFF' : '#2C2825';

                          return (
                            <g
                              key={`${rowPage.path}->${colPath}`}
                              className="cursor-pointer"
                              onClick={() => {
                                soundFX.playClick();
                                setInspectedPoint(
                                  `Transition ${rowPage.path} → ${colPath}: Probability = ${(prob * 100).toFixed(1)}% (${cell?.count || 0} sessions)`
                                );
                              }}
                            >
                              <rect
                                x={115 + cIdx * 96}
                                y={44 + rIdx * 36}
                                width="90"
                                height="30"
                                fill={fill}
                                stroke="#E5E0D5"
                              />
                              <text
                                x={160 + cIdx * 96}
                                y={63 + rIdx * 36}
                                textAnchor="middle"
                                fill={textFill}
                                className="text-[10px] font-mono font-semibold"
                              >
                                {prob > 0 ? `${(prob * 100).toFixed(0)}%` : '0%'}
                              </text>
                              {rIdx === 4 && (
                                <text
                                  x={160 + cIdx * 96}
                                  y="246"
                                  textAnchor="middle"
                                  className="text-[9.5px] font-mono fill-[#78716C]"
                                >
                                  {colPath.slice(0, 11)}
                                </text>
                              )}
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}
                </g>
              )}

              {/* PLOT 3: Conversion Funnel Retention & Drop-Off Curve */}
              {activePlot === 'funnel' && (
                <g>
                  <text
                    x="410"
                    y="22"
                    textAnchor="middle"
                    className="text-[12px] font-bold fill-[#2C2825]"
                  >
                    Fig 3. Sequential Funnel Retention Curve &amp; Step Drop-Off Rate
                  </text>
                  {funnelMetrics.map((step, idx) => {
                    const stepW = 540 / Math.max(1, funnelMetrics.length);
                    const x = 130 + idx * stepW;
                    const barH = Math.max(6, Math.round(step.conversionFromStart * 165));
                    const y = 230 - barH;

                    return (
                      <g
                        key={step.path}
                        className="cursor-pointer"
                        onClick={() => {
                          soundFX.playClick();
                          setInspectedPoint(
                            `Funnel Step 0${idx + 1} (${step.path}): ${step.reachedSessions} sessions (${(step.conversionFromStart * 100).toFixed(1)}% retention, ${(step.stepDropOffRate * 100).toFixed(1)}% step drop-off)`
                          );
                        }}
                      >
                        <rect
                          x={x}
                          y={y}
                          width={Math.min(58, stepW - 18)}
                          height={barH}
                          fill="#D97706"
                          stroke="#B45309"
                        />
                        <text
                          x={x + Math.min(29, (stepW - 18) / 2)}
                          y={y - 6}
                          textAnchor="middle"
                          className="text-[10px] font-mono font-bold fill-[#2C2825]"
                        >
                          {(step.conversionFromStart * 100).toFixed(0)}%
                        </text>
                        <text
                          x={x + Math.min(29, (stepW - 18) / 2)}
                          y="246"
                          textAnchor="middle"
                          className="text-[9.5px] font-mono fill-[#2C2825]"
                        >
                          {step.path.slice(0, 11)}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}

              {/* PLOT 4: Session Dwell-Time Distribution Histogram */}
              {activePlot === 'dwell' && (
                <g>
                  <text
                    x="410"
                    y="22"
                    textAnchor="middle"
                    className="text-[12px] font-bold fill-[#2C2825]"
                  >
                    Fig 4. Reconstructed Session Dwell-Time Distribution Histogram
                  </text>
                  {dwellHistogram.map((bin, idx) => {
                    const maxBin = Math.max(1, ...dwellHistogram.map((b) => b.count));
                    const barH = Math.round((bin.count / maxBin) * 160);
                    const x = 135 + idx * 92;
                    const y = 230 - barH;

                    return (
                      <g
                        key={bin.label}
                        className="cursor-pointer"
                        onClick={() => {
                          soundFX.playClick();
                          setInspectedPoint(
                            `Duration Bucket ${bin.label}: ${bin.count} reconstructed visitor sessions`
                          );
                        }}
                      >
                        <rect
                          x={x}
                          y={y}
                          width="64"
                          height={Math.max(4, barH)}
                          fill="#B45309"
                          stroke="#78350F"
                        />
                        <text
                          x={x + 32}
                          y={y - 6}
                          textAnchor="middle"
                          className="text-[10px] font-mono font-bold fill-[#2C2825]"
                        >
                          {bin.count} sess
                        </text>
                        <text
                          x={x + 32}
                          y="246"
                          textAnchor="middle"
                          className="text-[10px] font-mono fill-[#78716C]"
                        >
                          {bin.label}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}
            </g>
          </svg>
        </div>

        {/* Interactive Point Readout Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-[#E5E0D5] text-xs font-mono text-[#78716C]">
          <span>
            {inspectedPoint || 'Click any bar, cell, or funnel step inside the Matplotlib figure to inspect values'}
          </span>
          <span>rcParams: figure.facecolor=#FDFBF7 · dpi=120</span>
        </div>
      </div>
    </div>
  );
};
