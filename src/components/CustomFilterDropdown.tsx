import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useSkin } from '../context/ThemeContext';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  dotColor?: string;
  Icon?: ComponentType<{ className?: string }>;
}

interface CustomFilterDropdownProps<T extends string> {
  label: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  minWidthClass?: string;
}

export function CustomFilterDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  minWidthClass = 'min-w-[165px]',
}: CustomFilterDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const palette = useSkin();

  const selected = options.find((opt) => opt.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;

    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${minWidthClass}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${selected.label}`}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
          palette.focusRing
        } ${open ? palette.accentBadge : palette.subPanel}`}
      >
        <span className="flex items-center gap-2 truncate">
          {selected.dotColor && (
            <span className={`h-2 w-2 rounded-full shrink-0 ${selected.dotColor}`} aria-hidden="true" />
          )}
          {selected.Icon && (
            <selected.Icon className={`h-3.5 w-3.5 shrink-0 ${palette.textMuted}`} aria-hidden="true" />
          )}
          <span className={palette.textMuted}>{label}:</span>
          <span className={`truncate font-semibold ${palette.textPrimary}`}>{selected.label}</span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${
            open ? `rotate-180 ${palette.accentText}` : palette.textMuted
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={`Select ${label}`}
          className={`absolute right-0 z-40 mt-1.5 w-full min-w-[215px] overflow-hidden rounded-xl border p-1 shadow-2xl backdrop-blur-xl ${palette.modalBg}`}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            const OptIcon = opt.Icon;
            return (
              <li key={opt.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                    palette.focusRing
                  } ${
                    isSelected
                      ? `${palette.accentBadge} font-semibold`
                      : `${palette.textSecondary} ${
                          palette.isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800/80'
                        }`
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    {opt.dotColor && (
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${opt.dotColor}`}
                        aria-hidden="true"
                      />
                    )}
                    {OptIcon && (
                      <OptIcon
                        className={`h-3.5 w-3.5 shrink-0 ${
                          isSelected ? palette.accentText : palette.textMuted
                        }`}
                        aria-hidden="true"
                      />
                    )}
                    <span className="truncate">{opt.label}</span>
                  </span>
                  {isSelected && (
                    <Check className={`h-3.5 w-3.5 shrink-0 ${palette.accentText}`} aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
