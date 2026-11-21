import { createContext, useContext, useMemo } from 'react';

export type VisualSkin = 'digital-twin' | 'monsoon-alert' | 'daylight-civic';

export interface SkinPalette {
  skin: VisualSkin;
  isLight: boolean;
  highContrast: boolean;
  focusRing: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  panel: string;
  subPanel: string;
  input: string;
  selectOption: string;
  borderSubtle: string;
  accentText: string;
  accentBg: string;
  accentBadge: string;
  primaryBtn: string;
  secondaryBtn: string;
  gradientTitle: string;
  sidebarBg: string;
  headerBg: string;
  modalBg: string;
}

const FOCUS_RING_DARK =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950';
const FOCUS_RING_LIGHT =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

const SKIN_PALETTES: Record<VisualSkin, SkinPalette> = {
  'digital-twin': {
    skin: 'digital-twin',
    isLight: false,
    highContrast: false,
    focusRing: FOCUS_RING_DARK,
    textPrimary: 'text-slate-100',
    textSecondary: 'text-slate-300',
    textMuted: 'text-slate-400',
    panel:
      'dt-glass backdrop-blur-xl border border-cyan-500/20 text-slate-100',
    subPanel:
      'bg-slate-950/70 border border-cyan-500/15 text-slate-200',
    input:
      'bg-slate-950/80 border border-slate-700/80 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400',
    selectOption: 'bg-slate-900 text-slate-100',
    borderSubtle: 'border-slate-800/80',
    accentText: 'text-cyan-400',
    accentBg: 'bg-cyan-400/15',
    accentBadge: 'border-cyan-400/35 bg-cyan-400/12 text-cyan-300',
    primaryBtn:
      `bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.3)] ${FOCUS_RING_DARK}`,
    secondaryBtn:
      `border border-slate-700 bg-slate-950/80 text-slate-200 hover:border-cyan-400/40 hover:bg-slate-900 ${FOCUS_RING_DARK}`,
    gradientTitle: 'from-cyan-400 to-emerald-400',
    sidebarBg: 'bg-[#070b17]/90 border-cyan-500/20 backdrop-blur-xl',
    headerBg: 'bg-[#060913]/85 border-cyan-500/20 backdrop-blur-xl',
    modalBg: 'bg-[#0b1222] border-cyan-500/30 text-slate-100',
  },
  'monsoon-alert': {
    skin: 'monsoon-alert',
    isLight: false,
    highContrast: false,
    focusRing: FOCUS_RING_DARK,
    textPrimary: 'text-rose-50',
    textSecondary: 'text-slate-200',
    textMuted: 'text-slate-400',
    panel:
      'dt-glass backdrop-blur-xl border border-amber-500/30 text-rose-50',
    subPanel:
      'bg-[#12070b]/80 border border-amber-500/20 text-slate-200',
    input:
      'bg-[#100609]/85 border border-amber-500/25 text-rose-50 placeholder:text-slate-500 focus:border-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400',
    selectOption: 'bg-[#180c10] text-rose-50',
    borderSubtle: 'border-amber-500/20',
    accentText: 'text-amber-400',
    accentBg: 'bg-amber-400/15',
    accentBadge: 'border-amber-400/45 bg-amber-400/15 text-amber-200',
    primaryBtn:
      `bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.35)] ${FOCUS_RING_DARK}`,
    secondaryBtn:
      `border border-amber-500/30 bg-[#140a0e]/85 text-amber-100 hover:border-amber-400/60 hover:bg-[#1e0f14] ${FOCUS_RING_DARK}`,
    gradientTitle: 'from-amber-400 to-red-400',
    sidebarBg: 'bg-[#0f070a]/92 border-amber-500/25 backdrop-blur-xl',
    headerBg: 'bg-[#0b0608]/88 border-amber-500/25 backdrop-blur-xl',
    modalBg: 'bg-[#160a0e] border-amber-500/35 text-rose-50',
  },
  'daylight-civic': {
    skin: 'daylight-civic',
    isLight: true,
    highContrast: false,
    focusRing: FOCUS_RING_LIGHT,
    textPrimary: 'text-slate-900',
    textSecondary: 'text-slate-700',
    textMuted: 'text-slate-600',
    panel:
      'dt-glass backdrop-blur-xl border border-slate-200/90 text-slate-900 shadow-sm',
    subPanel:
      'bg-slate-50/90 border border-slate-200 text-slate-800',
    input:
      'bg-white border border-slate-300 text-slate-900 placeholder:text-slate-500 focus:border-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600',
    selectOption: 'bg-white text-slate-900',
    borderSubtle: 'border-slate-200',
    accentText: 'text-cyan-700',
    accentBg: 'bg-cyan-50',
    accentBadge: 'border-cyan-600/30 bg-cyan-50 text-cyan-800',
    primaryBtn:
      `bg-cyan-700 text-white hover:bg-cyan-800 shadow-sm ${FOCUS_RING_LIGHT}`,
    secondaryBtn:
      `border border-slate-300 bg-white text-slate-800 hover:border-cyan-700/60 hover:bg-slate-50 ${FOCUS_RING_LIGHT}`,
    gradientTitle: 'from-cyan-700 to-emerald-700',
    sidebarBg: 'bg-white/90 border-slate-200 backdrop-blur-xl',
    headerBg: 'bg-white/85 border-slate-200 backdrop-blur-xl',
    modalBg: 'bg-white border-slate-200 text-slate-900',
  },
};

