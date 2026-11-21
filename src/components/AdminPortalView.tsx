import { useCallback, useMemo, useState } from 'react';
import {
  AlertOctagon,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  MapPin,
  Search,
  ShieldCheck,
  Ticket,
} from 'lucide-react';
import { useSkin } from '../context/ThemeContext';
import { useDebounce } from '../hooks/useDebounce';
import {
  ISSUE_CATEGORIES,
  MUNICIPAL_DEPARTMENTS,
  STATUS_STEPS,
  type CivicIssue,
  type IssueCategory,
  type IssueStatus,
  type PriorityLevel,
} from '../types/issue';
import { buildGoogleMapsUrl } from '../utils/maps';
import { sanitizeInput } from '../utils/security';
import { calculateIssueKpis, sortIssues } from '../utils/triageLogic';
import { IssuePhoto } from './IssuePhoto';
import { PriorityBadge } from './PriorityBadge';
import { SlaRing } from './SlaRing';
import {
  inferIssueSector,
  SpatialSectorMap,
  type CitySector,
} from './SpatialSectorMap';

interface AdminPortalViewProps {
  issues: CivicIssue[];
  onUpdateIssue: (
    id: string,
    patch: {
      status?: IssueStatus;
      recommended_department?: string;
      priority_level?: PriorityLevel;
      verified_category?: IssueCategory;
      officialNote?: string;
    },
    toastMessage?: string,
  ) => void;
  selectedCity: string;
}

const ALL_ADMIN_STATUSES: IssueStatus[] = ['Pending Verification', ...STATUS_STEPS];

