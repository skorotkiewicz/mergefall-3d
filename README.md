# MERGE / FALL

A dependency-free 3D falling-block game with 2048 merges. The Canvas renderer projects solid cubes into an isometric view with a rotatable camera, landing previews, merge particles, and synthesized sound.

Run `npm start`, then visit http://localhost:5173. Run `npm test` for game rule checks and `npm run check` for JavaScript syntax checks.

Use arrow keys or WASD to move across the 4 × 4 well, Q/E to rotate the piece, Space to drop, and P to pause. Touch controls appear on smaller screens. Equal face-adjacent blocks merge, gravity settles the remaining blocks, and chain reactions continue until the board is stable. Reach 2048 and keep playing. Best scores and sound preference are saved in the browser.

The static website is in `mergefall/dist/`. No build step is required.
