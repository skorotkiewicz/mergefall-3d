import { Game, RELICS } from './engine.js';
import { Renderer, tileColor } from './renderer.js';

const $ = (id) => document.getElementById(id),
  game = new Game();
let renderer;
try {
  renderer = new Renderer($('world'));
} catch (e) {
  $('error-screen').hidden = false;
  $('error-message').textContent = e.message;
  throw e;
}
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const storage = {
  get(k) {
    try {
      return Number(localStorage.getItem(`fracture-${k}`)) || 0;
    } catch {
      return 0;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(`fracture-${k}`, String(v));
    } catch {}
  },
};
let best = storage.get('best'),
  runs = storage.get('runs'),
  home = true,
  paused = false,
  modalMode = null,
  lastFocus = null;
let timer = game.dropTime,
  previous = performance.now(),
  time = 0,
  eventUntil = 0,
  shake = 0,
  busy = 0,
  toastTimeout,
  audio = null,
  sound = false,
  introTurn = 0;
const keys = new Set(),
  names = ['First contact', 'In good company', 'Under pressure', 'Chain of command', 'Critical mass', 'A higher power', 'Event horizon', 'One more merge'];
function tone(freq, duration = 0.1, type = 'sine', volume = 0.045, delay = 0) {
  if (!sound || !audio) return;
  if (audio.state === 'suspended') audio.resume().catch(() => {});
  const o = audio.createOscillator(),
    g = audio.createGain(),
    t = audio.currentTime + delay;
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(volume, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  o.connect(g);
  g.connect(audio.destination);
  o.start(t);
  o.stop(t + duration + 0.01);
}
function initAudio() {
  if (!audio)
    try {
      audio = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      toast('Audio is unavailable in this browser.');
    }
}
function toast(s) {
  $('toast').textContent = s;
  $('toast').classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => $('toast').classList.remove('show'), 2600);
}
function releaseMouse() {
  keys.clear();
  if (document.pointerLockElement) document.exitPointerLock();
}
function closeModal() {
  $('modal').hidden = true;
  $('modal-content').replaceChildren();
  document.body.classList.remove('is-paused');
  modalMode = null;
  if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
}
function showModal(mode, html) {
  releaseMouse();
  paused = true;
  modalMode = mode;
  document.body.classList.add('is-paused');
  lastFocus = document.activeElement;
  $('modal-content').innerHTML = html;
  $('modal-content').querySelector('h2')?.setAttribute('id', 'modal-title');
  $('modal').hidden = false;
  $('modal-content').focus({ preventScroll: true });
}
function help() {
  if (modalMode && modalMode !== 'pause') return;
  const wasPaused = paused;
  showModal(
    'help',
    `<div class="eyebrow">FIELD MANUAL / 001</div><h2>A familiar shape.<br>A different kind of drop.</h2><p class="modal-copy">You're on the observation deck above a <strong>6 × 6 chamber</strong>. Place numbered tetrominoes into the well. Equal cubes touching along a face combine, then gravity takes over.</p><div class="how-grid"><div class="how-step"><span>01 / PLACE</span><h3>Find your opening.</h3><p>Arrow keys move the landing preview across the grid. <kbd>Q</kbd> and <kbd>E</kbd> rotate the shape. Translucent cubes show where it will land.</p></div><div class="how-step"><span>02 / MERGE</span><h3>Two of a kind become one.</h3><p>Press <kbd>SPACE</kbd> to drop. Touching 2s become 4, 4s become 8. Cubes fall into empty space and can trigger more merges.</p></div><div class="how-step"><span>03 / ADAPT</span><h3>Pick your advantage.</h3><p>Reach the target cube or merge count to clear a chamber. Choose one of three random relics. Your board and upgrades carry on.</p></div><div class="how-step"><span>04 / SURVIVE</span><h3>Keep some room.</h3><p>Pieces fall when the timer expires. A piece that lands above the nine-layer limit ends the run. Reach 2048 to win.</p></div></div><div class="controls-note">WASD walk · Drag to look · V reset view<br>R reroll · Esc pause · Double-click to lock the mouse<br>On touch screens, drag to look and use the placement buttons.</div><div class="modal-actions"><button class="primary-button" id="close-help">${home ? 'Got it. Let’s play' : 'Back to the chamber'} <span>↗</span></button></div>`,
  );
  $('close-help').onclick = () => {
    closeModal();
    if (home) startRun();
    else if (wasPaused) {
      paused = false;
      pause();
    } else paused = false;
  };
}
function results() {
  return `<div class="run-results"><div><span>SCORE</span><strong>${game.score.toLocaleString()}</strong></div><div><span>CHAMBER</span><strong>${String(game.floor).padStart(2, '0')}</strong></div><div><span>BIGGEST</span><strong>${game.maxValue}</strong></div></div>`;
}
function pause() {
  if (home || game.status !== 'playing') return;
  if (modalMode === 'pause') {
    closeModal();
    paused = false;
    return;
  }
  if (modalMode) return;
  showModal(
    'pause',
    `<div class="eyebrow">SIGNAL ON HOLD</div><h2>Take a breath.</h2><p class="modal-copy">Your chamber is waiting. The timer stops while you're away.</p>${results()}<div class="modal-actions"><button class="primary-button" id="resume-button">Keep going <span>↗</span></button><button class="secondary-button" id="restart-button">Start a new run</button></div>`,
  );
  $('resume-button').onclick = () => {
    closeModal();
    paused = false;
  };
  $('restart-button').onclick = () => {
    showModal(
      'confirm',
      `<div class="eyebrow">NEW RUN</div><h2>Leave this chamber?</h2><p class="modal-copy">Your score will be saved. This board and its relics will be lost.</p><div class="modal-actions"><button class="primary-button" id="confirm-restart">Start fresh <span>↗</span></button><button class="secondary-button" id="cancel-restart">Keep this run</button></div>`,
    );
    $('confirm-restart').onclick = () => {
      saveBest();
      startRun();
    };
    $('cancel-restart').onclick = () => {
      closeModal();
      paused = false;
      pause();
    };
  };
}
function saveBest() {
  if (game.score > best) {
    best = game.score;
    storage.set('best', best);
  }
  storage.set('deepest', Math.max(game.floor, storage.get('deepest')));
}
function startRun() {
  closeModal();
  game.reset();
  game.status = 'playing';
  home = false;
  paused = false;
  timer = game.dropTime;
  time = 0;
  busy = 0;
  eventUntil = 0;
  renderer.particles = [];
  renderer.dropAnimation = null;
  renderer.resetCamera();
  runs++;
  storage.set('runs', runs);
  document.body.classList.remove('is-home');
  $('event-feed').classList.remove('show');
  initAudio();
  tone(220, 0.3);
  tone(330, 0.4, 'sine', 0.04, 0.08);
  tone(440, 0.5, 'sine', 0.03, 0.16);
  updateUI();
  $('world').focus({ preventScroll: true });
  toast('Arrows place · Q / E rotate · Space drops');
}
function drawPiece(canvas, p, small = false) {
  const ctx = canvas.getContext('2d'),
    w = canvas.width,
    h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (!p) return;
  const mx = Math.max(...p.cells.map((c) => c[0])),
    mz = Math.max(...p.cells.map((c) => c[1])),
    s = small ? 20 : 29,
    r = small ? 5 : 8,
    bx = w / 2 - ((mx - mz) * s) / 2,
    by = h / 2 - (mx + mz) * s * 0.24 + r,
    color = tileColor(p.value);
  for (const [x, z] of [...p.cells].sort((a, b) => a[0] + a[1] - b[0] - b[1])) {
    const px = bx + (x - z) * s,
      py = by + (x + z) * s * 0.48;
    const poly = (pts, shade) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => {
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      if (shade) {
        ctx.fillStyle = shade;
        ctx.fill();
      }
    };
    poly(
      [
        [px - s + 1, py],
        [px, py + s * 0.48],
        [px, py + s * 0.48 + r],
        [px - s + 1, py + r],
      ],
      '#0005',
    );
    poly(
      [
        [px, py + s * 0.48],
        [px + s - 1, py],
        [px + s - 1, py + r],
        [px, py + s * 0.48 + r],
      ],
      '#0008',
    );
    poly([
      [px, py - s * 0.48 + 1],
      [px + s - 1, py],
      [px, py + s * 0.48 - 1],
      [px - s + 1, py],
    ]);
    ctx.fillStyle = '#18312c';
    ctx.font = `600 ${small ? 9 : 12}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.value, px, py);
  }
}
function updateUI() {
  const text = (id, v) => ($(id).textContent = v);
  text('score', game.score.toLocaleString());
  text('best-score', Math.max(best, game.score).toLocaleString());
  text('run-number', String(runs).padStart(3, '0'));
  text('floor-number', String(game.floor).padStart(2, '0'));
  text('floor-name', names[Math.min(game.floor - 1, names.length - 1)]);
  text('target', game.target);
  text('merge-goal', game.mergeGoal);
  text('merge-progress', `${game.floorMerges} / ${game.mergeGoal} MERGES`);
  const p = Math.min(100, Math.round((game.floorMerges / game.mergeGoal) * 100));
  $('floor-progress').style.width = `${p}%`;
  text('progress-percent', `${p}%`);
  text('biggest', game.maxValue);
  text('height', game.highest);
  $('height').style.color = game.highest >= 7 ? 'var(--accent)' : '';
  text('piece-name', game.active.name);
  text('piece-value', game.active.value);
  text('next-value', game.queue[0].value);
  text('after-value', game.queue[1].value);
  drawPiece($('piece-preview'), game.active);
  drawPiece($('next-preview'), game.queue[0], true);
  drawPiece($('after-preview'), game.queue[1], true);
  text('reroll-count', `${game.rerolls} LEFT`);
  $('reroll-button').disabled = game.rerolls <= 0;
  text('relic-count', String(game.relics.length).padStart(2, '0'));
  $('relic-list').replaceChildren();
  if (!game.relics.length) $('relic-list').innerHTML = '<span class="empty-relic">A clean slate. For now.</span>';
  for (const id of game.relics) {
    const r = RELICS.find((r) => r.id === id),
      el = document.createElement('span');
    el.className = 'relic-token';
    el.textContent = r.icon;
    el.title = `${r.name}: ${r.detail}`;
    el.setAttribute('aria-label', el.title);
    el.tabIndex = 0;
    $('relic-list').append(el);
  }
  $('chamber-caption').textContent = game.shields ? `FAILSAFE ARMED / ${game.shields} CHARGE` : 'EQUAL CUBES MERGE. MAKE ROOM FOR MORE.';
  $('system-status').textContent = home ? 'CHAMBER ONLINE' : `RUN ${String(runs).padStart(3, '0')} / CHAMBER ${String(game.floor).padStart(2, '0')}`;
}
function upgrade() {
  tone(330, 0.4);
  tone(440, 0.4, 'sine', 0.04, 0.1);
  tone(660, 0.7, 'sine', 0.04, 0.2);
  showModal(
    'upgrade',
    `<div class="eyebrow">CHAMBER ${String(game.floor).padStart(2, '0')} COMPLETE</div><h2>Make your next<br>move count.</h2><p class="modal-copy">Choose a relic. Your board carries on, and so do your upgrades.</p><div class="relic-options">${game
      .choices()
      .map((r) => `<button class="relic-choice" data-relic="${r.id}"><span class="relic-icon">${r.icon}</span><span class="relic-tag">${r.tag}</span><strong>${r.name}</strong><p>${r.description}</p></button>`)
      .join('')}</div><p class="controls-note">NEXT CHAMBER / TARGET ${Math.min(2048, 2 ** (game.floor + 5))} · YOUR STACK STAYS</p>`,
  );
  for (const b of $('modal-content').querySelectorAll('[data-relic]'))
    b.onclick = () => {
      game.choose(b.dataset.relic);
      closeModal();
      paused = false;
      timer = game.dropTime;
      updateUI();
      tone(440, 0.25);
      toast(`Chamber ${String(game.floor).padStart(2, '0')} · ${names[Math.min(game.floor - 1, names.length - 1)]}`);
    };
}
function finish(won = false) {
  const record = game.score > best;
  saveBest();
  tone(won ? 440 : 165, 0.5, 'triangle');
  tone(won ? 660 : 110, 0.7, 'triangle', 0.04, 0.2);
  showModal(
    'end',
    `<div class="eyebrow">${won ? '2048 / SIGNAL COMPLETE' : record ? 'NEW PERSONAL BEST' : 'END OF SIGNAL'}</div><h2>${won ? 'You made room<br>for the impossible.' : 'Out of room.<br>Not out of chances.'}</h2><p class="modal-copy">${won ? 'A 2048 cube. One chamber, a lot of good decisions.' : 'The stack reached the ceiling. A fresh chamber is one click away.'}</p>${results()}<div class="modal-actions"><button class="primary-button" id="again-button">One more run <span>↗</span></button><button class="secondary-button" id="home-button">Back to title</button></div>`,
  );
  $('again-button').onclick = startRun;
  $('home-button').onclick = () => {
    closeModal();
    home = true;
    paused = false;
    document.body.classList.add('is-home');
    renderer.resetCamera();
    seedDemo();
    updateUI();
  };
}
function drop() {
  if (home || paused || busy > 0 || game.status !== 'playing') return;
  const r = game.drop();
  if (!r) return;
  timer = game.dropTime;
  busy = 0.4;
  tone(90, 0.17, 'triangle', 0.06);
  if (r.shield) {
    toast('Failsafe triggered. Top three layers cleared.');
    renderer.burst([{ x: 2, y: 7, z: 2, value: 64 }]);
  } else if (r.overflow) {
    finish();
    return;
  } else {
    if (!reduced) {
      renderer.dropAnimation = { cells: r.placed, time: 0 };
      shake = 0.025;
    }
    renderer.burst(r.events);
    if (r.merges) {
      for (let i = 0; i < Math.min(7, r.merges); i++) tone(220 * 2 ** (i / 5), 0.23, 'sine', 0.025, 0.12 + i * 0.065);
      $('event-feed').innerHTML =
        `<div class="combo">${r.merges > 1 ? `${r.merges}× CHAIN REACTION` : 'CLEAN MERGE'}</div><div class="points">+${r.score}</div><div class="merge-caption">${r.merges} MERGES / ${Math.max(...r.events.map((e) => e.value))} CUBE</div>`;
      $('event-feed').classList.add('show');
      eventUntil = time + 2.2;
    }
  }
  updateUI();
  saveBest();
  if (['upgrade', 'won'].includes(game.status)) {
    const state = game.status;
    setTimeout(() => {
      if (game.status === state && !home) state === 'won' ? finish(true) : upgrade();
    }, 550);
  }
}
function action(a) {
  if (home || paused || game.status !== 'playing') return;
  let changed = false;
  const moves = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
  if (moves[a]) changed = game.move(...moves[a]);
  if (a === 'rotate') changed = game.rotate();
  if (a === 'rotate-back') changed = game.rotate(-1);
  if (a === 'reroll') {
    changed = game.reroll();
    if (changed) {
      timer = game.dropTime;
      toast('Fresh shape. Fresh chance.');
    } else toast('No rerolls left. Find a Second sight relic.');
  }
  if (a === 'drop') {
    drop();
    return;
  }
  if (changed) {
    tone(a.startsWith('rotate') ? 250 : 180, 0.055, 'sine', 0.02);
    updateUI();
  }
}
$('start-button').onclick = startRun;
$('help-button').onclick = help;
$('pause-button').onclick = pause;
$('reset-view').onclick = () => {
  renderer.resetCamera();
  toast('Viewpoint reset.');
};
$('reroll-button').onclick = () => {
  action('reroll');
  $('world').focus({ preventScroll: true });
};
$('sound-button').onclick = () => {
  initAudio();
  sound = !sound;
  $('sound-button').setAttribute('aria-label', sound ? 'Turn sound off' : 'Turn sound on');
  $('sound-button').setAttribute('aria-pressed', String(sound));
  $('sound-button').innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z${sound ? 'm5 3c3 2 3 6 0 8m3-11c5 4 5 10 0 14' : 'm5 4 5 6m0-6-5 6'}"/></svg>`;
  if (sound) tone(440, 0.2);
  toast(sound ? 'Sound on' : 'Sound off');
};
$('fullscreen-button').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else toast('Fullscreen is unavailable in this browser.');
  } catch {
    toast('Fullscreen is unavailable in this window.');
  }
};
document.addEventListener('fullscreenchange', () => $('fullscreen-button').setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'));
document.addEventListener('keydown', (e) => {
  if (modalMode) {
    if (e.key === 'Tab') {
      const items = [...$('modal-content').querySelectorAll('button,[tabindex="0"]')],
        first = items[0],
        last = items.at(-1);
      if (e.shiftKey && (document.activeElement === first || document.activeElement === $('modal-content'))) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === $('modal-content'))) {
        e.preventDefault();
        first?.focus();
      }
    }
    if (e.code === 'Escape' && modalMode === 'pause') {
      e.preventDefault();
      pause();
    } else if (e.code === 'Escape' && modalMode === 'help') {
      e.preventDefault();
      $('close-help').click();
    }
    return;
  }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    e.preventDefault();
    pause();
    return;
  }
  if (e.key === '?' || e.code === 'KeyH') {
    e.preventDefault();
    help();
    return;
  }
  if (home) {
    if (e.code === 'Enter' && !e.repeat && document.activeElement.tagName !== 'BUTTON') startRun();
    return;
  }
  if (e.code === 'Space' && document.activeElement.tagName === 'BUTTON') return;
  const map = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
    KeyQ: 'rotate-back',
    KeyE: 'rotate',
    Space: 'drop',
    KeyR: 'reroll',
  };
  if (map[e.code]) {
    e.preventDefault();
    if (!e.repeat || e.code.startsWith('Arrow')) action(map[e.code]);
  }
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
    e.preventDefault();
    keys.add(e.code);
  }
  if (e.code === 'KeyV') renderer.resetCamera();
});
document.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => {
  keys.clear();
  if (!home && !paused && game.status === 'playing') pause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !home && !paused && game.status === 'playing') pause();
});
const canvas = $('world');
canvas.tabIndex = 0;
let dragging = false,
  lastX = 0,
  lastY = 0;
