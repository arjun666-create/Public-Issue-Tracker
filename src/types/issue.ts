/**
 * Core domain models and configuration interfaces for CivicResolve.
 */

export type IssueCategory =
  | 'Roads & Potholes'
  | 'Sanitation & Waste'
  | 'Streetlights & Electrical'
  | 'Water Supply & Drainage'
  | 'Parks & Public Spaces'
  | 'Other';

export type PriorityLevel = 'Critical' | 'High' | 'Medium' | 'Low';

export type IssueStatus = 'Pending Verification' | 'Reported' | 'In Progress' | 'Resolved';

export type TriageMode = 'autonomous' | 'hybrid' | 'manual';

export type AiSensitivity = 'conservative' | 'balanced' | 'high-alert';

export type AiLanguageTone = 'technical' | 'citizen' | 'bilingual';

/**
 * Structured AI classification, priority detection, and department routing result.
 */
export interface AITriageResult {
  verified_category: IssueCategory;
  priority_level: PriorityLevel;
  priority_reasoning: string;
  recommended_department: string;
  ai_visual_verification: string;
  actionable_summary: string;
  routing_source?: 'gemini-ai' | 'manual-sop';
  matched_sla?: string;
  officer_contact?: string;
}

/** Backwards-compatible alias for AITriageResult. */
export type TriageResult = AITriageResult;

/**
 * Core civic complaint ticket entity stored and tracked across Citizen and Admin views.
 */
export interface CivicIssue {
  id: string;
  title: string;
  description: string;
  location: string;
  userCategory: IssueCategory;
  photoUrl?: string;
  status: IssueStatus;
  createdAt: string;
  updatedAt: string;
  officialNote?: string;
  upvotes?: number;
  aiTriage: AITriageResult;
}

/**
 * Standard Operating Procedure (SOP) rule mapping issue categories/keywords to departments and SLAs.
 */
export interface SOPRule {
  id: string;
  category: IssueCategory;
  keywords: string;
  department: string;
  sla: string;
  defaultPriority: PriorityLevel;
  officerContact: string;
}

/** Backwards-compatible alias for SOPRule. */
export type SopRule = SOPRule;

/**
 * Live Gemini AI prompt and urgency calibration settings.
 */
export interface AiBrainConfig {
  sensitivity: AiSensitivity;
  systemInstructionOverride: string;
  languageTone: AiLanguageTone;
}

/**
 * Root application configuration persisted in localStorage.
 */
export interface AppSettings {
  triageMode: TriageMode;
  sopRules: SOPRule[];
  aiConfig: AiBrainConfig;
}

/** Backwards-compatible alias for AppSettings. */
export type CivicSettings = AppSettings;

/**
 * Live diagnostic status returned by /api/health and /api/triage.
 */
export interface ApiHealthStatus {
  ok: boolean;
  geminiConfigured: boolean;
  model: string;
  sdk: string;
  latencyMs: number | null;
  keyMask: string;
  checkedAt: string;
}

/**
 * Single assertion outcome produced by the built-in System Self-Test suite.
 */
export interface SelfTestResult {
  id: string;
  name: string;
  category: 'Security' | 'Routing' | 'Schema' | 'Google Maps' | 'Accessibility' | 'Efficiency';
  status: 'PASS' | 'FAIL';
  durationMs: number;
  detail: string;
}

/**
 * Aggregated self-test execution report.
 */
export interface SelfTestReport {
  passed: number;
  failed: number;
  totalMs: number;
  ranAt: string;
  results: SelfTestResult[];
}

export const ISSUE_CATEGORIES: IssueCategory[] = [
  'Roads & Potholes',
  'Sanitation & Waste',
  'Streetlights & Electrical',
  'Water Supply & Drainage',
  'Parks & Public Spaces',
  'Other',
];

export const MUNICIPAL_DEPARTMENTS: string[] = [
  'Greater Chennai Corporation - Roads Dept',
  'Storm Water Drain & Roads Dept',
  'CMWSSB Metro Water',
  'Metro Water & Sewerage Board',
  'TANGEDCO Electrical',
  'TANGEDCO / Streetlight Maintenance',
  'Solid Waste Management',
  'Parks & Urban Forestry Dept',
  'General Municipal Works',
];

export const PRIORITY_ORDER: Record<PriorityLevel, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

export const STATUS_STEPS: IssueStatus[] = ['Reported', 'In Progress', 'Resolved'];
