import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDownUp,
  Building2,
  CheckCircle2,
  Clock,
  Construction,
  Droplets,
  ExternalLink,
  Eye,
  Info,
  Layers,
  Lightbulb,
  MapPin,
  MessageSquareText,
  RotateCcw,
  Search,
  Shapes,
  ShieldAlert,
  ThumbsUp,
  Ticket,
  Trash2,
  Trees,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { useSkin } from '../context/ThemeContext';
import { useDebounce } from '../hooks/useDebounce';
import {
  type CivicIssue,
  type IssueStatus,
  type PriorityLevel,
} from '../types/issue';
import { buildGoogleMapsUrl } from '../utils/maps';
import { calculateIssueKpis, sortIssues } from '../utils/triageLogic';
import { CustomFilterDropdown, type DropdownOption } from './CustomFilterDropdown';
import { IssuePhoto } from './IssuePhoto';
import { PriorityBadge } from './PriorityBadge';
import { SlaRing } from './SlaRing';
import {
  inferIssueSector,
  SpatialSectorMap,
  type CitySector,
} from './SpatialSectorMap';
import { StatusStepper } from './StatusStepper';

interface PublicTrackerViewProps {
  issues: CivicIssue[];
  upvotedIds: Record<string, boolean>;
  onToggleUpvote: (id: string) => void;
  onResetDemo: () => void;
  onNavigateReport: () => void;
  selectedCity: string;
}

type SortOption = 'newest' | 'oldest' | 'critical' | 'upvoted';
type KpiCardId = 'total' | 'in_progress' | 'resolved' | 'avg_time';

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Recent';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function useCountUp(target: number, decimals = 0, duration = 680): string {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let rafId = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(target * eased);
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);

  return decimals > 0 ? display.toFixed(decimals) : Math.round(display).toString();
}

function Sparkline({
  points,
  strokeColor,
  gradientId,
}: {
  points: number[];
  strokeColor: string;
  gradientId: string;
}) {
  const width = 92;
  const height = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;

  const coords = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * width;
    const y = height - 3 - ((val - min) / span) * (height - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polylinePoints = coords.join(' ');
  const areaPoints = `0,${height} ${polylinePoints} ${width},${height}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.32" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradientId})`} />
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polylinePoints}
      />
    </svg>
  );
}

const PRIORITY_OPTIONS: DropdownOption<'All' | PriorityLevel>[] = [
  { value: 'All', label: 'All Priorities', dotColor: 'bg-slate-400', Icon: Layers },
  { value: 'Critical', label: 'Critical', dotColor: 'bg-red-400', Icon: AlertOctagon },
  { value: 'High', label: 'High', dotColor: 'bg-amber-400', Icon: ShieldAlert },
  { value: 'Medium', label: 'Medium', dotColor: 'bg-cyan-400', Icon: AlertTriangle },
  { value: 'Low', label: 'Low', dotColor: 'bg-slate-400', Icon: Info },
];

const CATEGORY_OPTIONS: DropdownOption<string>[] = [
  { value: 'All', label: 'All Categories', dotColor: 'bg-slate-400', Icon: Layers },
  { value: 'Roads & Potholes', label: 'Roads & Potholes', dotColor: 'bg-red-400', Icon: Construction },
  { value: 'Sanitation & Waste', label: 'Sanitation & Waste', dotColor: 'bg-amber-400', Icon: Trash2 },
  {
    value: 'Streetlights & Electrical',
    label: 'Streetlights & Electrical',
    dotColor: 'bg-cyan-400',
    Icon: Lightbulb,
  },
  {
    value: 'Water Supply & Drainage',
    label: 'Water Supply & Drainage',
    dotColor: 'bg-blue-400',
    Icon: Droplets,
  },
  {
    value: 'Parks & Public Spaces',
    label: 'Parks & Public Spaces',
    dotColor: 'bg-emerald-400',
    Icon: Trees,
  },
  { value: 'Other', label: 'Other', dotColor: 'bg-slate-400', Icon: Shapes },
];

