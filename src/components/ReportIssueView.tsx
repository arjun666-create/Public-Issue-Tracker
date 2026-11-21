import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  Clock,
  Cpu,
  Crosshair,
  ExternalLink,
  Eye,
  FileCheck2,
  GitBranch,
  Loader2,
  MapPin,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Upload,
  UserCheck,
  Wrench,
  X,
} from 'lucide-react';
import { useSkin } from '../context/ThemeContext';
import {
  ISSUE_CATEGORIES,
  type AITriageResult,
  type CivicIssue,
  type CivicSettings,
  type IssueCategory,
} from '../types/issue';
import { compressImageFile } from '../utils/imageCompression';
import { buildGoogleMapsUrl } from '../utils/maps';
import { sanitizeInput, validateImageUpload } from '../utils/security';
import { matchManualSopRule } from '../utils/triageLogic';
import { PriorityBadge } from './PriorityBadge';
import { SlaRing } from './SlaRing';

interface ReportIssueViewProps {
  onIssueCreated: (issue: CivicIssue) => void;
  onNavigateTracker: () => void;
  onOpenSettings: () => void;
  onTriageLatencyMs: (latencyMs: number) => void;
  nextTicketNumber: number;
  selectedCity: string;
  settings: CivicSettings;
}

const MOCK_CHENNAI_LOCATIONS = [
  'Anna Nagar Roundtana, 2nd Avenue, Chennai (13.0850° N, 80.2101° E)',
  'Usman Road Flyover Approach, T. Nagar, Chennai (13.0418° N, 80.2341° E)',
  'Sardar Patel Road, Near Guindy Park Gate, Adyar, Chennai (13.0068° N, 80.2376° E)',
  'Velachery Main Road, Near Vijayanagar Bus Stand, Chennai (12.9784° N, 80.2212° E)',
];

const TERMINAL_STEPS = [
  '[1/3] Scanning visual hazard...',
  '[2/3] Verifying severity...',
  '[3/3] Routing to department...',
];

