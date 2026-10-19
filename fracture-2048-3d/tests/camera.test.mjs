import assert from 'node:assert/strict';
import test from 'node:test';
import { Renderer } from '../src/renderer.js';

for (const [direction, delta] of [
  ['left', -100],
  ['right', 100],
]) {
  test(`moving the mouse ${direction} turns the first-person camera ${direction}`, () => {
    const renderer = { camera: { x: 5, y: 7.5, z: 5, yaw: 0, pitch: 0 } };
    Renderer.prototype.look.call(renderer, delta, 0);
    // Walk in the resulting view direction to check the renderer's handedness too.
    Renderer.prototype.moveCamera.call(renderer, 1, 0, 0.1);
    assert.ok(delta < 0 ? renderer.camera.x < 5 : renderer.camera.x > 5);
  });
}
