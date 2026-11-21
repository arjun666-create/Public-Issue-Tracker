import { AlertTriangle, Radio } from 'lucide-react';
import { useSkin } from '../context/ThemeContext';
import type { TriageMode } from '../types/issue';

interface CityTelemetryTickerProps {
  criticalCount: number;
  inProgressCount: number;
  totalCount: number;
  triageMode: TriageMode;
}

export function CityTelemetryTicker({
  criticalCount,
  inProgressCount,
  totalCount,
  triageMode,
}: CityTelemetryTickerProps) {
  const palette = useSkin();
  const isMonsoon = palette.skin === 'monsoon-alert';
  const crewsDispatched = inProgressCount + 12;

  const modeLabel =
    triageMode === 'hybrid'
      ? 'HYBRID VERIFICATION'
      : triageMode === 'manual'
        ? 'STRICT MANUAL SOP'
        : 'AUTONOMOUS GEMINI AI';

  const items = [
    `ACTIVE SENSORS: 1,420`,
    `AVG GEMINI TRIAGE: 1.4s`,
    `CRITICAL ZONES: ${criticalCount}`,
    `CREWS DISPATCHED: ${crewsDispatched}`,
    `LIVE TICKETS: ${totalCount}`,
    `ROUTING ENGINE: ${modeLabel}`,
  ];

  const tickerText = items.join('   |   ');

  return (
    <div
      className={`relative z-40 flex h-8 items-center overflow-hidden border-b font-mono text-[11px] tracking-wide ${
        isMonsoon
          ? 'border-red-500/40 bg-red-950/85 text-amber-200'
          : palette.isLight
            ? 'border-slate-200 bg-slate-900 text-cyan-200'
            : 'border-cyan-500/20 bg-[#040710]/95 text-cyan-300'
      }`}
    >
      <div
        className={`z-10 flex h-full shrink-0 items-center gap-1.5 border-r px-3 font-semibold ${
          isMonsoon
            ? 'border-red-500/40 bg-red-900/90 text-red-100'
            : 'border-cyan-500/25 bg-slate-950 text-emerald-300'
        }`}
      >
        {isMonsoon ? (
          <>
            <AlertTriangle className="h-3 w-3 animate-pulse text-amber-300" aria-hidden="true" />
            <span className="whitespace-nowrap">MONSOON ALERT</span>
          </>
        ) : (
          <>
            <Radio className="h-3 w-3 animate-pulse text-emerald-400" aria-hidden="true" />
            <span className="whitespace-nowrap">LIVE TELEMETRY</span>
          </>
        )}
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        <div className="animate-ticker flex whitespace-nowrap will-change-transform">
          <span className="px-6 tabular-nums">{tickerText}</span>
          <span className="px-6 tabular-nums" aria-hidden="true">
            {tickerText}
          </span>
        </div>
      </div>
    </div>
  );
}
