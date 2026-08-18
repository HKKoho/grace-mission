// GameDefinition — the schema an agent authors as a JSON file.
// The engine never encodes game-specific logic; it interprets this data.

export type SpaceType = 'start' | 'finish' | 'event' | 'challenge' | 'blessing' | 'safe';

export interface BoardSpace {
  id: number;
  label: string;
  type: SpaceType;
  /** References a card id in the cards array */
  cardId?: string;
  x?: number; // 0–100 percentage coords for SVG placement
  y?: number;
}

export type EffectKind = 'resource' | 'move' | 'draw' | 'skip' | 'none';

export interface CardEffect {
  kind: EffectKind;
  resource?: string;
  delta?: number;
  spaces?: number; // positive = forward, negative = back
}

export interface GameCard {
  id: string;
  title: string;
  text: string;
  flavour?: string;
  effect: CardEffect;
}

export type WinConditionType = 'reachSpace' | 'collectResource' | 'deckExhausted';

export interface WinCondition {
  type: WinConditionType;
  spaceId?: number;
  resource?: string;
  amount?: number;
}

export interface GameDefinition {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  minPlayers: number;
  maxPlayers: number;
  dice: { count: number; sides: number };
  board: {
    spaces: GameCard extends never ? never : BoardSpace[];
    /** Ordered list of space ids forming the path */
    path: number[];
  };
  cards: GameCard[];
  resources?: string[];
  winCondition: WinCondition;
}
