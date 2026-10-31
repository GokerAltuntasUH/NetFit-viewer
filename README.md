# NetFit Viewer

A static browser interface for a graph attention workshop, with a dropdown selecting two focused viewers.

## AI notice

NetFit Viewer was generated using OpenAI models. AI was used to generate and refine the application code and documentation under the project author's direction.

## Viewer: 1 - graph observations

Open `index.html` in a browser and select **Viewer: 1**, or open `index.html#observations` directly. No installation, server, build, or Colab connection is required.

- Start with the included example (seed 42, road-node jitter 6), or open an individual `graph-workshop-scenario` JSON exported by the notebook.
- Select a node from the dropdown or click it in the graph to update the inspector and highlight incoming messages. Graph nodes also support keyboard focus and Enter/Space. Use **Open neighbourhood** to open the details pop-up; selecting nodes does not open it.
- Inspect road-node x/y coordinates and the readable node type. Displayed coordinates are rounded to three decimals; calculations use the original values.
- Compare bidirectional road messages with one-way messages following JSON source-to-target storage order. One-way mode is an illustrative experiment, not real road direction or a learned policy.
- Toggle self-messages separately. Neighbour counts exclude the selected node; message counts include its self-message when enabled.

All parsing and geometry run in the browser. Files are not uploaded to a server, and loaded data is not persisted across reloads. Invalid files produce an error while retaining the previous valid scene. Extract a single JSON scene from a bulk ZIP before loading it; manifests and ZIP files are not accepted.

The interactive import limits are 5 MB, 5,000 nodes, 12,000 roads, 1,500 axis-aligned rectangular buildings. Use smaller layouts for classroom inspection.

## Viewer: 2 - actions and rewards

Select **Viewer: 2**, or open `index.html#actions`. Use the included example or load an individual scenario JSON independently of Viewer: 1.

- Select a road node, then use the on-screen arrows or keyboard arrow keys to move it one unit along x or y. Keyboard movement is active only in Viewer: 2 and does not override native form controls.
- Physical road segments follow their endpoints. Red segments mark the exact length inside buildings; orange segments mark roads outside the site. Buildings remain fixed. No message arrows or neighbourhood connections are shown.
- Watch the current score and last move reward (new score minus previous score). A positive reward means an improvement. Undo reverses one move; Reset restores the loaded layout.
- The length cards count each physical road once. The score reproduces the source calculation: `-(0.4 * intersection penalty length + 0.6 * off-site penalty length)`. It counts both stored road directions and road self-edges, including the `0.0001` minimum for a building contact. Coordinates and moves use float32 precision. Movements are not clamped to the site.
- Expand the scoring explanation or road-building intersection table for details. These are intersection lengths, not surface areas. No training is performed.

Viewer: 2 owns a separate copy of its scenario; its moves do not change Viewer: 1.

## Files

- `index.html`, `styles.css`, `app.js`: interface, graph rendering, and node inspection.
- `graph.js`: shared validation and message-edge helpers. Context-edge helpers are retained for later work but are not used by Viewer: 1.
- `actions-core.js`: pure clipping, scoring, unit-step movement, undo, and reset.
- `actions-view.js`: independent Viewer: 2 interface and movement controls.
- `example.js`: built-in workshop-generator scene; embedded so opening local files works without fetching JSON.
- `tests/graph.test.cjs`: dependency-free geometry/graph checks; run `node tests/graph.test.cjs`.
- `tests/app.test.cjs`: isolated DOM test double for control and import behaviour; run `node tests/app.test.cjs`. This does not replace a visual browser check.

Additional checks: `node tests/actions-core.test.cjs` compares 66 scores against fixtures produced by the original Python scoring function and checks movement and contact cases. `node tests/actions-view.test.cjs` checks controls, keyboard scoping, import handling, and Viewer: 1 isolation using a DOM test double. Reference values are stored in `tests/scoring-reference.json`.

## Static hosting

All assets use relative paths and are suitable for a GitHub Pages project site. Keep `index.html`, `styles.css`, `graph.js`, `example.js`, `app.js`, `actions-core.js`, and `actions-view.js` together in the published directory. No server-side runtime or build step is required. The built-in example also works when opening `index.html` locally.
