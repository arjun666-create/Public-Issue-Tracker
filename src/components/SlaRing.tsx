import { useSkin } from '../context/ThemeContext';
import type { IssueStatus, PriorityLevel } from '../types/issue';

interface SlaRingProps {
  priority: PriorityLevel;
  status: IssueStatus;
  matchedSla?: string;
}

const DEFAULT_SLA_HOURS: Record<PriorityLevel, number> = {
  Critical: 4,
  High: 12,
  Medium: 24,
  Low: 72,
};

export function SlaRing({ priority, status, matchedSla }: SlaRingProps) {
  const palette = useSkin();
  const slaHours = matchedSla ? Number.parseInt(matchedSla, 10) || DEFAULT_SLA_HOURS[priority] : DEFAULT_SLA_HOURS[priority];

  const progress =
    status === 'Resolved'
      ? 100
      : status === 'In Progress'
        ? 64
        : status === 'Pending Verification'
          ? 22
          : 38;

  const size = 40;
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (progress / 100) * circumference;

  const strokeColor =
    status === 'Resolved'
      ? '#10b981'
      : priority === 'Critical'
        ? '#ef4444'
        : priority === 'High'
          ? '#f59e0b'
          : '#06b6d4';

  return (
    <div
      className="flex items-center gap-2"
      title={`Target SLA: ${slaHours}h (${status})`}
    >
      <div className="relative flex h-10 w-10 items-center justify-center shrink-0">
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={palette.isLight ? 'rgba(148,163,184,0.3)' : 'rgba(51,65,85,0.65)'}
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-500"
          />
        </svg>
        <span
          className={`absolute font-mono text-[10px] font-bold tabular-nums ${palette.textPrimary}`}
        >
          {slaHours}h
        </span>
      </div>
      <div className="leading-tight">
        <p className={`font-mono text-[10px] font-semibold uppercase ${palette.textMuted}`}>
          SLA Target
        </p>
        <p className={`font-mono text-xs font-semibold tabular-nums ${palette.textPrimary}`}>
          {status === 'Resolved' ? 'Met' : `${slaHours}h window`}
        </p>
      </div>
    </div>
  );
}
