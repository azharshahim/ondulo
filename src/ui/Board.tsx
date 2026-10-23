// ─── Plateau de jeu ────────────────────────────────────────────────────────
// Rendu « 3D doux » : cases en verre dépoli, serpents en dégradés avec yeux
// animés (clignement + regard qui suit le doigt), respiration au repos,
// traînée lumineuse pendant le glisser, anneau de trou qui pulse à
// l'approche du bon serpent, aspiration animée dans le trou, secousse
// douce quand un mouvement est impossible.
// Le glisser utilise react-native-gesture-handler ; chaque franchissement
// de case remonte au moteur (engine.tryMove) via `attemptMove`.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-worklets';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import type {
  Cell, End, GameState, HoleState, LevelDef, MoveResult, SnakeState,
} from '../game/types';
import { COLORS } from '../game/colors';
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

const RAINBOW = ['#FF5964', '#FF8C42', '#FFC93C', '#8BD450', '#3FA7FF', '#9B5DE5'];

const centerOf = (cellPos: Cell, cell: number) => ({
  x: (cellPos.c + 0.5) * cell,
  y: (cellPos.r + 0.5) * cell,
});

// ─── Yeux : clignent et regardent vers le doigt ────────────────────────────
function Eyes({ cell, look }: { cell: number; look: { dx: number; dy: number } }) {
  const blink = useSharedValue(1);
  useEffect(() => {
    blink.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2400 + Math.random() * 1600 }),
        withTiming(0.08, { duration: 70 }),
        withTiming(1, { duration: 130 }),
      ),
      -1, false,
    );
  }, [blink]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));
  const eye = cell * 0.17;
  const pupil = cell * 0.085;
  const off = cell * 0.05;
  return (
    <Animated.View style={[{ flexDirection: 'row', gap: cell * 0.07 }, style]}>
      {[0, 1].map((i) => (
        <View key={i} style={{
          width: eye, height: eye, borderRadius: eye / 2, backgroundColor: '#FFF',
          alignItems: 'center', justifyContent: 'center',
          transform: [{ translateX: look.dx * off }, { translateY: look.dy * off }],
        }}>
          <View style={{ width: pupil, height: pupil, borderRadius: pupil / 2, backgroundColor: '#182238' }} />
        </View>
      ))}
    </Animated.View>
  );
}

