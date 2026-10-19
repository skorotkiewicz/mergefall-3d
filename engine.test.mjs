import assert from 'node:assert/strict';
import test from 'node:test';
import { fits, initialBoard, landing, resolve, rotated } from './src/engine.mjs';

test('landing stays above occupied cells and never below the floor', () => {
  const p = {
    x: 0,
    y: 6,
    z: 0,
    cells: [
      [0, 0, 0],
      [0, 1, 0],
    ],
    value: 2,
  };
  assert.equal(landing([], p).y, 0);
  assert.equal(landing([{ x: 0, y: 0, z: 0, value: 4 }], p).y, 1);
  assert.equal(fits([], { ...p, x: -1 }), false);
  assert.equal(fits([], { ...p, y: 7 }), false);
});
test('equal face neighbors merge and gravity triggers a chain', () => {
  const { board, score, merges } = resolve([
    { x: 0, y: 0, z: 0, value: 2 },
    { x: 1, y: 0, z: 0, value: 2 },
    { x: 0, y: 1, z: 0, value: 4 },
  ]);
  assert.equal(board.length, 1);
  assert.equal(board[0].value, 8);
  assert.equal(board[0].y, 0);
  assert.equal(score, 12);
  assert.equal(merges, 2);
});
test('diagonal neighbors do not merge', () => {
  const result = resolve([
    { x: 0, y: 0, z: 0, value: 2 },
    { x: 1, y: 0, z: 1, value: 2 },
  ]);
  assert.equal(result.merges, 0);
});
test('four rotations restore the piece footprint', () => {
  const p = {
    x: 1,
    y: 6,
    z: 1,
    value: 2,
    cells: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 0, 1],
    ],
  };
  let r = p;
  for (let i = 0; i < 4; i++) r = rotated(r);
  assert.deepEqual(r, p);
});
test('starter board is stable and has no automatic merges', () => {
  const initial = initialBoard(),
    result = resolve(initial);
  assert.equal(result.merges, 0);
  assert.equal(result.board.length, initial.length);
});
test('a long simulated session preserves bounds, occupancy, and powers of two', () => {
  let board = [];
  for (let n = 0; n < 150; n++) {
    const p = {
      x: n % 4,
      y: 7,
      z: Math.floor(n / 4) % 4,
      value: n % 3 === 0 ? 4 : 2,
      cells: [[0, 0, 0]],
    };
    if (!fits(board, p)) break;
    board = resolve([...board, ...[{ ...landing(board, p), cells: undefined }].map(({ x, y, z, value }) => ({ x, y, z, value }))]).board;
    assert.equal(new Set(board.map((c) => `${c.x},${c.y},${c.z}`)).size, board.length);
    assert.ok(board.every((c) => c.y >= 0 && c.y < 8 && Number.isInteger(Math.log2(c.value))));
  }
});
