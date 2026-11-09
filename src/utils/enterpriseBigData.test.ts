import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRocksDbStateMetrics,
  computeSessionFeatureVectorsAndQuarantine,
  evaluateDataQualityExpectations,
} from './enterpriseBigData';
import { parseServerLogs, runNavigationPatternPipeline } from './navigationMining';
import { PRESET_DATASETS } from './sampleLogs';

test('computeRocksDbStateMetrics returns RocksDB provider and 15m watermark telemetry', () => {
  const hits = parseServerLogs(PRESET_DATASETS[0].rawLogText);
  const { summary, sessions } = runNavigationPatternPipeline(
    hits,
    {
      timeoutMinutes: 30,
      excludeBots: true,
      excludeStaticAssets: true,
      excludeErrorCodes: true,
      conversionTargetPath: '/order-confirmed',
    },
    0.05
  );

  const metrics = computeRocksDbStateMetrics(summary, sessions, 15, 0);
  assert.equal(
    metrics.providerClass,
    'org.apache.spark.sql.execution.streaming.state.RocksDBStateStoreProvider'
  );
  assert.equal(metrics.watermarkDelayMinutes, 15);
  assert.equal(metrics.activeStateKeys, sessions.length);
  assert.ok(metrics.evictedExpiredSessionKeys > 0);
  assert.ok(metrics.jvmHeapSavedMb > metrics.rocksDbSsdFootprintMb);
});

test('computeSessionFeatureVectorsAndQuarantine extracts ML vectors and isolates bot_quarantine rows', () => {
  const hits = parseServerLogs(PRESET_DATASETS[0].rawLogText);
  const { sessions } = runNavigationPatternPipeline(
    hits,
    {
      timeoutMinutes: 30,
      excludeBots: true,
      excludeStaticAssets: true,
      excludeErrorCodes: true,
      conversionTargetPath: '/order-confirmed',
    },
    0.05
  );

  const quarantineReport = computeSessionFeatureVectorsAndQuarantine(sessions, 0.6);
  assert.equal(quarantineReport.featureVectors.length, sessions.length);
  assert.ok(quarantineReport.quarantinedCount > 0);
  assert.equal(
    quarantineReport.quarantinedCount + quarantineReport.cleanSilverSessionCount,
    sessions.length
  );
  assert.ok(quarantineReport.cleanConversionRatePct >= quarantineReport.rawConversionRatePct);
  assert.ok(quarantineReport.featureVectors[0].uaSignatureHash.startsWith('0x'));
});

test('evaluateDataQualityExpectations validates non-null session IDs, monotonic timestamps, and strict Delta schema', () => {
  const hits = parseServerLogs(PRESET_DATASETS[0].rawLogText);
  const { summary, sessions } = runNavigationPatternPipeline(
    hits,
    {
      timeoutMinutes: 30,
      excludeBots: true,
      excludeStaticAssets: true,
      excludeErrorCodes: true,
      conversionTargetPath: '/order-confirmed',
    },
    0.05
  );

  const dqReport = evaluateDataQualityExpectations(summary, sessions);
  assert.equal(dqReport.schemaEnforcementMode, 'Strict (mergeSchema=false)');
  assert.equal(dqReport.expectations.length, 4);
  assert.equal(dqReport.expectations[0].passRatePct, 100);
  assert.equal(dqReport.expectations[1].passRatePct, 100);
});
