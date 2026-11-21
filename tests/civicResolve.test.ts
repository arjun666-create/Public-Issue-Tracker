import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS } from '../src/data/defaultSop';
import { SEED_ISSUES } from '../src/data/seedIssues';
import { buildGoogleMapsUrl, extractCoordinates } from '../src/utils/maps';
import { runSystemSelfTests } from '../src/utils/selfTests';
import {
  isSafeExternalUrl,
  sanitizeInput,
  validateBase64ImagePayload,
  validateImageUpload,
} from '../src/utils/security';
import {
  calculateIssueKpis,
  escapeCsvCell,
  matchManualSopRule,
  sortIssues,
  validateTriageResponseSchema,
} from '../src/utils/triageLogic';

describe('CivicResolve Security Hardening', () => {
  it('strips script tags, HTML elements, event handlers, and dangerous URIs', () => {
    const dirty =
      '<script>alert("xss")</script><img src=x onerror="fetch(1)">Flooded <b>junction</b> javascript:void(0)';
    const clean = sanitizeInput(dirty);
    assert.equal(clean.includes('<script'), false);
    assert.equal(clean.includes('<img'), false);
    assert.equal(/onerror\s*=/i.test(clean), false);
    assert.equal(/javascript:/i.test(clean), false);
    assert.equal(clean.includes('Flooded junction'), true);
  });

  it('enforces JPEG/PNG/WebP MIME types and 5MB file size cap', () => {
    assert.equal(validateImageUpload({ type: 'image/jpeg', size: 500_000 }).valid, true);
    assert.equal(validateImageUpload({ type: 'image/png', size: 1_200_000 }).valid, true);
    assert.equal(validateImageUpload({ type: 'image/webp', size: 900_000 }).valid, true);
    assert.equal(validateImageUpload({ type: 'image/svg+xml', size: 1024 }).valid, false);
    assert.equal(validateImageUpload({ type: 'application/pdf', size: 1024 }).valid, false);
    assert.equal(validateImageUpload({ type: 'image/jpeg', size: 5 * 1024 * 1024 + 1 }).valid, false);
  });

  it('validates base64 image payloads on the server boundary', () => {
    const valid = validateBase64ImagePayload('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
    assert.equal(valid.valid, true);
    assert.equal(valid.mimeType, 'image/jpeg');

    const badMime = validateBase64ImagePayload('data:image/svg+xml;base64,PHN2Zz4=');
    assert.equal(badMime.valid, false);
  });
});

describe('CivicResolve Priority Sorting & SOP Routing', () => {
  it('sorts Critical issues ahead of High, Medium, and Low issues', () => {
    const sorted = sortIssues(SEED_ISSUES, 'critical');
    assert.equal(sorted[0].aiTriage.priority_level, 'Critical');
    assert.equal(sorted[sorted.length - 1].aiTriage.priority_level, 'Low');
  });

  it('routes complaints to matching municipal SOP departments and SLAs', () => {
    const result = matchManualSopRule(
      DEFAULT_SETTINGS.sopRules,
      'Major pipe burst causing flood',
      'Clean water stagnation near Velachery',
      'Velachery, Chennai',
      'Other',
    );
    assert.ok(result.rule);
    assert.equal(result.rule.category, 'Water Supply & Drainage');
    assert.equal(result.rule.department, 'CMWSSB Metro Water');
    assert.equal(result.rule.sla, '4 Hours');
  });
});

describe('CivicResolve Gemini Schema & Google Maps Integration', () => {
  it('validates strict Gemini JSON triage response schema', () => {
    const valid = validateTriageResponseSchema({
      verified_category: 'Roads & Potholes',
      priority_level: 'High',
      priority_reasoning: 'Deep pothole on arterial lane.',
      recommended_department: 'Greater Chennai Corporation - Roads Dept',
      ai_visual_verification: 'Photo confirms damaged asphalt.',
      actionable_summary: 'Patch crater with cold-mix asphalt.',
    });
    assert.equal(valid.valid, true);

    const invalid = validateTriageResponseSchema({
      verified_category: 'Unknown',
      priority_level: 'Urgent',
      priority_reasoning: '',
    });
    assert.equal(invalid.valid, false);
  });

  it('builds safe HTTPS Google Maps coordinate and search URLs', () => {
    const coords = extractCoordinates('Anna Nagar (13.0850° N, 80.2101° E)');
    assert.deepEqual(coords, { lat: 13.085, lng: 80.2101 });

    const coordUrl = buildGoogleMapsUrl('Anna Nagar (13.0850° N, 80.2101° E)');
    assert.equal(coordUrl, 'https://www.google.com/maps?q=13.085000,80.210100');
    assert.equal(isSafeExternalUrl(coordUrl), true);

    const fallbackUrl = buildGoogleMapsUrl('T. Nagar Bus Stand, Chennai');
    assert.equal(
      fallbackUrl.startsWith('https://www.google.com/maps/search/?api=1&query='),
      true,
    );
  });

  it('neutralizes CSV formula cells and computes KPI stats', () => {
    assert.equal(escapeCsvCell('=SUM(A1:A2)'), "'=SUM(A1:A2)");
    const kpis = calculateIssueKpis(SEED_ISSUES);
    assert.equal(kpis.total, SEED_ISSUES.length);
  });
});

describe('CivicResolve Aggregated Self-Test Suite', () => {
  it('passes all built-in diagnostic assertions', () => {
    const report = runSystemSelfTests();
    assert.equal(report.failed, 0, JSON.stringify(report.results, null, 2));
    assert.ok(report.passed >= 8);
  });
});
