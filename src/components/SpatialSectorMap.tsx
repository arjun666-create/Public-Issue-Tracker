import { useMemo, type KeyboardEvent } from 'react';
import { Crosshair, ExternalLink, MapPin, RotateCcw } from 'lucide-react';
import { useSkin } from '../context/ThemeContext';
import type { CivicIssue, PriorityLevel } from '../types/issue';
import { buildGoogleMapsUrl } from '../utils/maps';
import { PriorityBadge } from './PriorityBadge';

export type CitySector = 'North Ward' | 'Central Ward' | 'Coastal Ward' | 'South Ward';

interface SpatialSectorMapProps {
  issues: CivicIssue[];
  selectedIssueId: string | null;
  selectedSector: CitySector | null;
  onSelectIssue: (id: string | null) => void;
  onSelectSector: (sector: CitySector | null) => void;
}

export function inferIssueSector(location: string): CitySector {
  const lower = location.toLowerCase();
  if (lower.includes('anna nagar') || lower.includes('perambur') || lower.includes('kolathur')) {
    return 'North Ward';
  }
  if (
    lower.includes('adyar') ||
    lower.includes('mylapore') ||
    lower.includes('marina') ||
    lower.includes('besant')
  ) {
    return 'Coastal Ward';
  }
  if (
    lower.includes('velachery') ||
    lower.includes('guindy') ||
    lower.includes('tambaram') ||
    lower.includes('omr')
  ) {
    return 'South Ward';
  }
  return 'Central Ward';
}

function getPinPosition(issue: CivicIssue, indexInSector: number): { x: number; y: number } {
  const sector = inferIssueSector(issue.location);
  const anchors: Record<CitySector, Array<{ x: number; y: number }>> = {
    'North Ward': [
      { x: 165, y: 74 },
      { x: 245, y: 92 },
      { x: 120, y: 105 },
      { x: 295, y: 66 },
    ],
    'Central Ward': [
      { x: 215, y: 165 },
      { x: 145, y: 185 },
      { x: 270, y: 152 },
      { x: 185, y: 205 },
    ],
    'Coastal Ward': [
      { x: 430, y: 145 },
      { x: 412, y: 215 },
      { x: 448, y: 95 },
      { x: 388, y: 180 },
    ],
    'South Ward': [
      { x: 240, y: 258 },
      { x: 315, y: 242 },
      { x: 160, y: 266 },
      { x: 355, y: 270 },
    ],
  };

  const list = anchors[sector];
  return list[indexInSector % list.length];
}

const PIN_COLORS: Record<PriorityLevel, { fill: string; ring: string }> = {
  Critical: { fill: '#ef4444', ring: 'rgba(239,68,68,0.45)' },
  High: { fill: '#f59e0b', ring: 'rgba(245,158,11,0.4)' },
  Medium: { fill: '#06b6d4', ring: 'rgba(6,182,212,0.4)' },
  Low: { fill: '#10b981', ring: 'rgba(16,185,129,0.35)' },
};

function handleSvgKeyDown(e: KeyboardEvent<SVGGElement>, action: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    action();
  }
}

