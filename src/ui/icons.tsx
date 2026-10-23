// ─── Icônes vectorielles SVG embarquées (remplace tous les emoji) ──────────
// Icônes « trait » cohérentes dessinées avec react-native-svg : aucun emoji,
// aucun glyphe système (donc aucun carré vide selon les appareils).
import React from 'react';
import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';
import type { ColorId } from '../game/types';

interface IconProps {
  size?: number;
  color?: string;
}

function Base({ size = 22, color = '#FFFFFF', children, filled }: IconProps & { children: React.ReactNode; filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'}
      stroke={filled ? 'none' : color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  );
}

export const IconPlay = (p: IconProps) => (
  <Base {...p} filled><Path d="M7 4.8v14.4c0 .9 1 1.5 1.8 1L20 13a1.2 1.2 0 0 0 0-2L8.8 3.9C8 3.4 7 4 7 4.8Z" /></Base>
);
export const IconPause = (p: IconProps) => (
  <Base {...p} filled>
    <Rect x="6" y="4.5" width="4" height="15" rx="1.4" />
    <Rect x="14" y="4.5" width="4" height="15" rx="1.4" />
  </Base>
);
export const IconMap = (p: IconProps) => (
  <Base {...p}>
    <Path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" />
    <Path d="M9 4v14M15 6v14" />
  </Base>
);
export const IconCalendar = (p: IconProps) => (
  <Base {...p}>
    <Rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
    <Path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
  </Base>
);
export const IconSettings = (p: IconProps) => (
  <Base {...p}>
    <Circle cx="12" cy="12" r="3.2" />
    <Path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1" />
  </Base>
);
export const IconStar = ({ size = 22, color = '#FFC93C' }: IconProps) => (
  <Base size={size} color={color} filled>
    <Polygon points="12,2.6 14.7,8.6 21.2,9.3 16.3,13.8 17.7,20.1 12,16.9 6.3,20.1 7.7,13.8 2.8,9.3 9.3,8.6" />
  </Base>
);
export const IconUndo = (p: IconProps) => (
  <Base {...p}>
    <Path d="M8.5 6.5 4.5 10l4 4" />
    <Path d="M4.5 10H15a5 5 0 0 1 0 10h-3.5" />
  </Base>
);
export const IconBulb = (p: IconProps) => (
  <Base {...p}>
    <Path d="M9.5 18.5h5M10.5 21h3" />
    <Path d="M12 3a6 6 0 0 1 3.5 10.8c-.7.5-1 1-1 2.2h-5c0-1.2-.3-1.7-1-2.2A6 6 0 0 1 12 3Z" />
  </Base>
);
export const IconRestart = (p: IconProps) => (
  <Base {...p}>
    <Path d="M20 12a8 8 0 1 1-2.3-5.6" />
    <Path d="M20.5 3.5v4h-4" />
  </Base>
);
export const IconHome = (p: IconProps) => (
  <Base {...p}>
    <Path d="M4 11.5 12 4l8 7.5" />
    <Path d="M6.5 10v9.5h11V10" />
  </Base>
);
export const IconSnake = (p: IconProps) => (
  <Base {...p}>
    <Path d="M4 18c4 0 4-4 8-4s4-4 8-4" strokeWidth={2.6} />
    <Circle cx="19" cy="9.4" r="0.4" fill={p.color ?? '#FFFFFF'} />
  </Base>
);
export const IconLock = (p: IconProps) => (
  <Base {...p}>
    <Rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
    <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    <Circle cx="12" cy="15.2" r="1.4" fill={p.color ?? '#FFFFFF'} stroke="none" />
  </Base>
);
export const IconCheck = (p: IconProps) => (
  <Base {...p}><Path d="M4.5 12.5 10 18 19.5 6.5" strokeWidth={2.6} /></Base>
);
export const IconNext = (p: IconProps) => (
  <Base {...p}><Path d="M5 12h13M13 6l6 6-6 6" strokeWidth={2.4} /></Base>
);
export const IconChevronLeft = (p: IconProps) => (
  <Base {...p}><Path d="M14.5 5 8 12l6.5 7" strokeWidth={2.4} /></Base>
);
export const IconChevronRight = (p: IconProps) => (
  <Base {...p}><Path d="M9.5 5 16 12l-6.5 7" strokeWidth={2.4} /></Base>
);
export const IconAuto = (p: IconProps) => (
  <Base {...p}>
    <Path d="M12 2.8a9 9 0 1 0 0 18.4 9 9 0 0 0 0-18.4Z" />
    <Path d="M12 7.5v3.2M12 14.3l-1.6-1.4" strokeWidth={1.8} />
  </Base>
);
export const IconSound = (p: IconProps) => (
  <Base {...p}>
    <Path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" />
    <Path d="M15.5 9.5a4 4 0 0 1 0 5M18 7a7.5 7.5 0 0 1 0 10" />
  </Base>
);
export const IconMusic = (p: IconProps) => (
  <Base {...p}>
    <Path d="M9.5 18.2V6l10-2v11.7" />
    <Circle cx="6.8" cy="18.2" r="2.7" />
    <Circle cx="16.8" cy="15.7" r="2.7" />
  </Base>
);
export const IconVibrate = (p: IconProps) => (
  <Base {...p}>
    <Rect x="9" y="3.5" width="6.5" height="17" rx="2" />
    <Path d="M5 8.5a8 8 0 0 0 0 7M19.5 8.5a8 8 0 0 1 0 7" />
  </Base>
);
export const IconEye = (p: IconProps) => (
  <Base {...p}>
    <Path d="M3 12s3.2-5.5 9-5.5S21 12 21 12s-3.2 5.5-9 5.5S3 12 3 12Z" />
    <Circle cx="12" cy="12" r="2.8" />
  </Base>
);
export const IconMoon = (p: IconProps) => (
  <Base {...p}><Path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" /></Base>
);
export const IconSun = (p: IconProps) => (
  <Base {...p}>
    <Circle cx="12" cy="12" r="3.6" />
    <Path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7" />
  </Base>
);
export const IconSparkle = (p: IconProps) => (
  <Base {...p} filled><Path d="M12 3c.7 4.8 2.4 6.8 7.5 7.7-5.1.9-6.8 2.9-7.5 7.6-.7-4.7-2.4-6.7-7.5-7.6C9.6 9.8 11.3 7.8 12 3Z" /></Base>
);
export const IconTv = (p: IconProps) => (
  <Base {...p}>
    <Rect x="3" y="7.5" width="18" height="12.5" rx="2.5" />
    <Path d="m8 3.5 4 4 4-4" />
  </Base>
);

// ─── Symboles daltoniens en vraies formes SVG (jamais de glyphes) ──────────
const STAR_POINTS = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 9.5 : 4.2;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${12 + r * Math.cos(a)},${12 + r * Math.sin(a)}`);
  }
  return pts.join(' ');
})();

export function ColorSymbol({ colorId, size = 16, color = '#FFFFFF' }: { colorId: ColorId; size?: number; color?: string }) {
  const common = { fill: color, stroke: 'rgba(0,0,0,0.25)', strokeWidth: 1 };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {colorId === 'corail' && <Circle cx="12" cy="12" r="8.5" {...common} />}
      {colorId === 'soleil' && <Polygon points="12,3.5 21,20 3,20" {...common} />}
      {colorId === 'lime' && <Rect x="4.5" y="4.5" width="15" height="15" rx="2" {...common} />}
      {colorId === 'azur' && <Polygon points="12,3 21,12 12,21 3,12" {...common} />}
      {colorId === 'violet' && <Polygon points={STAR_POINTS} {...common} />}
      {colorId === 'rose' && (
        <Path d="M12 20.5C6 16 3.5 12.6 3.5 9.3A4.6 4.6 0 0 1 12 6.7a4.6 4.6 0 0 1 8.5 2.6c0 3.3-2.5 6.7-8.5 11.2Z" {...common} />
      )}
      {colorId === 'orange' && <Path d="M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5V4Z" {...common} />}
      {colorId === 'marron' && <Polygon points="12,3.5 19.5,8 19.5,16 12,20.5 4.5,16 4.5,8" {...common} />}
    </Svg>
  );
}
