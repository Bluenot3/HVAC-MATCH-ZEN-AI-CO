import React from 'react';

interface ZenLogoProps {
  className?: string;
  size?: number | string;
  variant?: 'badge' | 'icon' | 'monochrome' | 'full' | 'glow';
  color?: string;
  showSubtitle?: boolean;
}

/**
 * Official ZEN AI Co. Brand Monogram Logo — Ultra-High Fidelity Vector Asset
 * Modeled after official brand identity:
 * - Geometric interlocking 'Z' monogram with 180° rotational symmetry
 * - Triple-diagonal precision speed slashes with corner return notches
 * - Multi-layer brushed titanium casing with iridescent specular rim lighting
 */
export const ZenLogo: React.FC<ZenLogoProps> = ({
  className = '',
  size = 32,
  variant = 'badge',
  color = 'currentColor',
  showSubtitle = false,
}) => {
  const pixelSize = typeof size === 'number' ? `${size}px` : size;

  const renderMonogramPaths = (idPrefix: string, isLight = false) => (
    <g>
      <defs>
        {/* Specular edge gradient for 3D bevel look */}
        <linearGradient id={`${idPrefix}-specular`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="30%" stopColor="#E2E8F0" stopOpacity="0.85" />
          <stop offset="70%" stopColor="#94A3B8" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#64748B" stopOpacity="0.8" />
        </linearGradient>

        <linearGradient id={`${idPrefix}-glow`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#34D399" />
        </linearGradient>

        <filter id={`${idPrefix}-emboss`} x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.75" />
        </filter>
      </defs>

      {/* Top Section: Horizontal top bar with left vertical drop notch, and diagonal slash */}
      <path
        d="M 13 13 L 87 13 L 68 32 L 28 32 L 28 44 L 13 44 Z"
        fill={isLight ? '#0F172A' : `url(#${idPrefix}-specular)`}
        filter={!isLight ? `url(#${idPrefix}-emboss)` : undefined}
      />

      {/* Central High-Speed Diagonal Slash */}
      <path
        d="M 87 23 L 32 77 L 13 77 L 68 23 Z"
        fill={isLight ? '#0F172A' : '#FFFFFF'}
        filter={!isLight ? `url(#${idPrefix}-emboss)` : undefined}
      />

      {/* Bottom Section: Horizontal bottom bar with right vertical rise notch, and diagonal slash */}
      <path
        d="M 87 56 L 72 56 L 72 68 L 32 68 L 13 87 L 87 87 Z"
        fill={isLight ? '#0F172A' : `url(#${idPrefix}-specular)`}
        filter={!isLight ? `url(#${idPrefix}-emboss)` : undefined}
      />
    </g>
  );

  if (variant === 'full') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        {/* 3D Metallic Squircle Badge */}
        <div
          style={{ width: pixelSize, height: pixelSize }}
          className="relative flex-shrink-0 rounded-xl p-[2px] bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 shadow-[0_4px_14px_rgba(59,130,246,0.35)] transition-transform duration-200 hover:scale-105"
        >
          {/* Subtle Outer Neon Rim Ring */}
          <div className="w-full h-full rounded-[10px] bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 flex items-center justify-center p-1.5 overflow-hidden relative border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/20 via-transparent to-transparent pointer-events-none" />
            <svg viewBox="0 0 100 100" className="w-full h-full relative z-10" xmlns="http://www.w3.org/2000/svg">
              {renderMonogramPaths('full-badge', false)}
            </svg>
          </div>
        </div>

        {/* Brand Typography */}
        <div className="flex flex-col justify-center leading-none">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 flex items-center">
              ZEN<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 ml-0.5 font-black">AI</span>
              <span className="text-slate-400 text-xs font-semibold ml-1">Co.</span>
            </span>
            <span className="px-1.5 py-0.5 rounded bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-[8.5px] uppercase tracking-wider shadow-2xs">
              PRO
            </span>
          </div>
          {showSubtitle && (
            <span className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase mt-0.5">
              Autonomous Dispatch Intelligence
            </span>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'badge' || variant === 'glow') {
    return (
      <div
        style={{ width: pixelSize, height: pixelSize }}
        className={`relative inline-flex items-center justify-center rounded-xl p-[1.5px] bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 shadow-[0_4px_16px_rgba(59,130,246,0.3)] transition-transform duration-200 hover:scale-105 flex-shrink-0 group ${className}`}
        title="ZEN AI Co. Powered"
      >
        <div className="w-full h-full rounded-[10px] bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 flex items-center justify-center p-1.5 overflow-hidden relative border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]">
          {/* Subtle animated ambient rim light */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-400/25 via-blue-600/10 to-transparent pointer-events-none" />
          <svg viewBox="0 0 100 100" className="w-full h-full relative z-10 transition-transform duration-200 group-hover:scale-105" xmlns="http://www.w3.org/2000/svg">
            {renderMonogramPaths('single-badge', false)}
          </svg>
        </div>
      </div>
    );
  }

  if (variant === 'monochrome') {
    return (
      <div
        style={{ width: pixelSize, height: pixelSize }}
        className={`inline-block flex-shrink-0 ${className}`}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full" fill={color} xmlns="http://www.w3.org/2000/svg">
          <path d="M 13 13 L 87 13 L 68 32 L 28 32 L 28 44 L 13 44 Z" />
          <path d="M 87 23 L 32 77 L 13 77 L 68 23 Z" />
          <path d="M 87 56 L 72 56 L 72 68 L 32 68 L 13 87 L 87 87 Z" />
        </svg>
      </div>
    );
  }

  // Default 'icon'
  return (
    <div
      style={{ width: pixelSize, height: pixelSize }}
      className={`inline-flex items-center justify-center rounded-lg bg-slate-900 text-white p-1 shadow-sm flex-shrink-0 ${className}`}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="#FFFFFF" xmlns="http://www.w3.org/2000/svg">
        <path d="M 13 13 L 87 13 L 68 32 L 28 32 L 28 44 L 13 44 Z" />
        <path d="M 87 23 L 32 77 L 13 77 L 68 23 Z" />
        <path d="M 87 56 L 72 56 L 72 68 L 32 68 L 13 87 L 87 87 Z" />
      </svg>
    </div>
  );
};
