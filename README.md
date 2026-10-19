# MERGE / FALL

A dependency-free 3D falling-block game with 2048 merges. The Canvas renderer projects solid cubes into an isometric view with a rotatable camera, landing previews, merge particles, and synthesized sound.

Install development tools with `bun install`. Run `bun start`, then visit http://localhost:5173. Bun serves the game with hot reloading. Run `bun test` for game rule checks.

Biome handles formatting, linting, and import organization. Run `bun run check` to check the project, `bun run check:fix` to apply safe fixes, `bun run lint` for linting only, or `bun run format` to format files. `bun run format:check` checks formatting without changing files. Use Bun for dependency management and project scripts.

Use arrow keys or WASD to move across the 4 × 4 well, Q/E to rotate the piece, Space to drop, and P to pause. Touch controls appear on smaller screens. Equal face-adjacent blocks merge, gravity settles the remaining blocks, and chain reactions continue until the board is stable. Reach 2048 and keep playing. Best scores and sound preference are saved in the browser.

The source is in `src/`. Run `bun run build` to bundle and minify the game into `dist/`, ready for static hosting. Development with `bun start` does not require a build.
