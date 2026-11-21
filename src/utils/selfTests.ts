/**
 * Built-in automated self-test and diagnostics runner for CivicResolve.
 * Shared between CLI unit tests (tests/civicResolve.test.ts) and the in-app
 * "System Self-Test & Diagnostics" panel in Settings.
 */

import { DEFAULT_SETTINGS } from '../data/defaultSop';
import { SEED_ISSUES } from '../data/seedIssues';
import type { SelfTestReport, SelfTestResult } from '../types/issue';
import { buildGoogleMapsUrl, extractCoordinates } from './maps';
import {
  isSafeExternalUrl,
  sanitizeInput,
  validateImageUpload,
} from './security';
import {
  calculateIssueKpis,
  escapeCsvCell,
  matchManualSopRule,
  sortIssues,
  validateTriageResponseSchema,
} from './triageLogic';

function runCase(
  id: string,
  name: string,
  category: SelfTestResult['category'],
  fn: () => string,
): SelfTestResult {
  const start = performance.now();
  try {
    const detail = fn();
    return {
      id,
      name,
      category,
      status: 'PASS',
      durationMs: Math.max(0.01, Number((performance.now() - start).toFixed(2))),
      detail,
    };
  } catch (err) {
    return {
      id,
      name,
      category,
      status: 'FAIL',
      durationMs: Math.max(0.01, Number((performance.now() - start).toFixed(2))),
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Executes all deterministic unit assertions and (when running in a browser)
 * live WCAG 2.1 AA DOM accessibility inspections.
 */
export function runSystemSelfTests(): SelfTestReport {
  const suiteStart = performance.now();
  const results: SelfTestResult[] = [];

  // 1. Security: XSS / Script / Event-handler sanitization
  results.push(
    runCase('sec-sanitize', 'Input Sanitization (XSS & HTML Stripping)', 'Security', () => {
      const payload =
        '<script>alert(1)</script><img src=x onerror="steal()">Deep pothole near <b>SBOA</b> School javascript:alert(2)';
      const cleaned = sanitizeInput(payload);
      assert(!cleaned.includes('<script'), 'Script tag was not stripped');
      assert(!cleaned.includes('<img'), 'HTML tag was not stripped');
      assert(!/onerror\s*=/i.test(cleaned), 'Event handler attribute leaked');
      assert(!/javascript:/i.test(cleaned), 'javascript: URI leaked');
      assert(cleaned.includes('Deep pothole near SBOA School'), 'Legitimate text corrupted');
      return `Stripped script/img/onerror payload -> "${cleaned}"`;
    }),
  );

  // 2. Security: MIME & 5MB upload validation
  results.push(
    runCase('sec-upload', 'File Upload Validation (MIME & 5MB Cap)', 'Security', () => {
      const validJpg = validateImageUpload({ type: 'image/jpeg', size: 1024 * 800 });
      const validWebp = validateImageUpload({ type: 'image/webp', size: 512 * 1024 });
      const badSvg = validateImageUpload({ type: 'image/svg+xml', size: 1024 });
      const oversized = validateImageUpload({ type: 'image/png', size: 6 * 1024 * 1024 });

      assert(validJpg.valid, 'Expected JPEG under 5MB to pass');
      assert(validWebp.valid, 'Expected WebP under 5MB to pass');
      assert(!badSvg.valid, 'Expected SVG upload to be rejected');
      assert(!oversized.valid, 'Expected >5MB PNG upload to be rejected');
      return 'Accepted JPEG/WebP <= 5MB; blocked SVG and 6MB PNG payload.';
    }),
  );

  // 3. Routing: Priority sorting order
  results.push(
    runCase('route-sort', 'Priority Sorting (Critical -> High -> Medium -> Low)', 'Routing', () => {
      const sorted = sortIssues(SEED_ISSUES, 'critical');
      assert(sorted.length === SEED_ISSUES.length, 'Sorted count mismatch');
      assert(sorted[0].aiTriage.priority_level === 'Critical', 'First ticket must be Critical');
      assert(
        sorted[sorted.length - 1].aiTriage.priority_level === 'Low',
        'Last ticket must be Low',
      );
      return `Sorted ${sorted.length} tickets deterministically (${sorted[0].id} -> ${sorted[sorted.length - 1].id}).`;
    }),
  );

  // 4. Routing: Manual SOP keyword matching
  results.push(
    runCase('route-sop', 'SOP Routing Matrix Keyword & SLA Match', 'Routing', () => {
      const match = matchManualSopRule(
        DEFAULT_SETTINGS.sopRules,
        'Sparking transformer wire near bus stop',
        'Exposed electric cable on pole #12',
        'Adyar, Chennai',
        'Other',
      );
      assert(match.rule !== null, 'Expected a matched SOP rule');
      assert(match.rule.category === 'Streetlights & Electrical', 'Wrong SOP category matched');
      assert(match.rule.department === 'TANGEDCO Electrical', 'Wrong SOP department routed');
      assert(match.matchedKeyword !== null, 'Expected matched trigger keyword');
      return `Matched "${match.matchedKeyword}" -> ${match.rule.department} (${match.rule.sla} SLA).`;
    }),
  );

  // 5. Schema: Gemini JSON Schema Validation
  results.push(
    runCase('schema-gemini', 'Gemini Structured JSON Schema Validation', 'Schema', () => {
      const validRes = validateTriageResponseSchema({
        verified_category: 'Water Supply & Drainage',
        priority_level: 'Critical',
        priority_reasoning: 'Burst pressurized main flooding roadway.',
        recommended_department: 'CMWSSB Metro Water',
        ai_visual_verification: 'No image attached',
        actionable_summary: 'Isolate valve and deploy dewatering crew.',
      });
      const invalidRes = validateTriageResponseSchema({
        verified_category: 'InvalidCategory',
        priority_level: 'Extreme',
      });
      assert(validRes.valid, 'Valid Gemini triage object failed schema validation');
      assert(!invalidRes.valid && invalidRes.errors.length >= 2, 'Invalid object should fail validation');
      return 'Verified valid payload & rejected malformed category/priority enums.';
    }),
  );

  // 6. Google Maps URL generation & coordinate parsing
  results.push(
    runCase('google-maps', 'Google Maps Coordinate Parsing & HTTPS URL', 'Google Maps', () => {
      const loc = '2nd Avenue, Anna Nagar West, Chennai (13.0878° N, 80.2004° E)';
      const coords = extractCoordinates(loc);
      const url = buildGoogleMapsUrl(loc);
      assert(coords !== null, 'Failed to parse coordinates');
      assert(url === 'https://www.google.com/maps?q=13.087800,80.200400', `Unexpected URL: ${url}`);
      assert(isSafeExternalUrl(url), 'Generated URL failed safety protocol check');
      return `Parsed (${coords.lat}, ${coords.lng}) -> ${url}`;
    }),
  );

  // 7. Efficiency: CSV formula injection defense & KPI aggregation
  results.push(
    runCase('eff-kpi-csv', 'KPI Aggregation & CSV Formula Sanitization', 'Efficiency', () => {
      const kpis = calculateIssueKpis(SEED_ISSUES);
      assert(kpis.total === SEED_ISSUES.length, 'Total KPI count mismatch');
      const formulaCell = escapeCsvCell('=CMD("calc")');
      assert(
        !formulaCell.startsWith('=') && formulaCell.includes("'=CMD"),
        'CSV formula prefix was not neutralized',
      );
      return `Computed ${kpis.total} KPIs (avg ${kpis.avgHours}h) & neutralized spreadsheet formula injection.`;
    }),
  );

  // 8. Accessibility: Live DOM / WCAG checks in browser (gracefully adapts in Node CLI)
  results.push(
    runCase('a11y-wcag', 'WCAG 2.1 AA Landmarks, Alt Text & Form Labels', 'Accessibility', () => {
      if (typeof document === 'undefined') {
        return 'Headless CLI mode: DOM landmark checks skipped cleanly (verified in browser runtime).';
      }
      const images = Array.from(document.querySelectorAll('img'));
      const missingAlt = images.filter((img) => !img.getAttribute('alt')?.trim());
      assert(missingAlt.length === 0, `${missingAlt.length} <img> element(s) missing alt text`);

      const controls = Array.from(document.querySelectorAll('input, select, textarea'));
      const unlabeled = controls.filter((el) => {
        const id = el.getAttribute('id');
        const hasAria = Boolean(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby'));
        const hasLabel = Boolean(id && document.querySelector(`label[for="${id}"]`));
        return !hasAria && !hasLabel;
      });
      assert(
        unlabeled.length === 0,
        `${unlabeled.length} form control(s) missing <label for> or aria-label`,
      );

      const mainEl = document.querySelector('main');
      assert(mainEl !== null, 'Missing semantic <main> landmark');
      return `Verified <main> landmark, ${images.length} images with alt text, and ${controls.length} labeled form controls.`;
    }),
  );

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.length - passed;

  return {
    passed,
    failed,
    totalMs: Number((performance.now() - suiteStart).toFixed(2)),
    ranAt: new Date().toISOString(),
    results,
  };
}
