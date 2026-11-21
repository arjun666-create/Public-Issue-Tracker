import { Check, Clock } from 'lucide-react';
import { useSkin } from '../context/ThemeContext';
import { STATUS_STEPS, type IssueStatus } from '../types/issue';

interface StatusStepperProps {
  status: IssueStatus;
  compact?: boolean;
}

export function StatusStepper({ status, compact = false }: StatusStepperProps) {
  const palette = useSkin();

  if (status === 'Pending Verification') {
    return (
      <div
        role="status"
        className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
          palette.isLight
            ? 'border-amber-400 bg-amber-50 text-amber-950'
            : 'border-amber-400/35 bg-amber-950/40 text-amber-200'
        }`}
        aria-label="Ticket status: Pending Admin Verification"
      >
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Pending Admin Verification</span>
        </span>
        <span className="font-mono text-[10px] opacity-90">HYBRID HOLD</span>
      </div>
    );
  }

  const currentIndex = STATUS_STEPS.indexOf(status);

  return (
    <div className="w-full" role="group" aria-label={`Ticket progress status: ${status}`}>
      <ol className="flex items-center justify-between">
        {STATUS_STEPS.map((step, idx) => {
          const isCompleted = idx < currentIndex || (step === 'Resolved' && status === 'Resolved');
          const isCurrent = idx === currentIndex && status !== 'Resolved';
          const isReached = idx <= currentIndex;

          return (
            <li
              key={step}
              aria-current={isCurrent ? 'step' : undefined}
              className="flex flex-1 items-center last:flex-none"
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 items-center justify-center rounded-md border font-mono text-[11px] font-semibold transition-colors ${
                    isCompleted
                      ? palette.isLight
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-emerald-400/70 bg-emerald-400/20 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.28)]'
                      : isCurrent
                        ? palette.isLight
                          ? 'border-cyan-700 bg-cyan-50 text-cyan-900'
                          : 'border-cyan-400/80 bg-cyan-400/20 text-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                        : palette.isLight
                          ? 'border-slate-300 bg-slate-100 text-slate-600'
                          : 'border-slate-700 bg-slate-900 text-slate-400'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <span className="tabular-nums">{idx + 1}</span>
                  )}
                </span>
                <span
                  className={`text-xs font-medium whitespace-nowrap ${
                    isReached ? palette.textPrimary : palette.textMuted
                  } ${compact ? 'hidden sm:inline' : ''}`}
                >
                  {step}
                </span>
              </div>

              {idx < STATUS_STEPS.length - 1 && (
                <div
                  className={`mx-2 h-px flex-1 transition-colors ${
                    idx < currentIndex
                      ? 'bg-emerald-500/70'
                      : palette.isLight
                        ? 'bg-slate-300'
                        : 'bg-slate-800'
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