// ─── Un segment de serpent ─────────────────────────────────────────────────
function Segment({
  snake, index, cell, skin, colorblind, theme, isDraggedEnd, dragPos, look,
  sinkTarget, sinkOrder, sinkProgress,
}: {
  snake: SnakeState; index: number; cell: number; skin: SkinId; colorblind: boolean;
  theme: Theme; isDraggedEnd: boolean; dragPos: { x: number; y: number } | null;
  look: { dx: number; dy: number };
  sinkTarget: { x: number; y: number } | null; sinkOrder: number; sinkProgress: SharedValue<number>;
}) {
  const info = COLORS[snake.color];
  const pos = snake.cells[index];
  const ctr = centerOf(pos, cell);
  const size = cell * 0.94;
  const breath = useSharedValue(1);
  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1.045, { duration: 1150 + index * 130, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
  }, [breath, index]);

  const animated = useAnimatedStyle(() => {
    let tx = 0, ty = 0, sinkScale = 1;
    if (sinkTarget) {
      const len = Math.max(1, snake.cells.length);
      const t = Math.min(1, Math.max(0, sinkProgress.value * (1 + 0.13 * (len - 1)) - sinkOrder * 0.13));
      tx = (sinkTarget.x - ctr.x) * t;
      ty = (sinkTarget.y - ctr.y) * t;
      sinkScale = 1 - 0.88 * t;
    }
    return {
      transform: [
        { translateX: tx }, { translateY: ty },
        { scale: breath.value * sinkScale },
      ],
      opacity: sinkTarget ? 1 - 0.25 * Math.min(1, sinkProgress.value * 1.4 - sinkOrder * 0.13) : 1,
    };
  });

  const left = (isDraggedEnd && dragPos ? dragPos.x : ctr.x) - size / 2;
  const top = (isDraggedEnd && dragPos ? dragPos.y : ctr.y) - size / 2;
  const isHead = index === 0;
  const isTail = index === snake.cells.length - 1;

  const gradientColors: [string, string, ...string[]] =
    skin === 'arcenciel'
      ? [RAINBOW[index % RAINBOW.length], RAINBOW[(index + 2) % RAINBOW.length]]
      : skin === 'degrade'
        ? [info.light, info.main, info.dark]
        : [info.light, info.main];

  // Direction de la queue (petite flèche) : du segment précédent vers la queue.
  let arrowRotate = '0deg';
  if (isTail && snake.cells.length > 1) {
    const prev = snake.cells[index - 1];
    const dr = pos.r - prev.r, dc = pos.c - prev.c;
    arrowRotate = dr === -1 ? '0deg' : dc === 1 ? '90deg' : dr === 1 ? '180deg' : '270deg';
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute', left, top, width: size, height: size,
          borderRadius: size * (isHead ? 0.46 : 0.34),
          shadowColor: info.dark, shadowOpacity: theme.id === 'neon' ? 0.85 : 0.45,
          shadowRadius: theme.id === 'neon' ? 10 : 5, shadowOffset: { width: 0, height: 3 },
          elevation: 5, zIndex: isHead ? 6 : 5 - Math.min(index, 3),
        },
        animated,
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{
          flex: 1, borderRadius: size * (isHead ? 0.46 : 0.34), overflow: 'hidden',
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
        }}
      >
        {/* Reflet doux en haut du segment (effet volume) */}
        <View style={{
          position: 'absolute', top: size * 0.07, left: size * 0.14, right: size * 0.14,
          height: size * 0.3, borderRadius: size * 0.2, backgroundColor: 'rgba(255,255,255,0.28)',
        }} />
        {skin === 'rayures' && [0.22, 0.5, 0.78].map((f) => (
          <View key={f} style={{
            position: 'absolute', left: -size * 0.2, right: -size * 0.2, top: size * f,
            height: size * 0.13, backgroundColor: 'rgba(255,255,255,0.30)',
            transform: [{ rotate: '24deg' }],
          }} />
        ))}
        {skin === 'pois' && [0.28, 0.62].map((fx, i) => (
          <View key={i} style={{
            position: 'absolute', left: size * fx, top: size * (i === 0 ? 0.3 : 0.58),
            width: size * 0.17, height: size * 0.17, borderRadius: size * 0.09,
            backgroundColor: 'rgba(255,255,255,0.4)',
          }} />
        ))}
        {isHead ? (
          <Eyes cell={cell} look={look} />
        ) : colorblind ? (
          <Text style={{
            color: '#FFF', fontWeight: '900', fontSize: cell * 0.3,
            textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 },
          }}>
            {info.symbol}
          </Text>
        ) : null}
        {isTail && !isHead && (
          <View style={{
            width: 0, height: 0, backgroundColor: 'transparent',
            borderLeftWidth: size * 0.13, borderRightWidth: size * 0.13, borderBottomWidth: size * 0.2,
            borderLeftColor: 'transparent', borderRightColor: 'transparent',
            borderBottomColor: 'rgba(255,255,255,0.9)',
            transform: [{ rotate: arrowRotate }],
          }} />
        )}
      </LinearGradient>
    </Animated.View>
  );
}

