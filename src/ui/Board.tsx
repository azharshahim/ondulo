// ─── Plateau de jeu ────────────────────────────────────────────────────────
// Rendu inspiré des captures de référence :
//  • serpents en « tube » (58 % de case) dessiné en SVG : chemin lissé par
//    courbes de Bézier (coudes arrondis, extrémités capsule), dégradé
//    radial clair haut-gauche → foncé, reflet brillant, ombre portée
//    douce, liseré clair ; les points du corps sont interpolés (rAF) pour
//    un suivi fluide avec un léger décalage entre segments ;
//  • tête : gros yeux blancs (pupille + reflet) qui clignent et regardent
//    vers le doigt ; queue : petite flèche sombre discrète ;
//  • trous : anneau coloré, intérieur sombre profond, halo CONTENU dans
//    la case du trou (il ne dépasse jamais du plateau) ;
//  • cases bleu très clair biseautées sur fond sombre dégradé.
// Règles : le moteur (engine.ts) est la seule source de vérité. Le pas de
// glisser est choisi par engine.evaluateDragStep et chaque franchissement de
// case est validé par engine.tryMove via `attemptMove`. L'extrémité
// affichée ne suit le doigt que dans un rayon bridé autour de sa case
// logique : visuellement, un serpent ne peut donc jamais recouvrir un
// autre serpent, même doigt rapide ou bloqué.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-worklets';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle, Defs, Path, Polygon, RadialGradient, Stop,
} from 'react-native-svg';
import type {
  Cell, End, GameState, HoleState, LevelDef, MoveResult, SnakeState,
} from '../game/types';
import { COLORS } from '../game/colors';
import { evaluateDragStep } from '../game/engine';
import { ColorSymbol, IconCheck } from './icons';
import type { SkinId } from '../state/storage';
import type { Theme } from './theme';

export interface HintVisual {
  snakeId: string;
  end: End;
  from: Cell;
  target: Cell;
}

export interface SinkingInfo {
  snakeId: string;
  holeCell: Cell;
  end: End;
}

interface BoardProps {
  level: LevelDef;
  state: GameState;
  theme: Theme;
  skin: SkinId;
  colorblind: boolean;
  boardWidth: number;
  hint: HintVisual | null;
  sinking: SinkingInfo | null;
  attemptMove: (snakeId: string, end: End, target: Cell) => MoveResult;
  onStep: () => void;
  onBlockedFx: () => void;
  onSinkDone: () => void;
}

type Pt = { x: number; y: number };

/** Regard au repos (référence stable pour React.memo). */
const IDLE_LOOK = { dx: 0, dy: 0.3 };

const RAINBOW = ['#EF6B73', '#F0B63F', '#F2D94E', '#9BDD4A', '#0A9BEF', '#C9A0F5'];