canvas.addEventListener('pointerdown', (e) => {
  if (paused || document.pointerLockElement) return;
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
  canvas.focus({ preventScroll: true });
});
canvas.addEventListener('pointermove', (e) => {
  if (paused || document.pointerLockElement) return;
  if (dragging) {
    renderer.look(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX;
    lastY = e.clientY;
    introTurn = 8;
  }
});
canvas.addEventListener('pointerup', () => (dragging = false));
canvas.addEventListener('pointercancel', () => (dragging = false));
canvas.addEventListener('dblclick', async () => {
  if (home || paused) return;
  try {
    await canvas.requestPointerLock?.();
    toast('Mouse locked. Esc releases and pauses.');
  } catch {
    toast('Drag to look around.');
  }
});
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas && !paused) renderer.look(e.movementX, e.movementY);
});
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && !home && !paused) pause();
});
for (const b of document.querySelectorAll('[data-action]'))
  b.onclick = () => {
    action(b.dataset.action);
    b.blur();
  };
function seedDemo() {
  game.reset();
  for (const [x, z, c] of [
    [0, 1, [2, 4]],
    [1, 1, [4, 8, 16]],
    [2, 1, [2, 4]],
    [3, 1, [8, 16, 32, 64]],
    [4, 1, [2, 4, 8]],
    [1, 2, [2, 4]],
    [2, 2, [8, 16, 32, 64, 128]],
    [3, 2, [2, 4, 8]],
    [4, 2, [4, 8]],
    [0, 3, [4]],
    [1, 3, [8, 16, 32]],
    [2, 3, [2]],
    [3, 3, [4, 8, 16]],
    [4, 3, [2, 4]],
    [1, 4, [2]],
    [2, 4, [4, 8]],
    [3, 4, [2]],
    [4, 4, [4]],
  ])
    game.board[x][z] = c;
  game.active = {
    name: 'T',
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [1, 1],
    ],
    value: 4,
  };
  game.x = 1;
  game.z = 1;
}
function frame(now) {
  const dt = Math.min(0.05, (now - previous) / 1000);
  previous = now;
  time += dt;
  busy = Math.max(0, busy - dt);
  shake = Math.max(0, shake - dt * 0.08);
  if (home && !paused && !dragging && !reduced) {
    introTurn = Math.max(0, introTurn - dt);
    if (!introTurn) {
      const a = -Math.PI / 4 + Math.sin(time * 0.12) * 0.03;
      renderer.camera.x = -Math.sin(a) * 6.3;
      renderer.camera.z = Math.cos(a) * 6.3;
      renderer.camera.y = 7.5;
      renderer.camera.yaw = a;
      renderer.camera.pitch = -1.05;
    }
  }
  if (!home && !paused && game.status === 'playing') {
    timer = Math.max(0, timer - dt);
    if (timer === 0) drop();
    renderer.moveCamera((keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0), (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), dt);
  }
  $('timer-value').textContent = `${timer.toFixed(1)}s`;
  $('timer-fill').style.width = `${Math.max(0, (timer / game.dropTime) * 100)}%`;
  document.querySelector('.drop-timer').classList.toggle('urgent', timer < 4);
  if (eventUntil && time > eventUntil) {
    $('event-feed').classList.remove('show');
    eventUntil = 0;
  }
  renderer.render(game, paused ? 0 : dt, time, {
    home,
    shake: paused ? 0 : shake,
  });
  requestAnimationFrame(frame);
}
seedDemo();
updateUI();
requestAnimationFrame(frame);
if (new URLSearchParams(location.search).has('debug'))
  window.fracture = {
    game,
    renderer,
    startRun,
    action,
    drop,
    updateUI,
    get paused() {
      return paused;
    },
    get timer() {
      return timer;
    },
  };