const SORT_OPTIONS: DropdownOption<SortOption>[] = [
  { value: 'critical', label: 'Most Critical', Icon: AlertOctagon },
  { value: 'newest', label: 'Newest', Icon: Clock },
  { value: 'oldest', label: 'Oldest', Icon: Clock },
  { value: 'upvoted', label: 'Most Upvoted', Icon: ArrowDownUp },
];

export function PublicTrackerView({
  issues,
  upvotedIds,
  onToggleUpvote,
  onResetDemo,
  onNavigateReport,
  selectedCity,
}: PublicTrackerViewProps) {
  const palette = useSkin();
  const [rawSearch, setRawSearch] = useState('');
  const debouncedSearch = useDebounce(rawSearch, 300);

  const [statusFilter, setStatusFilter] = useState<'All' | IssueStatus>('All');
  const [activeKpi, setActiveKpi] = useState<KpiCardId>('total');
  const [priorityFilter, setPriorityFilter] = useState<'All' | PriorityLevel>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<SortOption>('critical');
  const [selectedMapIssueId, setSelectedMapIssueId] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<CitySector | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<CivicIssue | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedIssue) {
        setSelectedIssue(null);
        return;
      }

      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIssue]);

  const kpis = useMemo(() => calculateIssueKpis(issues), [issues]);

  const totalCountUp = useCountUp(kpis.total, 0);
  const inProgressCountUp = useCountUp(kpis.inProgress, 0);
  const resolvedCountUp = useCountUp(kpis.resolved, 0);
  const avgHoursCountUp = useCountUp(kpis.avgHours, 1);

  const handleStatusChange = useCallback((status: 'All' | IssueStatus) => {
    setStatusFilter(status);
    if (status === 'All') setActiveKpi('total');
    else if (status === 'In Progress') setActiveKpi('in_progress');
    else if (status === 'Resolved') setActiveKpi('resolved');
  }, []);

  const handleKpiClick = useCallback((card: KpiCardId) => {
    setActiveKpi(card);
    if (card === 'total') setStatusFilter('All');
    else if (card === 'in_progress') setStatusFilter('In Progress');
    else if (card === 'resolved' || card === 'avg_time') setStatusFilter('Resolved');
  }, []);

  const filteredIssues = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const matched = issues.filter((issue) => {
      if (selectedMapIssueId && issue.id !== selectedMapIssueId) return false;
      if (selectedSector && inferIssueSector(issue.location) !== selectedSector) return false;
      if (statusFilter !== 'All' && issue.status !== statusFilter) return false;
      if (priorityFilter !== 'All' && issue.aiTriage.priority_level !== priorityFilter) {
        return false;
      }
      if (categoryFilter !== 'All' && issue.aiTriage.verified_category !== categoryFilter) {
        return false;
      }
      if (q) {
        const haystack = [
          issue.id,
          issue.title,
          issue.description,
          issue.location,
          issue.aiTriage.verified_category,
          issue.aiTriage.recommended_department,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return sortIssues(matched, sortBy);
  }, [
    issues,
    selectedMapIssueId,
    selectedSector,
    debouncedSearch,
    statusFilter,
    priorityFilter,
    categoryFilter,
    sortBy,
  ]);

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
    if (selectedMapIssueId) {
      chips.push({
        key: 'map-pin',
        label: `Pin: ${selectedMapIssueId}`,
        onRemove: () => setSelectedMapIssueId(null),
      });
    }
    if (selectedSector) {
      chips.push({
        key: 'sector',
        label: `Ward: ${selectedSector}`,
        onRemove: () => setSelectedSector(null),
      });
    }
    if (statusFilter !== 'All') {
      chips.push({
        key: 'status',
        label: `Status: ${statusFilter}`,
        onRemove: () => handleStatusChange('All'),
      });
    }
    if (priorityFilter !== 'All') {
      chips.push({
        key: 'priority',
        label: `Priority: ${priorityFilter}`,
        onRemove: () => setPriorityFilter('All'),
      });
    }
    if (categoryFilter !== 'All') {
      chips.push({
        key: 'category',
        label: `Category: ${categoryFilter}`,
        onRemove: () => setCategoryFilter('All'),
      });
    }
    if (debouncedSearch.trim()) {
      chips.push({
        key: 'search',
        label: `Search: "${debouncedSearch.trim()}"`,
        onRemove: () => setRawSearch(''),
      });
    }
    return chips;
  }, [
    selectedMapIssueId,
    selectedSector,
    statusFilter,
    priorityFilter,
    categoryFilter,
    debouncedSearch,
    handleStatusChange,
  ]);

  const clearAllFilters = useCallback(() => {
    setRawSearch('');
    setStatusFilter('All');
    setActiveKpi('total');
    setPriorityFilter('All');
    setCategoryFilter('All');
    setSelectedMapIssueId(null);
    setSelectedSector(null);
  }, []);

  const statusTabs: Array<{ value: 'All' | IssueStatus; label: string; count: number }> = useMemo(
    () => [
      { value: 'All', label: 'All', count: kpis.total },
      ...(kpis.pendingVerification > 0
        ? [
            {
              value: 'Pending Verification' as const,
              label: 'Pending Verification',
              count: kpis.pendingVerification,
            },
          ]
        : []),
      { value: 'Reported', label: 'Reported', count: kpis.reported },
      { value: 'In Progress', label: 'In Progress', count: kpis.inProgress },
      { value: 'Resolved', label: 'Resolved', count: kpis.resolved },
    ],
    [kpis],
  );

  const kpiCards = useMemo(
    () => [
      {
        id: 'total' as const,
        label: 'Total Issues',
        displayValue: totalCountUp,
        trendText: '+12% this week',
        sparkline: [14, 18, 16, 21, 24, 22, Math.max(25, kpis.total * 5)],
        strokeColor: '#06b6d4',
        iconBg: palette.isLight
          ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
          : 'bg-cyan-400/15 text-cyan-400 border-cyan-400/30',
        valueColor: palette.textPrimary,
        Icon: Ticket,
      },
      {
        id: 'in_progress' as const,
        label: 'In Progress',
        displayValue: inProgressCountUp,
        trendText: '+8% this week',
        sparkline: [6, 9, 8, 11, 10, 12, Math.max(13, kpis.inProgress * 5)],
        strokeColor: '#38bdf8',
        iconBg: palette.isLight
          ? 'bg-sky-50 text-sky-700 border-sky-200'
          : 'bg-sky-400/15 text-sky-400 border-sky-400/30',
        valueColor: palette.isLight ? 'text-cyan-700' : 'text-cyan-400',
        Icon: Activity,
      },
      {
        id: 'resolved' as const,
        label: 'Resolved',
        displayValue: resolvedCountUp,
        trendText: '+18% this week',
        sparkline: [5, 7, 10, 9, 13, 15, Math.max(17, kpis.resolved * 6)],
        strokeColor: '#10b981',
        iconBg: palette.isLight
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30',
        valueColor: palette.isLight ? 'text-emerald-700' : 'text-emerald-400',
        Icon: CheckCircle2,
      },
      {
        id: 'avg_time' as const,
        label: 'Avg. Resolution Time',
        displayValue: avgHoursCountUp,
        unit: 'hrs',
        trendText: '-14% faster',
        sparkline: [32, 29, 27, 24, 22, 20, Math.round(kpis.avgHours)],
        strokeColor: '#f59e0b',
        iconBg: palette.isLight
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-amber-400/15 text-amber-300 border-amber-400/30',
        valueColor: palette.isLight ? 'text-amber-700' : 'text-amber-300',
        Icon: Clock,
      },
    ],
    [totalCountUp, inProgressCountUp, resolvedCountUp, avgHoursCountUp, kpis, palette],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between ${palette.borderSubtle}`}>
        <div className="max-w-3xl space-y-2.5">
          <div
            role="status"
            aria-label="Live feed status: updated 2 minutes ago"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-500"
          >
            <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span>Live feed - updated 2 min ago</span>
          </div>

          <h2 className={`text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl [text-wrap:balance] ${palette.textPrimary}`}>
            Public Issue{' '}
            <span className={`bg-gradient-to-r ${palette.gradientTitle} bg-clip-text text-transparent`}>
              Tracking
            </span>{' '}
            Dashboard
          </h2>

          <p className={`text-sm leading-relaxed sm:text-base ${palette.textMuted}`}>
            Transparent Digital Twin infrastructure ledger for{' '}
            <span className={`font-medium ${palette.textPrimary}`}>{selectedCity}</span> tracking
            Reported, In Progress, and Resolved civic tickets with Google Maps location links.
          </p>
        </div>

        <button
          type="button"
          onClick={onResetDemo}
          className={`inline-flex items-center gap-1.5 self-start rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 sm:self-auto ${palette.secondaryBtn}`}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Restore Sample Tickets</span>
        </button>
      </div>

      {/* Interactive Bento KPI Cards */}
      <section aria-label="Civic issue metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const { Icon } = card;
          const isActive =
            (card.id === 'total' && activeKpi === 'total' && statusFilter === 'All') ||
            (card.id === 'in_progress' && statusFilter === 'In Progress') ||
            (card.id === 'resolved' && statusFilter === 'Resolved' && activeKpi === 'resolved') ||
            (card.id === 'avg_time' && statusFilter === 'Resolved' && activeKpi === 'avg_time');

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => handleKpiClick(card.id)}
              aria-pressed={isActive}
              aria-label={`Filter by ${card.label}: ${card.displayValue}${card.unit ? ` ${card.unit}` : ''}`}
              className={`group relative overflow-hidden rounded-xl border p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-10px_rgba(6,182,212,0.22)] ${
                palette.focusRing
              } ${palette.panel} ${
                isActive
                  ? 'ring-2 ring-cyan-400/70 border-cyan-400/60'
                  : 'hover:border-cyan-400/45'
              }`}
            >
              <div className="flex h-full flex-col justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl border p-2.5 ${card.iconBg}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <span className={`text-xs font-medium ${palette.textSecondary}`}>{card.label}</span>
                </div>

                <div className="flex items-end justify-between gap-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className={`font-mono text-3xl font-bold tabular-nums ${card.valueColor}`}>
                      {card.displayValue}
                    </span>
                    {card.unit && (
                      <span className={`font-mono text-xs font-semibold ${palette.textMuted}`}>
                        {card.unit}
                      </span>
                    )}
                  </div>

                  <Sparkline
                    points={card.sparkline}
                    strokeColor={card.strokeColor}
                    gradientId={`spark-${card.id}`}
                  />
                </div>

                <div className={`flex items-center justify-between gap-2 border-t pt-3 ${palette.borderSubtle}`}>
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-500">
                    {card.trendText.startsWith('-') ? (
                      <TrendingDown className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <TrendingUp className="h-3 w-3" aria-hidden="true" />
                    )}
                    <span>{card.trendText}</span>
                  </span>
                  <span className={`text-[11px] transition-colors ${palette.textMuted}`}>
                    {isActive ? 'Filtered' : 'Click to filter'}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </section>

      {/* Interactive Spatial Sector Radar / Mini-Map */}
      <SpatialSectorMap
        issues={issues}
        selectedIssueId={selectedMapIssueId}
        selectedSector={selectedSector}
        onSelectIssue={setSelectedMapIssueId}
        onSelectSector={setSelectedSector}
      />

      {/* Sticky Glassmorphic Filter Bar */}
      <section
        aria-label="Issue filters and search"
        className={`md:sticky md:top-24 z-20 space-y-3 rounded-xl border p-3.5 shadow-xl sm:p-4 ${palette.panel}`}
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div
            role="tablist"
            aria-label="Filter issues by status"
            className={`relative flex flex-wrap items-center gap-1 rounded-xl border p-1 ${palette.subPanel}`}
          >
            {statusTabs.map((tab) => {
              const isSelected = statusFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => handleStatusChange(tab.value)}
                  className={`relative z-10 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    palette.focusRing
                  } ${isSelected ? palette.accentText : palette.textMuted}`}
                >
                  {isSelected && (
                    <motion.span
                      layoutId="trackerStatusPill"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      className={`absolute inset-0 -z-10 rounded-lg border ${palette.accentBadge}`}
                    />
                  )}
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums ${
                      isSelected ? palette.accentBadge : palette.subPanel
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-1 flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
            <div className="relative flex-1 sm:min-w-[220px] xl:max-w-xs">
              <label htmlFor="tracker-search-input" className="sr-only">
                Search civic tickets
              </label>
              <Search
                className={`pointer-events-none absolute left-3 top-2.5 h-4 w-4 ${palette.textMuted}`}
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                id="tracker-search-input"
                type="text"
                value={rawSearch}
                onChange={(e) => setRawSearch(e.target.value)}
                placeholder="Search ID, landmark, issue..."
                aria-label="Search civic tickets (press / to focus)"
                className={`w-full rounded-lg py-2 pl-9 pr-14 text-xs sm:text-sm ${palette.input}`}
              />
              <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
                {rawSearch ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRawSearch('');
                      searchInputRef.current?.focus();
                    }}
                    aria-label="Clear search text"
                    className={`rounded p-1 ${palette.textMuted} ${palette.focusRing}`}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ) : (
                  <kbd
                    title="Press / to search"
                    className={`hidden rounded border px-1.5 py-0.5 font-mono text-[10px] sm:inline-block ${palette.subPanel}`}
                  >
                    /
                  </kbd>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <CustomFilterDropdown
                label="Priority"
                value={priorityFilter}
                options={PRIORITY_OPTIONS}
                onChange={setPriorityFilter}
                minWidthClass="min-w-[155px]"
              />

              <CustomFilterDropdown
                label="Category"
                value={categoryFilter}
                options={CATEGORY_OPTIONS}
                onChange={setCategoryFilter}
                minWidthClass="min-w-[175px]"
              />

              <CustomFilterDropdown
                label="Sort"
                value={sortBy}
                options={SORT_OPTIONS}
                onChange={setSortBy}
                minWidthClass="min-w-[155px]"
              />
            </div>
          </div>
        </div>

        <div className={`flex flex-wrap items-center justify-between gap-2 border-t pt-2.5 text-xs ${palette.borderSubtle}`}>
          <div className="flex flex-wrap items-center gap-2">
            {activeChips.length > 0 ? (
              <>
                {activeChips.map((chip) => (
                  <span
                    key={chip.key}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${palette.accentBadge}`}
                  >
                    <span>{chip.label}</span>
                    <button
                      type="button"
                      onClick={chip.onRemove}
                      aria-label={`Remove filter ${chip.label}`}
                      className={`rounded-full p-0.5 hover:opacity-75 ${palette.focusRing}`}
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className={`text-xs font-medium underline-offset-4 hover:underline ${palette.textMuted} ${palette.focusRing}`}
                >
                  Clear all
                </button>
              </>
            ) : (
              <span className={palette.textMuted}>No active filters applied</span>
            )}
          </div>

          <p className={`font-mono text-xs tabular-nums ${palette.textMuted}`} aria-live="polite">
            Showing <span className={`font-semibold ${palette.textPrimary}`}>{filteredIssues.length}</span> of{' '}
            <span className={`font-semibold ${palette.textPrimary}`}>{issues.length}</span> issues
          </p>
        </div>
      </section>

      {/* Ticket List */}
      {filteredIssues.length === 0 ? (
        <div className={`flex flex-col items-center justify-center gap-3 rounded-xl border px-6 py-14 text-center ${palette.panel}`}>
          <p className={`text-base font-semibold ${palette.textPrimary}`}>
            No civic issues match the current filters
          </p>
          <p className={`max-w-md text-sm ${palette.textMuted}`}>
            Clear your search, spatial ward filter, or status selections, or report a new issue.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={clearAllFilters}
              className={`rounded-lg px-4 py-2 text-xs font-semibold ${palette.secondaryBtn}`}
            >
              Clear All Filters
            </button>
            <button
              type="button"
              onClick={onNavigateReport}
              className={`rounded-lg px-4 py-2 text-xs font-semibold ${palette.primaryBtn}`}
            >
              Report an Issue
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredIssues.map((issue) => {
            const hasUpvoted = Boolean(upvotedIds[issue.id]);
            const upvoteCount = issue.upvotes ?? 0;
            const isHighlighted = selectedMapIssueId === issue.id;
            const mapsUrl = buildGoogleMapsUrl(issue.location);

            return (
              <article
                key={issue.id}
                aria-label={`Civic ticket ${issue.id}: ${issue.title}`}
                className={`group rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-400/50 hover:shadow-[0_14px_30px_-14px_rgba(6,182,212,0.25)] sm:p-5 ${
                  palette.panel
                } ${isHighlighted ? 'ring-2 ring-cyan-400/75 border-cyan-400' : ''}`}
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="w-full shrink-0 sm:w-44">
                    <IssuePhoto
                      src={issue.photoUrl}
                      alt={issue.title}
                      category={issue.aiTriage.verified_category}
                      className="aspect-[4/3] w-full"
                    />
                  </div>

                  <div className="min-w-0 flex-1 space-y-2.5">
                    <div className={`flex flex-wrap items-center gap-2 text-xs ${palette.textMuted}`}>
                      <span className={`font-mono font-semibold tabular-nums ${palette.accentText}`}>
                        {issue.id}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className={palette.textSecondary}>
                        {issue.aiTriage.verified_category}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-[11px]">{inferIssueSector(issue.location)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{formatShortDate(issue.createdAt)}</span>
                    </div>

                    <h3 className={`text-base font-semibold leading-snug sm:text-lg ${palette.textPrimary}`}>
                      {issue.title}
                    </h3>

                    <p className={`line-clamp-2 text-xs leading-relaxed sm:text-sm ${palette.textMuted}`}>
                      {issue.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                      <span className={`inline-flex items-center gap-1.5 ${palette.textSecondary}`}>
                        <MapPin className={`h-3.5 w-3.5 shrink-0 ${palette.textMuted}`} aria-hidden="true" />
                        <span className="font-mono text-[11px]">{issue.location}</span>
                      </span>
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${issue.id} location on Google Maps`}
                        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[10px] font-semibold transition-colors ${palette.accentBadge} ${palette.focusRing}`}
                      >
                        <span>Google Maps</span>
                        <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                      </a>
                      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-500">
                        <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{issue.aiTriage.recommended_department}</span>
                      </span>
                    </div>

                    {issue.officialNote && (
                      <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${palette.subPanel}`}>
                        <MessageSquareText
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500"
                          aria-hidden="true"
                        />
                        <p className="leading-relaxed">
                          <span className="font-semibold text-emerald-500">Official Remark: </span>
                          {issue.officialNote}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className={`flex flex-col justify-between gap-3.5 border-t pt-4 lg:w-76 lg:shrink-0 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0 ${palette.borderSubtle}`}>
                    <div className="flex items-center justify-between gap-3">
                      <PriorityBadge priority={issue.aiTriage.priority_level} />
                      <SlaRing
                        priority={issue.aiTriage.priority_level}
                        status={issue.status}
                        matchedSla={issue.aiTriage.matched_sla}
                      />
                    </div>

                    <StatusStepper status={issue.status} />

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleUpvote(issue.id)}
                        aria-pressed={hasUpvoted}
                        aria-label={`Upvote ${issue.id} (${upvoteCount} votes)`}
                        title="Upvote issue priority"
                        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 font-mono text-xs font-semibold tabular-nums transition-colors whitespace-nowrap shrink-0 ${
                          palette.focusRing
                        } ${
                          hasUpvoted
                            ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-500'
                            : palette.secondaryBtn
                        }`}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{upvoteCount}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedIssue(issue)}
                        aria-label={`Inspect AI triage breakdown for ${issue.id}`}
                        className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${palette.secondaryBtn}`}
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Inspect AI</span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedIssue && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="issue-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={() => setSelectedIssue(null)}
        >
          <div
            className={`max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border p-6 shadow-2xl ${palette.modalBg}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-start justify-between gap-4 border-b pb-4 ${palette.borderSubtle}`}>
              <div className="space-y-1">
                <div className={`flex items-center gap-2 text-xs ${palette.textMuted}`}>
                  <span className={`font-mono font-semibold tabular-nums ${palette.accentText}`}>
                    {selectedIssue.id}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedIssue.aiTriage.verified_category}</span>
                </div>
                <h2 id="issue-modal-title" className={`text-lg font-bold ${palette.textPrimary}`}>
                  {selectedIssue.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIssue(null)}
                aria-label="Close issue details modal (Escape)"
                className={`rounded-lg p-1.5 ${palette.textMuted} ${palette.focusRing}`}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <IssuePhoto
                src={selectedIssue.photoUrl}
                alt={selectedIssue.title}
                category={selectedIssue.aiTriage.verified_category}
                className="aspect-[16/9] w-full"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <PriorityBadge priority={selectedIssue.aiTriage.priority_level} />
                <span className="text-xs font-medium text-emerald-500">
                  Assigned: {selectedIssue.aiTriage.recommended_department}
                </span>
              </div>

              <StatusStepper status={selectedIssue.status} />

              <div className="space-y-1.5">
                <h3 className={`text-xs font-semibold ${palette.textMuted}`}>Citizen Description</h3>
                <p className={`text-sm leading-relaxed ${palette.textSecondary}`}>
                  {selectedIssue.description}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <p className={`font-mono text-xs ${palette.textMuted}`}>
                    {selectedIssue.location}
                  </p>
                  <a
                    href={buildGoogleMapsUrl(selectedIssue.location)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${selectedIssue.id} location on Google Maps`}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${palette.accentBadge} ${palette.focusRing}`}
                  >
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Open in Google Maps</span>
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </div>
              </div>

              <div className={`space-y-3 rounded-lg border p-4 ${palette.subPanel}`}>
                <h3 className={`text-xs font-semibold ${palette.accentText}`}>
                  Gemini AI Triage Breakdown
                </h3>
                <div className={`space-y-2 text-xs leading-relaxed ${palette.textSecondary}`}>
                  <p>
                    <span className={`font-semibold ${palette.textPrimary}`}>Priority Reasoning: </span>
                    {selectedIssue.aiTriage.priority_reasoning}
                  </p>
                  <p>
                    <span className={`font-semibold ${palette.textPrimary}`}>Visual Verification: </span>
                    {selectedIssue.aiTriage.ai_visual_verification}
                  </p>
                  <p>
                    <span className={`font-semibold ${palette.textPrimary}`}>Engineer Directive: </span>
                    {selectedIssue.aiTriage.actionable_summary}
                  </p>
                </div>
              </div>

              {selectedIssue.officialNote && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <h3 className="text-xs font-semibold text-emerald-500">
                    Official Municipal Remark
                  </h3>
                  <p className={`mt-1 text-sm leading-relaxed ${palette.textPrimary}`}>
                    {selectedIssue.officialNote}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