export function AdminPortalView({
  issues,
  onUpdateIssue,
  selectedCity,
}: AdminPortalViewProps) {
  const palette = useSkin();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);

  const [priorityFilter, setPriorityFilter] = useState<'All' | PriorityLevel>('All');
  const [departmentFilter, setDepartmentFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | IssueStatus>('All');
  const [sortBy, setSortBy] = useState<'priority' | 'newest'>('priority');
  const [selectedMapIssueId, setSelectedMapIssueId] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<CitySector | null>(null);

  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>(() => {
    const firstPending = issues.find((i) => i.status === 'Pending Verification');
    const firstCritical = issues.find((i) => i.aiTriage.priority_level === 'Critical');
    const target = firstPending ?? firstCritical;
    return target ? { [target.id]: true } : {};
  });

  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savedNoticeId, setSavedNoticeId] = useState<string | null>(null);

  const availableDepartments = useMemo(() => {
    const set = new Set<string>(MUNICIPAL_DEPARTMENTS);
    issues.forEach((issue) => set.add(issue.aiTriage.recommended_department));
    return Array.from(set);
  }, [issues]);

  const stats = useMemo(() => calculateIssueKpis(issues), [issues]);

  const filteredIssues = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const matched = issues.filter((issue) => {
      if (selectedMapIssueId && issue.id !== selectedMapIssueId) return false;
      if (selectedSector && inferIssueSector(issue.location) !== selectedSector) return false;
      if (priorityFilter !== 'All' && issue.aiTriage.priority_level !== priorityFilter) {
        return false;
      }
      if (
        departmentFilter !== 'All' &&
        issue.aiTriage.recommended_department !== departmentFilter
      ) {
        return false;
      }
      if (statusFilter !== 'All' && issue.status !== statusFilter) {
        return false;
      }
      if (q) {
        const text = [
          issue.id,
          issue.title,
          issue.location,
          issue.aiTriage.recommended_department,
          issue.aiTriage.actionable_summary,
        ]
          .join(' ')
          .toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });

    return sortIssues(matched, sortBy);
  }, [
    issues,
    selectedMapIssueId,
    selectedSector,
    debouncedSearch,
    priorityFilter,
    departmentFilter,
    statusFilter,
    sortBy,
  ]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleSaveNote = useCallback(
    (issue: CivicIssue) => {
      const rawDraft = noteDrafts[issue.id] ?? issue.officialNote ?? '';
      const cleanNote = sanitizeInput(rawDraft);
      onUpdateIssue(
        issue.id,
        { officialNote: cleanNote },
        `Official remark published for ${issue.id}`,
      );
      setNoteDrafts((prev) => ({ ...prev, [issue.id]: cleanNote }));
      setSavedNoticeId(issue.id);
      window.setTimeout(() => {
        setSavedNoticeId((current) => (current === issue.id ? null : current));
      }, 2200);
    },
    [noteDrafts, onUpdateIssue],
  );

  return (
    <div className="space-y-6">
      <div className={`flex flex-col gap-2 border-b pb-5 sm:flex-row sm:items-end sm:justify-between ${palette.borderSubtle}`}>
        <div className="max-w-2xl space-y-1">
          <h2 className={`text-2xl font-bold tracking-tight sm:text-3xl [text-wrap:balance] ${palette.textPrimary}`}>
            Municipal{' '}
            <span className={`bg-gradient-to-r ${palette.gradientTitle} bg-clip-text text-transparent`}>
              Admin
            </span>{' '}
            Dashboard
          </h2>
          <p className={`text-sm leading-relaxed ${palette.textMuted}`}>
            Priority-sorted triage queue for{' '}
            <span className={`font-medium ${palette.textPrimary}`}>{selectedCity}</span>. Inspect
            Gemini diagnostics, verify Hybrid holds, reassign divisions, and publish remarks.
          </p>
        </div>
      </div>

      {stats.pendingVerification > 0 && (
        <div
          role="region"
          aria-label="Hybrid verification queue alert"
          className="flex flex-col gap-3 rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3 text-xs">
            <ShieldCheck className="h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
            <div>
              <p className={`font-semibold ${palette.textPrimary}`}>
                {stats.pendingVerification} ticket{stats.pendingVerification > 1 ? 's' : ''} awaiting
                Hybrid Mode approval
              </p>
              <p className={palette.textSecondary}>
                Review AI recommendations below and click &quot;Approve &amp; Dispatch&quot; to move
                to Reported status.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter('Pending Verification')}
            className={`self-start rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-300 whitespace-nowrap sm:self-auto ${palette.focusRing}`}
          >
            Filter Pending ({stats.pendingVerification})
          </button>
        </div>
      )}

      {/* Bento-Grid Top KPI Stats */}
      <section aria-label="Admin dispatch metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`rounded-xl border p-5 ${palette.panel}`}>
          <div className={`flex items-center justify-between text-xs font-medium ${palette.textMuted}`}>
            <span>Critical Open</span>
            <AlertOctagon className="h-4 w-4 text-red-400" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="font-mono text-3xl font-bold text-red-400 tabular-nums">
              {stats.criticalOpen}
            </p>
            <span className="font-mono text-[11px] text-red-400/80">PRIORITY #1</span>
          </div>
        </div>

        <div className={`rounded-xl border p-5 ${palette.panel}`}>
          <div className={`flex items-center justify-between text-xs font-medium ${palette.textMuted}`}>
            <span>Awaiting Crew / Hold</span>
            <Clock className="h-4 w-4 text-amber-400" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="font-mono text-3xl font-bold text-amber-400 tabular-nums">
              {stats.reported + stats.pendingVerification}
            </p>
            <span className={`font-mono text-[11px] tabular-nums ${palette.textMuted}`}>
              {stats.pendingVerification} hybrid hold
            </span>
          </div>
        </div>

        <div className={`rounded-xl border p-5 ${palette.panel}`}>
          <div className={`flex items-center justify-between text-xs font-medium ${palette.textMuted}`}>
            <span>Active Field Work</span>
            <Ticket className={`h-4 w-4 ${palette.accentText}`} aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className={`font-mono text-3xl font-bold tabular-nums ${palette.accentText}`}>
              {stats.inProgress}
            </p>
            <span className={`font-mono text-[11px] ${palette.textMuted}`}>IN PROGRESS</span>
          </div>
        </div>

        <div className={`rounded-xl border p-5 ${palette.panel}`}>
          <div className={`flex items-center justify-between text-xs font-medium ${palette.textMuted}`}>
            <span>Closed Tickets</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="font-mono text-3xl font-bold text-emerald-500 tabular-nums">
              {stats.resolved}
            </p>
            <span className={`font-mono text-[11px] tabular-nums ${palette.textMuted}`}>
              of {stats.total} total
            </span>
          </div>
        </div>
      </section>

      {/* Interactive Spatial Sector Radar */}
      <SpatialSectorMap
        issues={issues}
        selectedIssueId={selectedMapIssueId}
        selectedSector={selectedSector}
        onSelectIssue={(id) => {
          setSelectedMapIssueId(id);
          if (id) setExpandedIds((prev) => ({ ...prev, [id]: true }));
        }}
        onSelectSector={setSelectedSector}
      />

      {/* Filters & Search Bar */}
      <section
        aria-label="Admin ticket filters"
        className={`grid grid-cols-1 gap-3 rounded-xl border p-4 md:grid-cols-12 ${palette.panel}`}
      >
        <div className="relative md:col-span-4">
          <label htmlFor="admin-search-input" className="sr-only">
            Search municipal tickets
          </label>
          <Search
            className={`pointer-events-none absolute left-3 top-2.5 h-4 w-4 ${palette.textMuted}`}
            aria-hidden="true"
          />
          <input
            id="admin-search-input"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ticket ID, landmark, engineer summary..."
            className={`w-full rounded-lg py-2 pl-9 pr-3 text-sm ${palette.input}`}
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="admin-filter-priority" className="sr-only">
            Filter by priority level
          </label>
          <select
            id="admin-filter-priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as 'All' | PriorityLevel)}
            className={`w-full rounded-lg px-3 py-2 text-xs font-medium ${palette.input}`}
          >
            <option value="All" className={palette.selectOption}>Priority: All</option>
            <option value="Critical" className={palette.selectOption}>Critical</option>
            <option value="High" className={palette.selectOption}>High</option>
            <option value="Medium" className={palette.selectOption}>Medium</option>
            <option value="Low" className={palette.selectOption}>Low</option>
          </select>
        </div>

        <div className="md:col-span-3">
          <label htmlFor="admin-filter-department" className="sr-only">
            Filter by department
          </label>
          <select
            id="admin-filter-department"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className={`w-full rounded-lg px-3 py-2 text-xs font-medium ${palette.input}`}
          >
            <option value="All" className={palette.selectOption}>Department: All</option>
            {availableDepartments.map((dept) => (
              <option key={dept} value={dept} className={palette.selectOption}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="admin-filter-status" className="sr-only">
            Filter by status
          </label>
          <select
            id="admin-filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'All' | IssueStatus)}
            className={`w-full rounded-lg px-3 py-2 text-xs font-medium ${palette.input}`}
          >
            <option value="All" className={palette.selectOption}>Status: All</option>
            {ALL_ADMIN_STATUSES.map((st) => (
              <option key={st} value={st} className={palette.selectOption}>
                {st}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-1">
          <label htmlFor="admin-sort-order" className="sr-only">
            Sort tickets
          </label>
          <select
            id="admin-sort-order"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'priority' | 'newest')}
            className={`w-full rounded-lg px-2.5 py-2 text-xs font-medium ${palette.input}`}
          >
            <option value="priority" className={palette.selectOption}>Priority</option>
            <option value="newest" className={palette.selectOption}>Newest</option>
          </select>
        </div>
      </section>

      {/* Expandable Compact Horizontal Management Cards */}
      {filteredIssues.length === 0 ? (
        <div className={`rounded-xl border px-6 py-12 text-center ${palette.panel}`}>
          <p className={`text-sm font-semibold ${palette.textPrimary}`}>
            No municipal tickets match the selected filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setPriorityFilter('All');
              setDepartmentFilter('All');
              setStatusFilter('All');
              setSelectedMapIssueId(null);
              setSelectedSector(null);
            }}
            className={`mt-3 rounded-lg px-4 py-2 text-xs font-semibold ${palette.secondaryBtn}`}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredIssues.map((issue) => {
            const isExpanded = Boolean(expandedIds[issue.id]);
            const currentDraft = noteDrafts[issue.id] ?? issue.officialNote ?? '';
            const isPendingVerify = issue.status === 'Pending Verification';
            const dossierId = `dossier-${issue.id}`;
            const mapsUrl = buildGoogleMapsUrl(issue.location);

            return (
              <article
                key={issue.id}
                aria-label={`Admin dispatch ticket ${issue.id}`}
                className={`overflow-hidden rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-14px_rgba(6,182,212,0.22)] ${
                  palette.panel
                } ${isPendingVerify ? 'border-amber-400/60' : ''}`}
              >
                <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <PriorityBadge priority={issue.aiTriage.priority_level} />
                      <span className={`font-mono text-xs font-semibold tabular-nums ${palette.accentText}`}>
                        {issue.id}
                      </span>
                      <span className={palette.textMuted} aria-hidden="true">
                        ·
                      </span>
                      <span className={`text-xs font-medium ${palette.textSecondary}`}>
                        {issue.aiTriage.verified_category}
                      </span>
                      <span className={palette.textMuted} aria-hidden="true">
                        ·
                      </span>
                      <span
                        role="status"
                        className={`font-mono text-xs font-semibold ${
                          issue.status === 'Resolved'
                            ? 'text-emerald-500'
                            : issue.status === 'In Progress'
                              ? palette.accentText
                              : issue.status === 'Pending Verification'
                                ? 'text-amber-400'
                                : palette.textSecondary
                        }`}
                      >
                        {issue.status}
                      </span>
                    </div>

                    <h3 className={`text-base font-semibold ${palette.textPrimary}`}>{issue.title}</h3>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <span className={`inline-flex items-center gap-1 font-mono text-[11px] ${palette.textMuted}`}>
                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{issue.location}</span>
                      </span>
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${issue.id} location in Google Maps`}
                        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[10px] font-semibold ${palette.accentBadge} ${palette.focusRing}`}
                      >
                        <span>Google Maps</span>
                        <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                      </a>
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-500">
                        <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{issue.aiTriage.recommended_department}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <SlaRing
                      priority={issue.aiTriage.priority_level}
                      status={issue.status}
                      matchedSla={issue.aiTriage.matched_sla}
                    />

                    {isPendingVerify && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateIssue(
                            issue.id,
                            { status: 'Reported' },
                            `${issue.id} verified and dispatched`,
                          )
                        }
                        className={`inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400 whitespace-nowrap shrink-0 ${palette.focusRing}`}
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Approve &amp; Dispatch</span>
                      </button>
                    )}

                    <select
                      aria-label={`Change status for ${issue.id}`}
                      value={issue.status}
                      onChange={(e) =>
                        onUpdateIssue(
                          issue.id,
                          { status: e.target.value as IssueStatus },
                          `${issue.id} status updated to ${e.target.value}`,
                        )
                      }
                      className={`rounded-lg px-3 py-2 text-xs font-semibold ${palette.input}`}
                    >
                      {ALL_ADMIN_STATUSES.map((st) => (
                        <option key={st} value={st} className={palette.selectOption}>
                          Status: {st}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => toggleExpanded(issue.id)}
                      aria-expanded={isExpanded}
                      aria-controls={dossierId}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${palette.accentBadge} ${palette.focusRing}`}
                    >
                      <span>{isExpanded ? 'Hide Dossier' : 'Inspect & Dispatch'}</span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div id={dossierId} className={`border-t p-5 sm:p-6 ${palette.borderSubtle}`}>
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                      <div className="space-y-4 lg:col-span-7">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                          <div className="sm:col-span-5">
                            <IssuePhoto
                              src={issue.photoUrl}
                              alt={issue.title}
                              category={issue.aiTriage.verified_category}
                              className="aspect-[4/3] w-full"
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-7">
                            <p className={`text-xs font-semibold ${palette.textMuted}`}>
                              Citizen Complaint
                            </p>
                            <p className={`text-sm leading-relaxed ${palette.textSecondary}`}>
                              {issue.description}
                            </p>
                            {issue.userCategory !== issue.aiTriage.verified_category && (
                              <p className="text-xs text-amber-400">
                                Citizen originally tagged: {issue.userCategory} (Corrected to{' '}
                                {issue.aiTriage.verified_category})
                              </p>
                            )}
                          </div>
                        </div>

                        <div className={`space-y-3 rounded-lg border p-4 ${palette.subPanel}`}>
                          <h4 className={`font-mono text-xs font-semibold ${palette.accentText}`}>
                            {issue.aiTriage.routing_source === 'manual-sop'
                              ? 'MANUAL SOP ROUTING DOSSIER'
                              : 'GEMINI AI TRIAGE DOSSIER'}
                          </h4>
                          <dl className="space-y-2.5 text-xs leading-relaxed">
                            <div>
                              <dt className={`font-semibold ${palette.textPrimary}`}>
                                Priority Reasoning
                              </dt>
                              <dd className={palette.textMuted}>{issue.aiTriage.priority_reasoning}</dd>
                            </div>
                            <div>
                              <dt className={`font-semibold ${palette.textPrimary}`}>
                                Visual Verification
                              </dt>
                              <dd className={palette.textMuted}>
                                {issue.aiTriage.ai_visual_verification}
                              </dd>
                            </div>
                            <div>
                              <dt className={`font-semibold ${palette.textPrimary}`}>
                                Field Engineer Actionable Summary
                              </dt>
                              <dd className="font-medium text-emerald-500">
                                {issue.aiTriage.actionable_summary}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </div>

                      <div className={`space-y-4 rounded-lg border p-4 lg:col-span-5 ${palette.subPanel}`}>
                        <h4 className={`text-xs font-semibold ${palette.textPrimary}`}>
                          Municipal Dispatch Controls
                        </h4>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <label
                              htmlFor={`prio-${issue.id}`}
                              className={`block text-xs font-medium ${palette.textSecondary}`}
                            >
                              Priority Override
                            </label>
                            <select
                              id={`prio-${issue.id}`}
                              value={issue.aiTriage.priority_level}
                              onChange={(e) =>
                                onUpdateIssue(
                                  issue.id,
                                  { priority_level: e.target.value as PriorityLevel },
                                  `${issue.id} priority set to ${e.target.value}`,
                                )
                              }
                              className={`w-full rounded-lg px-3 py-2 text-xs font-medium ${palette.input}`}
                            >
                              <option value="Critical" className={palette.selectOption}>Critical</option>
                              <option value="High" className={palette.selectOption}>High</option>
                              <option value="Medium" className={palette.selectOption}>Medium</option>
                              <option value="Low" className={palette.selectOption}>Low</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label
                              htmlFor={`cat-${issue.id}`}
                              className={`block text-xs font-medium ${palette.textSecondary}`}
                            >
                              Category Override
                            </label>
                            <select
                              id={`cat-${issue.id}`}
                              value={issue.aiTriage.verified_category}
                              onChange={(e) =>
                                onUpdateIssue(
                                  issue.id,
                                  { verified_category: e.target.value as IssueCategory },
                                  `${issue.id} category updated`,
                                )
                              }
                              className={`w-full rounded-lg px-3 py-2 text-xs font-medium ${palette.input}`}
                            >
                              {ISSUE_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat} className={palette.selectOption}>
                                  {cat}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label
                            htmlFor={`status-${issue.id}`}
                            className={`block text-xs font-medium ${palette.textSecondary}`}
                          >
                            Ticket Status (Updates Public Tracker Live)
                          </label>
                          <select
                            id={`status-${issue.id}`}
                            value={issue.status}
                            onChange={(e) =>
                              onUpdateIssue(
                                issue.id,
                                { status: e.target.value as IssueStatus },
                                `${issue.id} status changed to ${e.target.value}`,
                              )
                            }
                            className={`w-full rounded-lg px-3 py-2 text-sm font-medium ${palette.input}`}
                          >
                            {ALL_ADMIN_STATUSES.map((st) => (
                              <option key={st} value={st} className={palette.selectOption}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label
                            htmlFor={`dept-${issue.id}`}
                            className={`block text-xs font-medium ${palette.textSecondary}`}
                          >
                            Reassign Department
                          </label>
                          <select
                            id={`dept-${issue.id}`}
                            value={issue.aiTriage.recommended_department}
                            onChange={(e) =>
                              onUpdateIssue(
                                issue.id,
                                { recommended_department: e.target.value },
                                `${issue.id} reassigned to ${e.target.value}`,
                              )
                            }
                            className={`w-full rounded-lg px-3 py-2 text-sm font-medium ${palette.input}`}
                          >
                            {availableDepartments.map((dept) => (
                              <option key={dept} value={dept} className={palette.selectOption}>
                                {dept}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label
                            htmlFor={`note-${issue.id}`}
                            className={`block text-xs font-medium ${palette.textSecondary}`}
                          >
                            Add Official Note / Resolution Remark (Sanitized)
                          </label>
                          <textarea
                            id={`note-${issue.id}`}
                            rows={3}
                            value={currentDraft}
                            onChange={(e) =>
                              setNoteDrafts((prev) => ({ ...prev, [issue.id]: e.target.value }))
                            }
                            placeholder="Enter inspection findings, crew dispatch ETA, or resolution confirmation..."
                            className={`w-full rounded-lg px-3 py-2 text-sm ${palette.input}`}
                          />
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <span className="text-xs text-emerald-500" role="status" aria-live="polite">
                              {savedNoticeId === issue.id ? (
                                <span className="inline-flex items-center gap-1 font-medium">
                                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                  Published to Public Tracker
                                </span>
                              ) : null}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSaveNote(issue)}
                              className={`rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400 whitespace-nowrap shrink-0 ${palette.focusRing}`}
                            >
                              Save Remark
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