const centerOf = (cellPos: Cell, cell: number): Pt => ({
  x: (cellPos.c + 0.5) * cell,
  y: (cellPos.r + 0.5) * cell,
});

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Chemin SVG lissé : Bézier quadratiques aux coudes (rayon généreux). */
function smoothPath(points: Pt[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  let d = `M ${points[0].x} ${points[0].y}`;
  d += ` L ${mid(points[0], points[1]).x} ${mid(points[0], points[1]).y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const m = mid(points[i], points[i + 1]);
    d += ` Q ${points[i].x} ${points[i].y} ${m.x} ${m.y}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function targetsFromState(
  state: GameState, cell: number,
  dragPt: { snakeId: string; end: End; x: number; y: number } | null,
): Record<string, Pt[]> {
  const out: Record<string, Pt[]> = {};
  for (const snake of state.snakes) {
    if (snake.absorbed) continue;
    const pts = snake.cells.map((c) => centerOf(c, cell));
    if (dragPt && dragPt.snakeId === snake.id) {
      // Extrémité saisie : elle suit le doigt UNIQUEMENT dans un rayon
      // bridé (0,34 case) autour du centre de sa case logique — la case
      // validée par le moteur. Elle ne peut donc jamais être dessinée
      // par-dessus la case voisine (et son éventuel occupant).
      const idx = dragPt.end === 'head' ? 0 : pts.length - 1;
      const base = pts[idx];
      const dx = dragPt.x - base.x;
      const dy = dragPt.y - base.y;
      const dist = Math.hypot(dx, dy);
      const maxOff = cell * 0.34;
      const k = dist > maxOff ? maxOff / dist : 1;
      pts[idx] = { x: base.x + dx * k, y: base.y + dy * k };
    }
    out[snake.id] = pts;
  }
  return out;
}

// ─── Yeux : clignent, pupille avec reflet, regard vers le doigt ────────────
function Eyes({ cell, look }: { cell: number; look: { dx: number; dy: number } }) {
  const blink = useSharedValue(1);
  useEffect(() => {
    blink.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2300 + Math.random() * 1700 }),
        withTiming(0.08, { duration: 70 }),
        withTiming(1, { duration: 130 }),
      ),
      -1, false,
    );
  }, [blink]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));
  // Gros yeux : ≈ 32 % de la largeur du corps (corps = 0,58 case).
  const eye = cell * 0.185;
  const pupil = cell * 0.10;
  const off = cell * 0.04;
  return (
    <Animated.View style={[{ flexDirection: 'row', gap: cell * 0.055 }, style]}>
      {[0, 1].map((i) => (
        <View key={i} style={{
          width: eye, height: eye, borderRadius: eye / 2, backgroundColor: '#FFF',
          alignItems: 'center', justifyContent: 'center',
          shadowColor: '#0A2540', shadowOpacity: 0.25, shadowRadius: 2,
          shadowOffset: { width: 0, height: 1 }, elevation: 2,
          transform: [{ translateX: look.dx * off }, { translateY: look.dy * off }],
        }}>
          <View style={{
            width: pupil, height: pupil, borderRadius: pupil / 2, backgroundColor: '#16233C',
          }}>
            <View style={{
              position: 'absolute', top: pupil * 0.14, left: pupil * 0.16,
              width: pupil * 0.34, height: pupil * 0.34, borderRadius: pupil * 0.2,
              backgroundColor: '#FFF',
            }} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

/** Yeux positionnés sur la tête, orientés selon la direction du corps. */
function HeadEyes({ head, neck, cell, look, faded }: {
  head: Pt; neck: Pt; cell: number; look: { dx: number; dy: number }; faded: boolean;
}) {
  const dx = head.x - neck.x;
  const dy = head.y - neck.y;
  const m = Math.max(1, Math.hypot(dx, dy));
  const angle = (Math.atan2(dy / m, dx / m) * 180) / Math.PI + 90; // degrés, "haut" local → direction
  const rad = ((angle - 90) * Math.PI) / 180;
  // Regard converti dans le repère local (tient compte de la rotation).
  const localLook = {
    dx: look.dx * Math.cos(rad) + look.dy * Math.sin(rad),
    dy: -look.dx * Math.sin(rad) + look.dy * Math.cos(rad),
  };
  void angle;
  const rot = (Math.atan2(dy / m, dx / m) * 180) / Math.PI + 90;
  return (
    <View pointerEvents="none" style={{
      position: 'absolute', left: head.x - cell / 2, top: head.y - cell / 2,
      width: cell, height: cell, alignItems: 'center',
      opacity: faded ? 0.25 : 1,
      transform: [{ rotate: `${rot}deg` }],
    }}>
      <View style={{ marginTop: cell * 0.16 }}>
        <Eyes cell={cell} look={localLook} />
      </View>
    </View>
  );
}

// ─── Corps du serpent en tube SVG (mémoïsé : ne se re-rend que si SES
// points changent, pas à chaque image des autres serpents) ────────────────
const SnakeTube = React.memo(function SnakeTube({
  snake, points, cell, boardWidth, boardHeight, skin, colorblind, look, moving, sinkingSnake,
  shakeSignal, reduceMotion,
}: {
  snake: SnakeState; points: Pt[]; cell: number; boardWidth: number; boardHeight: number;
  skin: SkinId; colorblind: boolean; look: { dx: number; dy: number };
  moving: boolean; sinkingSnake: boolean;
  /** Incrémenté à chaque refus de pas : secousse ciblée de CE serpent. */
  shakeSignal: number;
  /** Réglage système « réduire les animations » : aucune secousse. */
  reduceMotion: boolean;
}) {
  const info = COLORS[snake.color];
  const w = cell * 0.58; // largeur du corps = 58 % d'une case
  const d = smoothPath(points);
  const gid = `grad-${snake.id.replace(/[^a-zA-Z0-9]/g, '')}-${snake.color}`;
  // Dégradé en coordonnées absolues (userSpaceOnUse) : avec un dégradé
  // relatif à la boîte englobante, un serpent parfaitement droit (boîte
  // de hauteur ou largeur nulle) dégénérait en teinte claire délavée.
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const gw = Math.max(maxX - minX, cell);
  const gh = Math.max(maxY - minY, cell);
  const gradCx = minX + gw * 0.34;
  const gradCy = minY + gh * 0.24;
  const gradR = Math.max(gw, gh) * 0.95;

  // Respiration douce + squash & stretch léger pendant le déplacement.
  const breath = useSharedValue(1);
  const squash = useSharedValue(1);
  // Secousse ciblée : 2,5 px max, 150 ms, uniquement sur CE serpent.
  const shake = useSharedValue(0);
  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1.018, { duration: 1250, easing: Easing.inOut(Easing.sin) }), -1, true,
    );
  }, [breath]);
  useEffect(() => {
    squash.value = withTiming(moving ? 1.045 : 1, { duration: moving ? 110 : 220 });
  }, [moving, squash]);
  useEffect(() => {
    if (!shakeSignal || reduceMotion) return;
    shake.value = withSequence(
      withTiming(-2.5, { duration: 35 }),
      withTiming(2.5, { duration: 40 }),
      withTiming(-1.2, { duration: 35 }),
      withTiming(0, { duration: 40 }),
    );
  }, [shakeSignal, reduceMotion, shake]);
  const wrapStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shake.value },
      { scaleX: breath.value * squash.value },
      { scaleY: breath.value * (1 - (squash.value - 1) * 0.7) },
    ],
    opacity: sinkingSnake ? 0.92 : 1,
  }));

  // Petite flèche de queue : triangle sombre discret, pointe vers l'extérieur.
  let arrow: string | null = null;
  if (points.length > 1) {
    const tail = points[points.length - 1];
    const prev = points[points.length - 2];
    const vx = tail.x - prev.x;
    const vy = tail.y - prev.y;
    const vm = Math.max(1, Math.hypot(vx, vy));
    const ux = vx / vm;
    const uy = vy / vm;
    const px = -uy;
    const py = ux;
    const tip = { x: tail.x + ux * w * 0.24, y: tail.y + uy * w * 0.24 };
    const b1 = { x: tail.x - ux * w * 0.06 + px * w * 0.17, y: tail.y - uy * w * 0.06 + py * w * 0.17 };
    const b2 = { x: tail.x - ux * w * 0.06 - px * w * 0.17, y: tail.y - uy * w * 0.06 - py * w * 0.17 };
    arrow = `${tip.x},${tip.y} ${b1.x},${b1.y} ${b2.x},${b2.y}`;
  }

  const gradientStops =
    skin === 'arcenciel'
      ? RAINBOW.map((c, i) => <Stop key={i} offset={i / (RAINBOW.length - 1)} stopColor={c} />)
      : skin === 'degrade'
        ? [
            <Stop key="a" offset="0" stopColor={info.light} />,
            <Stop key="b" offset="0.35" stopColor={info.main} />,
            <Stop key="c" offset="1" stopColor={info.dark} />,
          ]
        : [
            <Stop key="a" offset="0" stopColor={info.light} />,
            <Stop key="b" offset="0.48" stopColor={info.main} />,
            <Stop key="c" offset="1" stopColor={info.dark} />,
          ];

  const dotOffsets = [
    { dx: -0.13, dy: -0.09 }, { dx: 0.14, dy: 0.1 }, { dx: -0.05, dy: 0.15 }, { dx: 0.1, dy: -0.14 },
  ];

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, wrapStyle]}>
      <Svg width={boardWidth} height={boardHeight} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Defs>
          <RadialGradient id={gid} gradientUnits="userSpaceOnUse" cx={gradCx} cy={gradCy} r={gradR}>
            {gradientStops}
          </RadialGradient>
        </Defs>

        {/* Ombre portée douce */}
        <Path d={d} stroke="rgba(8,17,38,0.30)" strokeWidth={w}
          strokeLinecap="round" strokeLinejoin="round" fill="none"
          transform={`translate(0 ${cell * 0.075})`} />
        {/* Liseré clair (bord inférieur lumineux) */}
        <Path d={d} stroke={info.light} strokeWidth={w + cell * 0.03}
          strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.4}
          transform={`translate(0 ${cell * 0.014})`} />
        {/* Corps principal en dégradé radial */}
        <Path d={d} stroke={`url(#${gid})`} strokeWidth={w}
          strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* Reflet brillant en haut du corps */}
        <Path d={d} stroke="rgba(255,255,255,0.34)" strokeWidth={w * 0.33}
          strokeLinecap="round" strokeLinejoin="round" fill="none"
          transform={`translate(${-w * 0.13} ${-w * 0.17})`} />

        {/* Skins */}
        {skin === 'rayures' && (
          <Path d={d} stroke="rgba(255,255,255,0.30)" strokeWidth={w}
            strokeLinecap="butt" strokeLinejoin="round" fill="none"
            strokeDasharray={`${cell * 0.15} ${cell * 0.30}`} />
        )}
        {skin === 'pois' && points.map((p, i) => {
          const o = dotOffsets[i % dotOffsets.length];
          return (
            <Circle key={i} cx={p.x + o.dx * cell} cy={p.y + o.dy * cell}
              r={w * 0.085} fill="rgba(255,255,255,0.38)" />
          );
        })}

        {/* Flèche de queue */}
        {arrow && <Polygon points={arrow} fill={info.dark} opacity={0.42} />}
      </Svg>

      {/* Symboles daltoniens (formes SVG, aucun glyphe) le long du corps */}
      {colorblind && points.slice(1).map((p, i) => (
        <View key={i} pointerEvents="none" style={{
          position: 'absolute', left: p.x - cell * 0.14, top: p.y - cell * 0.14,
          width: cell * 0.28, height: cell * 0.28, alignItems: 'center', justifyContent: 'center',
        }}>
          <ColorSymbol colorId={snake.color} size={cell * 0.26} />
        </View>
      ))}

      {points.length > 1 && (
        <HeadEyes head={points[0]} neck={points[1]} cell={cell} look={look} faded={sinkingSnake} />
      )}
    </Animated.View>
  );
});

