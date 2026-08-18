import type { GameDefinition } from './types';

export type TurnPhase = 'ROLL' | 'MOVE' | 'RESOLVE' | 'DRAW' | 'END_TURN' | 'GAME_OVER';

export interface PlayerState {
  id: number;
  name: string;
  color: string;
  position: number; // index into def.board.path
  resources: Record<string, number>;
  skipsRemaining: number;
}

export interface GameState {
  definitionId: string;
  phase: TurnPhase;
  players: PlayerState[];
  currentPlayerIndex: number;
  lastRoll: number[];
  drawnCard: string | null; // card id
  winner: number | null; // player id
  turnCount: number;
  log: string[];
}

const PLAYER_COLORS = ['#e63946', '#2a9d8f', '#e9c46a', '#a8dadc'];

export function createInitialState(def: GameDefinition, playerNames: string[]): GameState {
  return {
    definitionId: def.id,
    phase: 'ROLL',
    players: playerNames.map((name, i) => ({
      id: i,
      name,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length] ?? '#888',
      position: 0,
      resources: Object.fromEntries((def.resources ?? []).map((r) => [r, 0])),
      skipsRemaining: 0,
    })),
    currentPlayerIndex: 0,
    lastRoll: [],
    drawnCard: null,
    winner: null,
    turnCount: 0,
    log: [`Game started: ${def.title}`],
  };
}
