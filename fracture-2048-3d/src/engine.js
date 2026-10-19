export const SIZE = 6,
  HEIGHT = 9;
export const SHAPES = {
  T: [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 1],
  ],
  L: [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
  ],
  J: [
    [1, 0],
    [1, 1],
    [1, 2],
    [0, 2],
  ],
  S: [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ],
  Z: [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
  I: [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ],
  O: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
};
export const RELICS = [
  {
    id: 'amplifier',
    icon: '×',
    name: 'Signal amplifier',
    tag: 'SCORE',
    description: 'Every merge scores 50% more.',
    detail: '+50% merge score',
  },
  {
    id: 'time',
    icon: '◷',
    name: 'Time dilation',
    tag: 'CONTROL',
    description: 'Gain 3 extra seconds before each piece falls.',
    detail: '+3 seconds per drop',
  },
  {
    id: 'purge',
    icon: '↓',
    name: 'Pressure release',
    tag: 'SPACE',
    description: 'Remove the bottom layer. Everything above settles.',
    detail: 'Clear the bottom layer',
  },
  {
    id: 'seed',
    icon: '↑',
    name: 'Hot start',
    tag: 'POWER',
    description: 'New cubes start one power higher. Merges grow faster.',
    detail: 'Double incoming values',
  },
  {
    id: 'reroll',
    icon: '↻',
    name: 'Second sight',
    tag: 'CONTROL',
    description: 'Gain 3 rerolls to replace your current shape.',
    detail: '+3 piece rerolls',
  },
  {
    id: 'shield',
    icon: '◇',
    name: 'Failsafe',
    tag: 'SURVIVAL',
    description: 'Survive one overflow. The top 3 layers are cleared.',
    detail: '+1 overflow protection',
  },
];
export class Game {
  constructor(random = Math.random) {
    this.random = random;
    this.reset();
  }
  reset() {
    this.board = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => []));
    Object.assign(this, {
      score: 0,
      floor: 1,
      maxValue: 2,
      floorMerges: 0,
      totalMerges: 0,
      drops: 0,
      multiplier: 1,
      extraTime: 0,
      seed: 0,
      rerolls: 2,
      shields: 0,
      relics: [],
      status: 'ready',
      x: 1,
      z: 2,
    });
    this.queue = [this.makePiece(), this.makePiece(), this.makePiece()];
    this.active = this.queue.shift();
    this.queue.push(this.makePiece());
    return this;
  }
  get target() {
    return Math.min(2048, 2 ** (this.floor + 4));
  }
  get mergeGoal() {
    return 8 + this.floor * 4;
  }
  get dropTime() {
    return Math.max(5, 16 - this.floor) + this.extraTime;
  }
  get highest() {
    return Math.max(0, ...this.board.flat().map((c) => c.length));
  }
  makePiece() {
    const names = Object.keys(SHAPES),
      name = names[Math.floor(this.random() * names.length)];
    return {
      name,
      cells: SHAPES[name].map((c) => [...c]),
      value: 2 ** (1 + this.seed + (this.random() < 0.18 ? 1 : 0)),
    };
  }
  valid(cells = this.active.cells, x = this.x, z = this.z) {
    return cells.every(([dx, dz]) => x + dx >= 0 && x + dx < SIZE && z + dz >= 0 && z + dz < SIZE);
  }
  move(dx, dz) {
    if (this.status !== 'playing' || !this.valid(this.active.cells, this.x + dx, this.z + dz)) return false;
    this.x += dx;
    this.z += dz;
    return true;
  }
  rotate(direction = 1) {
    if (this.status !== 'playing') return false;
    let cells = this.active.cells.map(([x, z]) => (direction > 0 ? [-z, x] : [z, -x]));
    const minX = Math.min(...cells.map((c) => c[0])),
      minZ = Math.min(...cells.map((c) => c[1]));
    cells = cells.map(([x, z]) => [x - minX, z - minZ]);
    const x = Math.min(this.x, SIZE - 1 - Math.max(...cells.map((c) => c[0]))),
      z = Math.min(this.z, SIZE - 1 - Math.max(...cells.map((c) => c[1])));
    if (!this.valid(cells, x, z)) return false;
    this.active.cells = cells;
    this.x = x;
    this.z = z;
    return true;
  }
  landing() {
    return Math.max(...this.active.cells.map(([dx, dz]) => this.board[this.x + dx][this.z + dz].length));
  }
  reroll() {
    if (this.status !== 'playing' || this.rerolls <= 0) return false;
    this.rerolls--;
    this.active = this.makePiece();
    this.x = Math.min(this.x, SIZE - 1 - Math.max(...this.active.cells.map((c) => c[0])));
    this.z = Math.min(this.z, SIZE - 1 - Math.max(...this.active.cells.map((c) => c[1])));
    return true;
  }
  drop() {
    if (this.status !== 'playing') return null;
    const y = this.landing();
    if (y >= HEIGHT) {
      if (this.shields > 0) {
        this.shields--;
        for (const c of this.board.flat()) c.splice(HEIGHT - 3);
        return { shield: true, events: [], merges: 0, score: 0 };
      }
      this.status = 'over';
      return { overflow: true, events: [], merges: 0, score: 0 };
    }
    const placed = this.active.cells.map(([dx, dz]) => ({
      x: this.x + dx,
      z: this.z + dz,
      y,
      value: this.active.value,
    }));
    for (const c of placed) this.board[c.x][c.z].push(c.value);
    this.drops++;
    const before = this.score,
      events = this.resolve();
    this.score += 4;
    this.active = this.queue.shift();
    this.queue.push(this.makePiece());
    this.x = Math.floor((SIZE - 1 - Math.max(...this.active.cells.map((c) => c[0]))) / 2);
    this.z = Math.floor((SIZE - 1 - Math.max(...this.active.cells.map((c) => c[1]))) / 2);
    if (this.maxValue >= 2048) this.status = 'won';
    else if (this.maxValue >= this.target || this.floorMerges >= this.mergeGoal) this.status = 'upgrade';
    return {
      placed,
      events,
      merges: events.length,
      score: this.score - before,
    };
  }
  resolve() {
    const events = [];
    let merged = true;
    // Each merge removes a cube. Rescanning after gravity guarantees termination.
    while (merged) {
      merged = false;
      scan: for (let y = 0; y < HEIGHT; y++)
        for (let x = 0; x < SIZE; x++)
          for (let z = 0; z < SIZE; z++) {
            const v = this.board[x][z][y];
            if (!v) continue;
            for (const [nx, nz, ny] of [
              [x, z, y + 1],
              [x + 1, z, y],
              [x, z + 1, y],
            ]) {
              if (nx >= SIZE || nz >= SIZE || this.board[nx][nz][ny] !== v) continue;
              this.board[x][z][y] = v * 2;
              this.board[nx][nz].splice(ny, 1);
              this.maxValue = Math.max(this.maxValue, v * 2);
              this.score += Math.round(v * 2 * this.multiplier);
              this.totalMerges++;
              this.floorMerges++;
              events.push({ x, z, y, value: v * 2 });
              merged = true;
              break scan;
            }
          }
    }
    return events;
  }
  choices() {
    return [...RELICS]
      .map((r) => ({ ...r, sort: this.random() }))
      .sort((a, b) => a.sort - b.sort)
      .slice(0, 3);
  }
  choose(id) {
    if (this.status !== 'upgrade' || !RELICS.some((r) => r.id === id)) return false;
    if (id === 'amplifier') this.multiplier += 0.5;
    if (id === 'time') this.extraTime += 3;
    if (id === 'purge') for (const c of this.board.flat()) c.shift();
    if (id === 'seed') {
      this.seed = Math.min(6, this.seed + 1);
      this.active.value *= 2;
      for (const p of this.queue) p.value *= 2;
    }
    if (id === 'reroll') this.rerolls += 3;
    if (id === 'shield') this.shields++;
    this.relics.push(id);
    this.floor++;
    this.floorMerges = 0;
    this.status = 'playing';
    return true;
  }
}