// ─── Un trou : anneau plus fin, intérieur bien sombre, halo contenu ───────
// Le halo est dimensionné pour rester DANS la case du trou (≤ 0,97 case
// au maximum de sa pulsation) : il ne dépasse jamais du plateau.
const HoleView = React.memo(function HoleView({ hole, cell, near }: {
  hole: HoleState; cell: number; near: boolean;
}) {
  const info = COLORS[hole.color];
  const pulse = useSharedValue(0.25);
  useEffect(() => {
    // Pulsation par l'OPACITÉ uniquement (taille constante) : le halo ne
    // génère aucun micro-décalage de mise en page (CLS).
    pulse.value = withRepeat(
      withTiming(near ? 0.55 : 0.34, { duration: near ? 380 : 1000, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
  }, [near, pulse]);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));
  const ctr = centerOf(hole.cell, cell);
  const size = cell * 0.8;
  const inner = size * 0.6;
  const glowSize = cell * 0.84;
  if (hole.filled) {
    // Même géométrie externe que l'état non rempli (cell × cell) : le
    // remplissage du trou ne change la taille d'aucun élément (CLS = 0).
    return (
      <View pointerEvents="none" style={{
        position: 'absolute', left: ctr.x - cell / 2, top: ctr.y - cell / 2,
        width: cell, height: cell, zIndex: 2, alignItems: 'center', justifyContent: 'center',
      }}>
        <View style={{
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: info.dark, alignItems: 'center', justifyContent: 'center', opacity: 0.9,
        }}>
          <View style={{
            width: inner, height: inner, borderRadius: inner / 2, backgroundColor: '#081728',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <IconCheck size={cell * 0.3} color={info.light} />
          </View>
        </View>
      </View>
    );
  }
  return (
    <View pointerEvents="none" style={{
      position: 'absolute', left: ctr.x - cell / 2, top: ctr.y - cell / 2,
      width: cell, height: cell, zIndex: 2, alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Halo lumineux pulsant, contenu dans la case */}
      <Animated.View style={[{
        position: 'absolute', width: glowSize, height: glowSize, borderRadius: glowSize / 2,
        backgroundColor: info.main,
      }, glowStyle]} />
      {/* Anneau : bord sombre puis couleur (léger volume) */}
      <View style={{
        position: 'absolute', width: size, height: size, borderRadius: size / 2,
        backgroundColor: info.dark,
        shadowColor: '#081126', shadowOpacity: 0.35, shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 }, elevation: 3,
      }} />
      <View style={{
        position: 'absolute', width: size - 4, height: size - 4, borderRadius: (size - 4) / 2,
        backgroundColor: info.main, top: cell / 2 - (size - 4) / 2 - size * 0.02,
      }} />
      {/* Intérieur sombre avec profondeur (ombre intérieure simulée) */}
      <View style={{
        width: inner, height: inner, borderRadius: inner / 2,
        backgroundColor: '#081728', borderWidth: 2, borderColor: 'rgba(0,0,0,0.45)',
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}>
        <View style={{
          position: 'absolute', top: -inner * 0.18, width: inner * 0.92, height: inner * 0.62,
          borderRadius: inner / 2, backgroundColor: '#02060D',
        }} />
        <ColorSymbol colorId={hole.color} size={cell * 0.2} color={info.light} />
      </View>
    </View>
  );
});

// ─── Couche statique des cases (mémoïsée : jamais re-rendue pendant un
// glisser, elle ne dépend que du niveau, du thème et de la taille) ────────
const CellsLayer = React.memo(function CellsLayer({ level, theme, cell }: {
  level: LevelDef; theme: Theme; cell: number;
}) {
  return (
    <>
      {level.grid.map((row, r) =>
        row.map((v, c) =>
          v === 1 ? (
            <View key={`cell-${r}-${c}`} pointerEvents="none" style={{
              position: 'absolute', left: c * cell + 1.5, top: r * cell + 1.5,
              width: cell - 3, height: cell - 3, borderRadius: cell * 0.17,
              backgroundColor: (r + c) % 2 === 0 ? '#EAF4FF' : '#E1EFFF',
              borderWidth: 1,
              borderTopColor: 'rgba(255,255,255,0.95)',
              borderLeftColor: 'rgba(255,255,255,0.95)',
              borderBottomColor: 'rgba(94,140,190,0.30)',
              borderRightColor: 'rgba(94,140,190,0.30)',
              shadowColor: '#0A2540', shadowOpacity: 0.16, shadowRadius: 3,
              shadowOffset: { width: 0, height: 2 },
              overflow: 'hidden',
            }}>
              <View style={{
                position: 'absolute', top: 1, left: 3, right: 3, height: '36%',
                borderRadius: cell * 0.12, backgroundColor: 'rgba(255,255,255,0.35)',
              }} />
              <View style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: '22%',
                backgroundColor: 'rgba(110,165,220,0.10)',
              }} />
            </View>
          ) : null,
        ),
      )}
    </>
  );
});

// ─── Plateau complet ───────────────────────────────────────────────────────
export default function Board(props: BoardProps) {
  const { level, state, theme, skin, colorblind, boardWidth, hint, sinking } = props;
  const cell = boardWidth / level.cols;
  const boardHeight = cell * level.rows;

  const latestRef = useRef(state);
  useEffect(() => { latestRef.current = state; }, [state]);
  const propsRef = useRef(props);
  propsRef.current = props;
  const sinkDoneRef = useRef(props.onSinkDone);
  sinkDoneRef.current = props.onSinkDone;

  const [drag, setDrag] = useState<{ snakeId: string; end: End; x: number; y: number } | null>(null);
  const [trail, setTrail] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
  const [movingId, setMovingId] = useState<string | null>(null);
  const dragRef = useRef<{ snakeId: string; end: End } | null>(null);
  const dragPtRef = useRef<{ snakeId: string; end: End; x: number; y: number } | null>(null);
  const lastDragUiRef = useRef(0);
  const lastBlockedRef = useRef<{ key: string; at: number }>({ key: '', at: 0 });
  const trailId = useRef(0);
  const trailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Réglage système « réduire les animations » (secousse désactivée si oui).
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (alive) setReduceMotion(v); })
      .catch(() => { /* ignore */ });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduceMotion(v));
    return () => { alive = false; sub.remove(); };
  }, []);

  // Secousse ciblée : identifiant du serpent bloqué + compteur de déclenchements.
  const [blockedShake, setBlockedShake] = useState<{ snakeId: string; n: number }>({ snakeId: '', n: 0 });

  // ── Interpolation fluide PAR SERPENT (suivi avec décalage) ──
  // Seuls les serpents dont la cible change sont animés et re-rendus :
  // les autres conservent la même référence de points (React.memo) et le
  // Board ne fait aucun setState tant qu'aucune animation n'est active.
  const [visual, setVisual] = useState<Record<string, Pt[]>>(() => targetsFromState(state, cell, null));
  const visualRef = useRef(visual);
  type SnakeAnim = { from: Pt[]; to: Pt[]; start: number; duration: number; delays: number[] };
  const animsRef = useRef(new Map<string, SnakeAnim>());
  const rafIdRef = useRef(0);
  const sinkKeyRef = useRef<string | null>(null);
  const sinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rafOf = () => (globalThis as {
    requestAnimationFrame?: (cb: () => void) => number;
    cancelAnimationFrame?: (id: number) => void;
  });

  const runFrame = useCallback(() => {
    rafIdRef.current = 0;
    const anims = animsRef.current;
    if (!anims.size) return;
    const now = Date.now();
    const next: Record<string, Pt[]> = { ...visualRef.current };
    let anyActive = false;
    for (const [id, anim] of Array.from(anims.entries())) {
      const pts = anim.to.map((tp, i) => {
        const fp = anim.from[i] ?? tp;
        const raw = (now - anim.start - (anim.delays[i] ?? 0)) / anim.duration;
        return raw >= 1 ? tp : {
          x: lerp(fp.x, tp.x, easeOut(clamp01(raw))),
          y: lerp(fp.y, tp.y, easeOut(clamp01(raw))),
        };
      });
      next[id] = pts;
      const done = anim.to.every((_, i) => (now - anim.start - (anim.delays[i] ?? 0)) / anim.duration >= 1);
      if (done) anims.delete(id);
      else anyActive = true;
    }
    visualRef.current = next;
    setVisual(next);
    const raf = rafOf().requestAnimationFrame;
    if (anyActive && raf) rafIdRef.current = raf(runFrame);
  }, []);

  const animateTo = useCallback((
    to: Record<string, Pt[]>, duration: number, delays: Record<string, number[]>,
  ) => {
    const raf = rafOf().requestAnimationFrame;
    if (!raf) {
      visualRef.current = to;
      setVisual(to);
      return;
    }
    const now = Date.now();
    let snapped: Record<string, Pt[]> | null = null;
    for (const [id, toPts] of Object.entries(to)) {
      const cur = visualRef.current[id];
      if (!cur || cur.length !== toPts.length) {
        // Nouveau serpent / longueur différente : position immédiate.
        (snapped ??= { ...visualRef.current })[id] = toPts;
        animsRef.current.delete(id);
        continue;
      }
      const alreadyThere = toPts.every(
        (tp, i) => Math.abs(tp.x - cur[i].x) < 0.05 && Math.abs(tp.y - cur[i].y) < 0.05,
      );
      if (alreadyThere) {
        animsRef.current.delete(id);
        continue;
      }
      animsRef.current.set(id, { from: cur, to: toPts, start: now, duration, delays: delays[id] ?? [] });
    }
    if (snapped) {
      visualRef.current = snapped;
      setVisual(snapped);
    }
    if (animsRef.current.size && !rafIdRef.current) {
      rafIdRef.current = raf(runFrame);
    }
  }, [runFrame]);

  useEffect(() => () => {
    const g = rafOf();
    if (rafIdRef.current && g.cancelAnimationFrame) g.cancelAnimationFrame(rafIdRef.current);
    if (sinkTimeoutRef.current) clearTimeout(sinkTimeoutRef.current);
  }, []);

  // Recalcule les cibles à chaque changement d'état / de glisser / d'aspiration.
  useEffect(() => {
    if (sinking) {
      const key = `${sinking.snakeId}-${sinking.holeCell.r},${sinking.holeCell.c}`;
      if (sinkKeyRef.current !== key) {
        sinkKeyRef.current = key;
        const holePt = centerOf(sinking.holeCell, cell);
        const current = targetsFromState(state, cell, null);
        const to: Record<string, Pt[]> = { ...current };
        const snakePts = current[sinking.snakeId] ?? [];
        to[sinking.snakeId] = snakePts.map(() => holePt);
        const delays: Record<string, number[]> = {};
        delays[sinking.snakeId] = snakePts.map((_, i) => {
          const distFromEnd = sinking.end === 'head' ? i : snakePts.length - 1 - i;
          return distFromEnd * 55;
        });
        animateTo(to, 400, delays);
        if (sinkTimeoutRef.current) clearTimeout(sinkTimeoutRef.current);
        sinkTimeoutRef.current = setTimeout(() => sinkDoneRef.current(), 720);
      }
      return;
    }
    sinkKeyRef.current = null;
    const dragging = dragPtRef.current;
    const to = targetsFromState(state, cell, dragging);
    const delays: Record<string, number[]> = {};
    for (const snake of state.snakes) {
      if (snake.absorbed) continue;
      delays[snake.id] = snake.cells.map((_, i) => {
        if (dragging && dragging.snakeId === snake.id) {
          const distFromEnd = dragging.end === 'head' ? i : snake.cells.length - 1 - i;
          return distFromEnd * 11;
        }
        return i * 6;
      });
    }
    animateTo(to, dragging ? 95 : 160, delays);
  }, [state, drag, sinking, cell, animateTo]);

  // Retour négatif CIBLÉ : secousse de 2,5 px / 150 ms sur le seul serpent
  // bloqué (+ son d'erreur), au plus une fois par 450 ms et par serpent.
  // N'est appelé que lorsqu'un pas vers une case voisine a réellement été
  // refusé par le moteur (évaluation 'blocked' d'evaluateDragStep).
  const triggerBlocked = useCallback((snakeId: string) => {
    const now = Date.now();
    if (lastBlockedRef.current.key === snakeId && now - lastBlockedRef.current.at < 450) return;
    lastBlockedRef.current = { key: snakeId, at: now };
    setBlockedShake((prev) => ({ snakeId, n: prev.n + 1 }));
    propsRef.current.onBlockedFx();
  }, []);

  // ── Logique de glisser (exécutée sur le thread JS via runOnJS) ──
  const handleStart = useCallback((x: number, y: number) => {
    if (propsRef.current.sinking) return;
    const st = latestRef.current;
    let best: { snakeId: string; end: End; d: number } | null = null;
    for (const snake of st.snakes) {
      if (snake.absorbed) continue;
      const ends: [End, Cell][] = [
        ['head', snake.cells[0]],
        ['tail', snake.cells[snake.cells.length - 1]],
      ];
      for (const [end, pos] of ends) {
        const ctr = centerOf(pos, cell);
        const d = Math.hypot(ctr.x - x, ctr.y - y);
        if (!best || d < best.d) best = { snakeId: snake.id, end, d };
      }
    }
    if (best && best.d < cell * 0.85) {
      dragRef.current = { snakeId: best.snakeId, end: best.end };
      dragPtRef.current = { snakeId: best.snakeId, end: best.end, x, y };
      setDrag({ snakeId: best.snakeId, end: best.end, x, y });
    }
  }, [cell]);

  const handleMove = useCallback((x: number, y: number) => {
    const active = dragRef.current;
    if (!active || propsRef.current.sinking) return;
    dragPtRef.current = { snakeId: active.snakeId, end: active.end, x, y };
    // setDrag limité à ~60/s (la position exacte reste dans dragPtRef).
    const nowUi = Date.now();
    if (nowUi - lastDragUiRef.current >= 16) {
      lastDragUiRef.current = nowUi;
      setDrag({ snakeId: active.snakeId, end: active.end, x, y });
    }
    const finger = { r: Math.floor(y / cell), c: Math.floor(x / cell) };
    const lvl = propsRef.current.level;
    // Avance STRICTEMENT case par case vers le doigt : chaque pas est
    // évalué par engine.evaluateDragStep (fonction partagée avec les
    // tests) puis validé par le moteur via attemptMove. Au premier pas
    // interdit, on s'arrête : le serpent reste bloqué là, même si le
    // doigt continue plus loin.
    for (let step = 0; step < 6; step++) {
      const st = latestRef.current;
      const snake = st.snakes.find((s) => s.id === active.snakeId);
      if (!snake || snake.absorbed) { dragRef.current = null; dragPtRef.current = null; return; }
      const ev = evaluateDragStep(lvl, st, active.snakeId, active.end, finger);
      if (ev.kind === 'arrived' || ev.kind === 'no-step') {
        // Doigt encore sur la case du serpent, ou aucun pas rapprochant :
        // aucun pas demandé → aucune secousse, aucun son d'erreur.
        break;
      }
      if (ev.kind === 'blocked') {
        // Pas vers une case voisine réellement refusé (occupée, hors
        // grille, zone vide, mauvais trou) : retour ciblé sur ce serpent.
        triggerBlocked(active.snakeId);
        break;
      }
      const res = propsRef.current.attemptMove(ev.move.snakeId, ev.move.end, ev.move.target);
      if (res.status === 'moved') {
        latestRef.current = res.state;
        propsRef.current.onStep();
        setMovingId(active.snakeId);
        if (movingTimer.current) clearTimeout(movingTimer.current);
        movingTimer.current = setTimeout(() => setMovingId(null), 240);
        const ctr = centerOf(ev.move.target, cell);
        const info = COLORS[snake.color];
        setTrail((prev) => [...prev.slice(-5), { id: ++trailId.current, x: ctr.x, y: ctr.y, color: info.main }]);
        if (trailTimer.current) clearTimeout(trailTimer.current);
        trailTimer.current = setTimeout(() => setTrail([]), 650);
        continue;
      }
      if (res.status === 'absorbed') {
        dragRef.current = null;
        dragPtRef.current = null;
        setDrag(null);
        return;
      }
      // Le moteur a refusé le pas proposé : on s'arrête immédiatement.
      triggerBlocked(active.snakeId);
      break;
    }
  }, [cell, triggerBlocked]);

  const handleEnd = useCallback(() => {
    dragRef.current = null;
    dragPtRef.current = null;
    setDrag(null);
  }, []);

  const handlersRef = useRef({ handleStart, handleMove, handleEnd });
  handlersRef.current = { handleStart, handleMove, handleEnd };
  const stableStart = useCallback((x: number, y: number) => handlersRef.current.handleStart(x, y), []);
  const stableMove = useCallback((x: number, y: number) => handlersRef.current.handleMove(x, y), []);
  const stableEnd = useCallback(() => handlersRef.current.handleEnd(), []);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onStart((e) => { 'worklet'; runOnJS(stableStart)(e.x, e.y); })
        .onUpdate((e) => { 'worklet'; runOnJS(stableMove)(e.x, e.y); })
        .onEnd(() => { 'worklet'; runOnJS(stableEnd)(); })
        .onFinalize(() => { 'worklet'; runOnJS(stableEnd)(); }),
    [stableStart, stableMove, stableEnd],
  );

  // Regard des têtes : vers le doigt pendant le glisser, sinon droit devant.
  // (objet constant au repos pour ne pas invalider React.memo des serpents)
  const lookFor = (snake: SnakeState) => {
    if (drag && drag.snakeId === snake.id && snake.cells.length) {
      const head = centerOf(snake.cells[0], cell);
      const dx = drag.x - head.x, dy = drag.y - head.y;
      const m = Math.max(1, Math.hypot(dx, dy));
      return { dx: dx / m, dy: dy / m };
    }
    return IDLE_LOOK;
  };

  const hintColor = hint ? COLORS[state.snakes.find((s) => s.id === hint.snakeId)?.color ?? 'corail'] : null;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        testID="game-board"
        style={{
          width: boardWidth, height: boardHeight, alignSelf: 'center',
          // Page web mobile : aucun geste navigateur pendant le glisser.
          touchAction: 'none', userSelect: 'none',
        } as object}
      >
        {/* Cadre sombre du plateau (contenu dans la largeur du plateau) */}
        <View pointerEvents="none" style={{
          position: 'absolute', left: 0, top: 0,
          right: 0, bottom: 0, borderRadius: cell * 0.3,
          backgroundColor: theme.isDark ? 'rgba(5,10,26,0.55)' : 'rgba(18,38,66,0.20)',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
          shadowColor: '#020617', shadowOpacity: 0.45, shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
        }} />

        {/* Cases bleu très clair, biseautées (couche mémoïsée) */}
        <CellsLayer level={level} theme={theme} cell={cell} />

        {/* Trous */}
        {state.trous.map((hole) => {
          const snake = state.snakes.find(
            (s) => !s.absorbed && s.color === hole.color &&
              Math.min(
                Math.abs(s.cells[0].r - hole.cell.r) + Math.abs(s.cells[0].c - hole.cell.c),
                Math.abs(s.cells[s.cells.length - 1].r - hole.cell.r) +
                  Math.abs(s.cells[s.cells.length - 1].c - hole.cell.c),
              ) <= 2,
          );
          return (
            <HoleView key={hole.id} hole={hole} cell={cell} near={!!snake && !hole.filled} />
          );
        })}

        {/* Traînée lumineuse du glisser */}
        {trail.map((p, i) => (
          <View key={p.id} pointerEvents="none" style={{
            position: 'absolute', left: p.x - cell * 0.16, top: p.y - cell * 0.16,
            width: cell * 0.32, height: cell * 0.32, borderRadius: cell * 0.16,
            backgroundColor: p.color, opacity: 0.10 + (i / Math.max(1, trail.length)) * 0.26, zIndex: 3,
          }} />
        ))}

        {/* Indice */}
        {hint && hintColor && (
          <>
            <View pointerEvents="none" style={{
              position: 'absolute', left: hint.target.c * cell + 2, top: hint.target.r * cell + 2,
              width: cell - 4, height: cell - 4, borderRadius: cell * 0.22,
              borderWidth: 3, borderColor: hintColor.main, backgroundColor: `${hintColor.main}33`, zIndex: 4,
            }} />
            <View pointerEvents="none" style={{
              position: 'absolute',
              left: hint.from.c * cell + cell * 0.08, top: hint.from.r * cell + cell * 0.08,
              width: cell * 0.84, height: cell * 0.84, borderRadius: cell * 0.42,
              borderWidth: 3, borderColor: '#FFF', zIndex: 8,
            }} />
          </>
        )}

        {/* Serpents en tube lisse */}
        {state.snakes.filter((s) => !s.absorbed).map((snake) => (
          <SnakeTube
            key={snake.id}
            snake={snake}
            points={visual[snake.id] ?? snake.cells.map((c) => centerOf(c, cell))}
            cell={cell}
            boardWidth={boardWidth}
            boardHeight={boardHeight}
            skin={skin}
            colorblind={colorblind}
            look={lookFor(snake)}
            moving={movingId === snake.id || drag?.snakeId === snake.id}
            sinkingSnake={sinking?.snakeId === snake.id}
            shakeSignal={blockedShake.snakeId === snake.id ? blockedShake.n : 0}
            reduceMotion={reduceMotion}
          />
        ))}
      </Animated.View>
    </GestureDetector>
  );
}
