import React, { useMemo, useState } from 'react';
import {
  MarkovTransitionCell,
  SequentialPattern,
  predictNextNavigation,
} from '../utils/navigationMining';
import { calculateTouchDistance } from '../utils/gestures';
import { soundFX } from '../utils/soundEffects';
import { Plus, RotateCcw, ArrowRight, ZoomIn, ZoomOut } from 'lucide-react';

interface MarkovMatrixViewProps {
  uniquePages: string[];
  transitions: MarkovTransitionCell[];
  patterns: SequentialPattern[];
}

export const MarkovMatrixView: React.FC<MarkovMatrixViewProps> = ({
  uniquePages,
  transitions,
  patterns,
}) => {
  const matrixPages = useMemo(() => uniquePages.slice(0, 8), [uniquePages]);
  const targetColumns = useMemo(() => [...matrixPages, 'EXIT'], [matrixPages]);

  const [displayMode, setDisplayMode] = useState<'probability' | 'count'>('probability');
  const [simulationTrail, setSimulationTrail] = useState<string[]>(() =>
    uniquePages.length >= 2 ? [uniquePages[0], uniquePages[1]] : ['/home']
  );
  const [selectedNextStep, setSelectedNextStep] = useState<string>(
    uniquePages[0] || '/home'
  );
  const [matrixZoom, setMatrixZoom] = useState<number>(1);
  const [pinchStartDist, setPinchStartDist] = useState<number | null>(null);
  const [pinchStartZoom, setPinchStartZoom] = useState<number>(1);

  const cellLookup = useMemo(() => {
    const map = new Map<string, MarkovTransitionCell>();
    for (const t of transitions) {
      map.set(`${t.fromPage}|||${t.toPage}`, t);
    }
    return map;
  }, [transitions]);

  const predictions = useMemo(() => {
    return predictNextNavigation(simulationTrail, transitions, patterns);
  }, [simulationTrail, transitions, patterns]);

  const handleAppendStep = (page: string) => {
    soundFX.playPop();
    setSimulationTrail((prev) => [...prev, page]);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      setPinchStartDist(calculateTouchDistance(e.touches));
      setPinchStartZoom(matrixZoom);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchStartDist) {
      const dist = calculateTouchDistance(e.touches);
      if (dist > 0) {
        const ratio = dist / pinchStartDist;
        setMatrixZoom(Math.min(1.4, Math.max(0.8, Number((pinchStartZoom * ratio).toFixed(2)))));
      }
    }
  };

  const handleTouchEnd = () => {
    setPinchStartDist(null);
  };

  return (
    <div className="space-y-6">
      {/* Header & Mode Switch */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E5E0D5]">
        <div>
          <h2 className="text-base font-semibold text-[#2C2825]">
            First-Order Markov State Transition Matrix P(Xₜ₊₁ | Xₜ)
          </h2>
          <p className="text-xs text-[#78716C] mt-0.5">
            Row-stochastic probability distribution across website states. Pinch-to-zoom or click any transition cell to append it to the live predictor.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-[#EFECE4] rounded-lg border border-[#E5E0D5]">
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                setDisplayMode('probability');
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                displayMode === 'probability'
                  ? 'bg-[#FFFFFF] text-[#2C2825] shadow-xs'
                  : 'text-[#78716C] hover:text-[#2C2825]'
              }`}
            >
              Transition Probability (%)
            </button>
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                setDisplayMode('count');
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                displayMode === 'count'
                  ? 'bg-[#FFFFFF] text-[#2C2825] shadow-xs'
                  : 'text-[#78716C] hover:text-[#2C2825]'
              }`}
            >
              Transition Volume (Hits)
            </button>
          </div>

          <div className="flex items-center gap-1 bg-[#EFECE4] p-1 rounded-lg border border-[#E5E0D5]">
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                setMatrixZoom((z) => Math.min(1.3, Number((z + 0.1).toFixed(2))));
              }}
              className="p-1.5 text-[#2C2825] hover:bg-[#FFFFFF] rounded"
              aria-label="Zoom in Markov matrix"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-1 text-[#2C2825] tabular-nums">
              {Math.round(matrixZoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                setMatrixZoom((z) => Math.max(0.8, Number((z - 0.1).toFixed(2))));
              }}
              className="p-1.5 text-[#2C2825] hover:bg-[#FFFFFF] rounded"
              aria-label="Zoom out Markov matrix"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Heatmap Table with Touch Pinch-Zoom */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="border border-[#E5E0D5] rounded-xl overflow-x-auto bg-[#FFFFFF]"
      >
        <div
          style={{
            transform: `scale(${matrixZoom})`,
            transformOrigin: 'top left',
          }}
        >
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E0D5] bg-[#F7F4EB] text-[#78716C]">
                <th className="py-2.5 px-3 font-semibold border-r border-[#E5E0D5] min-w-[140px] text-[#2C2825]">
                  From State (Xₜ) \ To (Xₜ₊₁)
                </th>
                {targetColumns.map((col) => (
                  <th
                    key={col}
                    className="py-2.5 px-2.5 font-mono font-semibold text-right min-w-[88px] text-[#2C2825]"
                  >
                    {col === 'EXIT' ? '[EXIT]' : col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E0D5] font-mono tabular-nums">
              {matrixPages.map((rowPage) => (
                <tr key={rowPage} className="hover:bg-[#F9F8F4]">
                  <td className="py-2.5 px-3 font-semibold text-[#2C2825] border-r border-[#E5E0D5] bg-[#F9F8F4]">
                    {rowPage}
                  </td>
                  {targetColumns.map((colPage) => {
                    const cell = cellLookup.get(`${rowPage}|||${colPage}`);
                    const prob = cell ? cell.probability : 0;
                    const count = cell ? cell.count : 0;

                    let bgClass = 'bg-transparent text-[#A8A29E]';
                    if (prob >= 0.45) {
                      bgClass = 'bg-[#B45309] text-[#FFFFFF] font-semibold';
                    } else if (prob >= 0.25) {
                      bgClass = 'bg-[#FDE68A] text-[#2C2825] font-semibold';
                    } else if (prob >= 0.1) {
                      bgClass = 'bg-[#FEF3C7] text-[#2C2825]';
                    } else if (prob > 0) {
                      bgClass = 'bg-[#F9F8F4] text-[#78716C]';
                    }

                    return (
                      <td
                        key={`${rowPage}->${colPage}`}
                        onClick={() => {
                          if (colPage !== 'EXIT' && prob > 0) {
                            handleAppendStep(colPage);
                          }
                        }}
                        className={`py-2.5 px-2.5 text-right transition-colors cursor-pointer ${bgClass}`}
                        title={`${rowPage} → ${colPage}: ${(prob * 100).toFixed(1)}% (${count} transitions)`}
                      >
                        {prob === 0
                          ? '—'
                          : displayMode === 'probability'
                          ? `${(prob * 100).toFixed(1)}%`
                          : count}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Next-Page Markov & Sequential Predictor Simulator */}
      <div className="border border-[#E5E0D5] rounded-xl p-5 bg-[#F9F8F4] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E0D5] pb-3">
          <div>
            <h3 className="text-sm font-semibold text-[#2C2825]">
              Interactive Next-Page Navigation Predictor
            </h3>
            <p className="text-xs text-[#78716C] mt-0.5">
              Simulate an active visitor clickstream trail to compute real-time next-page probabilities using combined Markov + Sequential Pattern Confidence.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Select page to append to visitor trail"
              value={selectedNextStep}
              onChange={(e) => setSelectedNextStep(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-mono border border-[#E5E0D5] rounded-lg bg-[#FFFFFF] text-[#2C2825]"
            >
              {uniquePages.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleAppendStep(selectedNextStep)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#FFFFFF] bg-[#B45309] hover:bg-[#92400E] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Append Step
            </button>
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                setSimulationTrail(uniquePages.length > 0 ? [uniquePages[0]] : ['/home']);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#2C2825] bg-[#EFECE4] hover:bg-[#E5E0D5] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Trail
            </button>
          </div>
        </div>

        {/* Active Trail Breadcrumb */}
        <div className="p-3 bg-[#FDFBF7] rounded-lg border border-[#E5E0D5] flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[#78716C] mr-1">Active Visitor Trail:</span>
          {simulationTrail.map((step, idx) => (
            <React.Fragment key={`${step}-${idx}`}>
              {idx > 0 && <ArrowRight className="w-3.5 h-3.5 text-[#78716C] shrink-0" />}
              <span className="font-mono text-xs font-semibold text-[#2C2825] bg-[#FFFFFF] px-2.5 py-1 rounded border border-[#E5E0D5]">
                {step}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* Predicted Next States Table */}
        <div className="overflow-x-auto bg-[#FFFFFF] rounded-lg border border-[#E5E0D5]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E0D5] bg-[#F7F4EB] text-[#78716C]">
                <th className="py-2 px-3">Predicted Next State (Xₜ₊₁)</th>
                <th className="py-2 px-3 text-right">1st-Order Markov P(Xₜ₊₁|Xₜ)</th>
                <th className="py-2 px-3 text-right">2nd-Order Sequence Confidence</th>
                <th className="py-2 px-3 text-right">Combined Likelihood</th>
                <th className="py-2 px-3 text-right">Expected Dwell</th>
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E0D5] font-mono tabular-nums">
              {predictions.map((pred) => (
                <tr key={pred.nextPage} className="hover:bg-[#F9F8F4]">
                  <td className="py-2.5 px-3 font-semibold text-[#2C2825]">
                    {pred.nextPage === 'EXIT' ? '[Session Exit]' : pred.nextPage}
                  </td>
                  <td className="py-2.5 px-3 text-right text-[#2C2825]">
                    {(pred.markovProbability * 100).toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 text-right text-[#2C2825]">
                    {(pred.sequentialBoostProbability * 100).toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-[#B45309]">
                    {(pred.combinedScore * 100).toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 text-right text-[#78716C]">{pred.avgDwellSec}s</td>
                  <td className="py-2.5 px-3 text-right font-sans">
                    {pred.nextPage !== 'EXIT' && (
                      <button
                        type="button"
                        onClick={() => handleAppendStep(pred.nextPage)}
                        className="text-xs font-medium text-[#B45309] hover:text-[#92400E] whitespace-nowrap"
                      >
                        Follow Path →
                      </button>
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