function formatKb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ReportIssueView({
  onIssueCreated,
  onNavigateTracker,
  onOpenSettings,
  onTriageLatencyMs,
  nextTicketNumber,
  selectedCity,
  settings,
}: ReportIssueViewProps) {
  const palette = useSkin();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [userCategory, setUserCategory] = useState<IssueCategory>('Roads & Potholes');
  const [photoDataUrl, setPhotoDataUrl] = useState<string>('');
  const [photoMimeType, setPhotoMimeType] = useState<string>('image/jpeg');
  const [photoName, setPhotoName] = useState<string>('');
  const [photoMeta, setPhotoMeta] = useState<string>('');
  const [locationIndex, setLocationIndex] = useState(0);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStageIdx, setAnalysisStageIdx] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdIssue, setCreatedIssue] = useState<CivicIssue | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isAnalyzing) {
      setAnalysisStageIdx(0);
      return;
    }
    const timer = window.setInterval(() => {
      setAnalysisStageIdx((prev) => (prev < TERMINAL_STEPS.length - 1 ? prev + 1 : prev));
    }, 750);
    return () => window.clearInterval(timer);
  }, [isAnalyzing]);

  const handleUseCurrentLocation = useCallback(() => {
    const chosen = MOCK_CHENNAI_LOCATIONS[locationIndex % MOCK_CHENNAI_LOCATIONS.length];
    setLocation(chosen);
    setLocationIndex((prev) => prev + 1);
    setErrorMsg(null);
  }, [locationIndex]);

  const handleFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageUpload(file);
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Unsupported file upload.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      const compressed = await compressImageFile(file, 1024, 0.8);
      setPhotoDataUrl(compressed.dataUrl);
      setPhotoMimeType(compressed.mimeType);
      setPhotoName(sanitizeInput(file.name) || 'field-photo.jpg');
      setPhotoMeta(
        `${compressed.width}×${compressed.height} JPEG · ${formatKb(compressed.compressedBytes)} (from ${formatKb(compressed.originalBytes)})`,
      );
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Unable to optimize the selected image file. Please try another JPEG, PNG, or WebP.',
      );
    }
  }, []);

  const clearPhoto = useCallback(() => {
    setPhotoDataUrl('');
    setPhotoName('');
    setPhotoMeta('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const resetFormForAnother = useCallback(() => {
    setTitle('');
    setDescription('');
    setLocation('');
    setUserCategory('Roads & Potholes');
    clearPhoto();
    setCreatedIssue(null);
    setErrorMsg(null);
  }, [clearPhoto]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const safeTitle = sanitizeInput(title);
    const safeDescription = sanitizeInput(description);
    const safeLocation = sanitizeInput(location);

    if (!safeTitle || !safeDescription || !safeLocation) {
      setErrorMsg(
        'Please enter a valid issue title, detailed description, and location (HTML/scripts are stripped).',
      );
      return;
    }

    setCreatedIssue(null);

    if (settings.triageMode === 'manual') {
      const { rule, matchedKeyword } = matchManualSopRule(
        settings.sopRules,
        safeTitle,
        safeDescription,
        safeLocation,
        userCategory,
      );

      const nowIso = new Date().toISOString();
      const manualTriage: AITriageResult = rule
        ? {
            verified_category: rule.category,
            priority_level: rule.defaultPriority,
            priority_reasoning: matchedKeyword
              ? `Matched Strict Manual SOP keyword "${matchedKeyword}" under ${rule.category} (Escalation SLA: ${rule.sla}).`
              : `Matched Strict Manual SOP category rule for ${rule.category} (Escalation SLA: ${rule.sla}).`,
            recommended_department: rule.department,
            ai_visual_verification: photoDataUrl
              ? 'Field photo attached (AI vision bypassed under Strict Manual SOP Mode).'
              : 'No image attached',
            actionable_summary: `Dispatch ${rule.department} (${rule.officerContact}) within ${rule.sla} SLA.`,
            routing_source: 'manual-sop',
            matched_sla: rule.sla,
            officer_contact: rule.officerContact,
          }
        : {
            verified_category: userCategory,
            priority_level: 'Medium',
            priority_reasoning: 'Routed via Strict Manual SOP default fallback (no matching rule found).',
            recommended_department: 'General Municipal Works',
            ai_visual_verification: photoDataUrl
              ? 'Field photo attached (AI vision bypassed under Strict Manual SOP Mode).'
              : 'No image attached',
            actionable_summary: `Assign ${safeTitle} at ${safeLocation} to General Municipal Works.`,
            routing_source: 'manual-sop',
            matched_sla: '24 Hours',
          };

      const newIssue: CivicIssue = {
        id: `CR-2026-${nextTicketNumber}`,
        title: safeTitle,
        description: safeDescription,
        location: safeLocation,
        userCategory,
        photoUrl: photoDataUrl || undefined,
        status: 'Reported',
        createdAt: nowIso,
        updatedAt: nowIso,
        upvotes: 1,
        aiTriage: manualTriage,
      };

      onIssueCreated(newIssue);
      setCreatedIssue(newIssue);
      return;
    }

    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: safeTitle,
          description: safeDescription,
          location: safeLocation,
          userCategory,
          imageBase64: photoDataUrl || undefined,
          imageMimeType: photoDataUrl ? photoMimeType : undefined,
          aiConfig: settings.aiConfig,
        }),
      });

      const payload = (await res.json()) as {
        triage?: AITriageResult;
        diagnostics?: { latencyMs?: number };
        error?: string;
      };

      if (!res.ok || !payload.triage) {
        throw new Error(payload.error || `AI Triage request failed with HTTP ${res.status}`);
      }

      if (typeof payload.diagnostics?.latencyMs === 'number') {
        onTriageLatencyMs(payload.diagnostics.latencyMs);
      }

      const nowIso = new Date().toISOString();
      const newIssue: CivicIssue = {
        id: `CR-2026-${nextTicketNumber}`,
        title: safeTitle,
        description: safeDescription,
        location: safeLocation,
        userCategory,
        photoUrl: photoDataUrl || undefined,
        status: settings.triageMode === 'hybrid' ? 'Pending Verification' : 'Reported',
        createdAt: nowIso,
        updatedAt: nowIso,
        upvotes: 1,
        aiTriage: {
          ...payload.triage,
          routing_source: 'gemini-ai',
        },
      };

      onIssueCreated(newIssue);
      setCreatedIssue(newIssue);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to reach AI triage service. Please try again.';
      setErrorMsg(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const modeBadge =
    settings.triageMode === 'hybrid'
      ? {
          label: 'Human-in-the-Loop Hybrid Mode',
          desc: 'Gemini suggests routing, then holds tickets in Pending Verification for admin approval.',
          Icon: UserCheck,
        }
      : settings.triageMode === 'manual'
        ? {
            label: 'Strict Manual SOP Mode',
            desc: 'AI routing bypassed. Tickets route deterministically via your custom SOP matrix.',
            Icon: GitBranch,
          }
        : {
            label: 'Autonomous Gemini AI Mode',
            desc: `Sensitivity: ${settings.aiConfig.sensitivity} · Tone: ${settings.aiConfig.languageTone}`,
            Icon: Bot,
          };

  const ModeIcon = modeBadge.Icon;

  return (
    <div className="space-y-6">
      <div className={`flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between ${palette.borderSubtle}`}>
        <div className="max-w-2xl space-y-1">
          <h2 className={`text-2xl font-bold tracking-tight sm:text-3xl [text-wrap:balance] ${palette.textPrimary}`}>
            Citizen Issue{' '}
            <span className={`bg-gradient-to-r ${palette.gradientTitle} bg-clip-text text-transparent`}>
              Reporting
            </span>{' '}
            &amp; AI Triage
          </h2>
          <p className={`text-sm leading-relaxed ${palette.textMuted}`}>
            Submit urban infrastructure defects for{' '}
            <span className={palette.textPrimary}>{selectedCity}</span>. Inputs are sanitized and
            routed via Gemini 2.5 Flash or your configured SOP policy.
          </p>
        </div>
        <span className={`font-mono text-xs font-semibold tabular-nums whitespace-nowrap shrink-0 ${palette.accentText}`}>
          NEXT TICKET: CR-2026-{nextTicketNumber}
        </span>
      </div>

      {/* Live Triage Mode Banner */}
      <div
        role="region"
        aria-label="Active triage policy banner"
        className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${palette.panel}`}
      >
        <div className="flex items-start gap-2.5 sm:items-center">
          <ModeIcon className={`mt-0.5 h-4 w-4 shrink-0 sm:mt-0 ${palette.accentText}`} aria-hidden="true" />
          <div className="text-xs">
            <span className={`font-semibold ${palette.textPrimary}`}>{modeBadge.label}: </span>
            <span className={palette.textSecondary}>{modeBadge.desc}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className={`inline-flex items-center gap-1.5 self-start rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 sm:self-auto ${palette.secondaryBtn}`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Configure Mode &amp; SOP</span>
        </button>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        {/* Left Column: Citizen Submission Form */}
        <section
          aria-label="Citizen complaint submission form"
          className={`rounded-xl border p-6 sm:p-7 lg:col-span-7 ${palette.panel}`}
        >
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {errorMsg && (
              <div
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-3 rounded-lg border border-red-500/50 bg-red-950/60 p-4 text-sm text-red-100"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="font-semibold text-red-50">Submission Validation Notice</p>
                  <p className="text-red-200">{errorMsg}</p>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="issue-title" className={`block text-sm font-medium ${palette.textPrimary}`}>
                Issue Title <span className="text-red-400" aria-hidden="true">*</span>
              </label>
              <input
                id="issue-title"
                type="text"
                required
                aria-describedby="issue-title-help"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Deep pothole near school gate pedestrian crossing"
                disabled={isAnalyzing}
                className={`w-full rounded-lg px-3.5 py-2.5 text-sm disabled:opacity-60 ${palette.input}`}
              />
              <p id="issue-title-help" className={`text-[11px] ${palette.textMuted}`}>
                Brief headline describing the civic hazard.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label htmlFor="issue-location" className={`block text-sm font-medium ${palette.textPrimary}`}>
                  Location / Landmark <span className="text-red-400" aria-hidden="true">*</span>
                </label>
                <div className="flex items-center gap-2">
                  {location.trim().length > 0 && (
                    <a
                      href={buildGoogleMapsUrl(location)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Preview entered location in Google Maps"
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${palette.secondaryBtn}`}
                    >
                      <span>Verify on Google Maps</span>
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={isAnalyzing}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${palette.accentBadge} ${palette.focusRing}`}
                  >
                    <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Use Current Location</span>
                  </button>
                </div>
              </div>
              <div className="relative">
                <MapPin
                  className={`pointer-events-none absolute left-3.5 top-3 h-4 w-4 ${palette.textMuted}`}
                  aria-hidden="true"
                />
                <input
                  id="issue-location"
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Street name, ward, or GPS coordinates in Chennai"
                  disabled={isAnalyzing}
                  className={`w-full rounded-lg py-2.5 pl-10 pr-3.5 text-sm disabled:opacity-60 ${palette.input}`}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="issue-category" className={`block text-sm font-medium ${palette.textPrimary}`}>
                Citizen-Selected Category
              </label>
              <select
                id="issue-category"
                value={userCategory}
                onChange={(e) => setUserCategory(e.target.value as IssueCategory)}
                disabled={isAnalyzing}
                className={`w-full rounded-lg px-3.5 py-2.5 text-sm disabled:opacity-60 ${palette.input}`}
              >
                {ISSUE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className={palette.selectOption}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="issue-description" className={`block text-sm font-medium ${palette.textPrimary}`}>
                Detailed Description <span className="text-red-400" aria-hidden="true">*</span>
              </label>
              <textarea
                id="issue-description"
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe severity, pedestrian or traffic exposure, and nearby civic landmarks..."
                disabled={isAnalyzing}
                className={`w-full rounded-lg px-3.5 py-2.5 text-sm leading-relaxed disabled:opacity-60 ${palette.input}`}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="issue-photo" className={`block text-sm font-medium ${palette.textPrimary}`}>
                Field Photo Upload (Optional — Auto-compressed to 1024px JPEG)
              </label>

              {!photoDataUrl ? (
                <label
                  htmlFor="issue-photo"
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors ${palette.subPanel} ${palette.focusRing} hover:border-cyan-400/60`}
                >
                  <Upload className={`h-5 w-5 ${palette.accentText}`} aria-hidden="true" />
                  <div className="space-y-0.5">
                    <p className={`text-sm font-medium ${palette.textPrimary}`}>
                      Attach an on-site photo for Gemini Neural Vision inspection
                    </p>
                    <p className={`text-xs ${palette.textMuted}`}>
                      Strictly JPEG, PNG, or WebP · Max 5 MB
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    id="issue-photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    disabled={isAnalyzing}
                    className="sr-only"
                  />
                </label>
              ) : (
                <div className={`relative overflow-hidden rounded-lg border ${palette.subPanel}`}>
                  <div className="relative">
                    <img
                      src={photoDataUrl}
                      alt={`Uploaded field photo preview: ${photoName || 'civic issue evidence'}`}
                      className="max-h-60 w-full object-cover"
                    />
                    {isAnalyzing && (
                      <div className="pointer-events-none absolute inset-0 bg-slate-950/35">
                        <motion.div
                          className="absolute inset-x-0 h-0.5 bg-cyan-400 shadow-[0_0_14px_3px_rgba(6,182,212,0.85)]"
                          initial={{ top: '4%' }}
                          animate={{ top: '94%' }}
                          transition={{
                            duration: 1.3,
                            repeat: Infinity,
                            repeatType: 'reverse',
                            ease: 'easeInOut',
                          }}
                        />
                        <div className="absolute left-3 top-3 h-4 w-4 border-l-2 border-t-2 border-cyan-400" />
                        <div className="absolute right-3 top-3 h-4 w-4 border-r-2 border-t-2 border-cyan-400" />
                        <div className="absolute bottom-3 left-3 h-4 w-4 border-b-2 border-l-2 border-cyan-400" />
                        <div className="absolute bottom-3 right-3 h-4 w-4 border-b-2 border-r-2 border-cyan-400" />
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded border border-cyan-400/50 bg-slate-950/85 px-2.5 py-1 font-mono text-[10px] font-semibold text-cyan-300">
                          NEURAL VISION SCANNING...
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={`flex flex-wrap items-center justify-between gap-2 border-t px-3.5 py-2 ${palette.borderSubtle}`}>
                    <div className="min-w-0">
                      <p className={`truncate font-mono text-xs ${palette.textSecondary}`}>
                        {photoName || 'Attached field photograph'}
                      </p>
                      {photoMeta && (
                        <p className="font-mono text-[10px] text-emerald-500">
                          Compressed: {photoMeta}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={clearPhoto}
                      disabled={isAnalyzing}
                      aria-label="Remove uploaded photograph"
                      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${palette.textMuted} ${palette.focusRing} hover:text-red-400`}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className={`flex flex-wrap items-center justify-between gap-3 border-t pt-4 ${palette.borderSubtle}`}>
              <p className={`text-xs ${palette.textMuted}`}>
                {settings.triageMode === 'manual'
                  ? 'Routes immediately via Strict Manual SOP Matrix.'
                  : settings.triageMode === 'hybrid'
                    ? 'Holds ticket in Pending Verification for admin review.'
                    : 'Dispatched immediately to the Digital Twin ledger.'}
              </p>
              <button
                type="submit"
                disabled={isAnalyzing}
                className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0 ${palette.primaryBtn}`}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Analyzing issue with Gemini AI...</span>
                  </>
                ) : settings.triageMode === 'manual' ? (
                  <>
                    <GitBranch className="h-4 w-4" aria-hidden="true" />
                    <span>Submit via Manual SOP</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    <span>Submit &amp; Analyze Report</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Right Column: Live AI Neural Scanner & Triage Preview Card */}
        <aside
          aria-label="Live AI triage preview and analysis telemetry"
          aria-live="polite"
          className={`flex flex-col rounded-xl border p-6 sm:p-7 lg:col-span-5 ${palette.panel}`}
        >
          {isAnalyzing ? (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex h-full flex-col justify-between gap-5"
            >
              <div className="space-y-5">
                <div className={`flex items-center justify-between border-b pb-4 ${palette.borderSubtle}`}>
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-3 w-3" aria-hidden="true">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-400" />
                    </span>
                    <span className={`font-mono text-xs font-semibold ${palette.accentText}`}>
                      NEURAL TRIAGE IN PROGRESS
                    </span>
                  </div>
                  <span className={`font-mono text-xs tabular-nums ${palette.textMuted}`}>
                    CR-2026-{nextTicketNumber}
                  </span>
                </div>

                <div className="relative h-44 overflow-hidden rounded-xl border border-cyan-500/35 bg-slate-950">
                  {photoDataUrl ? (
                    <img
                      src={photoDataUrl}
                      alt="Scanning uploaded civic issue photograph"
                      className="h-full w-full object-cover opacity-80"
                    />
                  ) : (
                    <div className="dt-blueprint-bg flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
                      <Cpu className="h-7 w-7 animate-pulse text-cyan-400" aria-hidden="true" />
                      <p className="font-mono text-[11px] text-cyan-300">
                        TEXTUAL HAZARD VECTOR ANALYSIS
                      </p>
                    </div>
                  )}

                  <motion.div
                    className="pointer-events-none absolute inset-x-0 h-0.5 bg-cyan-400 shadow-[0_0_16px_4px_rgba(6,182,212,0.85)]"
                    initial={{ top: '6%' }}
                    animate={{ top: '92%' }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      repeatType: 'reverse',
                      ease: 'easeInOut',
                    }}
                  />

                  <div className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 border-l-2 border-t-2 border-cyan-400" />
                  <div className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 border-r-2 border-t-2 border-cyan-400" />
                  <div className="pointer-events-none absolute bottom-2.5 left-2.5 h-3.5 w-3.5 border-b-2 border-l-2 border-cyan-400" />
                  <div className="pointer-events-none absolute bottom-2.5 right-2.5 h-3.5 w-3.5 border-b-2 border-r-2 border-cyan-400" />
                </div>

                <div className="rounded-xl border border-cyan-500/25 bg-slate-950 p-4 font-mono text-xs text-cyan-200">
                  <div className="mb-2.5 flex items-center gap-2 border-b border-slate-800 pb-2 text-[11px] text-slate-400">
                    <Terminal className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
                    <span>gemini-2.5-flash // triage-stream</span>
                  </div>
                  <div className="space-y-2">
                    {TERMINAL_STEPS.map((line, idx) => {
                      const done = idx < analysisStageIdx;
                      const active = idx === analysisStageIdx;
                      return (
                        <div
                          key={line}
                          className={`flex items-center gap-2 ${
                            done
                              ? 'text-emerald-400'
                              : active
                                ? 'text-cyan-300'
                                : 'text-slate-500'
                          }`}
                        >
                          {done ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          ) : active ? (
                            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
                          ) : (
                            <span className="h-3.5 w-3.5 shrink-0 text-center" aria-hidden="true">
                              ·
                            </span>
                          )}
                          <span>{line}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className={`rounded-lg border p-3.5 font-mono text-[11px] ${palette.subPanel}`}>
                Sensitivity: {settings.aiConfig.sensitivity} | Output: {settings.aiConfig.languageTone}
              </div>
            </motion.div>
          ) : createdIssue ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              className="flex h-full flex-col justify-between gap-6"
            >
              <div className="space-y-5">
                <div className={`flex items-start justify-between gap-3 border-b pb-4 ${palette.borderSubtle}`}>
                  <div className="space-y-1">
                    {createdIssue.status === 'Pending Verification' ? (
                      <div className="flex items-center gap-2 text-amber-400">
                        <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="text-xs font-semibold">
                          Pending Admin Verification (Hybrid Hold)
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-emerald-500">
                        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="text-xs font-semibold">
                          {createdIssue.aiTriage.routing_source === 'manual-sop'
                            ? 'Manual SOP Routing Complete'
                            : 'AI Triage Complete'}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2.5">
                      <h3 className={`font-mono text-xl font-bold tabular-nums ${palette.textPrimary}`}>
                        {createdIssue.id}
                      </h3>
                      <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${palette.accentBadge}`}>
                        {createdIssue.aiTriage.routing_source === 'manual-sop'
                          ? 'SOP MATCH'
                          : '96.4% CONF'}
                      </span>
                    </div>
                  </div>
                  <PriorityBadge priority={createdIssue.aiTriage.priority_level} />
                </div>

                {createdIssue.status === 'Pending Verification' && (
                  <div className="rounded-lg border border-amber-400/40 bg-amber-950/35 p-3 text-xs text-amber-200">
                    Human-in-the-Loop Hybrid Mode is active. An administrator must approve this AI
                    recommendation in the Municipal Admin Portal before dispatch.
                  </div>
                )}

                <div className="flex items-center justify-between gap-4 rounded-xl border p-3.5 border-inherit bg-emerald-500/5">
                  <div>
                    <p className={`text-[11px] font-medium ${palette.textMuted}`}>Assigned Department</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-emerald-500">
                      <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{createdIssue.aiTriage.recommended_department}</span>
                    </p>
                  </div>
                  <SlaRing
                    priority={createdIssue.aiTriage.priority_level}
                    status={createdIssue.status}
                    matchedSla={createdIssue.aiTriage.matched_sla}
                  />
                </div>

                <div className="space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className={`text-xs font-medium ${palette.textMuted}`}>Confirmed Category</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className={`text-sm font-semibold ${palette.accentText}`}>
                          {createdIssue.aiTriage.verified_category}
                        </span>
                        {createdIssue.aiTriage.verified_category !== createdIssue.userCategory && (
                          <span className="text-xs text-amber-400">
                            (Reclassified from {createdIssue.userCategory})
                          </span>
                        )}
                      </div>
                    </div>

                    <a
                      href={buildGoogleMapsUrl(createdIssue.location)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${createdIssue.id} coordinates in Google Maps`}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${palette.accentBadge} ${palette.focusRing}`}
                    >
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Open in Google Maps</span>
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  </div>

                  <div className={`border-t pt-3 ${palette.borderSubtle}`}>
                    <p className={`text-xs font-medium ${palette.textMuted}`}>
                      Routing &amp; Priority Reasoning
                    </p>
                    <p className={`mt-1 text-sm leading-relaxed ${palette.textSecondary}`}>
                      {createdIssue.aiTriage.priority_reasoning}
                    </p>
                  </div>

                  <div>
                    <p className={`text-xs font-medium ${palette.textMuted}`}>Visual Verification</p>
                    <p className={`mt-1 text-sm leading-relaxed ${palette.textSecondary}`}>
                      {createdIssue.aiTriage.ai_visual_verification}
                    </p>
                  </div>

                  <div className={`rounded-lg border p-3.5 ${palette.subPanel}`}>
                    <p className={`font-mono text-[11px] font-semibold ${palette.accentText}`}>
                      FIELD ENGINEER DISPATCH DIRECTIVE
                    </p>
                    <p className={`mt-1 text-sm font-medium leading-relaxed ${palette.textPrimary}`}>
                      {createdIssue.aiTriage.actionable_summary}
                    </p>
                  </div>
                </div>
              </div>

              <div className={`flex flex-wrap items-center gap-3 border-t pt-5 ${palette.borderSubtle}`}>
                <button
                  type="button"
                  onClick={onNavigateTracker}
                  className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 whitespace-nowrap ${palette.focusRing}`}
                >
                  <span>View in Public Tracker</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={resetFormForAnother}
                  className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${palette.secondaryBtn}`}
                >
                  Submit Another
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="flex h-full flex-col justify-between gap-6">
              <div className="space-y-5">
                <div className={`flex items-start justify-between gap-3 border-b pb-4 ${palette.borderSubtle}`}>
                  <div>
                    <span className={`inline-flex items-center gap-1.5 font-mono text-xs font-semibold ${palette.accentText}`}>
                      <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {settings.triageMode === 'manual'
                          ? 'MANUAL SOP TELEMETRY'
                          : 'AI TRIAGE PREVIEW'}
                      </span>
                    </span>
                    <h3 className={`mt-1 text-lg font-semibold ${palette.textPrimary}`}>
                      Live Dispatch Telemetry
                    </h3>
                  </div>
                  <span className={`rounded-md border px-2.5 py-1 font-mono text-[11px] font-medium ${palette.subPanel}`}>
                    STANDBY
                  </span>
                </div>

                <div className={`space-y-2.5 rounded-lg border p-4 font-mono text-xs ${palette.subPanel}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={palette.textMuted}>Active Engine</span>
                    <span className="font-semibold text-emerald-500">
                      {settings.triageMode === 'manual'
                        ? 'Strict Manual SOP'
                        : settings.triageMode === 'hybrid'
                          ? 'Hybrid AI + Approval'
                          : 'Autonomous Gemini AI'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={palette.textMuted}>Category</span>
                    <span className={`font-semibold ${palette.accentText}`}>{userCategory}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={palette.textMuted}>Draft Title</span>
                    <span className={`max-w-[58%] truncate text-right font-medium ${palette.textPrimary}`}>
                      {title.trim() || 'Awaiting title...'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={palette.textMuted}>Coordinates</span>
                    <span className={`max-w-[58%] truncate text-right font-medium ${palette.textPrimary}`}>
                      {location.trim() || 'Awaiting pin...'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={palette.textMuted}>Vision Payload</span>
                    <span className={`font-semibold ${photoDataUrl ? 'text-emerald-500' : palette.textMuted}`}>
                      {photoDataUrl ? 'COMPRESSED READY' : 'NONE'}
                    </span>
                  </div>
                </div>

                <dl className="space-y-3.5">
                  <div className="flex items-start gap-3">
                    <FileCheck2 className={`mt-0.5 h-4 w-4 shrink-0 ${palette.accentText}`} aria-hidden="true" />
                    <div>
                      <dt className={`text-sm font-semibold ${palette.textPrimary}`}>
                        01. AI Classification
                      </dt>
                      <dd className={`mt-0.5 text-xs leading-relaxed ${palette.textMuted}`}>
                        {settings.triageMode === 'manual'
                          ? 'Matches complaint keywords against your custom SOP routing table.'
                          : 'Validates or overrides the citizen-selected category automatically.'}
                      </dd>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <AlertCircle className={`mt-0.5 h-4 w-4 shrink-0 ${palette.accentText}`} aria-hidden="true" />
                    <div>
                      <dt className={`text-sm font-semibold ${palette.textPrimary}`}>
                        02. Priority Detection
                      </dt>
                      <dd className={`mt-0.5 text-xs leading-relaxed ${palette.textMuted}`}>
                        {settings.triageMode === 'manual'
                          ? 'Applies Default Priority Override and Auto-Escalation SLA from SOP rule.'
                          : `Scores Critical, High, Medium, or Low using ${settings.aiConfig.sensitivity} sensitivity.`}
                      </dd>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Eye className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                    <div>
                      <dt className={`text-sm font-semibold ${palette.textPrimary}`}>
                        03. Multimodal Vision Scan
                      </dt>
                      <dd className={`mt-0.5 text-xs leading-relaxed ${palette.textMuted}`}>
                        Compresses photos to 1024px JPEG and inspects hazards via Gemini 2.5 Flash.
                      </dd>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                    <div>
                      <dt className={`text-sm font-semibold ${palette.textPrimary}`}>
                        04. Department Recommendation
                      </dt>
                      <dd className={`mt-0.5 text-xs leading-relaxed ${palette.textMuted}`}>
                        {settings.triageMode === 'hybrid'
                          ? 'Holds recommendation in Pending Verification until admin approval.'
                          : 'Routes to the municipal division with Google Maps link and dispatch directive.'}
                      </dd>
                    </div>
                  </div>
                </dl>
              </div>

              <div className={`rounded-lg border p-3.5 text-xs ${palette.subPanel}`}>
                Submit the form on the left to trigger live neural scanning and dispatch under{' '}
                <strong className={palette.textPrimary}>{modeBadge.label}</strong>.
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
