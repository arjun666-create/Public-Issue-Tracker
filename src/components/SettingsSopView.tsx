import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  Cloud,
  CloudRain,
  Cpu,
  Download,
  Edit3,
  FileJson,
  FileSpreadsheet,
  FlaskConical,
  GitBranch,
  KeyRound,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  Sliders,
  Trash2,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { useSkin } from '../context/ThemeContext';
import { DEFAULT_SYSTEM_INSTRUCTION } from '../data/defaultSop';
import {
  ISSUE_CATEGORIES,
  MUNICIPAL_DEPARTMENTS,
  type AiLanguageTone,
  type AiSensitivity,
  type ApiHealthStatus,
  type CivicIssue,
  type CivicSettings,
  type IssueCategory,
  type PriorityLevel,
  type SelfTestReport,
  type SopRule,
  type TriageMode,
} from '../types/issue';
import { sanitizeInput } from '../utils/security';
import { runSystemSelfTests } from '../utils/selfTests';
import { escapeCsvCell } from '../utils/triageLogic';
import { PriorityBadge } from './PriorityBadge';

interface SettingsSopViewProps {
  settings: CivicSettings;
  issues: CivicIssue[];
  apiHealth: ApiHealthStatus;
  lastTriageLatencyMs: number | null;
  onRefreshHealth: () => Promise<void>;
  onUpdateSettings: (next: CivicSettings, toastMessage?: string) => void;
  onLoadMonsoonScenario: () => void;
  onResetAllDemo: () => void;
}

const SLA_OPTIONS = ['2 Hours', '4 Hours', '12 Hours', '24 Hours', '48 Hours', '72 Hours'];

const SENSITIVITY_OPTIONS: Array<{
  value: AiSensitivity;
  label: string;
  desc: string;
}> = [
  {
    value: 'conservative',
    label: 'Conservative',
    desc: 'Reserves Critical strictly for verified immediate life-safety emergencies.',
  },
  {
    value: 'balanced',
    label: 'Balanced',
    desc: 'Standard municipal calibration weighing hazard severity and traffic exposure.',
  },
  {
    value: 'high-alert',
    label: 'High-Alert',
    desc: 'Escalates waterlogging, monsoon drainage, and school-zone hazards to Critical.',
  },
];

const TONE_OPTIONS: Array<{
  value: AiLanguageTone;
  label: string;
  desc: string;
}> = [
  {
    value: 'technical',
    label: 'Technical Engineering Brief',
    desc: 'Concise municipal dispatch directives for field crews.',
  },
  {
    value: 'citizen',
    label: 'Simple Citizen-Friendly Summary',
    desc: 'Plain-language explanations easy for residents to read.',
  },
  {
    value: 'bilingual',
    label: 'Bilingual (English + Tamil)',
    desc: 'Outputs English summary paired with Tamil translation.',
  },
];

