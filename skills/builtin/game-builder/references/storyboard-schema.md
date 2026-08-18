# Storyboard schema

Adapted from `/reference/Games/storyboard-agent.ts`. Write the storyboard as a single markdown file at `/workspace/games/<slug>/storyboard.md` with this YAML frontmatter, followed by the sections below as markdown body. There is no code to run here — this document is the entire artifact of Phase 1, and the human reviewer reads it directly.

## Frontmatter

```yaml
---
version: 1.0.0
createdAt: <ISO date>
genre: puzzle | platformer | narrative | collector
approximatePlayMinutes: <number>
readyForBuild: false   # human flips this to true in Phase 2 — never set it yourself
---
```

## Body sections

### 1. Premise (150–200 words)

The emotional/spiritual truth the player should carry away — not a summary of game mechanics. Name the Bible passage or theme directly.

> Example: "This is a narrative game about the Good Samaritan's costly compassion (Luke 10:25–37). Set on the Jericho road, it is built for a youth-group player who has been taught that 'neighbor' is a category, and walks away knowing it is a verb. The player should put the game down not with a high score, but with the discomfort of asking 'who have I walked past?'"

### 2. Persona

| Field | Description |
|---|---|
| `whyTheyPlay` | the emotional truth, restated as motivation |
| `whatTheyNeedFromGame` | usually "meaning through play," sometimes more specific |
| `whatBreaksImmersion` | restate the ethical boundaries here as immersion-breakers (e.g. "violence, mockery of any character, a forced 'correct' theological answer") |
| `background` / `location` | the stated audience and cultural setting |

### 3. Emotional arc

A table of 6–8 beats walking `opening → inciting → rising → dark_night → turn → climax → resolution → carry_forward`, each with the player's emotion and the scene type (`interior | exterior | cutscene | puzzle | dialogue | action`). This is the spine the panels hang on — write it before the panels so the panels have somewhere to go.

### 4. Acts

Two acts is enough for a short game:
- **Act 1 — The World Before**: establishes the world and the player's place in it.
- **Act 2 — The World Changed**: forces the player to act and discover what the story is really asking of them.

Each act lists: `emotionalPurpose`, `openingScene`, `closingScene`, `keyTension`, `playerAgency`, and the panel IDs it owns.

### 5. Scene panels (minimum 4)

Panel count formula: `max(4, min(8, round(approximatePlayMinutes / 3)))`.

Each panel:

```
id: SB-001
act: Act 1
title: <short scene name>
setting: { location, timeOfDay, atmosphere, sounds, culturalMarkers }
charactersPresent: [Player, ...]
playerAction: what the player does here
emotionalTarget: what the player should feel leaving this panel
dialogueNotes: any line of dialogue or narration to show
canvasHint:
  backgroundColor: <hex>
  lightingMood: bright | dim | dark | golden | cold
  ambientParticles: true | false   # true mainly for narrative genre
linksToNext: SB-002   # or "END" for the last panel
```

Lighting convention carried over from the reference design: opening panels run `dim`, the middle of the story runs `dark`, and the final panel resolves to `golden` — light breaking in after the dark night, never the reverse.

### 6. Downstream briefs

```
worldBuilder:
  priorityPanelIds: [first two panel IDs]
  visualTone: "<genre> — <first five words of the premise>"
  canvasSize: { width: 800, height: 500 }
  backgroundColor: <first panel's backgroundColor>
  gridVisible: true unless genre is narrative

narrativeEngine:
  toneOfVoice: poetic if narrative, terse otherwise
  dialogueDensity: heavy if narrative, light otherwise
  branchingPhilosophy: "Every meaningful choice has a visible consequence"

gameBalance:
  difficultyPhilosophy: "Difficulty should mirror emotional tension, not just skill"
  gravityPreset: see genre table in SKILL.md
  frictionPreset: see genre table in SKILL.md
  coinCount: round(approximatePlayMinutes * 1.5)
  coinValue: 25 if collector, else 10
```

### 7. HITL checklist (the gate)

```
premiseReviewed: false
personaValidated: false
emotionalArcFelt: false
panelsVisualised: false
downstreamBriefsComplete: true
ethicalBoundariesRespected: true
readyForBuild: false
```

All seven flip to `true` together when the human approves in Phase 2 — there is no partial approval. Mirror this in the frontmatter's `readyForBuild` field, which is what Phase 3 actually checks before building.

---

## Worked example — The Good Samaritan (narrative, 9 minutes, youth group)

- **Genre:** narrative → gravity 0, friction 1.0, dialogue-heavy, `ambientParticles: true`
- **Panel count:** `max(4, min(8, round(9/3)))` = 4 panels
- **Panels:** (1) SB-001 "The Road Down from Jerusalem" — dim, dawn; (2) SB-002 "Passed By" — dark, midday, the priest and the Levite cross the road; (3) SB-003 "The Samaritan Stops" — dark→golden transition, the costly choice; (4) SB-004 "At the Inn" — golden, dusk, resolution.
- **Carry-forward beat:** the closing screen does not say "You win." It asks, in the player's own choice, "Who is your neighbor?" — no scored "correct" answer, just the question left standing.
