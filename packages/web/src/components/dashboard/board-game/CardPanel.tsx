'use client';

import type { GameDefinition } from '@/lib/board-game/types';
import type { TurnPhase } from '@/lib/board-game/state';
import { Button } from '@/components/ui/button';

interface Props {
  def: GameDefinition;
  drawnCardId: string | null;
  phase: TurnPhase;
  onDraw: () => void;
  onConfirm: () => void;
}

export function CardPanel({ def, drawnCardId, phase, onDraw, onConfirm }: Props) {
  const card = drawnCardId ? def.cards.find((c) => c.id === drawnCardId) : null;

  return (
    <div className="flex min-h-[140px] flex-col gap-3 rounded-lg border border-border bg-card p-4">
      {card ? (
        <>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold">{card.title}</h3>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {card.effect.kind}
            </span>
          </div>
          <p className="text-sm text-foreground">{card.text}</p>
          {card.flavour && (
            <p className="border-l-2 border-muted pl-3 text-xs italic text-muted-foreground">
              {card.flavour}
            </p>
          )}
          {phase === 'RESOLVE' && (
            <Button size="sm" onClick={onConfirm}>
              Confirm
            </Button>
          )}
        </>
      ) : phase === 'DRAW' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-sm text-muted-foreground">You landed on a card space.</p>
          <Button size="sm" onClick={onDraw}>
            Draw Card
          </Button>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-xs text-muted-foreground">No card drawn yet.</p>
        </div>
      )}
    </div>
  );
}
