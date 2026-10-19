import { MergefallAudio } from './audio.mjs';
import { cellsOf, fits, HEIGHT, initialBoard, landing, piece, resolve, rotated, SIZE } from './engine.mjs';
import { compareCubes, cubeFaces, fitView, projectPoint } from './projection.mjs';

const $ = (id) => document.getElementById(id),
  canvas = $('game'),
  ctx = canvas.getContext('2d');
const audio = new MergefallAudio();
const palette = {
  2: ['#bfd9b8', '#a3bd9c', '#789d76'],
  4: ['#a7d6cf', '#80b8b2', '#548f87'],
  8: ['#c4bce0', '#a699c9', '#7e70a1'],
  16: ['#e5bec4', '#cf9da7', '#a67681'],
  32: ['#eddaa2', '#d3bd80', '#ad955a'],
  64: ['#e5b184', '#cd9365', '#a77247'],
  128: ['#d6ed95', '#b8d474', '#8ca64e'],
  256: ['#9cddbd', '#77bb9b', '#4c9272'],
  512: ['#9fbee8', '#779dce', '#4e77a7'],
  1024: ['#e4a5c3', '#c97fa1', '#a2587a'],
  2048: ['#e8ff93', '#cde970', '#a5c34a'],
};
let board = initialBoard(),
  active = {
    cells: [
      [0, 0, 0],
      [0, 1, 0],
    ],
    value: 2,
    x: 2,
    y: 6,
    z: 2,
  },
  queue = [piece(), piece(), piece()],
  score = 0,
  best = 0,
  phase = 'ready',
  chill = true,
  sound = false,
  fallTime = 0,
  last = performance.now(),
  angle = Math.PI / 4,
  targetAngle = angle,
  particles = [],
  drag = null,
  celebrated = false;
try {
  best = Number(localStorage.getItem('mergefall-best')) || 0;
  sound = localStorage.getItem('mergefall-sound') === 'true';
} catch {}
let width = 0,
  height = 0,
  view = { scale: 50, originX: 0, originY: 0 };
