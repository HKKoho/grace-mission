# Game JS patterns

Ready-to-use code blocks adapted from `/reference/Games/game-server.ts` and `/reference/Games/index.html`, collapsed from a client/server pair into a single self-contained `requestAnimationFrame` loop (no `WebSocket`, no `setInterval` ticking a remote server — everything below runs entirely inside the Projector iframe). Copy what's needed into the `<script>` block of `index.html` and wire it to the storyboard's panels.

## 1. State, driven by the storyboard

```js
// PANELS comes straight from the approved storyboard.md — one entry per scene panel.
const PANELS = [
  { id: 'SB-001', backgroundColor: '#0a0a14', lightingMood: 'dim',  ambientParticles: false, caption: 'The road down from Jerusalem…' },
  { id: 'SB-002', backgroundColor: '#0f0f18', lightingMood: 'dark', ambientParticles: false, caption: 'A priest passes by, on the other side.' },
  { id: 'SB-003', backgroundColor: '#0f0f18', lightingMood: 'dark', ambientParticles: true,  caption: 'A Samaritan stops.' },
  { id: 'SB-004', backgroundColor: '#14080a', lightingMood: 'golden', ambientParticles: true, caption: 'At the inn, the bill is already paid.' },
];

// From the storyboard's downstreamBriefs.gameBalance — see storyboard-schema.md genre table.
const GRAVITY  = 0;     // e.g. 0.45 for platformer
const FRICTION = 1.0;   // e.g. 0.88 for platformer
const COIN_VALUE = 10;

let panelIndex = 0;
let particles = [];
let coins = [];
let running = false;

const player = { x: 400, y: 250, vx: 0, vy: 0, size: 14, color: '#4DA3FF' };
```

## 2. Mood overlay (verbatim from the reference renderer)

```js
const moodSettings = {
  bright: { overlayColor: null,                    gridAlpha: 0.08 },
  dim:    { overlayColor: 'rgba(0,0,0,0.2)',        gridAlpha: 0.04 },
  dark:   { overlayColor: 'rgba(0,0,0,0.5)',        gridAlpha: 0.025 },
  golden: { overlayColor: 'rgba(180,100,0,0.12)',   gridAlpha: 0.06 },
  cold:   { overlayColor: 'rgba(30,60,120,0.18)',   gridAlpha: 0.04 },
};

function applyMoodOverlay(octx, overlayCanvas, mood) {
  const s = moodSettings[mood] || moodSettings.dim;
  octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  if (s.overlayColor) {
    octx.fillStyle = s.overlayColor;
    octx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    overlayCanvas.style.opacity = '1';
  } else {
    overlayCanvas.style.opacity = '0';
  }
  return s.gridAlpha;
}
```

## 3. Ambient particles

```js
function spawnParticles(w, h) {
  particles = Array.from({ length: 30 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: 1 + Math.random() * 2,
    vy: -0.2 - Math.random() * 0.3,
    alpha: 0.1 + Math.random() * 0.3,
  }));
}

function updateParticles(w, h) {
  for (const p of particles) {
    p.y += p.vy;
    if (p.y < -4) { p.y = h + 4; p.x = Math.random() * w; }
  }
}

function drawParticles(ctx) {
  for (const p of particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200,180,255,${p.alpha})`;
    ctx.fill();
  }
}
```

## 4. Movement + physics (gravity/friction from the genre preset, wall bounce from game-server.ts)

```js
const keys = {};
window.addEventListener('keydown', (e) => { keys[e.key] = true; });
window.addEventListener('keyup',   (e) => { keys[e.key] = false; });

function updatePlayer(w, h) {
  const SPEED = 0.6;
  if (keys['ArrowLeft']  || keys['a']) player.vx -= SPEED;
  if (keys['ArrowRight'] || keys['d']) player.vx += SPEED;
  if (keys['ArrowUp']    || keys['w']) player.vy -= SPEED;
  if (keys['ArrowDown']  || keys['s']) player.vy += SPEED;

  player.vy += GRAVITY;
  player.vx *= FRICTION;
  player.vy *= FRICTION;
  player.x += player.vx;
  player.y += player.vy;

  if (player.x - player.size < 0) { player.x = player.size;     player.vx *= -0.6; }
  if (player.x + player.size > w) { player.x = w - player.size; player.vx *= -0.6; }
  if (player.y - player.size < 0) { player.y = player.size;     player.vy *= -0.6; }
  if (player.y + player.size > h) { player.y = h - player.size; player.vy *= -0.6; }
}
```

## 5. Coins (collectibles)

```js
function spawnCoins(count, w, h) {
  coins = Array.from({ length: count }, () => ({
    x: 40 + Math.random() * (w - 80),
    y: 40 + Math.random() * (h - 80),
    collected: false,
  }));
}