export function SpatialSectorMap({
  issues,
  selectedIssueId,
  selectedSector,
  onSelectIssue,
  onSelectSector,
}: SpatialSectorMapProps) {
  const palette = useSkin();

  const pins = useMemo(() => {
    const sectorCounts: Record<CitySector, number> = {
      'North Ward': 0,
      'Central Ward': 0,
      'Coastal Ward': 0,
      'South Ward': 0,
    };

    return issues.map((issue) => {
      const sector = inferIssueSector(issue.location);
      const idx = sectorCounts[sector];
      sectorCounts[sector] += 1;
      const pos = getPinPosition(issue, idx);
      return { issue, sector, ...pos };
    });
  }, [issues]);

  const activeIssue = useMemo(
    () => issues.find((i) => i.id === selectedIssueId) ?? null,
    [issues, selectedIssueId],
  );

  const sectorStats = useMemo(() => {
    const counts: Record<CitySector, number> = {
      'North Ward': 0,
      'Central Ward': 0,
      'Coastal Ward': 0,
      'South Ward': 0,
    };
    for (const p of pins) counts[p.sector] += 1;
    return counts;
  }, [pins]);

  return (
    <section
      aria-label="Spatial City Sector Radar"
      className={`rounded-xl border p-4 sm:p-5 ${palette.panel}`}
    >
      <div className="flex flex-col gap-3 border-b pb-3.5 sm:flex-row sm:items-center sm:justify-between border-inherit">
        <div className="flex items-center gap-2.5">
          <div className={`rounded-lg border p-2 ${palette.accentBadge}`}>
            <Crosshair className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className={`text-sm font-bold ${palette.textPrimary}`}>
              Spatial Sector Radar — Greater Chennai Grid
            </h3>
            <p className={`text-xs ${palette.textMuted}`}>
              Select any telemetry pin or ward zone to isolate and inspect matching tickets.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(selectedIssueId || selectedSector) && (
            <button
              type="button"
              onClick={() => {
                onSelectIssue(null);
                onSelectSector(null);
              }}
              aria-label="Clear active spatial map filter"
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${palette.secondaryBtn}`}
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              <span>Clear Spatial Filter</span>
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Stylized SVG Spatial Map */}
        <div
          className={`relative overflow-hidden rounded-xl border lg:col-span-8 ${palette.subPanel}`}
        >
          <svg
            viewBox="0 0 560 310"
            className="h-[240px] w-full sm:h-[270px]"
            role="group"
            aria-label="Interactive Chennai ward map with keyboard-selectable civic issue pins"
          >
            <defs>
              <pattern id="radarGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke={palette.isLight ? 'rgba(15,23,42,0.06)' : 'rgba(6,182,212,0.1)'}
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="560" height="310" fill="url(#radarGrid)" />

            <path
              d="M 480 0 L 560 0 L 560 310 L 452 310 Q 465 220 478 140 Q 486 70 480 0 Z"
              fill={palette.isLight ? 'rgba(2,132,199,0.08)' : 'rgba(6,182,212,0.07)'}
              stroke={palette.isLight ? 'rgba(2,132,199,0.28)' : 'rgba(6,182,212,0.28)'}
              strokeWidth="1.5"
            />
            <text
              x="512"
              y="160"
              fill={palette.isLight ? '#0369a1' : '#22d3ee'}
              opacity="0.65"
              fontSize="9"
              fontFamily="JetBrains Mono, monospace"
              transform="rotate(90 512 160)"
              textAnchor="middle"
            >
              BAY OF BENGAL COASTLINE
            </text>

            <path
              d="M 20 140 Q 190 130 330 155 T 476 150"
              fill="none"
              stroke={palette.isLight ? 'rgba(14,165,233,0.32)' : 'rgba(6,182,212,0.24)'}
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            <path
              d="M 15 225 Q 200 220 350 235 T 465 245"
              fill="none"
              stroke={palette.isLight ? 'rgba(14,165,233,0.25)' : 'rgba(16,185,129,0.22)'}
              strokeWidth="1.5"
              strokeDasharray="3 4"
            />

            {(
              [
                { name: 'North Ward', x: 18, y: 16, w: 330, h: 108 },
                { name: 'Central Ward', x: 18, y: 132, w: 330, h: 90 },
                { name: 'Coastal Ward', x: 356, y: 16, w: 112, h: 276 },
                { name: 'South Ward', x: 18, y: 230, w: 330, h: 64 },
              ] as const
            ).map((zone) => {
              const isZoneActive = selectedSector === zone.name;
              const toggleSector = () =>
                onSelectSector(selectedSector === zone.name ? null : zone.name);
              return (
                <g
                  key={zone.name}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isZoneActive}
                  aria-label={`Filter by ${zone.name} (${sectorStats[zone.name]} issues)`}
                  className="cursor-pointer focus:outline-none"
                  onClick={toggleSector}
                  onKeyDown={(e) => handleSvgKeyDown(e, toggleSector)}
                >
                  <rect
                    x={zone.x}
                    y={zone.y}
                    width={zone.w}
                    height={zone.h}
                    rx="10"
                    fill={
                      isZoneActive
                        ? palette.isLight
                          ? 'rgba(2,132,199,0.12)'
                          : 'rgba(6,182,212,0.14)'
                        : 'transparent'
                    }
                    stroke={
                      isZoneActive
                        ? '#06b6d4'
                        : palette.isLight
                          ? 'rgba(100,116,139,0.45)'
                          : 'rgba(148,163,184,0.22)'
                    }
                    strokeWidth={isZoneActive ? '1.75' : '1'}
                    strokeDasharray={isZoneActive ? undefined : '4 4'}
                  />
                  <text
                    x={zone.x + 10}
                    y={zone.y + 18}
                    fill={
                      isZoneActive
                        ? palette.isLight
                          ? '#0369a1'
                          : '#67e8f9'
                        : palette.isLight
                          ? '#334155'
                          : '#cbd5e1'
                    }
                    fontSize="10"
                    fontWeight="600"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {zone.name.toUpperCase()} ({sectorStats[zone.name]})
                  </text>
                </g>
              );
            })}

            {pins.map(({ issue, x, y }) => {
              const color = PIN_COLORS[issue.aiTriage.priority_level];
              const isSelected = selectedIssueId === issue.id;
              const isCritical = issue.aiTriage.priority_level === 'Critical';
              const togglePin = () => onSelectIssue(isSelected ? null : issue.id);

              return (
                <g
                  key={issue.id}
                  transform={`translate(${x}, ${y})`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`Inspect ${issue.id}: ${issue.title}, ${issue.aiTriage.priority_level} priority`}
                  className="cursor-pointer focus:outline-none"
                  onClick={togglePin}
                  onKeyDown={(e) => handleSvgKeyDown(e, togglePin)}
                >
                  {(isCritical || isSelected) && (
                    <circle
                      r={isSelected ? 18 : 14}
                      fill={color.ring}
                      className="animate-ping"
                      style={{ transformOrigin: '0px 0px' }}
                    />
                  )}
                  <circle
                    r={isSelected ? 11 : 8}
                    fill={color.ring}
                    stroke={isSelected ? '#ffffff' : color.fill}
                    strokeWidth={isSelected ? 2 : 1}
                  />
                  <circle r={4.5} fill={color.fill} />
                  <title>{`${issue.id}: ${issue.title} (${issue.aiTriage.priority_level})`}</title>
                </g>
              );
            })}
          </svg>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-inherit px-3.5 py-2 font-mono text-[10px]">
            <span className={palette.textMuted}>13.08° N / 80.27° E</span>
            <div className="flex flex-wrap items-center gap-3">
              {(['Critical', 'High', 'Medium', 'Low'] as PriorityLevel[]).map((prio) => (
                <span key={prio} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: PIN_COLORS[prio].fill }}
                    aria-hidden="true"
                  />
                  <span className={palette.textSecondary}>{prio}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Sector Quick Filters & Active Pin Inspector */}
        <div className="flex flex-col justify-between gap-3 lg:col-span-4">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Ward quick filters">
            {(
              ['North Ward', 'Central Ward', 'Coastal Ward', 'South Ward'] as CitySector[]
            ).map((sector) => {
              const active = selectedSector === sector;
              return (
                <button
                  key={sector}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelectSector(active ? null : sector)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    palette.focusRing
                  } ${active ? palette.accentBadge : palette.subPanel}`}
                >
                  <span className="truncate font-semibold">{sector}</span>
                  <span className="font-mono text-[11px] font-bold tabular-nums">
                    {sectorStats[sector]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className={`flex-1 rounded-xl border p-3.5 ${palette.subPanel}`}>
            {activeIssue ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-mono text-xs font-bold tabular-nums ${palette.accentText}`}>
                    {activeIssue.id}
                  </span>
                  <PriorityBadge priority={activeIssue.aiTriage.priority_level} />
                </div>
                <p className={`text-xs font-semibold leading-snug ${palette.textPrimary}`}>
                  {activeIssue.title}
                </p>
                <p className={`flex items-start gap-1 text-[11px] ${palette.textMuted}`}>
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                  <span>{activeIssue.location}</span>
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <p className="font-mono text-[11px] font-medium text-emerald-500">
                    {activeIssue.aiTriage.recommended_department}
                  </p>
                  <a
                    href={buildGoogleMapsUrl(activeIssue.location)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${activeIssue.id} location in Google Maps`}
                    className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[10px] font-semibold transition-colors ${palette.accentBadge} ${palette.focusRing}`}
                  >
                    <span>Google Maps</span>
                    <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col justify-center gap-1 text-xs">
                <p className={`font-semibold ${palette.textPrimary}`}>
                  Pin Telemetry Standby
                </p>
                <p className={`leading-relaxed ${palette.textMuted}`}>
                  Select any radar pin on the map to highlight its ticket card, view coordinates, or
                  launch Google Maps.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
