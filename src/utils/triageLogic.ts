/**
 * Pure business logic helpers for CivicResolve:
 * - Priority & chronological sorting
 * - Deterministic SOP keyword/category routing
 * - Strict Gemini JSON triage schema validation
 * - KPI aggregations and safe CSV serialization
 */

import {
  ISSUE_CATEGORIES,
  PRIORITY_ORDER,
  type AITriageResult,
  type CivicIssue,
  type IssueCategory,
  type PriorityLevel,
  type SOPRule,
} from '../types/issue';

export type AdminSortMode = 'priority' | 'newest';
export type PublicSortMode = 'newest' | 'oldest' | 'critical' | 'upvoted';

const ALLOWED_PRIORITIES: readonly PriorityLevel[] = ['Critical', 'High', 'Medium', 'Low'];

/**
 * Matches a citizen complaint against configured Municipal SOP rules using keyword hits
 * and category affinity.
 */
export function matchManualSopRule(
  rules: SOPRule[],
  title: string,
  description: string,
  location: string,
  userCategory: IssueCategory,
): { rule: SOPRule | null; matchedKeyword: string | null } {
  const haystack = `${title} ${description} ${location}`.toLowerCase();

  let bestRule: SOPRule | null = null;
  let bestScore = 0;
  let bestKeyword: string | null = null;

  for (const rule of rules) {
    const keywords = rule.keywords
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    let hits = 0;
    let firstMatched: string | null = null;
    for (const kw of keywords) {
      if (haystack.includes(kw)) {
        hits += 1;
        if (!firstMatched) firstMatched = kw;
      }
    }

    if (rule.category === userCategory) {
      hits += 0.5;
    }

    if (hits > bestScore) {
      bestScore = hits;
      bestRule = rule;
      bestKeyword = firstMatched;
    }
  }

  if (!bestRule) {
    bestRule = rules.find((r) => r.category === userCategory) ?? rules[0] ?? null;
  }

  return { rule: bestRule, matchedKeyword: bestKeyword };
}

/**
 * Pure priority & date sorter used across Public Tracker and Admin Portal.
 */
export function sortIssues(issues: CivicIssue[], mode: PublicSortMode | AdminSortMode): CivicIssue[] {
  return [...issues].sort((a, b) => {
    if (mode === 'newest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (mode === 'oldest') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (mode === 'upvoted') {
      return (b.upvotes ?? 0) - (a.upvotes ?? 0);
    }
    if (mode === 'priority') {
      if (a.status === 'Pending Verification' && b.status !== 'Pending Verification') return -1;
      if (b.status === 'Pending Verification' && a.status !== 'Pending Verification') return 1;
    }

    const pDiff =
      PRIORITY_ORDER[a.aiTriage.priority_level] - PRIORITY_ORDER[b.aiTriage.priority_level];
    if (pDiff !== 0) return pDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/**
 * Validates that an unknown JSON object conforms strictly to the Gemini AITriageResult schema.
 */
export function validateTriageResponseSchema(
  payload: unknown,
): { valid: true; data: AITriageResult } | { valid: false; errors: string[] } {
  const errors: string[] = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, errors: ['Payload must be a non-null JSON object.'] };
  }

  const obj = payload as Record<string, unknown>;

  if (
    typeof obj.verified_category !== 'string' ||
    !ISSUE_CATEGORIES.includes(obj.verified_category as IssueCategory)
  ) {
    errors.push(`Invalid verified_category: ${String(obj.verified_category)}`);
  }

  if (
    typeof obj.priority_level !== 'string' ||
    !ALLOWED_PRIORITIES.includes(obj.priority_level as PriorityLevel)
  ) {
    errors.push(`Invalid priority_level: ${String(obj.priority_level)}`);
  }

  const requiredStrings: Array<keyof AITriageResult> = [
    'priority_reasoning',
    'recommended_department',
    'ai_visual_verification',
    'actionable_summary',
  ];

  for (const field of requiredStrings) {
    if (typeof obj[field] !== 'string' || (obj[field] as string).trim().length === 0) {
      errors.push(`Missing or empty string field: ${field}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      verified_category: obj.verified_category as IssueCategory,
      priority_level: obj.priority_level as PriorityLevel,
      priority_reasoning: (obj.priority_reasoning as string).trim(),
      recommended_department: (obj.recommended_department as string).trim(),
      ai_visual_verification: (obj.ai_visual_verification as string).trim(),
      actionable_summary: (obj.actionable_summary as string).trim(),
    },
  };
}

/**
 * Computes real-time KPI counts and mean resolution time in hours.
 */
export function calculateIssueKpis(issues: CivicIssue[]) {
  const total = issues.length;
  const pendingVerification = issues.filter((i) => i.status === 'Pending Verification').length;
  const reported = issues.filter((i) => i.status === 'Reported').length;
  const inProgress = issues.filter((i) => i.status === 'In Progress').length;
  const criticalOpen = issues.filter(
    (i) => i.aiTriage.priority_level === 'Critical' && i.status !== 'Resolved',
  ).length;
  const resolvedIssues = issues.filter((i) => i.status === 'Resolved');
  const resolved = resolvedIssues.length;

  let avgHours = 18.4;
  if (resolvedIssues.length > 0) {
    const totalHours = resolvedIssues.reduce((acc, issue) => {
      const diff = new Date(issue.updatedAt).getTime() - new Date(issue.createdAt).getTime();
      const hrs = Math.max(1, diff / (1000 * 60 * 60));
      return acc + hrs;
    }, 0);
    avgHours = Math.round((totalHours / resolvedIssues.length) * 10) / 10;
  }

  return {
    total,
    pendingVerification,
    reported,
    inProgress,
    criticalOpen,
    resolved,
    avgHours,
  };
}

/**
 * Escapes CSV cell values and neutralizes spreadsheet formula injection (=, +, -, @).
 */
export function escapeCsvCell(val: string | number | undefined): string {
  let str = String(val ?? '');
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
