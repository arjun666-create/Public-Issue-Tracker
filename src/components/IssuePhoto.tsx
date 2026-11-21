import { useState } from 'react';
import { CameraOff } from 'lucide-react';
import { useSkin } from '../context/ThemeContext';
import type { IssueCategory } from '../types/issue';

interface IssuePhotoProps {
  src?: string;
  alt: string;
  category: IssueCategory;
  className?: string;
}

export function IssuePhoto({ src, alt, category, className = 'aspect-[4/3] w-full' }: IssuePhotoProps) {
  const [failed, setFailed] = useState(false);
  const palette = useSkin();

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={`No field photograph attached for ${category}: ${alt}`}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-center ${
          palette.isLight
            ? 'border-slate-300 bg-gradient-to-br from-slate-100 via-white to-slate-100'
            : 'border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900'
        } ${className}`}
      >
        <CameraOff className={`h-5 w-5 ${palette.textMuted}`} aria-hidden="true" />
        <div className="space-y-0.5">
          <p className={`text-xs font-medium ${palette.textSecondary}`}>No Field Photo</p>
          <p className={`text-[11px] ${palette.textMuted}`}>{category}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-lg border ${
        palette.isLight ? 'border-slate-300 bg-slate-100' : 'border-slate-800 bg-slate-950'
      } ${className}`}
    >
      <img
        src={src}
        alt={`Field evidence for ${category} — ${alt}`}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
