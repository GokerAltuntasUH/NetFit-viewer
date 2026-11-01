# Viewer development guide

Build a lightweight static web application for an introductory graph attention workshop. The project is named NetFit Viewer. GitHub Pages is the future target; keep relative asset paths and avoid requiring a server-side runtime.

Use one simple dropdown to select three distinct interfaces. Shared utilities are welcome; each view must expose only its relevant capabilities:
- Viewer: 1 - node features, incoming neighbours, edge types, and message direction.
- Viewer: 2 - four unit-step road-node movements, scores, undo, and reset.
- Viewer: 3 - the same movement/scoring interface as Viewer: 2, plus directed ghost edges (obstacle-context links).

Use **obstacle-context edges** for directed information links from intersected building corners to road-segment endpoints. These are not physical roads or attention weights.

The companion notebook uses self-contained code and downloads JSON scenarios. Viewer files should open in a separate browser tab and accept data independently of Colab. Use the scene format `graph-workshop-scenario` and the generator's documented parameters. Do not add Google connections or notebook-runtime dependencies.

Viewer: 1 now implements local JSON loading, graph rendering, node inspection, an incoming-neighbourhood dialog, and toggles for road message direction and self-messages. It is strictly a Day 1 road-node observation graph: no building-node markers, selection, neighbours, or obstacle-context controls. Keep buildings only as background footprints, and do not calculate context edges when loading Viewer: 1. Keep movement, reward calculation, and training out of Viewer: 1. Keep repository setup and publishing for later user instructions.

`graph.js` contains pure graph logic and has dependency-free checks in `tests/graph.test.cjs`. Physical roads are undirected; one-way storage-order mode is explicitly an illustrative option. Building outlines are not message edges, and context edges are directed building-to-road only. Defaults: bidirectional roads and self-messages on. Only road nodes participate. Context edges are out of scope, not merely hidden by default. Keep the built-in example usable through file:// without network requests.

Node selection (click, keyboard, or dropdown) updates the inspector without opening a dialog. Only the explicit Open neighbourhood button opens the pop-up.

Viewer: 2 is implemented in `actions-core.js` and `actions-view.js`. Keep its scene independent of Viewer: 1. It shows physical roads, clipped building-intersection segments, off-site segments, road-node selection, four one-unit movements, live score/reward, undo, and reset. Do not add message arrows or obstacle-context edges here. Buildings stay fixed. Match the original float32 movement and Liang-Barsky score, including both directed road entries, first-use road self-edges, and the 0.0001 minimum building-contact penalty. Default intersection/off-site weights are 0.4/0.6; movements are not site-clamped. Physical length cards count each road once and must remain distinct from scoring penalty totals.

Run `tests/actions-core.test.cjs` for Python-reference scoring comparisons and `tests/actions-view.test.cjs` for isolated DOM control checks, alongside the existing graph/app checks. DOM doubles do not verify visual layout. Keep scripts ASCII with Unicode escapes and HTML entities to avoid encoding corruption on Windows.

Viewer: 3 shares the movement controller in `actions-view.js` but owns a separate scene and history. Its ghost edges are directed, dashed links from all four corners of intersected buildings to both road endpoints, deduplicated per corner/endpoint pair. Recompute links from current clipped intersections after moves, undo, reset, and loads; boundary contacts count. Ghost edges are information links only, never physical roads, score penalties, or attention weights. Keep them exclusive to Viewer: 3.