// ─── Un trou ───────────────────────────────────────────────────────────────
function HoleView({ hole, cell, theme, colorblind, near }: {
  hole: HoleState; cell: number; theme: Theme; colorblind: boolean; near: boolean;
}) {
  const info = COLORS[hole.color];
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(near ? 1.45 : 1.18, { duration: near ? 380 : 950, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
  }, [near, pulse]);
  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: near ? 0.75 : 0.4,
  }));
  const ctr = centerOf(hole.cell, cell);
  const size = cell * 0.8;
  if (hole.filled) {
    return (
      <View pointerEvents="none" style={{
        position: 'absolute', left: ctr.x - size / 2, top: ctr.y - size / 2,
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: theme.holeInner, borderWidth: 2, borderColor: info.dark,
        alignItems: 'center', justifyContent: 'center', opacity: 0.75, zIndex: 2,
      }}>
        <Text style={{ color: info.light, fontSize: cell * 0.32, fontWeight: '900' }}>✓</Text>
      </View>
    );
  }
  return (
    <View pointerEvents="none" style={{
      position: 'absolute', left: ctr.x - size / 2, top: ctr.y - size / 2,
      width: size, height: size, zIndex: 2, alignItems: 'center', justifyContent: 'center',
    }}>
      <Animated.View style={[{
        position: 'absolute', width: size, height: size, borderRadius: size / 2,
        backgroundColor: info.main,
      }, glowStyle]} />
      <View style={{
        width: size * 0.82, height: size * 0.82, borderRadius: size * 0.41,
        backgroundColor: theme.holeInner, borderWidth: 3, borderColor: info.main,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <View style={{
          width: size * 0.4, height: size * 0.4, borderRadius: size * 0.2,
          backgroundColor: '#000', opacity: 0.85,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: info.light, fontSize: cell * 0.2, fontWeight: '900' }}>{info.symbol}</Text>
        </View>
      </View>
    </View>
  );
}

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
  const dragRef = useRef<{ snakeId: string; end: End } | null>(null);
  const lastBlockedRef = useRef<{ key: string; at: number }>({ key: '', at: 0 });
  const trailId = useRef(0);
  const trailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
  const sinkProgress = useSharedValue(0);

  // Animation d'aspiration quand un serpent rentre dans son trou.
  useEffect(() => {
    if (sinking) {
      sinkProgress.value = 0;
      sinkProgress.value = withTiming(1, { duration: 620, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) runOnJS(() => sinkDoneRef.current())();
      });
    } else {
      sinkProgress.value = 0;
    }
  }, [sinking, sinkProgress]);

  const triggerBlocked = useCallback((key: string) => {
    const now = Date.now();
    if (lastBlockedRef.current.key === key && now - lastBlockedRef.current.at < 450) return;
    lastBlockedRef.current = { key, at: now };
    shakeX.value = withSequence(
      withTiming(-7, { duration: 55 }), withTiming(7, { duration: 55 }),
      withTiming(-4, { duration: 45 }), withTiming(0, { duration: 45 }),
    );
    propsRef.current.onBlockedFx();
  }, [shakeX]);

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
      setDrag({ snakeId: best.snakeId, end: best.end, x, y });
    }
  }, [cell]);

  const handleMove = useCallback((x: number, y: number) => {
    const active = dragRef.current;
    if (!active || propsRef.current.sinking) return;
    setDrag({ snakeId: active.snakeId, end: active.end, x, y });
    const finger = { r: Math.floor(y / cell), c: Math.floor(x / cell) };
    // Avance case par case vers le doigt (jusqu'à 4 cases par événement).
    for (let step = 0; step < 4; step++) {
      const st = latestRef.current;
      const snake = st.snakes.find((s) => s.id === active.snakeId);
      if (!snake || snake.absorbed) { dragRef.current = null; return; }
      const endCell = active.end === 'head' ? snake.cells[0] : snake.cells[snake.cells.length - 1];
      if (endCell.r === finger.r && endCell.c === finger.c) break;
      const dr = finger.r - endCell.r;
      const dc = finger.c - endCell.c;
      const attempts: Cell[] = [];
      if (Math.abs(dr) >= Math.abs(dc) && dr !== 0) attempts.push({ r: endCell.r + Math.sign(dr), c: endCell.c });
      if (dc !== 0) attempts.push({ r: endCell.r, c: endCell.c + Math.sign(dc) });
      if (dr !== 0 && attempts[0]?.c === endCell.c && Math.abs(dc) > Math.abs(dr)) {
        // priorité à l'axe dominant : réordonne si besoin
        attempts.reverse();
      }
      let progressed = false;
      for (const target of attempts) {
        const res = propsRef.current.attemptMove(active.snakeId, active.end, target);
        if (res.status === 'moved') {
          latestRef.current = res.state;
          propsRef.current.onStep();
          const ctr = centerOf(target, cell);
          const info = COLORS[snake.color];
          setTrail((prev) => [...prev.slice(-7), { id: ++trailId.current, x: ctr.x, y: ctr.y, color: info.main }]);
          if (trailTimer.current) clearTimeout(trailTimer.current);
          trailTimer.current = setTimeout(() => setTrail([]), 650);
          progressed = true;
          break;
        }
        if (res.status === 'absorbed') {
          dragRef.current = null;
          setDrag(null);
          return;
        }
      }
      if (!progressed) {
        const t = attempts[0];
        if (t) triggerBlocked(`${active.snakeId}-${active.end}-${t.r},${t.c}`);
        break;
      }
    }
  }, [cell, triggerBlocked]);

  const handleEnd = useCallback(() => {
    dragRef.current = null;
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
  const lookFor = (snake: SnakeState) => {
    if (drag && drag.snakeId === snake.id && snake.cells.length) {
      const head = centerOf(snake.cells[0], cell);
      const dx = drag.x - head.x, dy = drag.y - head.y;
      const m = Math.max(1, Math.hypot(dx, dy));
      return { dx: dx / m, dy: dy / m };
    }
    return { dx: 0, dy: 0.3 };
  };

  const hintColor = hint ? COLORS[state.snakes.find((s) => s.id === hint.snakeId)?.color ?? 'corail'] : null;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width: boardWidth, height: boardHeight, alignSelf: 'center' }, shakeStyle]}>
        {/* Cases jouables (verre dépoli) */}
        {level.grid.map((row, r) =>
          row.map((v, c) =>
            v === 1 ? (
              <View key={`cell-${r}-${c}`} pointerEvents="none" style={{
                position: 'absolute', left: c * cell + 1.5, top: r * cell + 1.5,
                width: cell - 3, height: cell - 3, borderRadius: cell * 0.2,
                backgroundColor: theme.cell, borderWidth: 1, borderColor: theme.cellBorder,
                shadowColor: '#000', shadowOpacity: theme.isDark ? 0.25 : 0.08,
                shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
              }} />
            ) : null,
          ),
        )}

        {/* Trous (anneau lumineux, pulse renforcé si le bon serpent approche) */}
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
            <HoleView key={hole.id} hole={hole} cell={cell} theme={theme}
              colorblind={colorblind} near={!!snake && !hole.filled} />
          );
        })}

        {/* Traînée lumineuse du glisser */}
        {trail.map((p, i) => (
          <View key={p.id} pointerEvents="none" style={{
            position: 'absolute', left: p.x - cell * 0.16, top: p.y - cell * 0.16,
            width: cell * 0.32, height: cell * 0.32, borderRadius: cell * 0.16,
            backgroundColor: p.color, opacity: 0.12 + (i / trail.length) * 0.3, zIndex: 3,
          }} />
        ))}

        {/* Indice : case cible pulsante + extrémité à saisir entourée */}
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
              borderWidth: 3, borderColor: '#FFF', zIndex: 7,
            }} />
          </>
        )}

        {/* Serpents (queue rendue d'abord, tête au-dessus) */}
        {state.snakes.filter((s) => !s.absorbed).map((snake) => {
          const isSinking = sinking?.snakeId === snake.id;
          const sinkTarget = isSinking ? centerOf(sinking.holeCell, cell) : null;
          return (
            <View key={snake.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
              {snake.cells.map((_, i) => {
                const index = snake.cells.length - 1 - i; // ordre de rendu inverse
                const segmentCell = snake.cells[index];
                void segmentCell;
                const isDraggedEnd = !!drag && drag.snakeId === snake.id &&
                  ((drag.end === 'head' && index === 0) || (drag.end === 'tail' && index === snake.cells.length - 1));
                const sinkOrder = !isSinking ? 0
                  : sinking.end === 'head' ? index : snake.cells.length - 1 - index;
                return (
                  <Segment
                    key={index}
                    snake={snake}
                    index={index}
                    cell={cell}
                    skin={skin}
                    colorblind={colorblind}
                    theme={theme}
                    isDraggedEnd={isDraggedEnd}
                    dragPos={isDraggedEnd && drag ? { x: drag.x, y: drag.y } : null}
                    look={lookFor(snake)}
                    sinkTarget={sinkTarget}
                    sinkOrder={sinkOrder}
                    sinkProgress={sinkProgress}
                  />
                );
              })}
            </View>
          );
        })}
      </Animated.View>
    </GestureDetector>
  );
}
