// ─── Contraste WCAG 2.1 des textes principaux (npm run test:contrast) ───────
// Mesure les ratios de contraste réels en composant les couleurs translucides
// sur le pire arrêt du dégradé de fond (les textes peuvent se trouver sur
// n'importe quel point du dégradé), en mode Jour et en mode Nuit.
// Seuil normal : 4,5:1 (WCAG AA, texte courant) ; grand texte : 3:1.
import { THEMES, type Theme } from '../src/ui/theme';

type RGBA = { r: number; g: number; b: number; a: number };

function parse(color: string): RGBA {
  const c = color.trim();
  if (c.startsWith('#')) {
    const hex = c.slice(1);
    const full = hex.length === 3 ? hex.split('').map((x) => x + x).join('') : hex;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: 1,
    };
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`couleur illisible : ${c}`);
  const [r, g, b, a = '1'] = m[1].split(',').map((v) => v.trim());
  return { r: Number(r), g: Number(g), b: Number(b), a: Number(a) };
}

/** Composition source-over de `fg` (éventuellement translucide) sur `bg`. */
function over(fg: RGBA, bg: RGBA): RGBA {
  const a = fg.a + bg.a * (1 - fg.a);
  const mix = (f: number, b: number) => (f * fg.a + b * bg.a * (1 - fg.a)) / (a || 1);
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a };
}

function luminance({ r, g, b }: RGBA): number {
  const chan = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

function ratio(fg: RGBA, bg: RGBA): number {
  const l1 = luminance(over(fg, bg));
  const l2 = luminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Ratio le plus défavorable sur les trois arrêts du dégradé. */
function worstOnGradient(fg: RGBA, theme: Theme): number {
  return Math.min(...theme.bgGradient.map((stop) => ratio(fg, parse(stop))));
}

/** Ratio d'un texte posé sur un panneau translucide, lui-même sur le dégradé. */
function worstOnPanel(fg: RGBA, panel: string, theme: Theme): number {
  const p = parse(panel);
  return Math.min(...theme.bgGradient.map((stop) => ratio(fg, over(p, parse(stop)))));
}

const THEMES_TO_CHECK: { id: 'jour' | 'nuit' | 'clair' | 'sombre' | 'neon'; label: string }[] = [
  { id: 'jour', label: 'Jour' },
  { id: 'nuit', label: 'Nuit' },
  { id: 'clair', label: 'Clair (palette secondaire)' },
  { id: 'sombre', label: 'Sombre (palette secondaire)' },
  { id: 'neon', label: 'Néon (palette secondaire)' },
];

interface Pair { name: string; ratio: number; min: number; }

function measure(theme: Theme): Pair[] {
  const text = parse(theme.text);
  const subtext = parse(theme.subtext);
  const pairs: Pair[] = [
    { name: 'Titre / texte principal sur fond', ratio: worstOnGradient(text, theme), min: 4.5 },
    { name: 'Texte secondaire sur fond', ratio: worstOnGradient(subtext, theme), min: 4.5 },
    { name: 'Texte principal sur panneau', ratio: worstOnPanel(text, theme.panel, theme), min: 4.5 },
    { name: 'Texte secondaire sur panneau', ratio: worstOnPanel(subtext, theme.panel, theme), min: 4.5 },
    { name: 'Bouton principal : blanc sur accent', ratio: Math.min(
      ratio(parse('#FFFFFF'), parse(theme.accent)),
      ratio(parse('#FFFFFF'), parse(theme.accent2)),
    ), min: 4.5 },
    { name: 'Bouton principal : texte blanc sur accent2', ratio: ratio(parse(theme.buttonText), parse(theme.accent2)), min: 4.5 },
    { name: 'Accent de texte sur fond', ratio: worstOnGradient(parse(theme.accentText), theme), min: 4.5 },
    { name: 'Accent de texte sur panneau', ratio: worstOnPanel(parse(theme.accentText), theme.panel, theme), min: 4.5 },
    { name: 'Message d’erreur sur fond', ratio: worstOnGradient(parse(theme.error), theme), min: 4.5 },
    // Sous-titre du bouton principal (HomeScreen « Niveau 1 ») : blanc opaque
    // depuis la correction (le blanc à 85 % ne donnait que 3,95:1).
    { name: 'Sous-titre de bouton : blanc sur accent', ratio: Math.min(
      ratio(parse('#FFFFFF'), parse(theme.accent)),
      ratio(parse('#FFFFFF'), parse(theme.accent2)),
    ), min: 4.5 },
  ];
  return pairs;
}

let failures = 0;
for (const { id, label } of THEMES_TO_CHECK) {
  const theme = THEMES[id];
  console.log(`── ${label} ──`);
  for (const p of measure(theme)) {
    const ok = p.ratio >= p.min;
    if (!ok) failures++;
    console.log(`  ${ok ? '✓' : '✗'} ${p.ratio.toFixed(2)}:1  (min ${p.min})  ${p.name}`);
  }
}

console.log(failures
  ? `\n❌ ${failures} paire(s) sous le seuil WCAG AA.`
  : '\n✅ Tous les textes principaux atteignent au moins 4,5:1 (AA) sur les 5 palettes (jour, nuit, clair, sombre, néon).');
process.exit(failures ? 1 : 0);