function withHighContrast(base: SkinPalette): SkinPalette {
  if (base.isLight) {
    return {
      ...base,
      highContrast: true,
      textPrimary: 'text-black',
      textSecondary: 'text-slate-950',
      textMuted: 'text-slate-800',
      panel: 'bg-white border-2 border-slate-950 text-black shadow-none',
      subPanel: 'bg-slate-100 border-2 border-slate-900 text-black',
      input:
        'bg-white border-2 border-slate-950 text-black placeholder:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600',
      borderSubtle: 'border-slate-900',
      accentText: 'text-cyan-900',
      accentBadge: 'border-2 border-cyan-900 bg-cyan-100 text-black font-bold',
      primaryBtn: `bg-black text-white border-2 border-black hover:bg-slate-800 ${FOCUS_RING_LIGHT}`,
      secondaryBtn: `border-2 border-black bg-white text-black hover:bg-slate-200 ${FOCUS_RING_LIGHT}`,
      sidebarBg: 'bg-white border-slate-950',
      headerBg: 'bg-white border-slate-950',
      modalBg: 'bg-white border-2 border-black text-black',
    };
  }

  return {
    ...base,
    highContrast: true,
    textPrimary: 'text-white',
    textSecondary: 'text-slate-100',
    textMuted: 'text-slate-200',
    panel: 'bg-[#090d16] border-2 border-cyan-400 text-white shadow-none',
    subPanel: 'bg-black border-2 border-slate-400 text-white',
    input:
      'bg-black border-2 border-cyan-400 text-white placeholder:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400',
    borderSubtle: 'border-slate-500',
    accentText: 'text-cyan-300',
    accentBadge: 'border-2 border-cyan-300 bg-cyan-950 text-white font-bold',
    primaryBtn: `bg-cyan-300 text-black border-2 border-cyan-200 hover:bg-cyan-200 ${FOCUS_RING_DARK}`,
    secondaryBtn: `border-2 border-white bg-black text-white hover:bg-slate-900 ${FOCUS_RING_DARK}`,
    sidebarBg: 'bg-black border-cyan-400',
    headerBg: 'bg-black border-cyan-400',
    modalBg: 'bg-black border-2 border-cyan-300 text-white',
  };
}

const ThemeContext = createContext<SkinPalette>(SKIN_PALETTES['digital-twin']);

export function ThemeProvider({
  skin,
  highContrast = false,
  children,
}: {
  skin: VisualSkin;
  highContrast?: boolean;
  children: React.ReactNode;
}) {
  const palette = useMemo(() => {
    const base = SKIN_PALETTES[skin];
    return highContrast ? withHighContrast(base) : base;
  }, [skin, highContrast]);

  return <ThemeContext.Provider value={palette}>{children}</ThemeContext.Provider>;
}

export function useSkin(): SkinPalette {
  return useContext(ThemeContext);
}
