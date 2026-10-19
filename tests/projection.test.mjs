import assert from 'node:assert/strict';
import test from 'node:test';
import { compareCubes, cubeFaces } from '../src/projection.mjs';

test('visible faces keep their labels upright through a full camera turn', () => {
  for (let degrees = 5; degrees < 360; degrees += 10) {
    const angle = (degrees * Math.PI) / 180;
    const project = (x, y, z) => ({ x: x * Math.cos(angle) - z * Math.sin(angle), y: (x * Math.sin(angle) + z * Math.cos(angle)) * 0.46 - y * 0.91 });
    const { sides } = cubeFaces(project, angle);
    for (const [a, b, , d] of sides) {
      const determinant = (b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x);
      assert.ok(determinant > 0, `Mirrored face at ${degrees} degrees`);
    }
  }
});

test('only faces pointing toward the camera are drawn', () => {
  for (let quarter = 0; quarter < 4; quarter++) {
    const angle = Math.PI / 4 + (quarter * Math.PI) / 2;
    const { sides } = cubeFaces((x, y, z) => ({ x, y, z }), angle);
    for (const [a, b, , d] of sides) {
      const normalX = (d.y - a.y) * (b.z - a.z) - (d.z - a.z) * (b.y - a.y);
      const normalZ = (d.x - a.x) * (b.y - a.y) - (d.y - a.y) * (b.x - a.x);
      assert.ok(normalX * Math.sin(angle) + normalZ * Math.cos(angle) > 0, `Back face selected in quarter ${quarter}`);
    }
  }
});

test('a lower foreground cube covers a higher background cube at every camera quarter', () => {
  for (let quarter = 0; quarter < 4; quarter++) {
    const angle = Math.PI / 4 + (quarter * Math.PI) / 2;
    const back = { x: 1, y: 1, z: 1 };
    const front = { x: 1 + Math.sign(Math.sin(angle)), y: 0, z: 1 };
    assert.ok(compareCubes(front, back, angle) > 0, `Foreground cube drawn too early in quarter ${quarter}`);
    assert.ok(compareCubes({ ...back, y: 2 }, back, angle) > 0, 'Upper cubes cover the cubes directly beneath them');
  }
});
