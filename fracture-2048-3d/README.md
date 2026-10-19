# FRACTURE // 2048

A first-person 3D puzzle roguelike. Drop Tetris shapes into a six by six chamber, merge equal numbered cubes, and reach 2048 before the stack reaches the ceiling.

## Play locally

```sh
bun dev
```

Open **http://localhost:5173** in a browser with WebGL enabled. Bun serves the HTML directly and reloads changes. The game also works on touch screens.

For a production build, run `bun run build`, then `bun start`.

## Controls

| Input | Action |
| --- | --- |
| Arrow keys | Place the shape on the chamber grid |
| Q / E | Rotate counterclockwise / clockwise |
| Space | Drop |
| R | Reroll the current piece |
| WASD | Walk around the observation deck |
| Drag | Look around |
| Double-click the scene | Lock the mouse for first-person looking |
| V | Reset the camera |
| Esc / P | Pause |
| ? / H | How to play |

Shapes fall automatically when the drop timer expires. Cubes settle independently after a shape lands. Equal cubes touching along a face merge, and gravity can cause further merges. Diagonal cubes do not merge.

Reach a chamber's target number or merge count to choose one of three random relics. Relics change merge scores, drop time, incoming values, rerolls, or overflow protection. The board carries between chambers. An overflowing drop ends the run. Merging a 2048 cube wins.

Personal best, run count and deepest chamber stay in this browser. Sound starts muted and can be enabled with the speaker button.

## Checks

Run the rules tests and build the browser bundle:

```sh
bun install
bun test
bun run build
bun run check
```

`src/` contains the standalone browser game. `engine.js` contains the rules, `renderer.js` contains the WebGL renderer, and `game.js` handles input, UI, audio and progression. Bun provides the development server and builds the static site into `dist/`. Biome is a development dependency. The game has no third-party runtime dependencies.

For browser debugging, open `/?debug` to expose `window.fracture` with the game, renderer and control functions.
