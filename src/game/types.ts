// ─── Types fondamentaux du jeu ─────────────────────────────────────────────
// Un niveau est décrit en JSON : grille (0 = vide / zone noire, 1 = case),
// serpents (couleur + cases ordonnées tête → queue), trous (couleur + case).

export type ColorId =
  | 'corail'
  | 'soleil'
  | 'lime'
  | 'azur'
  | 'violet'
  | 'rose'
  | 'orange'
  | 'marron';

export interface Cell {
  r: number; // ligne
  c: number; // colonne
}

export type End = 'head' | 'tail';

export interface SnakeDef {
  id: string;
  color: ColorId;
  /** Cases ordonnées de la tête (index 0) vers la queue (dernier index). */
  cells: Cell[];
}

export interface HoleDef {
  id: string;
  color: ColorId;
  cell: Cell;
}

export interface LevelDef {
  id: number | string;
  titleFr: string;
  titleEn: string;
  rows: number;
  cols: number;
  /** grid[r][c] : 0 = zone noire (interdite), 1 = case jouable. */
  grid: number[][];
  snakes: SnakeDef[];
  trous: HoleDef[];
  /** Nombre de coups optimal calculé par le solveur (ou borne garantie par le générateur). */
  optimal: number;
  /** Vrai si l'optimal a été prouvé par le solveur BFS/A*. */
  solverValidated: boolean;
  /** Solution connue (générateur) : utile pour la validation, pas affichée au joueur. */
  solution?: Move[];
  daily?: boolean;
}

export interface SnakeState {
  id: string;
  color: ColorId;
  cells: Cell[]; // vide si le serpent est rentré dans son trou
  absorbed: boolean;
}

export interface HoleState extends HoleDef {
  filled: boolean;
}

export interface GameState {
  snakes: SnakeState[];
  trous: HoleState[];
  moves: number;
}

export interface Move {
  snakeId: string;
  end: End;
  /** Case cible de l'extrémité saisie. */
  target: Cell;
}

export type BlockReason =
  | 'hors-grille'
  | 'case-vide' // zone noire du décor
  | 'trou-autre-couleur'
  | 'occupe'
  | 'non-adjacent'
  | 'deja-rentre'
  | 'inconnu';

export type MoveResult =
  | { status: 'moved'; state: GameState; move: Move }
  | { status: 'absorbed'; state: GameState; move: Move; holeId: string }
  | { status: 'blocked'; reason: BlockReason };
