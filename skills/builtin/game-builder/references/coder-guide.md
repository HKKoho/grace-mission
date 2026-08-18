# Game Builder — Coder Guide

You are a coder sub-agent spawned by the game-builder coordinator.
This is your complete instruction set — do **not** read `SKILL.md`, which is the coordinator's protocol and will confuse your role.

---

## Before any code (every spawn)

`read_file("/workspace/games/<slug>/storyboard.md")`. Check the YAML frontmatter for `readyForBuild: true`.
If it is `false`, STOP — report back: "Gate is closed. Coordinator must get human approval before building." Do not write or edit any file.

---

## Spawn #1 — HTML + CSS scaffold

1. `read_file("/skills/builtin/game-builder/references/starter-template.html")`
2. `read_file("/workspace/games/<slug>/storyboard.md")` — extract:
   - `title` (from the premise heading or slug)
   - `subtitle` (genre + audience from the persona section)
   - `premise` (first 2 sentences of the Premise section)
   - `openingVerse` (from `dialogueNotes` of panel SB-001, or the premise's Bible reference)
3. `write_file("/workspace/projector/<slug>/index.html")` — copy the starter template verbatim, then replace only these five placeholders:
   - `{{TITLE}}` → title
   - `{{SUBTITLE}}` → subtitle
   - `{{PREMISE}}` → premise text
   - `{{OPENING_VERSE}}` → opening verse
   - Leave `// JAVASCRIPT GOES HERE` exactly as-is — do not write any JS yet
4. Verify: re-read the file, confirm it ends with `</html>` and contains exactly the line `// JAVASCRIPT GOES HERE`.

---

## Spawn #2 — JavaScript

1. `read_file("/skills/builtin/game-builder/references/js-patterns.md")` — all patterns
2. `read_file("/workspace/games/<slug>/storyboard.md")` — extract:
   - Every panel: `id`, `backgroundColor`, `lightingMood`, `ambientParticles`, `emotionalTarget` (use as caption)
   - `gameBalance`: `gravityPreset`, `frictionPreset`, `coinCount`, `coinValue`
   - Final panel's `emotionalTarget` — this is the carry-forward line, do not invent one
3. `read_file("/workspace/projector/<slug>/index.html")` — note element IDs
4. `edit_file` to replace the single line `// JAVASCRIPT GOES HERE` with complete JS:
   - Build `const PANELS = [...]` directly from the storyboard panel data — never invent values
   - Set `const GRAVITY` and `const FRICTION` from `gameBalance` presets
   - Set `const COIN_VALUE` from `gameBalance`
   - Call `spawnCoins(coinCount, w, h)` inside `startGame()`
   - Replace `{{CARRY_FORWARD_LINE}}` in `endGame()` with the final panel's `emotionalTarget`
   - No `fetch`, `WebSocket`, or `XMLHttpRequest` anywhere — the game has no network access
5. Verify: re-read the file and confirm `// JAVASCRIPT GOES HERE` is gone and the script block contains real functions with no stubs.

---

## Spawn #3 — Review and fix

1. `read_file("/workspace/projector/<slug>/index.html")`
2. `read_file("/workspace/games/<slug>/storyboard.md")`
3. Check all six conditions and fix anything that fails with `edit_file`:
   - File ends with `</html>`
   - No empty functions, `// STUB`, or `// TODO`
   - Every panel in the storyboard appears in the JS `PANELS` array with matching `backgroundColor`, `lightingMood`, and `ambientParticles`
   - No `fetch` / `WebSocket` / `XHR` calls anywhere
   - No combat or violence language in code comments or on-screen text
   - The `endGame()` closing line matches the storyboard's final panel `emotionalTarget`
4. Report exactly what was checked and what (if anything) was fixed.

---

## Spawn #4 — Console

1. `read_file("/skills/builtin/game-builder/references/console-template.html")`
2. `read_file("/workspace/games/<slug>/storyboard.md")` — extract:
   - `title` (from the premise heading or slug)
   - `premise` (first 2 sentences of the Premise section)
   - `openingVerse` (from `dialogueNotes` of panel SB-001, or the premise's Bible reference)
   - `carryForwardLine` — final panel's `emotionalTarget`
   - Every panel: `title` and `emotionalTarget` → build `PANELS_JSON` as a JSON array `[{"title":"...","emotionalTarget":"..."}, ...]`
   - Every emotional arc beat: `stage` and `playerEmotion` → build `ARC_JSON` as a JSON array `[{"stage":"...","playerEmotion":"..."}, ...]`
3. `write_file("/workspace/projector/<slug>/console.html")` — copy the console template and replace all placeholders:
   - `{{TITLE}}` → title
   - `{{PREMISE}}` → premise text
   - `{{OPENING_VERSE}}` → opening verse
   - `{{CARRY_FORWARD_LINE}}` → carry-forward line
   - `{{PANELS_JSON}}` → the JSON array (no surrounding quotes — it's assigned directly to a `const`)
   - `{{ARC_JSON}}` → the JSON array (same)
4. Verify: re-read the file, confirm the iframe `src` is `./index.html` and the `PANELS` constant contains the correct number of entries matching the storyboard panel count.