function resize() {
  const r = canvas.getBoundingClientRect();
  width = r.width;
  height = r.height;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  view = fitView(width, height, SIZE, HEIGHT);
}
new ResizeObserver(resize).observe(canvas);
function project(x, y, z) {
  return projectPoint(x, y, z, angle, view, SIZE);
}
function path(points) {
  ctx.beginPath();
  points.forEach((p, i) => {
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  });
  ctx.closePath();
}
function poly(points, fill, stroke) {
  path(points);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
}
function line(a, b, color, lineWidth = 1) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}
function faceText(points, value, alpha = 1) {
  const [a, b, , d] = points;
  ctx.save();
  ctx.transform((b.x - a.x) / 100, (b.y - a.y) / 100, (d.x - a.x) / 100, (d.y - a.y) / 100, a.x, a.y);
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = '#27352d';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${value >= 1024 ? 30 : value >= 128 ? 36 : 43}px "Space Grotesk",sans-serif`;
  ctx.fillText(value, 50, 53);
  ctx.restore();
}
function cube(c, { ghost = false, falling = false, alpha = 1 } = {}) {
  const gap = 0.045,
    x = c.x + gap,
    z = c.z + gap,
    y = c.y + gap,
    n = 0.91;
  const p = (a, b, d) => project(x + a * n, y + b * n, z + d * n),
    col = palette[Math.min(c.value, 2048)] || palette[2048];
  const { top, sides } = cubeFaces(p, angle);
  ctx.save();
  ctx.globalAlpha = alpha;
  if (ghost) {
    ctx.globalAlpha = 0.4;
    ctx.setLineDash([3, 4]);
    [...sides, top].forEach((f) => {
      poly(f, '#c5e68a09', '#c4df8b');
    });
    ctx.restore();
    return;
  }
  if (falling) {
    ctx.shadowColor = `${col[0]}88`;
    ctx.shadowBlur = 19;
  }
  sides.forEach((f, i) => {
    poly(f, col[i + 1], col[2]);
    ctx.shadowBlur = 0;
    faceText(f, c.value);
  });
  poly(top, col[0], col[0]);
  const center = {
    x: top.reduce((s, p) => s + p.x, 0) / 4,
    y: top.reduce((s, p) => s + p.y, 0) / 4,
  };
  poly(
    top.map((p) => ({
      x: p.x * 0.87 + center.x * 0.13,
      y: p.y * 0.87 + center.y * 0.13,
    })),
    null,
    '#ffffff25',
  );
  line(top[0], top[1], '#ffffff55', 1.3);
  line(top[0], top[3], '#ffffff35', 1.1);
  ctx.restore();
}
function render(now) {
  ctx.clearRect(0, 0, width, height);
  angle += (targetAngle - angle) * 0.085;
  const floor = [project(0, 0, 0), project(4, 0, 0), project(4, 0, 4), project(0, 0, 4)];
  ctx.save();
  ctx.shadowColor = '#000a';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 24;
  poly(floor, '#242c1e', '#4b573b');
  ctx.restore();
  const base = cubeFaces((x, y, z) => {
    const point = project(x * 4, 0, z * 4);
    return { x: point.x, y: point.y + (1 - y) * 11 };
  }, angle);
  base.sides.forEach((face, i) => {
    poly(face, i === 0 ? '#11160d' : '#1b2414', '#3a452d');
  });
  for (let i = 0; i <= 4; i++) {
    line(project(i, 0, 0), project(i, 0, 4), '#4b583a66');
    line(project(0, 0, i), project(4, 0, i), '#4b583a66');
  }
  [
    [0, 0],
    [4, 0],
    [0, 4],
    [4, 4],
  ].forEach(([x, z]) => {
    line(project(x, 0, z), project(x, HEIGHT, z), '#78865c15');
    const t = project(x, HEIGHT, z);
    line(t, { x: t.x, y: t.y + 12 }, '#7c8e5c66');
  });
  ctx.save();
  ctx.setLineDash([2, 6]);
  [
    [
      [0, 8, 0],
      [4, 8, 0],
    ],
    [
      [0, 8, 0],
      [0, 8, 4],
    ],
    [
      [4, 8, 0],
      [4, 8, 4],
    ],
    [
      [0, 8, 4],
      [4, 8, 4],
    ],
  ].forEach(([a, b]) => {
    line(project(...a), project(...b), '#7b8d591b');
  });
  ctx.restore();
  if (phase !== 'over') {
    const ghost = landing(board, active);
    cellsOf(ghost).forEach((c) => {
      cube(c, { ghost: true });
    });
  }
  const items = board.map((c) => ({ ...c, falling: false }));
  if (phase !== 'over')
    cellsOf(active).forEach((c) => {
      items.push({
        ...c,
        falling: true,
        y: c.y + (phase === 'ready' ? Math.sin(now * 0.0018) * 0.06 : 0),
      });
    });
  items.sort((a, b) => compareCubes(a, b, angle));
  items.forEach((c) => {
    cube(c, { falling: c.falling });
  });
  for (const p of particles) {
    const t = (now - p.time) / 900;
    if (t >= 1) continue;
    const at = project(p.x, p.y + t * 1.7, p.z);
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(at.x + Math.sin(p.seed) * t * 50, at.y, 3 * (1 - t), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  particles = particles.filter((p) => now - p.time < 900);
  const delta = Math.min(now - last, 100);
  last = now;
  if (phase === 'playing') {
    fallTime += delta;
    const speed = chill ? 2200 : Math.max(480, 1150 - score / 30);
    if (fallTime > speed) {
      fallTime = 0;
      if (fits(board, { ...active, y: active.y - 1 })) active.y--;
      else lock();
    }
  }
  requestAnimationFrame(render);
}
function tone(frequency = 330, duration = 0.08) {
  audio.sync({ enabled: sound, playing: phase === 'playing', chill });
  audio.tone(frequency, duration);
}
function update() {
  audio.sync({ enabled: sound, playing: phase === 'playing', chill });
  $('score').textContent = score.toLocaleString();
  $('best').textContent = best.toLocaleString();
  const highest = Math.max(...board.map((c) => c.value), 2);
  $('highest').innerHTML = `${highest.toLocaleString()}<span>/ 2048</span>`;
  const preview = $('highest-preview');
  if (preview.dataset.value !== String(highest)) {
    preview.innerHTML = miniCube(highest);
    preview.dataset.value = String(highest);
    preview.setAttribute('aria-label', `Highest tile: ${highest.toLocaleString()}`);
  }
  $('progress').style.width = `${Math.min(100, (Math.log2(highest) / 11) * 100)}%`;
  $('sound-label').textContent = sound ? 'Sound on' : 'Sound off';
  $('sound-btn').setAttribute('aria-label', sound ? 'Turn sound off' : 'Turn sound on');
  $('sound-btn').setAttribute('aria-pressed', String(sound));
  $('sound-btn').title = 'Background music and sound effects';
  $('sound-icon').textContent = sound ? '♫' : '♪';
  const inspecting = phase === 'over' && $('game-overlay').hidden;
  $('show-results').hidden = !inspecting;
  $('landing-note').textContent = phase === 'over' ? 'Your final stack' : 'Your next landing';
  document.querySelectorAll('[data-action]').forEach((button) => {
    button.disabled = phase === 'over';
  });
  $('status').textContent = phase === 'ready' ? 'READY WHEN YOU ARE' : phase === 'paused' ? 'A MOMENT TO RESET' : phase === 'over' ? (inspecting ? 'YOUR FINAL STACK' : 'ONE MORE TRY?') : 'FIND YOUR NEXT MERGE';
  $('start').innerHTML = phase === 'ready' ? "Let's play <span>↗</span>" : phase === 'playing' ? 'Pause game <span>Ⅱ</span>' : phase === 'paused' ? 'Keep playing <span>→</span>' : 'Play again <span>↗</span>';
  $('mode').innerHTML = `${chill ? 'Chill' : 'Classic'} mode <span>⌄</span>`;
  $('action-note').textContent = inspecting ? 'Z / X to rotate. Esc for results.' : chill ? 'No rush. Find your rhythm.' : 'A little faster. A little bolder.';
  renderQueue();
}
function miniCube(value) {
  const c = palette[Math.min(value, 2048)] || palette[2048];
  const fontSize = value >= 1024 ? 9 : value >= 128 ? 11 : 16;
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 20 32 7 56 20 32 33Z" fill="${c[0]}"/><path d="M8 20 32 33 32 59 8 46Z" fill="${c[1]}"/><path d="M32 33 56 20 56 46 32 59Z" fill="${c[2]}"/><text x="21" y="41" text-anchor="middle" fill="#293a30" font-family="sans-serif" font-size="${fontSize}" font-weight="600" transform="rotate(28 21 41)">${value}</text><path d="M8 20 32 33 56 20" fill="none" stroke="#fff3"/></svg>`;
}
function renderQueue() {
  $('next-pieces').innerHTML = queue
    .map((p, i) => `<div class="next-piece">${miniCube(p.value)}<span>${String(i + 1).padStart(2, '0')} · ${p.cells.length} ${p.cells.length === 1 ? 'BLOCK' : 'BLOCKS'}</span></div>`)
    .join('');
}
function announce(text) {
  $('combo').textContent = text;
  $('combo').classList.remove('pop');
  void $('combo').offsetWidth;
  $('combo').classList.add('pop');
}
function lock() {
  const result = resolve([...board, ...cellsOf(active)]);
  board = result.board;
  score += result.score;
  if (score > best) {
    best = score;
    try {
      localStorage.setItem('mergefall-best', best);
    } catch {}
  }
  if (result.merges) {
    announce(result.merges > 1 ? `${result.merges}× chain! +${result.score}` : `Nice merge. +${result.score}`);
    $('score-caption').textContent = result.merges > 1 ? 'That’s a chain reaction.' : 'A little bigger. A little better.';
    result.events.forEach((e) => {
      for (let i = 0; i < 9; i++)
        particles.push({
          ...e,
          x: e.x + 0.5,
          z: e.z + 0.5,
          color: (palette[Math.min(e.value, 2048)] || palette[2])[0],
          time: performance.now(),
          seed: Math.random() * 7,
        });
    });
    tone(330 + Math.min(result.merges, 6) * 90, 0.2);
  } else tone(140, 0.09);
  if (!celebrated && board.some((c) => c.value >= 2048)) {
    celebrated = true;
    announce('2048! Keep the good things going.');
  }
  active = queue.shift();
  queue.push(piece());
  fallTime = 0;
  if (!fits(board, active)) {
    phase = 'over';
    showResults();
  }
  update();
}
function showOverlay(eyebrow, title, copy, button) {
  $('overlay-eyebrow').textContent = eyebrow;
  $('overlay-title').textContent = title;
  $('overlay-copy').textContent = copy;
  $('resume').innerHTML = `${button} <span>→</span>`;
  $('inspect-board').hidden = phase !== 'over';
  $('game-overlay').hidden = false;
}
function showResults() {
  if (phase !== 'over') return;
  showOverlay('A GOOD RUN. A FRESH START.', 'Room for one more?', `The stack is full. Your score: ${score.toLocaleString()}.`, "Let's go again");
  update();
  $('resume').focus();
}
function inspectBoard() {
  if (phase !== 'over') return;
  $('game-overlay').hidden = true;
  update();
  canvas.focus();
}
function togglePlay() {
  if (phase === 'over') {
    reset(true);
    return;
  }
  if (phase === 'playing') {
    phase = 'paused';
    showOverlay('TAKE A BREATHER', 'On pause.', 'Your next big merge can wait.', 'Back to the blocks');
  } else {
    phase = 'playing';
    $('game-overlay').hidden = true;
    fallTime = 0;
    tone(440, 0.1);
  }
  update();
}
function reset(play = false) {
  audio.reset();
  board = initialBoard();
  active = {
    cells: [
      [0, 0, 0],
      [0, 1, 0],
    ],
    value: 2,
    x: 2,
    y: 6,
    z: 2,
  };
  queue = [piece(), piece(), piece()];
  score = 0;
  phase = play ? 'playing' : 'ready';
  fallTime = 0;
  particles = [];
  celebrated = false;
  $('combo').classList.remove('pop');
  $('combo').textContent = '';
  $('game-overlay').hidden = true;
  $('score-caption').textContent = 'Every merge adds up.';
  update();
}
function act(action) {
  if (phase === 'paused' || phase === 'over') return;
  if (phase === 'ready') {
    phase = 'playing';
    update();
  }
  if (action === 'drop') {
    active = landing(board, active);
    lock();
    return;
  }
  let next = { ...active };
  if (action === 'left') next.x--;
  if (action === 'right') next.x++;
  if (action === 'back') next.z--;
  if (action === 'forward') next.z++;
  if (action === 'rotate') next = rotated(active, 1);
  if (action === 'counterrotate') next = rotated(active, -1);
  if (fits(board, next)) {
    active = next;
    tone(170, 0.025);
  } else if (action.includes('rotate')) {
    for (const dx of [-1, 1, -2])
      if (fits(board, { ...next, x: next.x + dx })) {
        active = { ...next, x: next.x + dx };
        break;
      }
  }
}
document.addEventListener('keydown', (e) => {
  if ($('help-dialog').open || e.target.tagName === 'INPUT') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.toLowerCase();
  if (e.key === 'Escape' && phase === 'over') {
    e.preventDefault();
    if ($('game-overlay').hidden) showResults();
    else inspectBoard();
    return;
  }
  if (key === 'z' || key === 'x') {
    e.preventDefault();
    if (!e.repeat) rotateView(key === 'z' ? -1 : 1);
    return;
  }
  const actions = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'back',
    ArrowDown: 'forward',
    a: 'left',
    d: 'right',
    w: 'back',
    s: 'forward',
    q: 'counterrotate',
    e: 'rotate',
    ' ': 'drop',
  };
  const action = actions[e.key] || actions[e.key.toLowerCase()];
  if (action) {
    e.preventDefault();
    if (e.repeat && action === 'drop') return;
    act(action);
  }
  if (e.key.toLowerCase() === 'p' || e.key === 'Escape') {
    e.preventDefault();
    if (phase === 'playing' || phase === 'paused') togglePlay();
  }
});
$('start').onclick = togglePlay;
$('resume').onclick = togglePlay;
$('inspect-board').onclick = inspectBoard;
$('show-results').onclick = showResults;
$('restart').onclick = () => reset(phase === 'playing');
$('mode').onclick = () => {
  chill = !chill;
  fallTime = 0;
  update();
};
function rotateView(direction) {
  targetAngle += (direction * Math.PI) / 2;
}
$('view-left').onclick = () => {
  rotateView(-1);
};
$('view-right').onclick = () => {
  rotateView(1);
};
$('sound-btn').onclick = () => {
  sound = !sound;
  try {
    localStorage.setItem('mergefall-sound', String(sound));
  } catch {}
  tone(440);
  update();
};
document.querySelectorAll('[data-action]').forEach((button) => {
  button.onclick = () => act(button.dataset.action);
});
const help = $('help-dialog');
$('help-btn').onclick = () => {
  if (phase === 'playing') togglePlay();
  help.showModal();
};
$('got-it').onclick = $('close-help').onclick = () => help.close();
help.addEventListener('click', (e) => {
  if (e.target === help) {
    const r = help.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) help.close();
  }
});
$('play-tab').onclick = () => canvas.focus();
canvas.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, time: performance.now() };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointerup', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x,
    dy = e.clientY - drag.y;
  if (Math.hypot(dx, dy) < 15) {
    if (performance.now() - drag.time < 300) act('rotate');
  } else if (Math.abs(dx) > Math.abs(dy)) act(dx > 0 ? 'right' : 'left');
  else act(dy > 0 ? 'forward' : 'back');
  drag = null;
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && phase === 'playing') togglePlay();
});
update();
resize();
requestAnimationFrame(render);
