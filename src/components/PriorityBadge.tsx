import { AlertOctagon, AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { useSkin } from '../context/ThemeContext';
import type { PriorityLevel } from '../types/issue';

interface PriorityBadgeProps {
  priority: PriorityLevel;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const palette = useSkin();

  const darkStyles: Record<PriorityLevel, { classes: string; Icon: typeof AlertOctagon }> = {
    Critical: {
      classes:
        'border-red-500/80 bg-red-950/65 text-red-200 shadow-[0_0_16px_rgba(239,68,68,0.4)]',
      Icon: AlertOctagon,
    },
    High: {
      classes:
        'border-amber-400/70 bg-amber-950/55 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.28)]',
      Icon: ShieldAlert,
    },
    Medium: {
      classes:
        'border-cyan-400/65 bg-cyan-950/55 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.24)]',
      Icon: AlertTriangle,
    },
    Low: {
      classes:
        'border-slate-500/60 bg-slate-800/75 text-slate-200 shadow-[0_0_8px_rgba(148,163,184,0.16)]',
      Icon: Info,
    },
  };

  const lightStyles: Record<PriorityLevel, { classes: string; Icon: typeof AlertOctagon }> = {
    Critical: {
      classes:
        'border-red-500 bg-red-50 text-red-800 shadow-[0_0_12px_rgba(239,68,68,0.2)]',
      Icon: AlertOctagon,
    },
    High: {
      classes: 'border-amber-500 bg-amber-50 text-amber-900',
      Icon: ShieldAlert,
    },
    Medium: {
      classes: 'border-cyan-500 bg-cyan-50 text-cyan-900',
      Icon: AlertTriangle,
    },
    Low: {
      classes: 'border-slate-400 bg-slate-100 text-slate-800',
      Icon: Info,
    },
  };

  const style = palette.isLight ? lightStyles[priority] : darkStyles[priority];
  const { Icon } = style;

  return (
    <span
      role="status"
      aria-label={`Priority level: ${priority}`}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[11px] font-semibold whitespace-nowrap shrink-0 ${style.classes}`}
    >
      {priority === 'Critical' ? (
        <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"
            aria-hidden="true"
          />
          <Icon className="relative h-3 w-3 shrink-0" aria-hidden="true" />
        </span>
      ) : (
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      <span>{priority}</span>
    </span>
  );
}
