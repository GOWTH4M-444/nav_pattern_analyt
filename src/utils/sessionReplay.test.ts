import test from 'node:test';
import assert from 'node:assert/strict';
import {
  selectReplayableSessions,
  buildSessionReplaySteps,
  interpolatePointOnCubicBezier,
} from './sessionReplay';
import { ReconstructedSession } from './navigationMining';

const MOCK_SESSIONS: ReconstructedSession[] = [
  {
    sessionId: 'SESS-001',
    visitorIp: '192.0.2.10',
    device: 'Desktop',
    startTime: '2026-11-09T10:00:00Z',
    totalDurationSec: 120,
    pathSequence: ['/home', '/catalog', '/product-detail', '/cart', '/checkout', '/order-confirmed'],
    dwellTimesSec: [20, 25, 30, 15, 30, 0],
    converted: true,
    bounced: false,
    entryPage: '/home',
    exitPage: '/order-confirmed',
    loopDetected: false,
    anomalyScore: 0.12,
    anomalyReason: 'Nominal',
    embeddingCluster: 'High-Intent Buyer',
  },
  {
    sessionId: 'SESS-002',
    visitorIp: '198.51.100.42',
    device: 'Mobile',
    startTime: '2026-11-09T10:05:00Z',
    totalDurationSec: 95,
    pathSequence: ['/home', '/cart', '/product-detail', '/cart', '/product-detail'],
    dwellTimesSec: [15, 20, 20, 20, 20],
    converted: false,
    bounced: false,
    entryPage: '/home',
    exitPage: '/product-detail',
    loopDetected: true,
    anomalyScore: 0.78,
    anomalyReason: 'Deep Ping-Pong Oscillation',
    embeddingCluster: 'Catalog Explorer',
  },
];

test('selectReplayableSessions filters high_conversion vs anomalous cohorts accurately', () => {
  const highConv = selectReplayableSessions(MOCK_SESSIONS, 'high_conversion');
  assert.equal(highConv.length, 1);
  assert.equal(highConv[0].sessionId, 'SESS-001');

  const anomalous = selectReplayableSessions(MOCK_SESSIONS, 'anomalous');
  assert.equal(anomalous.length, 1);
  assert.equal(anomalous[0].sessionId, 'SESS-002');
});

test('buildSessionReplaySteps constructs step transitions, repeat flags, and exit links', () => {
  const convSteps = buildSessionReplaySteps(MOCK_SESSIONS[0], '/order-confirmed');
  assert.equal(convSteps.length, 6);
  assert.equal(convSteps[0].pagePath, '/home');
  assert.equal(convSteps[0].nextPagePath, '/catalog');
  assert.equal(convSteps[5].isConversionGoal, true);
  assert.equal(convSteps[5].nextPagePath, null);

  const loopSteps = buildSessionReplaySteps(MOCK_SESSIONS[1], '/order-confirmed');
  assert.equal(loopSteps.length, 5);
  assert.equal(loopSteps[3].isRepeatVisit, true);
  assert.equal(loopSteps[4].nextPagePath, 'EXIT');
});

test('interpolatePointOnCubicBezier returns exact start, midpoint, and end coordinates', () => {
  const p0 = { x: 100, y: 100 };
  const p1 = { x: 200, y: 100 };
  const p2 = { x: 300, y: 200 };
  const p3 = { x: 400, y: 200 };

  assert.deepEqual(interpolatePointOnCubicBezier(0, p0, p1, p2, p3), { x: 100, y: 100 });
  assert.deepEqual(interpolatePointOnCubicBezier(1, p0, p1, p2, p3), { x: 400, y: 200 });
  const mid = interpolatePointOnCubicBezier(0.5, p0, p1, p2, p3);
  assert.equal(mid.x, 250);
  assert.equal(mid.y, 150);
});
