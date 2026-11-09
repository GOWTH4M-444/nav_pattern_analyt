export interface PresetDataset {
  id: string;
  name: string;
  domain: string;
  description: string;
  defaultConversionPath: string;
  defaultFunnelSteps: string[];
  rawLogText: string;
}

function generateApacheLine(
  ip: string,
  epochMs: number,
  path: string,
  status: number,
  bytes: number,
  referrer: string,
  ua: string
): string {
  const d = new Date(epochMs);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getUTCDate()).padStart(2, '0');
  const mon = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hr = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const sec = String(d.getUTCSeconds()).padStart(2, '0');
  const dateStr = `${day}/${mon}/${year}:${hr}:${min}:${sec} +0000`;
  return `${ip} - - [${dateStr}] "GET ${path} HTTP/1.1" ${status} ${bytes} "${referrer}" "${ua}"`;
}

function buildDatasetFromTrails(
  baseTimeMs: number,
  trails: {
    ip: string;
    ua: string;
    steps: { path: string; dwellSec: number; status?: number }[];
    repeatCount: number;
  }[]
): string {
  const lines: string[] = [];
  let sessionCursorMs = baseTimeMs;

  let ipSuffix = 10;
  for (const trail of trails) {
    for (let r = 0; r < trail.repeatCount; r++) {
      const oct3 = Math.floor(ipSuffix / 250) + 1;
      const oct4 = (ipSuffix % 250) + 2;
      const visitorIp = trail.ip === 'AUTO' ? `198.51.${oct3}.${oct4}` : trail.ip;
      ipSuffix++;

      let t = sessionCursorMs;
      let prevPath = '-';
      for (const step of trail.steps) {
        lines.push(
          generateApacheLine(
            visitorIp,
            t,
            step.path,
            step.status ?? 200,
            4200 + (step.path.length * 130),
            prevPath === '-' ? '-' : `https://portal.example.org${prevPath}`,
            trail.ua
          )
        );
        t += step.dwellSec * 1000;
        prevPath = step.path;
      }
      sessionCursorMs += 42 * 1000;
    }
  }
  return lines.join('\n');
}

const UA_DESKTOP_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15';
const UA_DESKTOP_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const UA_MOBILE_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const UA_TABLET_IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const UA_GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