export function SettingsSopView({
  settings,
  issues,
  apiHealth,
  lastTriageLatencyMs,
  onRefreshHealth,
  onUpdateSettings,
  onLoadMonsoonScenario,
  onResetAllDemo,
}: SettingsSopViewProps) {
  const palette = useSkin();

  const [sensitivityDraft, setSensitivityDraft] = useState<AiSensitivity>(
    settings.aiConfig.sensitivity,
  );
  const [toneDraft, setToneDraft] = useState<AiLanguageTone>(settings.aiConfig.languageTone);
  const [instructionDraft, setInstructionDraft] = useState<string>(
    settings.aiConfig.systemInstructionOverride,
  );

  useEffect(() => {
    setSensitivityDraft(settings.aiConfig.sensitivity);
    setToneDraft(settings.aiConfig.languageTone);
    setInstructionDraft(settings.aiConfig.systemInstructionOverride);
  }, [settings.aiConfig]);

  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<SopRule | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategory, setNewCategory] = useState<IssueCategory>('Roads & Potholes');
  const [newKeywords, setNewKeywords] = useState('');
  const [newDepartment, setNewDepartment] = useState<string>(MUNICIPAL_DEPARTMENTS[0]);
  const [newSla, setNewSla] = useState<string>('4 Hours');
  const [newPriority, setNewPriority] = useState<PriorityLevel>('High');
  const [newOfficer, setNewOfficer] = useState('');

  const [pingingHealth, setPingingHealth] = useState(false);
  const [selfTestReport, setSelfTestReport] = useState<SelfTestReport | null>(null);

  const handleModeChange = useCallback(
    (mode: TriageMode) => {
      onUpdateSettings(
        { ...settings, triageMode: mode },
        'Settings & SOP Rules Updated Live',
      );
    },
    [onUpdateSettings, settings],
  );

  const handleApplyAiBrain = useCallback(() => {
    const cleanPrompt = sanitizeInput(instructionDraft);
    onUpdateSettings(
      {
        ...settings,
        aiConfig: {
          sensitivity: sensitivityDraft,
          languageTone: toneDraft,
          systemInstructionOverride: cleanPrompt || DEFAULT_SYSTEM_INSTRUCTION,
        },
      },
      'Settings & SOP Rules Updated Live',
    );
  }, [instructionDraft, onUpdateSettings, sensitivityDraft, settings, toneDraft]);

  const handleResetPrompt = useCallback(() => {
    setInstructionDraft(DEFAULT_SYSTEM_INSTRUCTION);
  }, []);

  const startEditingRule = useCallback((rule: SopRule) => {
    setEditingRuleId(rule.id);
    setEditDraft({ ...rule });
  }, []);

  const saveEditedRule = useCallback(() => {
    if (!editDraft) return;
    const sanitizedRule: SopRule = {
      ...editDraft,
      keywords: sanitizeInput(editDraft.keywords) || editDraft.category.toLowerCase(),
      department: sanitizeInput(editDraft.department) || 'General Municipal Works',
      officerContact: sanitizeInput(editDraft.officerContact) || 'Municipal Control Room',
    };
    const updatedRules = settings.sopRules.map((r) => (r.id === sanitizedRule.id ? sanitizedRule : r));
    onUpdateSettings(
      { ...settings, sopRules: updatedRules },
      'Settings & SOP Rules Updated Live',
    );
    setEditingRuleId(null);
    setEditDraft(null);
  }, [editDraft, onUpdateSettings, settings]);

  const deleteRule = useCallback(
    (id: string) => {
      const updatedRules = settings.sopRules.filter((r) => r.id !== id);
      onUpdateSettings(
        { ...settings, sopRules: updatedRules },
        'Settings & SOP Rules Updated Live',
      );
    },
    [onUpdateSettings, settings],
  );

  const handleAddRule = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const cleanDept = sanitizeInput(newDepartment);
      const cleanOfficer = sanitizeInput(newOfficer);
      if (!cleanDept || !cleanOfficer) return;

      const cleanKeywords =
        sanitizeInput(newKeywords) ||
        newCategory.toLowerCase().replace(/&/g, '').split(/\s+/).filter(Boolean).join(', ');

      const createdRule: SopRule = {
        id: `sop-${Date.now()}`,
        category: newCategory,
        keywords: cleanKeywords,
        department: cleanDept,
        sla: newSla,
        defaultPriority: newPriority,
        officerContact: cleanOfficer,
      };

      onUpdateSettings(
        { ...settings, sopRules: [createdRule, ...settings.sopRules] },
        'Settings & SOP Rules Updated Live',
      );

      setNewKeywords('');
      setNewOfficer('');
      setShowAddForm(false);
    },
    [newCategory, newDepartment, newKeywords, newOfficer, newPriority, newSla, onUpdateSettings, settings],
  );

  const handleExportJson = useCallback(() => {
    const report = {
      exportedAt: new Date().toISOString(),
      activeTriageMode: settings.triageMode,
      aiBrainConfig: settings.aiConfig,
      sopRulesCount: settings.sopRules.length,
      totalIssues: issues.length,
      issues,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `civicresolve-audit-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [issues, settings]);

  const handleExportCsv = useCallback(() => {
    const headers = [
      'Ticket ID',
      'Title',
      'Location',
      'Status',
      'User Category',
      'Verified Category',
      'Priority',
      'Department',
      'Routing Source',
      'AI Priority Reasoning',
      'AI Visual Verification',
      'Actionable Summary',
      'Official Remark',
      'Upvotes',
      'Created At',
    ];
    const rows = issues.map((issue) => [
      escapeCsvCell(issue.id),
      escapeCsvCell(issue.title),
      escapeCsvCell(issue.location),
      escapeCsvCell(issue.status),
      escapeCsvCell(issue.userCategory),
      escapeCsvCell(issue.aiTriage.verified_category),
      escapeCsvCell(issue.aiTriage.priority_level),
      escapeCsvCell(issue.aiTriage.recommended_department),
      escapeCsvCell(issue.aiTriage.routing_source ?? 'gemini-ai'),
      escapeCsvCell(issue.aiTriage.priority_reasoning),
      escapeCsvCell(issue.aiTriage.ai_visual_verification),
      escapeCsvCell(issue.aiTriage.actionable_summary),
      escapeCsvCell(issue.officialNote ?? ''),
      escapeCsvCell(issue.upvotes ?? 0),
      escapeCsvCell(issue.createdAt),
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `civicresolve-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [issues]);

  const handlePingHealth = useCallback(async () => {
    setPingingHealth(true);
    try {
      await onRefreshHealth();
    } finally {
      setPingingHealth(false);
    }
  }, [onRefreshHealth]);

  const handleRunSelfTests = useCallback(() => {
    const report = runSystemSelfTests();
    setSelfTestReport(report);
  }, []);

  const modes: Array<{
    id: TriageMode;
    title: string;
    badge: string;
    desc: string;
    Icon: typeof Bot;
  }> = [
    {
      id: 'autonomous',
      title: 'Autonomous Gemini AI Mode',
      badge: 'Default',
      desc: 'Gemini analyzes text and field photos, scores hazards, and routes tickets directly to departments in Reported status.',
      Icon: Bot,
    },
    {
      id: 'hybrid',
      title: 'Human-in-the-Loop Hybrid Mode',
      badge: 'Verified Dispatch',
      desc: 'Gemini suggests category, priority, and department, then holds the ticket in Pending Verification until an admin approves it.',
      Icon: UserCheck,
    },
    {
      id: 'manual',
      title: 'Strict Manual SOP Mode',
      badge: 'Deterministic',
      desc: 'Bypasses AI auto-routing and applies your custom keyword-to-department SOP matrix rules directly.',
      Icon: GitBranch,
    },
  ];

  const sensitivityIndex = SENSITIVITY_OPTIONS.findIndex((o) => o.value === sensitivityDraft);

  return (
    <div className="space-y-8">
      <div className={`flex flex-col gap-2 border-b pb-5 sm:flex-row sm:items-end sm:justify-between ${palette.borderSubtle}`}>
        <div className="max-w-3xl space-y-1.5">
          <h2 className={`text-2xl font-bold tracking-tight sm:text-3xl [text-wrap:balance] ${palette.textPrimary}`}>
            Settings,{' '}
            <span className={`bg-gradient-to-r ${palette.gradientTitle} bg-clip-text text-transparent`}>
              SOP &amp; Diagnostics
            </span>{' '}
            Center
          </h2>
          <p className={`text-sm leading-relaxed ${palette.textMuted}`}>
            Configure municipal triage automation, edit SOP routing matrices, inspect Google Cloud
            &amp; Gemini API telemetry, and execute automated self-tests live.
          </p>
        </div>
      </div>

      {/* SECTION 1: Triage Mode Switcher */}
      <section aria-label="Triage mode switcher" className="space-y-4">
        <div>
          <h3 className={`text-base font-semibold ${palette.textPrimary}`}>
            1. Triage Mode Switcher (AI vs. Manual Procedure)
          </h3>
          <p className={`text-xs ${palette.textMuted}`}>
            Changes take effect immediately on the Report an Issue intake workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {modes.map((mode) => {
            const { Icon } = mode;
            const isSelected = settings.triageMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => handleModeChange(mode.id)}
                aria-pressed={isSelected}
                className={`flex flex-col justify-between gap-4 rounded-xl border p-5 text-left transition-all duration-200 hover:-translate-y-0.5 ${
                  palette.focusRing
                } ${palette.panel} ${isSelected ? 'ring-2 ring-cyan-400/70 border-cyan-400' : ''}`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={`rounded-xl border p-2.5 ${
                        isSelected ? palette.accentBadge : palette.subPanel
                      }`}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <span
                      className={`rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold ${
                        isSelected
                          ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-500'
                          : palette.subPanel
                      }`}
                    >
                      {isSelected ? 'ACTIVE MODE' : mode.badge}
                    </span>
                  </div>

                  <div>
                    <h4 className={`text-sm font-bold ${palette.textPrimary}`}>{mode.title}</h4>
                    <p className={`mt-1.5 text-xs leading-relaxed ${palette.textMuted}`}>
                      {mode.desc}
                    </p>
                  </div>
                </div>

                <div className={`flex items-center gap-2 border-t pt-3 text-xs font-semibold ${palette.borderSubtle}`}>
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full ${
                      isSelected ? 'bg-cyan-400' : 'bg-slate-500'
                    }`}
                  />
                  <span className={isSelected ? palette.accentText : palette.textMuted}>
                    {isSelected ? 'Currently active for new citizen reports' : 'Click to activate'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: Custom SOP & Routing Matrix */}
      <section aria-label="Manual routing and escalation matrix" className={`space-y-4 rounded-xl border p-5 sm:p-6 ${palette.panel}`}>
        <div className={`flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between ${palette.borderSubtle}`}>
          <div>
            <h3 className={`text-base font-semibold ${palette.textPrimary}`}>
              2. Manual Routing &amp; Escalation Matrix (SOP Builder)
            </h3>
            <p className={`text-xs ${palette.textMuted}`}>
              Used directly in Strict Manual SOP Mode and displayed as municipal SLA reference across
              dispatch queues.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddForm((prev) => !prev)}
            aria-expanded={showAddForm}
            className={`inline-flex items-center gap-1.5 self-start rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${palette.primaryBtn}`}
          >
            {showAddForm ? (
              <>
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Close Form</span>
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Add New Procedure Rule</span>
              </>
            )}
          </button>
        </div>

        {showAddForm && (
          <form
            onSubmit={handleAddRule}
            className={`grid grid-cols-1 gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-6 ${palette.subPanel}`}
          >
            <div className="space-y-1 lg:col-span-2">
              <label htmlFor="sop-new-category" className={`block text-[11px] font-medium ${palette.textSecondary}`}>
                Issue Category
              </label>
              <select
                id="sop-new-category"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as IssueCategory)}
                className={`w-full rounded-lg px-3 py-2 text-xs ${palette.input}`}
              >
                {ISSUE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className={palette.selectOption}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 lg:col-span-2">
              <label htmlFor="sop-new-department" className={`block text-[11px] font-medium ${palette.textSecondary}`}>
                Assigned Municipal Department
              </label>
              <input
                id="sop-new-department"
                type="text"
                required
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                placeholder="e.g., Greater Chennai Corporation - Roads Dept"
                className={`w-full rounded-lg px-3 py-2 text-xs ${palette.input}`}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="sop-new-sla" className={`block text-[11px] font-medium ${palette.textSecondary}`}>
                Auto-Escalation SLA
              </label>
              <select
                id="sop-new-sla"
                value={newSla}
                onChange={(e) => setNewSla(e.target.value)}
                className={`w-full rounded-lg px-3 py-2 text-xs ${palette.input}`}
              >
                {SLA_OPTIONS.map((sla) => (
                  <option key={sla} value={sla} className={palette.selectOption}>
                    {sla}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="sop-new-priority" className={`block text-[11px] font-medium ${palette.textSecondary}`}>
                Default Priority Override
              </label>
              <select
                id="sop-new-priority"
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as PriorityLevel)}
                className={`w-full rounded-lg px-3 py-2 text-xs ${palette.input}`}
              >
                <option value="Critical" className={palette.selectOption}>Critical</option>
                <option value="High" className={palette.selectOption}>High</option>
                <option value="Medium" className={palette.selectOption}>Medium</option>
                <option value="Low" className={palette.selectOption}>Low</option>
              </select>
            </div>

            <div className="space-y-1 sm:col-span-2 lg:col-span-3">
              <label htmlFor="sop-new-keywords" className={`block text-[11px] font-medium ${palette.textSecondary}`}>
                Trigger Keywords (comma-separated for Strict SOP matching)
              </label>
              <input
                id="sop-new-keywords"
                type="text"
                value={newKeywords}
                onChange={(e) => setNewKeywords(e.target.value)}
                placeholder="e.g., monsoon, flood, submerged, drain"
                className={`w-full rounded-lg px-3 py-2 text-xs ${palette.input}`}
              />
            </div>

            <div className="space-y-1 sm:col-span-2 lg:col-span-2">
              <label htmlFor="sop-new-officer" className={`block text-[11px] font-medium ${palette.textSecondary}`}>
                Field Officer Contact / Zone
              </label>
              <input
                id="sop-new-officer"
                type="text"
                required
                value={newOfficer}
                onChange={(e) => setNewOfficer(e.target.value)}
                placeholder="e.g., Zone-09 AE R. Kumar (+91 44-2433-1100)"
                className={`w-full rounded-lg px-3 py-2 text-xs ${palette.input}`}
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className={`w-full rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400 ${palette.focusRing}`}
              >
                Save Rule
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-xs">
            <thead>
              <tr className={`border-b text-[11px] font-semibold ${palette.borderSubtle} ${palette.textMuted}`}>
                <th scope="col" className="py-3 pr-4">Issue Category</th>
                <th scope="col" className="py-3 pr-4">Assigned Municipal Department</th>
                <th scope="col" className="py-3 pr-4">Auto-Escalation SLA</th>
                <th scope="col" className="py-3 pr-4">Default Priority Override</th>
                <th scope="col" className="py-3 pr-4">Field Officer Contact / Zone</th>
                <th scope="col" className="py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${palette.isLight ? 'divide-slate-200' : 'divide-slate-800/70'}`}>
              {settings.sopRules.map((rule) => {
                const isEditing = editingRuleId === rule.id && editDraft !== null;
                if (isEditing && editDraft) {
                  return (
                    <tr key={rule.id}>
                      <td className="py-3 pr-3 align-top space-y-1.5">
                        <select
                          aria-label="Edit issue category"
                          value={editDraft.category}
                          onChange={(e) =>
                            setEditDraft({
                              ...editDraft,
                              category: e.target.value as IssueCategory,
                            })
                          }
                          className={`w-full rounded px-2 py-1.5 text-xs ${palette.input}`}
                        >
                          {ISSUE_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat} className={palette.selectOption}>
                              {cat}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          aria-label="Edit trigger keywords"
                          value={editDraft.keywords}
                          onChange={(e) =>
                            setEditDraft({ ...editDraft, keywords: e.target.value })
                          }
                          placeholder="Keywords..."
                          className={`w-full rounded px-2 py-1 text-[11px] ${palette.input}`}
                        />
                      </td>
                      <td className="py-3 pr-3 align-top">
                        <input
                          type="text"
                          aria-label="Edit assigned municipal department"
                          value={editDraft.department}
                          onChange={(e) =>
                            setEditDraft({ ...editDraft, department: e.target.value })
                          }
                          className={`w-full rounded px-2 py-1.5 text-xs ${palette.input}`}
                        />
                      </td>
                      <td className="py-3 pr-3 align-top">
                        <select
                          aria-label="Edit auto-escalation SLA"
                          value={editDraft.sla}
                          onChange={(e) => setEditDraft({ ...editDraft, sla: e.target.value })}
                          className={`w-full rounded px-2 py-1.5 text-xs ${palette.input}`}
                        >
                          {SLA_OPTIONS.map((sla) => (
                            <option key={sla} value={sla} className={palette.selectOption}>
                              {sla}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 pr-3 align-top">
                        <select
                          aria-label="Edit default priority override"
                          value={editDraft.defaultPriority}
                          onChange={(e) =>
                            setEditDraft({
                              ...editDraft,
                              defaultPriority: e.target.value as PriorityLevel,
                            })
                          }
                          className={`w-full rounded px-2 py-1.5 text-xs ${palette.input}`}
                        >
                          <option value="Critical" className={palette.selectOption}>Critical</option>
                          <option value="High" className={palette.selectOption}>High</option>
                          <option value="Medium" className={palette.selectOption}>Medium</option>
                          <option value="Low" className={palette.selectOption}>Low</option>
                        </select>
                      </td>
                      <td className="py-3 pr-3 align-top">
                        <input
                          type="text"
                          aria-label="Edit field officer contact"
                          value={editDraft.officerContact}
                          onChange={(e) =>
                            setEditDraft({ ...editDraft, officerContact: e.target.value })
                          }
                          className={`w-full rounded px-2 py-1.5 text-xs ${palette.input}`}
                        />
                      </td>
                      <td className="py-3 text-right align-top">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={saveEditedRule}
                            aria-label="Save SOP rule"
                            className={`rounded-md bg-emerald-500 p-1.5 text-slate-950 hover:bg-emerald-400 ${palette.focusRing}`}
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRuleId(null);
                              setEditDraft(null);
                            }}
                            aria-label="Cancel SOP rule edit"
                            className={`rounded-md p-1.5 ${palette.secondaryBtn}`}
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={rule.id}>
                    <td className="py-3.5 pr-4">
                      <p className={`font-semibold ${palette.textPrimary}`}>{rule.category}</p>
                      <p className={`mt-0.5 font-mono text-[11px] ${palette.textMuted}`}>
                        Keywords: <span className={palette.accentText}>{rule.keywords}</span>
                      </p>
                    </td>
                    <td className="py-3.5 pr-4 font-medium text-emerald-500">{rule.department}</td>
                    <td className={`py-3.5 pr-4 font-mono tabular-nums ${palette.textSecondary}`}>
                      {rule.sla}
                    </td>
                    <td className="py-3.5 pr-4">
                      <PriorityBadge priority={rule.defaultPriority} />
                    </td>
                    <td className={`py-3.5 pr-4 font-mono text-[11px] ${palette.textSecondary}`}>
                      {rule.officerContact}
                    </td>
                    <td className="py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEditingRule(rule)}
                          aria-label={`Edit rule for ${rule.category}`}
                          className={`rounded-md p-1.5 ${palette.secondaryBtn}`}
                        >
                          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRule(rule.id)}
                          aria-label={`Delete rule for ${rule.category}`}
                          className={`rounded-md p-1.5 hover:text-red-400 ${palette.secondaryBtn}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {settings.sopRules.length === 0 && (
                <tr>
                  <td colSpan={6} className={`py-8 text-center text-xs ${palette.textMuted}`}>
                    No SOP routing rules defined. Add a procedure rule above or reset defaults.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 3: Live Gemini AI Brain Tuner */}
      <section aria-label="Live Gemini AI Brain tuner" className={`space-y-5 rounded-xl border p-5 sm:p-6 ${palette.panel}`}>
        <div className={`flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between ${palette.borderSubtle}`}>
          <div className="flex items-start gap-3">
            <div className={`rounded-xl border p-2.5 ${palette.accentBadge}`}>
              <Cpu className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className={`text-base font-semibold ${palette.textPrimary}`}>
                3. Live Gemini AI Brain Tuner (Prompt &amp; Sensitivity Controls)
              </h3>
              <p className={`text-xs ${palette.textMuted}`}>
                Customize Gemini 2.5 Flash strictness, system instructions, and output tone live.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleApplyAiBrain}
            className={`inline-flex items-center gap-2 self-start rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400 whitespace-nowrap shrink-0 sm:self-auto ${palette.focusRing}`}
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Apply &amp; Sync to AI Engine</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-5">
            <div className={`space-y-3 rounded-xl border p-4 ${palette.subPanel}`}>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="ai-sensitivity-range"
                  className={`flex items-center gap-2 text-xs font-semibold ${palette.textPrimary}`}
                >
                  <Sliders className={`h-3.5 w-3.5 ${palette.accentText}`} aria-hidden="true" />
                  <span>AI Strictness / Urgency Sensitivity</span>
                </label>
                <span className={`rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold ${palette.accentBadge}`}>
                  {SENSITIVITY_OPTIONS[sensitivityIndex]?.label ?? 'Balanced'}
                </span>
              </div>

              <input
                id="ai-sensitivity-range"
                type="range"
                min={0}
                max={2}
                step={1}
                value={sensitivityIndex === -1 ? 1 : sensitivityIndex}
                onChange={(e) => {
                  const opt = SENSITIVITY_OPTIONS[Number(e.target.value)];
                  if (opt) {
                    setSensitivityDraft(opt.value);
                    onUpdateSettings(
                      {
                        ...settings,
                        aiConfig: { ...settings.aiConfig, sensitivity: opt.value },
                      },
                      'Settings & SOP Rules Updated Live',
                    );
                  }
                }}
                className={`h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-cyan-400 ${palette.focusRing}`}
              />

              <div className={`grid grid-cols-3 text-[11px] font-medium ${palette.textMuted}`}>
                <span className={sensitivityDraft === 'conservative' ? palette.accentText : ''}>
                  Conservative
                </span>
                <span
                  className={`text-center ${sensitivityDraft === 'balanced' ? palette.accentText : ''}`}
                >
                  Balanced
                </span>
                <span
                  className={`text-right ${sensitivityDraft === 'high-alert' ? 'text-red-400' : ''}`}
                >
                  High-Alert
                </span>
              </div>

              <p className={`text-xs leading-relaxed ${palette.textMuted}`}>
                {SENSITIVITY_OPTIONS[sensitivityIndex]?.desc}
              </p>
            </div>

            <div className={`space-y-2.5 rounded-xl border p-4 ${palette.subPanel}`}>
              <p className={`text-xs font-semibold ${palette.textPrimary}`}>
                Language &amp; Tone Output
              </p>
              <div className="space-y-2" role="radiogroup" aria-label="AI Language and tone output">
                {TONE_OPTIONS.map((opt) => {
                  const active = toneDraft === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        setToneDraft(opt.value);
                        onUpdateSettings(
                          {
                            ...settings,
                            aiConfig: { ...settings.aiConfig, languageTone: opt.value },
                          },
                          'Settings & SOP Rules Updated Live',
                        );
                      }}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        palette.focusRing
                      } ${active ? palette.accentBadge : palette.panel}`}
                    >
                      <p className="text-xs font-semibold">{opt.label}</p>
                      <p className={`mt-0.5 text-[11px] ${palette.textMuted}`}>{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={`flex flex-col justify-between gap-3 rounded-xl border p-4 lg:col-span-7 ${palette.subPanel}`}>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="system-instruction-override"
                className={`text-xs font-semibold ${palette.textPrimary}`}
              >
                Live System Instruction Override
              </label>
              <button
                type="button"
                onClick={handleResetPrompt}
                className={`text-[11px] font-medium hover:underline ${palette.textMuted} ${palette.focusRing}`}
              >
                Restore Default Prompt
              </button>
            </div>

            <textarea
              id="system-instruction-override"
              rows={11}
              value={instructionDraft}
              onChange={(e) => setInstructionDraft(e.target.value)}
              className={`w-full flex-1 rounded-lg p-3.5 font-mono text-xs leading-relaxed ${palette.input}`}
            />

            <p className={`text-[11px] ${palette.textMuted}`}>
              Tip: Add a custom rule like{' '}
              <span className={`font-mono ${palette.accentText}`}>
                &quot;Treat any complaint mentioning &apos;monsoon&apos; or &apos;flood&apos; as
                Critical priority&quot;
              </span>{' '}
              then click <strong className={palette.textPrimary}>Apply &amp; Sync to AI Engine</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 4: Presenter Toolkit */}
      <section aria-label="Presenter toolkit and data export" className={`space-y-4 rounded-xl border p-5 sm:p-6 ${palette.panel}`}>
        <div className={`border-b pb-4 ${palette.borderSubtle}`}>
          <h3 className={`text-base font-semibold ${palette.textPrimary}`}>
            4. Presenter Toolkit &amp; Data Management Utilities
          </h3>
          <p className={`text-xs ${palette.textMuted}`}>
            One-click scenario injection, state reset, and full audit log export for live reviews.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <button
            type="button"
            onClick={onLoadMonsoonScenario}
            className={`flex items-start gap-3.5 rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 ${palette.subPanel} ${palette.focusRing} hover:border-amber-400/60`}
          >
            <div className="rounded-lg border border-amber-400/35 bg-amber-500/15 p-2.5 text-amber-400">
              <CloudRain className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className={`text-sm font-semibold ${palette.textPrimary}`}>
                Load Emergency Monsoon Scenario
              </p>
              <p className={`mt-1 text-xs leading-relaxed ${palette.textMuted}`}>
                Injects 3 high-priority Chennai flood, sparking wire, and collapsed shoulder tickets.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onResetAllDemo}
            className={`flex items-start gap-3.5 rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 ${palette.subPanel} ${palette.focusRing} hover:border-cyan-400/50`}
          >
            <div className={`rounded-lg border p-2.5 ${palette.accentBadge}`}>
              <RotateCcw className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className={`text-sm font-semibold ${palette.textPrimary}`}>
                Reset to Default Demo Data
              </p>
              <p className={`mt-1 text-xs leading-relaxed ${palette.textMuted}`}>
                Restores the 5 baseline Chennai complaints, default SOP matrix, and Balanced AI mode.
              </p>
            </div>
          </button>

          <div className={`flex flex-col justify-between gap-3 rounded-xl border p-4 ${palette.subPanel}`}>
            <div className="flex items-start gap-3">
              <div className="rounded-lg border border-emerald-400/35 bg-emerald-500/15 p-2.5 text-emerald-500">
                <Download className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className={`text-sm font-semibold ${palette.textPrimary}`}>Export Audit Log</p>
                <p className={`mt-0.5 text-xs ${palette.textMuted}`}>
                  Download {issues.length} tickets, AI reasoning, and sanitized manual remarks.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-500 hover:bg-emerald-500/25 ${palette.focusRing}`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${palette.accentBadge} ${palette.focusRing}`}
              >
                <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
                <span>JSON</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: Google Cloud & Gemini API Status */}
      <section
        aria-label="Google Cloud and Gemini API diagnostics"
        className={`space-y-4 rounded-xl border p-5 sm:p-6 ${palette.panel}`}
      >
        <div className={`flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between ${palette.borderSubtle}`}>
          <div className="flex items-start gap-3">
            <div className={`rounded-xl border p-2.5 ${palette.accentBadge}`}>
              <Cloud className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className={`text-base font-semibold ${palette.textPrimary}`}>
                5. Google Cloud &amp; Gemini API Status
              </h3>
              <p className={`text-xs ${palette.textMuted}`}>
                Real-time SDK health, active model version, latency telemetry, and masked server secret status.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handlePingHealth}
            disabled={pingingHealth}
            className={`inline-flex items-center gap-1.5 self-start rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 sm:self-auto ${palette.secondaryBtn}`}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${pingingHealth ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{pingingHealth ? 'Checking...' : 'Ping API Health'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className={`rounded-xl border p-4 ${palette.subPanel}`}>
            <p className={`text-[11px] font-medium ${palette.textMuted}`}>Active Model &amp; SDK</p>
            <p className={`mt-1 font-mono text-sm font-bold ${palette.accentText}`}>
              {apiHealth.model}
            </p>
            <p className={`mt-0.5 font-mono text-[11px] ${palette.textSecondary}`}>
              SDK: {apiHealth.sdk}
            </p>
          </div>

          <div className={`rounded-xl border p-4 ${palette.subPanel}`}>
            <p className={`text-[11px] font-medium ${palette.textMuted}`}>Health &amp; Status</p>
            <p
              className={`mt-1 inline-flex items-center gap-1.5 font-mono text-sm font-bold ${
                apiHealth.ok && apiHealth.geminiConfigured ? 'text-emerald-500' : 'text-amber-400'
              }`}
            >
              <Activity className="h-4 w-4" aria-hidden="true" />
              <span>
                {apiHealth.ok && apiHealth.geminiConfigured ? 'HEALTHY / ONLINE' : 'STANDBY'}
              </span>
            </p>
            <p className={`mt-0.5 font-mono text-[11px] ${palette.textMuted}`}>
              Checked: {new Date(apiHealth.checkedAt).toLocaleTimeString()}
            </p>
          </div>

          <div className={`rounded-xl border p-4 ${palette.subPanel}`}>
            <p className={`text-[11px] font-medium ${palette.textMuted}`}>Measured Latency</p>
            <p className={`mt-1 font-mono text-sm font-bold tabular-nums ${palette.textPrimary}`}>
              {apiHealth.latencyMs !== null ? `${apiHealth.latencyMs} ms` : '—'}
              {lastTriageLatencyMs !== null ? ` · Triage: ${lastTriageLatencyMs} ms` : ''}
            </p>
            <p className={`mt-0.5 text-[11px] ${palette.textMuted}`}>
              Server endpoint round-trip
            </p>
          </div>

          <div className={`rounded-xl border p-4 ${palette.subPanel}`}>
            <p className={`flex items-center gap-1.5 text-[11px] font-medium ${palette.textMuted}`}>
              <KeyRound className="h-3 w-3" aria-hidden="true" />
              <span>API Key Protection</span>
            </p>
            <p className={`mt-1 truncate font-mono text-xs font-bold ${palette.textPrimary}`}>
              {apiHealth.keyMask}
            </p>
            <p className="mt-0.5 text-[11px] text-emerald-500">
              Server-side isolated (never bundled)
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 6: System Self-Test & Diagnostics */}
      <section
        aria-label="System self-test and automated unit tests"
        className={`space-y-4 rounded-xl border p-5 sm:p-6 ${palette.panel}`}
      >
        <div className={`flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between ${palette.borderSubtle}`}>
          <div className="flex items-start gap-3">
            <div className={`rounded-xl border p-2.5 ${palette.accentBadge}`}>
              <FlaskConical className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className={`text-base font-semibold ${palette.textPrimary}`}>
                6. System Self-Test &amp; Diagnostics
              </h3>
              <p className={`text-xs ${palette.textMuted}`}>
                Run live assertions verifying XSS sanitization, upload MIME/5MB checks, priority
                sorting, SOP routing, Gemini JSON schema validation, Google Maps URLs, and WCAG 2.1 AA landmarks.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunSelfTests}
            className={`inline-flex items-center gap-2 self-start rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 sm:self-auto ${palette.primaryBtn}`}
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Run Automated Health &amp; Unit Tests</span>
          </button>
        </div>

        {selfTestReport ? (
          <div className="space-y-4" aria-live="polite">
            <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${palette.subPanel}`}>
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                <span className="inline-flex items-center gap-1.5 text-emerald-500">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>{selfTestReport.passed} PASSED</span>
                </span>
                {selfTestReport.failed > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-red-400">
                    <XCircle className="h-4 w-4" aria-hidden="true" />
                    <span>{selfTestReport.failed} FAILED</span>
                  </span>
                )}
              </div>
              <span className={`font-mono text-xs tabular-nums ${palette.textMuted}`}>
                Total execution: {selfTestReport.totalMs} ms
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {selfTestReport.results.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start justify-between gap-3 rounded-xl border p-3.5 ${palette.subPanel}`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${palette.accentBadge}`}>
                        {item.category}
                      </span>
                      <p className={`text-xs font-semibold ${palette.textPrimary}`}>{item.name}</p>
                    </div>
                    <p className={`font-mono text-[11px] leading-relaxed ${palette.textMuted}`}>
                      {item.detail}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      role="status"
                      className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold ${
                        item.status === 'PASS'
                          ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-500'
                          : 'border-red-500/50 bg-red-500/15 text-red-400'
                      }`}
                    >
                      {item.status}
                    </span>
                    <span className={`font-mono text-[10px] tabular-nums ${palette.textMuted}`}>
                      {item.durationMs} ms
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={`rounded-xl border border-dashed p-5 text-center text-xs ${palette.subPanel}`}>
            Click <strong className={palette.textPrimary}>Run Automated Health &amp; Unit Tests</strong>{' '}
            above to execute the live verification suite and inspect execution timings.
          </div>
        )}
      </section>

      <div className={`flex items-start gap-3 rounded-xl border p-4 text-xs ${palette.subPanel}`}>
        {settings.triageMode === 'manual' ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
        ) : (
          <ShieldAlert className={`mt-0.5 h-4 w-4 shrink-0 ${palette.accentText}`} aria-hidden="true" />
        )}
        <p className={palette.textSecondary}>
          Active Configuration Summary:{' '}
          <strong className={palette.textPrimary}>
            {modes.find((m) => m.id === settings.triageMode)?.title}
          </strong>{' '}
          · {settings.sopRules.length} SOP rules configured · AI sensitivity set to{' '}
          <strong className={palette.accentText}>{settings.aiConfig.sensitivity}</strong> (
          {settings.aiConfig.languageTone} tone).
        </p>
      </div>
    </div>
  );
}
