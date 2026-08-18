import type { GameDefinition } from './types';
import type { PlayerState } from './state';

export function checkWin(def: GameDefinition, player: PlayerState): boolean {
  const { winCondition, board } = def;
  switch (winCondition.type) {
    case 'reachSpace': {
      const targetIndex = board.path.indexOf(winCondition.spaceId ?? -1);
      return targetIndex !== -1 && player.position >= targetIndex;
    }
    case 'collectResource': {
      const { resource, amount } = winCondition;
      if (!resource || amount === undefined) return false;
      return (player.resources[resource] ?? 0) >= amount;
    }
    case 'deckExhausted':
      // handled in reducer when log length hits a threshold
      return false;
    default:
      return false;
  }
}

export function spaceIndexForPath(def: GameDefinition, pathIndex: number): number {
  return def.board.path[Math.min(pathIndex, def.board.path.length - 1)] ?? 0;
}

export function lastPathIndex(def: GameDefinition): number {
  return def.board.path.length - 1;
}
