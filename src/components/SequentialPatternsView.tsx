import React, { useMemo, useState } from 'react';
import {
  SequentialPattern,
  ReconstructedSession,
  evaluateFunnelSteps,
} from '../utils/navigationMining';
import { soundFX } from '../utils/soundEffects';
import { Search, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface SequentialPatternsViewProps {
  patterns: SequentialPattern[];
  sessions: ReconstructedSession[];
  funnelSteps: string[];
  uniquePages: string[];
  minSupport: number;
  onChangeMinSupport: (val: number) => void;
  onUpdateFunnelSteps: (steps: string[]) => void;
}

export const SequentialPatternsView: React.FC<SequentialPatternsViewProps> = ({
  patterns,
  sessions,
  funnelSteps,
  uniquePages,
  minSupport,
  onChangeMinSupport,
  onUpdateFunnelSteps,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [lengthFilter, setLengthFilter] = useState<'all' | '2' | '3' | '4'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [newFunnelStep, setNewFunnelStep] = useState<string>(uniquePages[0] || '/home');

  const funnelMetrics = useMemo(() => {
    return evaluateFunnelSteps(sessions, funnelSteps);
  }, [sessions, funnelSteps]);

  const filteredPatterns = useMemo(() => {
    return patterns.filter((p) => {
      if (lengthFilter !== 'all' && p.length !== parseInt(lengthFilter, 10)) return false;
      if (categoryFilter !== 'all' && p.classification !== categoryFilter) return false;
      if (
        searchQuery.trim() !== '' &&
        !p.sequenceKey.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [patterns, lengthFilter, categoryFilter, searchQuery]);

  const handleRemoveFunnelStep = (idx: number) => {
    if (funnelSteps.length <= 2) return;
    soundFX.playClick();
    onUpdateFunnelSteps(funnelSteps.filter((_, i) => i !== idx));
  };

  const handleAddFunnelStep = () => {
    if (!newFunnelStep || funnelSteps.includes(newFunnelStep)) return;
    soundFX.playPop();
    onUpdateFunnelSteps([...funnelSteps, newFunnelStep]);
  };

  return (
    <div className="space-y-6">
      {/* Multi-Step Conversion Funnel Bottleneck Analyzer */}
      <div className="border border-[#E5E0D5] rounded-xl p-5 bg-[#F9F8F4] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E0D5] pb-3">
          <div>
            <h2 className="text-base font-semibold text-[#2C2825]">
              Multi-Step Conversion Funnel &amp; Drop-Off Leakage Analyzer
            </h2>
            <p className="text-xs text-[#78716C] mt-0.5">
              Measures sequential retention across ordered target steps and identifies exact leakage destinations where visitors abandon the funnel.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Add step to conversion funnel"
              value={newFunnelStep}
              onChange={(e) => setNewFunnelStep(e.target.value)}
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
              onClick={handleAddFunnelStep}
              className="px-3 py-1.5 text-xs font-medium text-[#FFFFFF] bg-[#B45309] hover:bg-[#92400E] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Add Funnel Step
            </button>
          </div>
        </div>

        {/* Funnel Steps Bar Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {funnelMetrics.map((step) => {
            const pctFromStart = (step.conversionFromStart * 100).toFixed(1);
            const dropPct = (step.stepDropOffRate * 100).toFixed(1);

            return (
              <div
                key={`${step.stepIndex}-${step.path}`}
                className="p-3.5 border border-[#E5E0D5] rounded-lg bg-[#FFFFFF] flex flex-col justify-between space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono font-semibold text-[#78716C]">
                      0{step.stepIndex + 1}.
                    </span>
                    <span className="text-xs font-mono font-semibold text-[#2C2825] truncate">
                      {step.path}
                    </span>
                  </div>
                  {funnelSteps.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFunnelStep(step.stepIndex)}
                      className="text-[11px] text-[#78716C] hover:text-[#B45309] transition-colors"
                      aria-label={`Remove funnel step ${step.path}`}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div>
                  <div className="flex items-baseline justify-between text-xs font-mono tabular-nums mb-1">
                    <span className="text-[#78716C]">
                      {step.reachedSessions} sessions ({pctFromStart}%)
                    </span>
                    {step.stepIndex > 0 && (
                      <span
                        className={
                          step.stepDropOffRate > 0.35
                            ? 'text-[#B45309] font-semibold'
                            : 'text-[#78716C]'
                        }
                      >
                        -{dropPct}% drop
                      </span>
                    )}
                  </div>
                  <div className="w-full h-2 bg-[#EFECE4] rounded-xs overflow-hidden">
                    <div
                      className="h-full bg-[#D97706] transition-all"
                      style={{ width: `${Math.max(4, step.conversionFromStart * 100)}%` }}
                    />
                  </div>
                </div>

                {step.stepIndex > 0 && step.topLeakDestinations.length > 0 && (
                  <div className="pt-1 border-t border-[#E5E0D5] text-[11px] text-[#2C2825] font-mono tabular-nums">
                    <span className="text-[#78716C] font-sans block mb-0.5">
                      Primary Leakage Destination:
                    </span>
                    <span>
                      → {step.topLeakDestinations[0].toPage} ({step.topLeakDestinations[0].count}{' '}
                      sessions)
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Frequent Sequential Patterns Controls */}
      <div className="border border-[#E5E0D5] rounded-xl bg-[#FFFFFF] overflow-hidden">
        <div className="p-4 border-b border-[#E5E0D5] bg-[#F9F8F4] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[#2C2825]">
              Frequent Contiguous Sequential Navigation Patterns (PrefixSpan / N-Gram Miner)
            </h3>
            <p className="text-xs text-[#78716C] mt-0.5">
              Discovered multi-step clickstream sequences ranked by session support and conditional continuation confidence.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="Filter patterns by URL path"
                placeholder="Filter path (e.g. /cart)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-[#E5E0D5] rounded-lg bg-[#FFFFFF] text-[#2C2825] focus:outline-none focus:ring-2 focus:ring-[#D97706]"
              />
            </div>

            {/* Length Segmented Control */}
            <div className="flex items-center gap-1 p-1 bg-[#EFECE4] rounded-lg border border-[#E5E0D5]">
              {(['all', '2', '3', '4'] as const).map((len) => (
                <button
                  key={len}
                  type="button"
                  onClick={() => {
                    soundFX.playClick();
                    setLengthFilter(len);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    lengthFilter === len
                      ? 'bg-[#FFFFFF] text-[#2C2825] shadow-xs'
                      : 'text-[#78716C] hover:text-[#2C2825]'
                  }`}
                >
                  {len === 'all' ? 'All Lengths' : `${len}-Step`}
                </button>
              ))}
            </div>

            {/* Classification Filter */}
            <select
              aria-label="Filter by pattern classification"
              value={categoryFilter}
              onChange={(e) => {
                soundFX.playClick();
                setCategoryFilter(e.target.value);
              }}
              className="px-2.5 py-1.5 text-xs border border-[#E5E0D5] rounded-lg bg-[#FFFFFF] text-[#2C2825]"
            >
              <option value="all">All Classifications</option>
              <option value="Optimal Funnel">Optimal Funnel</option>
              <option value="Exploration Path">Exploration Path</option>
              <option value="Ping-Pong Loop">Ping-Pong Loop</option>
              <option value="Reload Loop">Reload Loop</option>
              <option value="Abandonment Path">Abandonment Path</option>
            </select>

            {/* Min Support Slider */}
            <div className="flex items-center gap-2 text-xs">
              <label htmlFor="support-slider" className="text-[#78716C] whitespace-nowrap">
                Min Support:
              </label>
              <input
                id="support-slider"
                type="range"
                min={0.02}
                max={0.35}
                step={0.01}
                value={minSupport}
                onChange={(e) => onChangeMinSupport(parseFloat(e.target.value))}
                className="w-20 accent-[#D97706] cursor-pointer"
              />
              <span className="font-mono font-semibold text-[#2C2825] tabular-nums w-10">
                {Math.round(minSupport * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Sequential Patterns Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E0D5] bg-[#F7F4EB] text-[#78716C] font-medium">
                <th className="py-2.5 px-4">ID</th>
                <th className="py-2.5 px-4">Navigation Sequence Pattern</th>
                <th className="py-2.5 px-4">Classification</th>
                <th className="py-2.5 px-4 text-right">Sessions</th>
                <th className="py-2.5 px-4 text-right">Support</th>
                <th className="py-2.5 px-4 text-right">Confidence</th>
                <th className="py-2.5 px-4 text-right">Avg Dwell</th>
                <th className="py-2.5 px-4 text-right">Goal Conversion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E0D5] font-mono tabular-nums">
              {filteredPatterns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center font-sans text-[#78716C]">
                    No sequential patterns match the current support threshold and search criteria. Try lowering Min Support or clearing the filter.
                  </td>
                </tr>
              ) : (
                filteredPatterns.slice(0, 35).map((pat) => {
                  const isLoop =
                    pat.classification === 'Ping-Pong Loop' || pat.classification === 'Reload Loop';
                  const isOptimal = pat.classification === 'Optimal Funnel';

                  return (
                    <tr key={pat.id} className="hover:bg-[#F9F8F4]">
                      <td className="py-2.5 px-4 text-[#78716C]">{pat.id}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {pat.sequence.map((node, i) => (
                            <React.Fragment key={`${pat.id}-${i}`}>
                              {i > 0 && (
                                <ArrowRight className="w-3 h-3 text-[#78716C] shrink-0" />
                              )}
                              <span className="font-semibold text-[#2C2825]">{node}</span>
                            </React.Fragment>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 font-sans">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium ${
                            isLoop
                              ? 'text-[#B45309]'
                              : isOptimal
                              ? 'text-[#15803D]'
                              : pat.classification === 'Abandonment Path'
                              ? 'text-[#9A3412]'
                              : 'text-[#78716C]'
                          }`}
                        >
                          {isLoop && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                          {isOptimal && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                          {pat.classification}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right text-[#2C2825]">{pat.count}</td>
                      <td className="py-2.5 px-4 text-right font-semibold text-[#2C2825]">
                        {(pat.support * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-4 text-right text-[#2C2825]">
                        {(pat.confidence * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-4 text-right text-[#78716C]">
                        {pat.avgDurationSec}s
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-[#2C2825]">
                        {(pat.conversionRate * 100).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
