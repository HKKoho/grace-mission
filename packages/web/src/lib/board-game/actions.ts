export type GameAction =
  | { type: 'ROLL_DICE' }
  | { type: 'DRAW_CARD' }
  | { type: 'CONFIRM_CARD' }
  | { type: 'END_TURN' };
