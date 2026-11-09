import { ReconstructedSession } from './navigationMining';

export type ReplayCohortMode = 'high_conversion' | 'anomalous';

export interface SessionReplayStep {
  stepIndex: number;
  pagePath: string;
  nextPagePath: string | null;
  dwellSec: number;
  cumulativeTimeSec: number;
  isRepeatVisit: boolean;
  isConversionGoal: boolean;
}

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Selects and ranks candidate sessions for Session Replay based on cohort mode:
 * - 'high_conversion': Converted sessions ordered by path richness and duration
 * - 'anomalous': High anomaly score or loop-detected sessions ordered by anomalyScore descending
 */
export function selectReplayableSessions(
  sessions: ReconstructedSession[],
  mode: ReplayCohortMode
): ReconstructedSession[] {
  if (mode === 'high_conversion') {
    const converted = sessions
      .filter((s) => s.converted && s.pathSequence.length >= 2)
      .sort((a, b) => b.pathSequence.length - a.pathSequence.length || b.totalDurationSec - a.totalDurationSec);
    return converted.length > 0 ? converted : sessions.slice(0, 10);
  }

  const anomalous = sessions
    .filter((s) => s.anomalyScore >= 0.35 || s.loopDetected)
    .sort((a, b) => b.anomalyScore - a.anomalyScore || b.pathSequence.length - a.pathSequence.length);
  return anomalous.length > 0 ? anomalous : sessions.slice(0, 10);
}

/**
 * Builds an ordered list of step-by-step transitions for a selected session,
 * including the terminal EXIT transition when a session exits without converting.
 */
export function buildSessionReplaySteps(
  session: ReconstructedSession | null,
  conversionTargetPath: string
): SessionReplayStep[] {
  if (!session || session.pathSequence.length === 0) return [];

  const seenPages = new Set<string>();
  let cumulative = 0;

  return session.pathSequence.map((pagePath, idx) => {
    const dwellSec = session.dwellTimesSec[idx] ?? 15;
    const stepStartCumulative = cumulative;
    cumulative += dwellSec;

    const isRepeatVisit = seenPages.has(pagePath);
    seenPages.add(pagePath);

    const isLastPage = idx === session.pathSequence.length - 1;
    const isGoal = pagePath.toLowerCase() === conversionTargetPath.toLowerCase();

    const nextPagePath = !isLastPage
      ? session.pathSequence[idx + 1]
      : isGoal
      ? null
      : 'EXIT';

    return {
      stepIndex: idx,
      pagePath,
      nextPagePath,
      dwellSec,
      cumulativeTimeSec: stepStartCumulative,
      isRepeatVisit,
      isConversionGoal: isGoal,
    };
  });
}

/**
 * Evaluates a point (x, y) along a 2D cubic Bezier curve at parameter t in [0, 1].
 */
export function interpolatePointOnCubicBezier(
  t: number,
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D
): Point2D {
  const clamped = Math.max(0, Math.min(1, t));
  const u = 1 - clamped;
  const tt = clamped * clamped;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * clamped;

  const x =
    uuu * p0.x +
    3 * uu * clamped * p1.x +
    3 * u * tt * p2.x +
    ttt * p3.x;

  const y =
    uuu * p0.y +
    3 * uu * clamped * p1.y +
    3 * u * tt * p2.y +
    ttt * p3.y;

  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}
