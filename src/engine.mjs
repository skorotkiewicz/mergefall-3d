export const SIZE = 4,
  HEIGHT = 8;
export const shapes = [
  [
    [0, 0, 0],
    [0, 1, 0],
  ],
  [
    [0, 0, 0],
    [1, 0, 0],
  ],
  [
    [0, 0, 0],
    [1, 0, 0],
    [0, 0, 1],
  ],
  [[0, 0, 0]],
  [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
  ],
];
export function piece(random = Math.random) {
  const value = random() < 0.72 ? 2 : random() < 0.85 ? 4 : 8;
  return {
    cells: shapes[Math.floor(random() * shapes.length)].map((c) => [...c]),
    value,
    x: 1,
    y: 6,
    z: 1,
  };
}
export function cellsOf(p) {
  return p.cells.map(([x, y, z]) => ({
    x: p.x + x,
    y: p.y + y,
    z: p.z + z,
    value: p.value,
  }));
}
export function fits(board, p) {
  return cellsOf(p).every((c) => c.x >= 0 && c.x < SIZE && c.z >= 0 && c.z < SIZE && c.y >= 0 && c.y < HEIGHT && !board.some((b) => b.x === c.x && b.y === c.y && b.z === c.z));
}
export function landing(board, p) {
  const out = { ...p };
  while (fits(board, { ...out, y: out.y - 1 })) out.y--;
  return out;
}
export function rotated(p, dir = 1) {
  let cells = p.cells.map(([x, y, z]) => (dir === 1 ? [-z, y, x] : [z, y, -x]));
  const minX = Math.min(...cells.map((c) => c[0])),
    minZ = Math.min(...cells.map((c) => c[2]));
  cells = cells.map(([x, y, z]) => [x - minX, y, z - minZ]);
  return { ...p, cells };
}
export function settle(input) {
  const board = input.map((c) => ({ ...c }));
  board.sort((a, b) => a.y - b.y);
  for (const c of board) {
    while (c.y > 0 && !board.some((b) => b !== c && b.x === c.x && b.z === c.z && b.y === c.y - 1)) c.y--;
  }
  return board;
}
export function resolve(input) {
  let board = settle(input),
    score = 0,
    merges = 0;
  const events = [];
  for (let safety = 0; safety < 1000; safety++) {
    let pair = null;
    for (let i = 0; i < board.length && !pair; i++)
      for (let j = i + 1; j < board.length; j++) {
        const a = board[i],
          b = board[j];
        if (a.value === b.value && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) === 1) {
          pair = [i, j];
          break;
        }
      }
    if (!pair) break;
    const [i, j] = pair;
    let a = board[i],
      b = board[j];
    if (b.y < a.y) [a, b] = [b, a];
    const merged = { ...a, value: a.value * 2 };
    score += merged.value;
    merges++;
    events.push(merged);
    board = board.filter((_, n) => n !== i && n !== j);
    board.push(merged);
    board = settle(board);
  }
  return { board, score, merges, events };
}
export function initialBoard() {
  return [
    { x: 0, y: 0, z: 0, value: 4 },
    { x: 1, y: 0, z: 0, value: 8 },
    { x: 2, y: 0, z: 0, value: 2 },
    { x: 0, y: 0, z: 1, value: 16 },
    { x: 1, y: 0, z: 1, value: 32 },
    { x: 2, y: 0, z: 1, value: 4 },
    { x: 3, y: 0, z: 1, value: 2 },
    { x: 0, y: 0, z: 2, value: 2 },
    { x: 1, y: 0, z: 2, value: 8 },
    { x: 2, y: 0, z: 2, value: 16 },
    { x: 0, y: 1, z: 0, value: 2 },
    { x: 0, y: 1, z: 1, value: 4 },
    { x: 1, y: 1, z: 1, value: 2 },
    { x: 0, y: 2, z: 1, value: 8 },
  ];
}
