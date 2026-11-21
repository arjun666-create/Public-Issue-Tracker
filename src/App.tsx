import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Contrast,
  Cpu,
  FilePlus2,
  Flame,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  X,
} from 'lucide-react';
import { ThemeProvider, useSkin, type VisualSkin } from './context/ThemeContext';
import { SEED_ISSUES } from './data/seedIssues';
import { DEFAULT_SETTINGS, MONSOON_SCENARIO_ISSUES } from './data/defaultSop';
import { CityTelemetryTicker } from './components/CityTelemetryTicker';
import { ReportIssueView } from './components/ReportIssueView';
import { PublicTrackerView } from './components/PublicTrackerView';
import { AdminPortalView } from './components/AdminPortalView';
import { SettingsSopView } from './components/SettingsSopView';
import type {
  ApiHealthStatus,
  CivicIssue,
  CivicSettings,
  IssueCategory,
  IssueStatus,
  PriorityLevel,
} from './types/issue';
import { safeJsonParse, sanitizeInput } from './utils/security';

type ActiveView = 'report' | 'tracker' | 'admin' | 'settings';

const STORAGE_KEY = 'civicresolve_issues_v1';
const SETTINGS_STORAGE_KEY = 'civicresolve_settings_v1';
const SKIN_STORAGE_KEY = 'civicresolve_skin_v1';
const HIGH_CONTRAST_STORAGE_KEY = 'civicresolve_hc_v1';

const CITIES = [
  'Greater Chennai Corporation',
  'Coimbatore City Municipal Corp',
  'Madurai Municipal Corporation',
];

const VISUAL_SKINS: Array<{
  id: VisualSkin;
  shortLabel: string;
  fullLabel: string;
  Icon: typeof Cpu;
}> = [
  { id: 'digital-twin', shortLabel: 'Digital Twin', fullLabel: 'Digital Twin Dark', Icon: Cpu },
  { id: 'monsoon-alert', shortLabel: 'Monsoon Alert', fullLabel: 'Monsoon Emergency Alert', Icon: Flame },
  { id: 'daylight-civic', shortLabel: 'Daylight', fullLabel: 'Daylight Civic Portal', Icon: Sun },
];

function loadInitialIssues(): CivicIssue[] {
  try {
    const parsed = safeJsonParse<CivicIssue[] | null>(window.localStorage.getItem(STORAGE_KEY), null);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return SEED_ISSUES;
  } catch {
    return SEED_ISSUES;
  }
}