function updateCoins() {
  for (const coin of coins) {
    if (coin.collected) continue;
    const dx = player.x - coin.x, dy = player.y - coin.y;
    if (Math.sqrt(dx * dx + dy * dy) < player.size + 10) {
      coin.collected = true;
      document.getElementById('hudCoins').textContent =
        'Coins: ' + (coins.filter((c) => c.collected).length * COIN_VALUE);
    }
  }
}

function drawCoins(ctx) {
  for (const coin of coins) {
    if (coin.collected) continue;
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#EF9F27';
    ctx.fill();
    ctx.strokeStyle = '#BA7517'; ctx.lineWidth = 1.5; ctx.stroke();
  }
}
```

## 6. Panel/scene transitions (driven by the storyboard's `linksToNext`)

```js
function showPanel(i) {
  panelIndex = i;
  const panel = PANELS[i];
  document.getElementById('gameWrap').style.background = panel.backgroundColor;
  document.getElementById('hudPanel').textContent = `Scene ${i + 1} of ${PANELS.length}`;

  const caption = document.getElementById('caption');
  caption.textContent = panel.caption;
  caption.classList.add('visible');
  setTimeout(() => caption.classList.remove('visible'), 4000);

  if (panel.ambientParticles) spawnParticles(800, 500);
  else particles = [];

  // Notify the console iframe of the current panel
  window.parent.postMessage({ type: 'game:panel', panelIndex: i }, '*');
}

// Call this on whatever this game's "advance" condition is —
// reaching a point, collecting all coins, finishing a dialogue, etc.
function advancePanel() {
  if (panelIndex < PANELS.length - 1) {
    showPanel(panelIndex + 1);
  } else {
    endGame();
  }
}
```

## 7. Game loop

```js
function gameTick() {
  if (!running) return;
  const canvas = document.getElementById('game-canvas');
  const overlay = document.getElementById('mood-overlay');
  const ctx = canvas.getContext('2d');
  const octx = overlay.getContext('2d');
  const w = canvas.width, h = canvas.height;

  updatePlayer(w, h);
  updateCoins();

  ctx.clearRect(0, 0, w, h);
  const gridAlpha = applyMoodOverlay(octx, overlay, PANELS[panelIndex].lightingMood);

  ctx.strokeStyle = `rgba(255,255,255,${gridAlpha})`;
  ctx.lineWidth = 0.5;
  for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  if (particles.length) { updateParticles(w, h); drawParticles(ctx); }

  drawCoins(ctx);

  ctx.beginPath();
  ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
  ctx.fillStyle = player.color;
  ctx.fill();

  requestAnimationFrame(gameTick);
}

function startGame() {
  document.getElementById('startScreen').classList.add('hidden');
  running = true;
  window.parent.postMessage({ type: 'game:start' }, '*');
  showPanel(0);
  requestAnimationFrame(gameTick);
}

function restartGame() {
  document.getElementById('endScreen').classList.add('hidden');
  document.getElementById('startScreen').classList.remove('hidden');
  running = false;
  panelIndex = 0;
  player.x = 400; player.y = 250; player.vx = 0; player.vy = 0;
}
```

## 8. Win / carry-forward screen

The end screen never shows a score as the point of the story — it shows the resolution beat's emotional truth. A question left open (see the Good Samaritan example in `storyboard-schema.md`) is often stronger than a verdict.

```js
function endGame() {
  running = false;
  window.parent.postMessage({ type: 'game:end' }, '*');
  document.getElementById('endTitle').textContent = 'The road continues…';
  document.getElementById('endLine').textContent =
    '{{CARRY_FORWARD_LINE}}'; // pull straight from the storyboard's final emotionalArc beat
  document.getElementById('endScreen').classList.remove('hidden');
}
```
