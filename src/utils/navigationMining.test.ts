import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseServerLogs,
  reconstructSessions,
  computeMarkovModel,
  mineSequentialPatterns,
  evaluateFunnelSteps,
  predictNextNavigation,
} from './navigationMining';

const SAMPLE_APACHE_LOGS = `
192.168.1.10 - - [09/Nov/2026:10:00:00 +0000] "GET /home HTTP/1.1" 200 5120 "-" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
192.168.1.10 - - [09/Nov/2026:10:00:25 +0000] "GET /catalog HTTP/1.1" 200 6200 "https://shop.example.com/home" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
192.168.1.10 - - [09/Nov/2026:10:01:10 +0000] "GET /product-detail HTTP/1.1" 200 8400 "https://shop.example.com/catalog" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
192.168.1.10 - - [09/Nov/2026:10:02:00 +0000] "GET /cart HTTP/1.1" 200 3100 "https://shop.example.com/product-detail" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
192.168.1.10 - - [09/Nov/2026:10:03:00 +0000] "GET /checkout HTTP/1.1" 200 4100 "https://shop.example.com/cart" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
192.168.1.10 - - [09/Nov/2026:10:03:45 +0000] "GET /order-confirmed HTTP/1.1" 200 2900 "https://shop.example.com/checkout" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
192.168.1.10 - - [09/Nov/2026:10:03:46 +0000] "GET /assets/app.css HTTP/1.1" 200 1200 "https://shop.example.com/order-confirmed" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
66.249.66.1 - - [09/Nov/2026:10:04:00 +0000] "GET /home HTTP/1.1" 200 5120 "-" "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
192.168.1.22 - - [09/Nov/2026:10:05:00 +0000] "GET /home HTTP/1.1" 200 5120 "-" "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile"
192.168.1.22 - - [09/Nov/2026:10:05:30 +0000] "GET /catalog HTTP/1.1" 200 6200 "https://shop.example.com/home" "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile"
192.168.1.22 - - [09/Nov/2026:10:06:00 +0000] "GET /product-detail HTTP/1.1" 200 8400 "https://shop.example.com/catalog" "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile"
192.168.1.22 - - [09/Nov/2026:10:06:20 +0000] "GET /catalog HTTP/1.1" 200 6200 "https://shop.example.com/product-detail" "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile"
`;

test('parseServerLogs parses Apache Combined Log lines and classifies bots/devices', () => {
  const hits = parseServerLogs(SAMPLE_APACHE_LOGS);
  assert.equal(hits.length, 12);
  assert.equal(hits[0].ip, '192.168.1.10');
  assert.equal(hits[0].path, '/home');
  assert.equal(hits[0].device, 'Desktop');
  assert.equal(hits[7].device, 'Bot');
  assert.equal(hits[8].device, 'Mobile');
});

test('reconstructSessions filters bots and static assets and computes anomaly scores', () => {
  const hits = parseServerLogs(SAMPLE_APACHE_LOGS);
  const result = reconstructSessions(hits, {
    timeoutMinutes: 30,
    excludeBots: true,
    excludeStaticAssets: true,
    excludeErrorCodes: true,
    conversionTargetPath: '/order-confirmed',
  });

  assert.equal(result.botHitsRemoved, 1);
  assert.equal(result.staticAssetHitsRemoved, 1);
  assert.equal(result.sessions.length, 2);

  const s1 = result.sessions[0];
  assert.equal(s1.converted, true);
  assert.equal(s1.loopDetected, false);
  assert.equal(s1.embeddingCluster, 'High-Intent Buyer');

  const s2 = result.sessions[1];
  assert.equal(s2.converted, false);
  assert.equal(s2.loopDetected, true);
  assert.ok(s2.anomalyScore > 0.3);
});

test('computeMarkovModel computes valid probabilities, PageRank centrality, Markov absorption, and 16-D Word2Vec vectors', () => {
  const hits = parseServerLogs(SAMPLE_APACHE_LOGS);
  const { sessions } = reconstructSessions(hits, {
    timeoutMinutes: 30,
    excludeBots: true,
    excludeStaticAssets: true,
    excludeErrorCodes: true,
    conversionTargetPath: '/order-confirmed',
  });

  const { uniquePages, pageMetrics, transitions, word2VecPairs } = computeMarkovModel(sessions, '/order-confirmed');
  assert.ok(uniquePages.includes('/home'));
  assert.ok(uniquePages.includes('/catalog'));

  for (const page of uniquePages) {
    const outgoing = transitions.filter((t) => t.fromPage === page);
    const sumProb = outgoing.reduce((acc, t) => acc + t.probability, 0);
    assert.ok(Math.abs(sumProb - 1.0) < 0.005);
  }

  // Check PageRank sums to ~1.0
  const prSum = pageMetrics.reduce((acc, m) => acc + m.pageRank, 0);
  assert.ok(Math.abs(prSum - 1.0) < 0.02);

  // Check 16-D Word2Vec embeddings
  assert.equal(pageMetrics[0].embedding16D.length, 16);
  assert.ok(word2VecPairs.length > 0);
});

test('mineSequentialPatterns and evaluateFunnelSteps extract frequent sequences and funnel drop-offs', () => {
  const hits = parseServerLogs(SAMPLE_APACHE_LOGS);
  const { sessions } = reconstructSessions(hits, {
    timeoutMinutes: 30,
    excludeBots: true,
    excludeStaticAssets: true,
    excludeErrorCodes: true,
    conversionTargetPath: '/order-confirmed',
  });

  const patterns = mineSequentialPatterns(sessions, 0.1, '/order-confirmed');
  assert.ok(patterns.length > 0);
  const homeToCatalog = patterns.find((p) => p.sequenceKey === '/home -> /catalog');
  assert.ok(homeToCatalog);
  assert.equal(homeToCatalog.support, 1.0);

  const funnel = evaluateFunnelSteps(sessions, ['/home', '/catalog', '/product-detail', '/cart', '/order-confirmed']);
  assert.equal(funnel.length, 5);
  assert.equal(funnel[0].reachedSessions, 2);
  assert.equal(funnel[3].reachedSessions, 1);

  const predictions = predictNextNavigation(['/home', '/catalog'], computeMarkovModel(sessions).transitions, patterns);
  assert.ok(predictions.length > 0);
  assert.equal(predictions[0].nextPage, '/product-detail');
});
