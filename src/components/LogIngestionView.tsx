import React, { useState } from 'react';
import {
  ReconstructedSession,
  SessionizationOptions,
  AnalysisSummary,
} from '../utils/navigationMining';
import { soundFX } from '../utils/soundEffects';
import { Play, RotateCcw, ArrowRight, FileText } from 'lucide-react';

interface LogIngestionViewProps {
  rawLogText: string;
  onChangeRawLogText: (text: string) => void;
  options: SessionizationOptions;
  onChangeOptions: (opts: SessionizationOptions) => void;
  onRunPipeline: () => void;
  onResetToPreset: () => void;
  summary: AnalysisSummary;
  sessions: ReconstructedSession[];
}

export const LogIngestionView: React.FC<LogIngestionViewProps> = ({
  rawLogText,
  onChangeRawLogText,
  options,
  onChangeOptions,
  onRunPipeline,
  onResetToPreset,
  summary,
  sessions,
}) => {
  const [deviceFilter, setDeviceFilter] = useState<'ALL' | 'Desktop' | 'Mobile' | 'Tablet'>('ALL');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleApplyAndRun = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawLogText.trim()) {
      setValidationError('Please provide server access log entries or CSV clickstream records before running the parser.');
      return;
    }
    soundFX.playChime();
    setValidationError(null);
    onRunPipeline();
  };

  const filteredSessions = sessions.filter((s) =>
    deviceFilter === 'ALL' ? true : s.device === deviceFilter
  );

  return (
    <div className="space-y-6">
      {/* Preprocessing & Log Ingestion Form */}
      <form
        onSubmit={handleApplyAndRun}
        className="border border-[#E5E0D5] rounded-xl p-5 bg-[#F9F8F4] space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E0D5] pb-3">
          <div>
            <h2 className="text-base font-semibold text-[#2C2825]">
              Server Log Ingestion &amp; Clickstream Sessionization Pipeline
            </h2>
            <p className="text-xs text-[#78716C] mt-0.5">
              Paste Apache/Nginx Combined Access Logs or CSV clickstream records to reconstruct visitor trajectories.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                setValidationError(null);
                onResetToPreset();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#2C2825] bg-[#EFECE4] hover:bg-[#E5E0D5] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restore Default Dataset
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-[#FFFFFF] bg-[#B45309] hover:bg-[#92400E] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              Parse &amp; Reconstruct Sessions
            </button>
          </div>
        </div>

        {/* Sessionization Heuristic Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-3.5 bg-[#FDFBF7] rounded-lg border border-[#E5E0D5] text-xs">
          <div>
            <label
              htmlFor="timeout-minutes"
              className="block font-medium text-[#2C2825] mb-1"
            >
              Session Inactivity Timeout (Min)
            </label>
            <input
              id="timeout-minutes"
              type="number"
              min={1}
              max={180}
              value={options.timeoutMinutes}
              onChange={(e) =>
                onChangeOptions({
                  ...options,
                  timeoutMinutes: Math.max(1, parseInt(e.target.value, 10) || 30),
                })
              }
              className="w-full px-2.5 py-1.5 font-mono border border-[#E5E0D5] rounded bg-[#FFFFFF] text-[#2C2825]"
            />
          </div>

          <div>
            <label
              htmlFor="conversion-target-input"
              className="block font-medium text-[#2C2825] mb-1"
            >
              Goal Conversion Target Path
            </label>
            <input
              id="conversion-target-input"
              type="text"
              value={options.conversionTargetPath}
              onChange={(e) =>
                onChangeOptions({
                  ...options,
                  conversionTargetPath: e.target.value.trim() || '/order-confirmed',
                })
              }
              className="w-full px-2.5 py-1.5 font-mono border border-[#E5E0D5] rounded bg-[#FFFFFF] text-[#2C2825]"
            />
          </div>

          <div className="md:col-span-2 flex flex-wrap items-center gap-5 pt-4">
            <label className="inline-flex items-center gap-2 cursor-pointer text-[#2C2825]">
              <input
                type="checkbox"
                checked={options.excludeBots}
                onChange={(e) =>
                  onChangeOptions({ ...options, excludeBots: e.target.checked })
                }
                className="rounded border-[#E5E0D5] accent-[#D97706]"
              />
              Filter Web Crawlers / Spiders ({summary.botHitsRemoved} filtered)
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer text-[#2C2825]">
              <input
                type="checkbox"
                checked={options.excludeStaticAssets}
                onChange={(e) =>
                  onChangeOptions({ ...options, excludeStaticAssets: e.target.checked })
                }
                className="rounded border-[#E5E0D5] accent-[#D97706]"
              />
              Strip Static Assets .css/.js/.png ({summary.staticAssetHitsRemoved} filtered)
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer text-[#2C2825]">
              <input
                type="checkbox"
                checked={options.excludeErrorCodes}
                onChange={(e) =>
                  onChangeOptions({ ...options, excludeErrorCodes: e.target.checked })
                }
                className="rounded border-[#E5E0D5] accent-[#D97706]"
              />
              Ignore HTTP 4xx/5xx Errors ({summary.errorHitsRemoved} filtered)
            </label>
          </div>
        </div>

        {/* Raw Server Log Textarea */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="raw-server-logs"
              className="text-xs font-medium text-[#2C2825] flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-[#B45309]" />
              Raw Server Access Log Buffer ({summary.totalRawHits} raw lines → {summary.filteredValidHits} valid pageviews)
            </label>
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                onChangeRawLogText('');
              }}
              className="text-xs text-[#78716C] hover:text-[#2C2825]"
            >
              Clear Buffer
            </button>
          </div>
          <textarea
            id="raw-server-logs"
            rows={6}
            value={rawLogText}
            onChange={(e) => {
              setValidationError(null);
              onChangeRawLogText(e.target.value);
            }}
            placeholder='192.168.1.10 - - [09/Nov/2026:10:00:00 +0000] "GET /home HTTP/1.1" 200 5120 "-" "Mozilla/5.0..."'
            className="w-full p-3 text-xs font-mono border border-[#E5E0D5] rounded-lg bg-[#FDFBF7] text-[#2C2825] focus:outline-none focus:ring-2 focus:ring-[#D97706]"
          />
          {validationError && (
            <p role="alert" className="text-xs text-[#9A3412] mt-1.5 font-medium">
              {validationError}
            </p>
          )}
        </div>
      </form>

      {/* Reconstructed Sessions Table */}
      <div className="border border-[#E5E0D5] rounded-xl bg-[#FFFFFF] overflow-hidden">
        <div className="p-4 border-b border-[#E5E0D5] bg-[#F9F8F4] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[#2C2825]">
              Reconstructed Visitor Sessions ({filteredSessions.length} of {sessions.length})
            </h3>
            <p className="text-xs text-[#78716C] mt-0.5">
              Individual visitor trajectories grouped by IP address, User-Agent device class, and {options.timeoutMinutes}-minute inactivity window.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#EFECE4] rounded-lg border border-[#E5E0D5]">
            {(['ALL', 'Desktop', 'Mobile', 'Tablet'] as const).map((dev) => (
              <button
                key={dev}
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  setDeviceFilter(dev);
                }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  deviceFilter === dev
                    ? 'bg-[#FFFFFF] text-[#2C2825] shadow-xs'
                    : 'text-[#78716C] hover:text-[#2C2825]'
                }`}
              >
                {dev === 'ALL' ? 'All Devices' : dev}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E0D5] bg-[#F7F4EB] text-[#78716C] font-medium">
                <th className="py-2.5 px-4">Session ID</th>
                <th className="py-2.5 px-4">Visitor IP</th>
                <th className="py-2.5 px-4">Device</th>
                <th className="py-2.5 px-4">Reconstructed Clickstream Trajectory</th>
                <th className="py-2.5 px-4 text-right">Hits</th>
                <th className="py-2.5 px-4 text-right">Duration</th>
                <th className="py-2.5 px-4">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E0D5] font-mono tabular-nums">
              {filteredSessions.slice(0, 40).map((sess) => (
                <tr key={sess.sessionId} className="hover:bg-[#F9F8F4]">
                  <td className="py-2.5 px-4 font-semibold text-[#2C2825]">
                    {sess.sessionId}
                  </td>
                  <td className="py-2.5 px-4 text-[#78716C]">{sess.visitorIp}</td>
                  <td className="py-2.5 px-4 font-sans text-[#2C2825]">{sess.device}</td>
                  <td className="py-2.5 px-4">
                    <div className="flex flex-wrap items-center gap-1">
                      {sess.pathSequence.map((p, idx) => (
                        <React.Fragment key={`${sess.sessionId}-${idx}`}>
                          {idx > 0 && (
                            <ArrowRight className="w-3 h-3 text-[#78716C] shrink-0" />
                          )}
                          <span className="text-[#2C2825]">{p}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-right text-[#2C2825]">
                    {sess.pathSequence.length}
                  </td>
                  <td className="py-2.5 px-4 text-right text-[#2C2825]">
                    {sess.totalDurationSec}s
                  </td>
                  <td className="py-2.5 px-4 font-sans">
                    {sess.converted ? (
                      <span className="text-[#15803D] font-medium">Converted</span>
                    ) : sess.bounced ? (
                      <span className="text-[#78716C]">Single-Page Bounce</span>
                    ) : sess.loopDetected ? (
                      <span className="text-[#B45309] font-medium">Backtrack Loop</span>
                    ) : (
                      <span className="text-[#78716C]">Exited</span>
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
