import assert from 'node:assert/strict';
import test from 'node:test';
import { Game, HEIGHT, SHAPES, SIZE } from '../src/engine.js';

const mass = (game) => game.board.flat(2).reduce((sum, v) => sum + v, 0);
const cubes = (game) => game.board.flat().reduce((sum, c) => sum + c.length, 0);
const playing = () => {
  const g = new Game(() => 0.1);
  g.status = 'playing';
  return g;
};

test('all seven tetrominoes contain four different grid cells', () => {
  assert.equal(Object.keys(SHAPES).length, 7);
  for (const shape of Object.values(SHAPES)) {
    assert.equal(shape.length, 4);
    assert.equal(new Set(shape.map((c) => c.join(','))).size, 4);
  }
});
test('a fresh run starts empty with a current piece, a queue and rerolls', () => {
  const g = playing();
  assert.equal(cubes(g), 0);
  assert.equal(g.queue.length, 3);
  assert.equal(g.active.cells.length, 4);
  assert.equal(g.rerolls, 2);
  assert.equal(g.target, 32);
});
test('a horizontal pair merges and falling cubes trigger a chain', () => {
  const g = playing();
  g.board[0][0] = [2, 4];
  g.board[1][0] = [2];
  const before = mass(g),
    events = g.resolve();
  assert.equal(mass(g), before);
  assert.equal(events.length, 2);
  assert.deepEqual(g.board[0][0], [8]);
  assert.deepEqual(g.board[1][0], []);
  assert.equal(g.score, 12);
  assert.equal(g.maxValue, 8);
});
test('vertical neighbors merge and gravity preserves a compact stack', () => {
  const g = playing();
  g.board[2][3] = [2, 2, 4, 8];
  g.resolve();
  assert.deepEqual(g.board[2][3], [16]);
  assert.equal(g.totalMerges, 3);
});
test('diagonal cubes do not merge', () => {
  const g = playing();
  g.board[0][0] = [2];
  g.board[1][1] = [2];
  assert.equal(g.resolve().length, 0);
  assert.equal(cubes(g), 2);
});
test('a rigid shape lands above its tallest column, then each cube settles', () => {
  const g = playing();
  g.active = { name: 'I', cells: SHAPES.I, value: 4 };
  g.x = 0;
  g.z = 0;
  g.board[0][0] = [2, 8, 16];
  assert.equal(g.landing(), 3);
  const result = g.drop();
  assert.ok(result.placed.every((c) => c.y === 3));
  assert.equal(mass(g), 26 + 16);
  assert.equal(g.drops, 1);
});
test('movement and wall-kicked rotation never leave the six by six grid', () => {
  const g = playing();
  g.active = { name: 'I', cells: SHAPES.I.map((c) => [...c]), value: 2 };
  g.x = 2;
  g.z = 5;
  assert.equal(g.move(1, 0), false);
  assert.equal(g.move(0, 1), false);
  assert.equal(g.rotate(), true);
  assert.ok(g.valid());
  for (let i = 0; i < 4; i++) {
    assert.ok(g.rotate());
    assert.ok(g.valid());
  }
});
test('an overflowing piece ends a run without modifying the board', () => {
  const g = playing();
  g.x = 1;
  g.z = 2;
  g.board[1][2] = Array.from({ length: HEIGHT }, (_, i) => 2 ** (i + 1));
  const before = mass(g),
    result = g.drop();
  assert.equal(result.overflow, true);
  assert.equal(g.status, 'over');
  assert.equal(mass(g), before);
});
test('a failsafe clears the top three layers and retains the current piece', () => {
  const g = playing();
  g.shields = 1;
  g.board[1][2] = Array(HEIGHT).fill(2);
  const piece = g.active,
    result = g.drop();
  assert.equal(result.shield, true);
  assert.equal(g.highest, 6);
  assert.equal(g.shields, 0);
  assert.equal(g.active, piece);
  assert.equal(g.status, 'playing');
});
test('floor completion offers upgrades and the chosen relic persists', () => {
  const g = playing();
  g.floorMerges = g.mergeGoal;
  g.drop();
  assert.equal(g.status, 'upgrade');
  assert.equal(new Set(g.choices().map((r) => r.id)).size, 3);
  assert.equal(g.choose('time'), true);
  assert.equal(g.floor, 2);
  assert.equal(g.extraTime, 3);
  assert.equal(g.floorMerges, 0);
  assert.equal(g.status, 'playing');
  assert.deepEqual(g.relics, ['time']);
});
test('amplifier increases merge score without changing merged values', () => {
  const g = playing();
  g.status = 'upgrade';
  g.choose('amplifier');
  g.board[0][0] = [2, 2];
  g.resolve();
  assert.equal(g.score, 6);
  assert.deepEqual(g.board[0][0], [4]);
});
test('pressure release removes exactly one bottom cube per occupied column', () => {
  const g = playing();
  g.board[0][0] = [2, 4, 8];
  g.board[1][0] = [16];
  g.status = 'upgrade';
  g.choose('purge');
  assert.deepEqual(g.board[0][0], [4, 8]);
  assert.deepEqual(g.board[1][0], []);
});
test('hot start doubles the hand, queue and future incoming values', () => {
  const g = playing(),
    old = g.active.value,
    queued = g.queue.map((p) => p.value);
  g.status = 'upgrade';
  g.choose('seed');
  assert.equal(g.active.value, old * 2);
  assert.deepEqual(
    g.queue.map((p) => p.value),
    queued.map((v) => v * 2),
  );
  assert.equal(g.makePiece().value, 8);
});
test('rerolls are bounded and new shapes remain in bounds', () => {
  const g = playing();
  g.x = 3;
  g.z = 4;
  assert.ok(g.reroll());
  assert.ok(g.valid());
  assert.ok(g.reroll());
  assert.equal(g.reroll(), false);
  assert.equal(g.rerolls, 0);
});
test('a 2048 merge wins the run', () => {
  const g = playing();
  g.board[5][5] = [1024, 1024];
  g.drop();
  assert.equal(g.maxValue, 2048);
  assert.equal(g.status, 'won');
});
test('random runs conserve cube values and finish with no mergeable neighbors', () => {
  let state = 1234567;
  const rng = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  for (let run = 0; run < 30; run++) {
    const g = new Game(rng);
    g.status = 'playing';
    for (let step = 0; step < 80; step++) {
      g.x = 0;
      g.z = 0;
      for (let i = 0; i < Math.floor(rng() * 4); i++) g.rotate();
      for (let i = 0; i < Math.floor(rng() * SIZE); i++) g.move(1, 0);
      for (let i = 0; i < Math.floor(rng() * SIZE); i++) g.move(0, 1);
      const before = mass(g),
        value = g.active.value,
        result = g.drop();
      if (result.overflow) break;
      assert.equal(mass(g), before + 4 * value);
      assert.ok(g.highest <= HEIGHT);
      assert.equal(g.resolve().length, 0);
      if (g.status === 'upgrade') g.choose('time');
      if (g.status === 'won') break;
    }
  }
});