function loadInitialSettings(): CivicSettings {
  try {
    const parsed = safeJsonParse<Partial<CivicSettings> | null>(
      window.localStorage.getItem(SETTINGS_STORAGE_KEY),
      null,
    );
    if (!parsed) return DEFAULT_SETTINGS;
    return {
      triageMode: parsed.triageMode ?? DEFAULT_SETTINGS.triageMode,
      sopRules:
        Array.isArray(parsed.sopRules) && parsed.sopRules.length > 0
          ? parsed.sopRules
          : DEFAULT_SETTINGS.sopRules,
      aiConfig: {
        sensitivity: parsed.aiConfig?.sensitivity ?? DEFAULT_SETTINGS.aiConfig.sensitivity,
        languageTone: parsed.aiConfig?.languageTone ?? DEFAULT_SETTINGS.aiConfig.languageTone,
        systemInstructionOverride:
          parsed.aiConfig?.systemInstructionOverride ??
          DEFAULT_SETTINGS.aiConfig.systemInstructionOverride,
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadInitialSkin(): VisualSkin {
  try {
    const raw = window.localStorage.getItem(SKIN_STORAGE_KEY);
    if (raw === 'digital-twin' || raw === 'monsoon-alert' || raw === 'daylight-civic') {
      return raw;
    }
    return 'digital-twin';
  } catch {
    return 'digital-twin';
  }
}

function loadInitialHighContrast(): boolean {
  try {
    return window.localStorage.getItem(HIGH_CONTRAST_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

const DEFAULT_HEALTH: ApiHealthStatus = {
  ok: true,
  geminiConfigured: false,
  model: 'gemini-2.5-flash',
  sdk: '@google/genai',
  latencyMs: null,
  keyMask: 'Checking...',
  checkedAt: new Date().toISOString(),
};

function CivicResolveShell({
  visualSkin,
  onSelectSkin,
  highContrast,
  onToggleHighContrast,
}: {
  visualSkin: VisualSkin;
  onSelectSkin: (skin: VisualSkin) => void;
  highContrast: boolean;
  onToggleHighContrast: () => void;
}) {
  const palette = useSkin();
  const [activeView, setActiveView] = useState<ActiveView>('tracker');
  const [issues, setIssues] = useState<CivicIssue[]>(loadInitialIssues);
  const [settings, setSettings] = useState<CivicSettings>(loadInitialSettings);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState(CITIES[0]);
  const [apiHealth, setApiHealth] = useState<ApiHealthStatus>(DEFAULT_HEALTH);
  const [lastTriageLatencyMs, setLastTriageLatencyMs] = useState<number | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(issues));
      setStorageWarning(null);
    } catch {
      setStorageWarning('Browser localStorage is full or unavailable. Changes remain active in memory for this session.');
    }
  }, [issues]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      setStorageWarning('Unable to persist SOP settings to localStorage.');
    }
  }, [settings]);

  const refreshHealth = useCallback(async () => {
    const start = performance.now();
    try {
      const res = await fetch('/api/health');
      const roundTripMs = Math.max(1, Math.round(performance.now() - start));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Partial<ApiHealthStatus>;
      setApiHealth({
        ok: Boolean(data.ok),
        geminiConfigured: Boolean(data.geminiConfigured),
        model: data.model ?? 'gemini-2.5-flash',
        sdk: data.sdk ?? '@google/genai',
        latencyMs: roundTripMs,
        keyMask: data.keyMask ?? 'ENV:GEMINI_API_KEY (••••••••••••••••)',
        checkedAt: data.checkedAt ?? new Date().toISOString(),
      });
    } catch {
      setApiHealth((prev) => ({
        ...prev,
        ok: false,
        geminiConfigured: false,
        latencyMs: null,
        keyMask: 'Unreachable',
        checkedAt: new Date().toISOString(),
      }));
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

  const nextTicketNumber = useMemo(() => {
    let maxNum = 1045;
    for (const issue of issues) {
      const match = /CR-\d{4}-(\d+)/.exec(issue.id);
      if (match) {
        const n = Number.parseInt(match[1], 10);
        if (n > maxNum && n < 2000) maxNum = n;
      }
    }
    return maxNum + 1;
  }, [issues]);

  const telemetryCounts = useMemo(() => {
    const criticalCount = issues.filter(
      (i) => i.aiTriage.priority_level === 'Critical' && i.status !== 'Resolved',
    ).length;
    const inProgressCount = issues.filter((i) => i.status === 'In Progress').length;
    return { criticalCount, inProgressCount, totalCount: issues.length };
  }, [issues]);

  const handleIssueCreated = useCallback(
    (newIssue: CivicIssue) => {
      setIssues((prev) => [newIssue, ...prev]);
      showToast(`Ticket ${newIssue.id} logged (${newIssue.status})`);
    },
    [showToast],
  );

  const handleUpdateIssue = useCallback(
    (
      id: string,
      patch: {
        status?: IssueStatus;
        recommended_department?: string;
        priority_level?: PriorityLevel;
        verified_category?: IssueCategory;
        officialNote?: string;
      },
      toastText?: string,
    ) => {
      const nowIso = new Date().toISOString();
      const sanitizedNote =
        patch.officialNote !== undefined ? sanitizeInput(patch.officialNote) : undefined;

      setIssues((prev) =>
        prev.map((issue) => {
          if (issue.id !== id) return issue;
          return {
            ...issue,
            status: patch.status ?? issue.status,
            officialNote:
              sanitizedNote !== undefined ? sanitizedNote || undefined : issue.officialNote,
            updatedAt: nowIso,
            aiTriage: {
              ...issue.aiTriage,
              recommended_department:
                patch.recommended_department ?? issue.aiTriage.recommended_department,
              priority_level: patch.priority_level ?? issue.aiTriage.priority_level,
              verified_category: patch.verified_category ?? issue.aiTriage.verified_category,
            },
          };
        }),
      );
      if (toastText) showToast(toastText);
    },
    [showToast],
  );

  const [upvotedIds, setUpvotedIds] = useState<Record<string, boolean>>(() => {
    try {
      return safeJsonParse<Record<string, boolean>>(
        window.localStorage.getItem('civicresolve_upvoted_v1'),
        {},
      );
    } catch {
      return {};
    }
  });

  const handleToggleUpvote = useCallback((id: string) => {
    setUpvotedIds((prev) => {
      const alreadyUpvoted = Boolean(prev[id]);
      const next = { ...prev, [id]: !alreadyUpvoted };
      try {
        window.localStorage.setItem('civicresolve_upvoted_v1', JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      setIssues((curr) =>
        curr.map((issue) => {
          if (issue.id !== id) return issue;
          const base = issue.upvotes ?? 0;
          return {
            ...issue,
            upvotes: alreadyUpvoted ? Math.max(0, base - 1) : base + 1,
          };
        }),
      );
      return next;
    });
  }, []);

  const handleResetDemo = useCallback(() => {
    setIssues(SEED_ISSUES);
    setUpvotedIds({});
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_ISSUES));
      window.localStorage.removeItem('civicresolve_upvoted_v1');
    } catch {
      setStorageWarning('Restored in-memory sample tickets; browser storage is unavailable.');
    }
    showToast('Restored baseline Chennai demo tickets');
  }, [showToast]);

  const handleUpdateSettings = useCallback(
    (next: CivicSettings, message?: string) => {
      setSettings(next);
      showToast(message || 'Settings & SOP Rules Updated Live');
    },
    [showToast],
  );

  const handleLoadMonsoonScenario = useCallback(() => {
    setIssues((prev) => {
      const existingIds = new Set(prev.map((i) => i.id));
      const fresh = MONSOON_SCENARIO_ISSUES.filter((m) => !existingIds.has(m.id));
      if (fresh.length === 0) return prev;
      return [...fresh, ...prev];
    });
    showToast('Emergency Monsoon Scenario loaded into live dashboard');
  }, [showToast]);

  const handleResetAllDemo = useCallback(() => {
    setIssues(SEED_ISSUES);
    setSettings(DEFAULT_SETTINGS);
    setUpvotedIds({});
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_ISSUES));
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
      window.localStorage.removeItem('civicresolve_upvoted_v1');
    } catch {
      setStorageWarning('Reset in-memory defaults; browser storage is unavailable.');
    }
    showToast('Reset all tickets, SOP rules, and AI Brain defaults');
  }, [showToast]);

  const navItems: Array<{
    id: ActiveView;
    label: string;
    Icon: typeof FilePlus2;
  }> = [
    { id: 'report', label: 'Report an Issue', Icon: FilePlus2 },
    { id: 'tracker', label: 'Public Issue Tracker', Icon: Activity },
    { id: 'admin', label: 'Municipal Admin Portal', Icon: ShieldCheck },
    { id: 'settings', label: 'Settings & SOP', Icon: SlidersHorizontal },
  ];

  const activeTitle = navItems.find((item) => item.id === activeView)?.label ?? 'CivicResolve';

  const selectView = useCallback((view: ActiveView) => {
    setActiveView(view);
    setMobileMenuOpen(false);
  }, []);

  const aiHealthy = apiHealth.ok && apiHealth.geminiConfigured;

  return (
    <div className={`dt-blueprint-bg flex min-h-screen flex-col ${palette.textPrimary}`}>
      {/* WCAG Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-cyan-400 focus:px-4 focus:py-2 focus:text-xs focus:font-bold focus:text-slate-950 focus:shadow-xl"
      >
        Skip to main content
      </a>

      {/* Live City Telemetry Ticker */}
      <CityTelemetryTicker
        criticalCount={telemetryCounts.criticalCount}
        inProgressCount={telemetryCounts.inProgressCount}
        totalCount={telemetryCounts.totalCount}
        triageMode={settings.triageMode}
      />

      <div className="flex flex-1">
        {/* Mobile Sidebar Backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-xs lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Left-Hand Collapsible Command Sidebar */}
        <aside
          aria-label="Command Center Navigation"
          className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r transition-all duration-200 lg:sticky lg:top-8 lg:h-[calc(100vh-2rem)] lg:translate-x-0 ${
            palette.sidebarBg
          } ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} ${
            sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'
          } w-64 shrink-0`}
        >
          <div className={`flex h-16 items-center justify-between border-b px-4 ${palette.borderSubtle}`}>
            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={() => selectView('tracker')}
                aria-label="CivicResolve Home"
                className={`text-left text-lg font-bold tracking-tight whitespace-nowrap shrink-0 rounded ${palette.textPrimary} ${palette.focusRing}`}
              >
                Civic<span className={palette.accentText}>Resolve</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!sidebarCollapsed}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={`hidden rounded-lg p-2 transition-colors lg:inline-flex ${palette.textMuted} ${palette.focusRing} hover:bg-cyan-500/10`}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation drawer"
              className={`rounded-lg p-2 lg:hidden ${palette.textMuted} ${palette.focusRing}`}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <nav className="flex-1 space-y-1.5 p-3" aria-label="Primary sections">
            {navItems.map((item) => {
              const { Icon } = item;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectView(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`flex w-full items-center gap-3 rounded-full border px-3.5 py-2.5 text-sm font-medium transition-all whitespace-nowrap ${
                    palette.focusRing
                  } ${sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''} ${
                    isActive
                      ? `${palette.accentBadge} shadow-[0_0_16px_rgba(6,182,212,0.18)]`
                      : `border-transparent ${palette.textMuted} hover:bg-cyan-500/10`
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${isActive ? palette.accentText : ''}`}
                    aria-hidden="true"
                  />
                  <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Live AI Engine Online Indicator */}
          <div className={`border-t p-3 ${palette.borderSubtle}`}>
            <button
              type="button"
              onClick={() => selectView('settings')}
              title={aiHealthy ? 'Gemini 2.5 Flash Online — Click for diagnostics' : 'AI Engine Standby'}
              aria-label="Open Google Cloud and Gemini API diagnostics in Settings"
              className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                palette.subPanel
              } ${palette.focusRing} ${sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''}`}
            >
              <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
                {aiHealthy && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                    aiHealthy ? 'bg-emerald-500' : 'bg-amber-400'
                  }`}
                />
              </span>
              <div className={`min-w-0 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                <p className={`truncate text-xs font-semibold ${palette.textPrimary}`}>
                  {aiHealthy ? 'AI Engine Online' : 'AI Engine Standby'}
                </p>
                <p className={`truncate font-mono text-[10px] ${palette.textMuted}`}>
                  {settings.triageMode === 'manual' ? 'Manual SOP Active' : apiHealth.model}
                </p>
              </div>
            </button>
          </div>
        </aside>

        {/* Main Content Shell */}
        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          {/* Top Header Bar */}
          <header
            className={`sticky top-8 z-30 flex h-16 items-center justify-between gap-2 border-b px-4 sm:gap-3 sm:px-6 lg:px-8 ${palette.headerBg}`}
          >
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
                aria-expanded={mobileMenuOpen}
                className={`rounded-lg border p-2 lg:hidden ${palette.secondaryBtn}`}
              >
                <Menu className="h-4 w-4" aria-hidden="true" />
              </button>
              <h1 className={`truncate text-sm font-bold tracking-tight sm:text-lg ${palette.textPrimary}`}>
                {activeTitle}
              </h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              {/* Google Cloud & Gemini API Status Diagnostic Badge */}
              <button
                type="button"
                onClick={() => {
                  void refreshHealth();
                  selectView('settings');
                }}
                aria-label={`Google Cloud and Gemini API status: ${apiHealth.model}, ${
                  aiHealthy ? 'Healthy' : 'Standby'
                }, latency ${apiHealth.latencyMs ?? 'checking'} milliseconds`}
                className={`hidden md:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  palette.focusRing
                } ${
                  aiHealthy
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${aiHealthy ? 'bg-emerald-500' : 'bg-amber-400'}`}
                />
                <span>{apiHealth.model}</span>
                {apiHealth.latencyMs !== null && (
                  <span className="opacity-80 tabular-nums">
                    · {lastTriageLatencyMs ?? apiHealth.latencyMs}ms
                  </span>
                )}
              </button>

              {/* High Contrast / Screen-Reader Friendly Toggle */}
              <button
                type="button"
                onClick={onToggleHighContrast}
                aria-pressed={highContrast}
                aria-label="Toggle High Contrast accessibility mode"
                title="High Contrast / Screen-Reader Friendly Mode"
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  palette.focusRing
                } ${highContrast ? palette.accentBadge : palette.subPanel}`}
              >
                <Contrast className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="hidden xl:inline">High Contrast</span>
              </button>

              {/* Live Theme & Skin Switcher */}
              <div
                role="group"
                aria-label="Visual Mode switcher"
                className={`flex items-center gap-1 rounded-full border p-1 ${palette.subPanel}`}
              >
                {VISUAL_SKINS.map((mode) => {
                  const ModeIcon = mode.Icon;
                  const active = visualSkin === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => {
                        onSelectSkin(mode.id);
                        showToast(`Visual Mode switched to ${mode.fullLabel}`);
                      }}
                      title={mode.fullLabel}
                      aria-label={`Switch visual mode to ${mode.fullLabel}`}
                      aria-pressed={active}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold transition-all whitespace-nowrap shrink-0 sm:px-2.5 ${
                        palette.focusRing
                      } ${active ? palette.accentBadge : `${palette.textMuted} hover:opacity-90`}`}
                    >
                      <ModeIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="hidden md:inline">{mode.shortLabel}</span>
                    </button>
                  );
                })}
              </div>

              {/* City Selector */}
              <div className={`hidden 2xl:flex items-center gap-2 rounded-lg border px-3 py-1.5 ${palette.subPanel}`}>
                <Building2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
                <select
                  aria-label="Select municipal authority"
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="bg-transparent text-xs font-medium focus:outline-none"
                >
                  {CITIES.map((city) => (
                    <option key={city} value={city} className={palette.selectOption}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick "+ Report Issue" CTA */}
              <button
                type="button"
                onClick={() => selectView('report')}
                aria-label="Report a new civic issue"
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 sm:px-3.5 ${palette.primaryBtn}`}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Report Issue</span>
              </button>
            </div>
          </header>

          {storageWarning && (
            <div
              role="alert"
              className="mx-auto mt-3 flex w-full max-w-7xl items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-950/50 px-4 py-2 text-xs text-amber-200"
            >
              <span className="inline-flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
                <span>{storageWarning}</span>
              </span>
              <button
                type="button"
                onClick={() => setStorageWarning(null)}
                aria-label="Dismiss storage warning"
                className="rounded p-1 hover:bg-amber-900/60"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {activeView === 'report' && (
              <ReportIssueView
                onIssueCreated={handleIssueCreated}
                onNavigateTracker={() => selectView('tracker')}
                onOpenSettings={() => selectView('settings')}
                onTriageLatencyMs={setLastTriageLatencyMs}
                nextTicketNumber={nextTicketNumber}
                selectedCity={selectedCity}
                settings={settings}
              />
            )}

            {activeView === 'tracker' && (
              <PublicTrackerView
                issues={issues}
                upvotedIds={upvotedIds}
                onToggleUpvote={handleToggleUpvote}
                onResetDemo={handleResetDemo}
                onNavigateReport={() => selectView('report')}
                selectedCity={selectedCity}
              />
            )}

            {activeView === 'admin' && (
              <AdminPortalView
                issues={issues}
                onUpdateIssue={handleUpdateIssue}
                selectedCity={selectedCity}
              />
            )}

            {activeView === 'settings' && (
              <SettingsSopView
                settings={settings}
                issues={issues}
                apiHealth={apiHealth}
                lastTriageLatencyMs={lastTriageLatencyMs}
                onRefreshHealth={refreshHealth}
                onUpdateSettings={handleUpdateSettings}
                onLoadMonsoonScenario={handleLoadMonsoonScenario}
                onResetAllDemo={handleResetAllDemo}
              />
            )}
          </main>
        </div>
      </div>

      {/* Live Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs font-semibold shadow-2xl backdrop-blur-xl ${palette.modalBg}`}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
            <span>{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              aria-label="Dismiss notification"
              className={`ml-1 rounded p-0.5 ${palette.textMuted} ${palette.focusRing}`}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const [visualSkin, setVisualSkin] = useState<VisualSkin>(loadInitialSkin);
  const [highContrast, setHighContrast] = useState<boolean>(loadInitialHighContrast);

  useEffect(() => {
    document.documentElement.setAttribute('data-skin', visualSkin);
    try {
      window.localStorage.setItem(SKIN_STORAGE_KEY, visualSkin);
    } catch {
      // Ignore storage errors
    }
  }, [visualSkin]);

  useEffect(() => {
    document.documentElement.setAttribute('data-high-contrast', highContrast ? 'true' : 'false');
    try {
      window.localStorage.setItem(HIGH_CONTRAST_STORAGE_KEY, highContrast ? 'true' : 'false');
    } catch {
      // Ignore storage errors
    }
  }, [highContrast]);

  return (
    <ThemeProvider skin={visualSkin} highContrast={highContrast}>
      <CivicResolveShell
        visualSkin={visualSkin}
        onSelectSkin={setVisualSkin}
        highContrast={highContrast}
        onToggleHighContrast={() => setHighContrast((prev) => !prev)}
      />
    </ThemeProvider>
  );
}