export const PRESET_DATASETS: PresetDataset[] = [
  {
    id: 'ecommerce-store',
    name: 'E-Commerce Retail Storefront Logs',
    domain: 'store.nordicgear.io',
    description: 'High-volume retail clickstream with catalog exploration, search filters, cart ping-pong loops, and checkout conversion.',
    defaultConversionPath: '/order-confirmed',
    defaultFunnelSteps: ['/home', '/catalog', '/product-detail', '/cart', '/checkout', '/order-confirmed'],
    rawLogText: buildDatasetFromTrails(Date.UTC(2026, 10, 9, 8, 0, 0), [
      // Optimal checkout funnel (Desktop)
      {
        ip: 'AUTO',
        ua: UA_DESKTOP_MAC,
        repeatCount: 14,
        steps: [
          { path: '/home', dwellSec: 18 },
          { path: '/catalog', dwellSec: 34 },
          { path: '/product-detail', dwellSec: 52 },
          { path: '/cart', dwellSec: 24 },
          { path: '/checkout', dwellSec: 46 },
          { path: '/order-confirmed', dwellSec: 20 },
        ],
      },
      // Search-driven conversion path (Desktop Win)
      {
        ip: 'AUTO',
        ua: UA_DESKTOP_WIN,
        repeatCount: 9,
        steps: [
          { path: '/home', dwellSec: 12 },
          { path: '/search', dwellSec: 28 },
          { path: '/product-detail', dwellSec: 44 },
          { path: '/reviews', dwellSec: 38 },
          { path: '/cart', dwellSec: 19 },
          { path: '/checkout', dwellSec: 41 },
          { path: '/order-confirmed', dwellSec: 15 },
        ],
      },
      // Catalog <-> Product Detail Ping-Pong comparison loop then abandon at cart (Mobile)
      {
        ip: 'AUTO',
        ua: UA_MOBILE_IOS,
        repeatCount: 11,
        steps: [
          { path: '/home', dwellSec: 14 },
          { path: '/catalog', dwellSec: 26 },
          { path: '/product-detail', dwellSec: 31 },
          { path: '/catalog', dwellSec: 22 },
          { path: '/product-detail', dwellSec: 29 },
          { path: '/cart', dwellSec: 35 },
          { path: '/shipping-policy', dwellSec: 27 },
        ],
      },
      // Checkout reload loop / payment friction drop-off
      {
        ip: 'AUTO',
        ua: UA_MOBILE_IOS,
        repeatCount: 7,
        steps: [
          { path: '/catalog', dwellSec: 25 },
          { path: '/product-detail', dwellSec: 40 },
          { path: '/cart', dwellSec: 20 },
          { path: '/checkout', dwellSec: 55 },
          { path: '/checkout', dwellSec: 48 },
        ],
      },
      // Single-page bounce on /home
      {
        ip: 'AUTO',
        ua: UA_MOBILE_IOS,
        repeatCount: 8,
        steps: [{ path: '/home', dwellSec: 9 }],
      },
      // Tablet deep review readers who convert
      {
        ip: 'AUTO',
        ua: UA_TABLET_IPAD,
        repeatCount: 5,
        steps: [
          { path: '/home', dwellSec: 20 },
          { path: '/catalog', dwellSec: 32 },
          { path: '/product-detail', dwellSec: 48 },
          { path: '/reviews', dwellSec: 62 },
          { path: '/product-detail', dwellSec: 18 },
          { path: '/cart', dwellSec: 22 },
          { path: '/checkout', dwellSec: 39 },
          { path: '/order-confirmed', dwellSec: 18 },
        ],
      },
      // Noise: Static assets & Googlebot crawler & 404 error
      {
        ip: '66.249.66.41',
        ua: UA_GOOGLEBOT,
        repeatCount: 4,
        steps: [
          { path: '/home', dwellSec: 2 },
          { path: '/catalog', dwellSec: 2 },
          { path: '/product-detail', dwellSec: 2 },
        ],
      },
      {
        ip: '198.51.100.88',
        ua: UA_DESKTOP_MAC,
        repeatCount: 3,
        steps: [
          { path: '/assets/bundle.js', dwellSec: 1 },
          { path: '/assets/theme.css', dwellSec: 1 },
          { path: '/legacy-promo', dwellSec: 4, status: 404 },
        ],
      },
    ]),
  },
  {
    id: 'saas-onboarding',
    name: 'B2B SaaS Onboarding & Workspace Telemetry',
    domain: 'app.cloudpulse.dev',
    description: 'B2B cloud platform navigation logs tracking landing page visits, pricing evaluation, docs lookup, and API key activation.',
    defaultConversionPath: '/api-key-created',
    defaultFunnelSteps: ['/landing', '/pricing', '/signup', '/onboarding', '/api-key-created'],
    rawLogText: buildDatasetFromTrails(Date.UTC(2026, 10, 9, 12, 0, 0), [
      {
        ip: 'AUTO',
        ua: UA_DESKTOP_MAC,
        repeatCount: 15,
        steps: [
          { path: '/landing', dwellSec: 22 },
          { path: '/pricing', dwellSec: 38 },
          { path: '/signup', dwellSec: 31 },
          { path: '/onboarding', dwellSec: 49 },
          { path: '/api-key-created', dwellSec: 25 },
        ],
      },
      {
        ip: 'AUTO',
        ua: UA_DESKTOP_WIN,
        repeatCount: 10,
        steps: [
          { path: '/landing', dwellSec: 19 },
          { path: '/docs', dwellSec: 65 },
          { path: '/pricing', dwellSec: 29 },
          { path: '/docs', dwellSec: 54 },
          { path: '/signup', dwellSec: 34 },
        ],
      },
      {
        ip: 'AUTO',
        ua: UA_DESKTOP_MAC,
        repeatCount: 8,
        steps: [
          { path: '/landing', dwellSec: 16 },
          { path: '/signup', dwellSec: 28 },
          { path: '/onboarding', dwellSec: 42 },
          { path: '/docs', dwellSec: 75 },
          { path: '/onboarding', dwellSec: 38 },
          { path: '/api-key-created', dwellSec: 20 },
        ],
      },
      {
        ip: 'AUTO',
        ua: UA_MOBILE_IOS,
        repeatCount: 7,
        steps: [
          { path: '/landing', dwellSec: 14 },
          { path: '/pricing', dwellSec: 24 },
        ],
      },
    ]),
  },
  {
    id: 'university-portal',
    name: 'Academic Portal & Course Registration Logs',
    domain: 'registrar.stateuniv.edu',
    description: 'University student portal clickstreams analyzing course catalog browsing, prerequisite loops, and enrollment confirmation.',
    defaultConversionPath: '/enrollment-confirmed',
    defaultFunnelSteps: ['/portal', '/course-search', '/syllabus-view', '/schedule-builder', '/enrollment-confirmed'],
    rawLogText: buildDatasetFromTrails(Date.UTC(2026, 10, 9, 15, 0, 0), [
      {
        ip: 'AUTO',
        ua: UA_DESKTOP_MAC,
        repeatCount: 13,
        steps: [
          { path: '/portal', dwellSec: 15 },
          { path: '/course-search', dwellSec: 40 },
          { path: '/syllabus-view', dwellSec: 55 },
          { path: '/schedule-builder', dwellSec: 48 },
          { path: '/enrollment-confirmed', dwellSec: 22 },
        ],
      },
      {
        ip: 'AUTO',
        ua: UA_DESKTOP_WIN,
        repeatCount: 11,
        steps: [
          { path: '/portal', dwellSec: 18 },
          { path: '/course-search', dwellSec: 36 },
          { path: '/syllabus-view', dwellSec: 42 },
          { path: '/course-search', dwellSec: 31 },
          { path: '/syllabus-view', dwellSec: 45 },
          { path: '/prereq-error', dwellSec: 28 },
        ],
      },
      {
        ip: 'AUTO',
        ua: UA_TABLET_IPAD,
        repeatCount: 6,
        steps: [
          { path: '/portal', dwellSec: 12 },
          { path: '/advisor-chat', dwellSec: 70 },
          { path: '/schedule-builder', dwellSec: 40 },
          { path: '/enrollment-confirmed', dwellSec: 19 },
        ],
      },
    ]),
  },
];
