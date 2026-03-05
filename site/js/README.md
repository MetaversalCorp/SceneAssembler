# Scene Assembler – JavaScript Modules

A 3D scene editor for the web. Assembles scenes from GLB/GLTF models, syncs with a JSON representation, and integrates with Metaversal Fabrics for 6DoF access via Metaverse Browser.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| 3D | Three.js 0.128 (OrbitControls, TransformControls, GLTFLoader) |
| UI | Bootstrap 5.3, Font Awesome 7, Outfit (Google Fonts) |
| Code editor | CodeMirror 6 (via `window.jsonEditorAPI`; ESM from esm.sh) |
| Tutorial | Driver.js 1.4 (Getting Started walkthrough) |
| Multi-user | Metaversal Fabric (vendor/mv/*), jQuery 3.7, Socket.io 4.8 |
| Entry | `maputil.js`, `rp1.js` (Fabric integration, scene load) |

---

## Architecture Overview

The app is split into **sa-*** modules. Each file has a single responsibility. Scripts load in dependency order (see `index.html`). Global state lives in `sa-core.js` (scene, camera, selection) and `sa-bootstrap.js` (DOM refs).

```
index.html
    └── maputil.js
    └── rp1.js (Fabric, scene load)
    └── sa-config.js
    └── sa-core.js
    └── sa-bootstrap.js
    └── sa-models.js
    └── sa-properties.js
    └── sa-transforms.js
    └── sa-json-sync.js
    └── sa-selection.js
    └── sa-groups.js
    └── sa-sidebar.js
    └── sa-ui.js
    └── sa-object-library.js
    └── sa-main.js
    └── sa-shell.js
    └── sa-tutorial.js
```

---

## Module Reference

| Module | Purpose | Depends on |
|--------|---------|------------|
| **sa-config.js** | Shared constants. No dependencies. | — |
| **sa-core.js** | Three.js scene, camera, renderer, lights, grid, ruler, human guide. | sa-config |
| **sa-bootstrap.js** | DOM refs, `getJSONEditorText`/`setJSONEditorText`, init on DOMContentLoaded. | sa-config, sa-core |
| **sa-models.js** | Model cache, `loadModelFromReference`, URL utilities. | sa-config |
| **sa-properties.js** | Bounds, clamping, texture info, properties panel updates. | sa-core, sa-bootstrap |
| **sa-transforms.js** | Transform gizmo, box helpers, undo/redo, canvas size, transform events. | sa-config, sa-core |
| **sa-json-sync.js** | Syncs JSON editor ↔ 3D scene; `buildNode`, `parseJSONAndUpdateScene`, export. | sa-core, sa-models |
| **sa-selection.js** | `selectObject`, `selectFromSidebar`, `selectFromCanvas`, select all, deselect. | sa-core |
| **sa-groups.js** | Group/ungroup, drag-drop attach, duplicate, delete. | sa-core |
| **sa-sidebar.js** | Builds outliner; `createSidebarItem`, `addGroupToList`, `addModelToList`, `makeLabelEditable`. | sa-core |
| **sa-ui.js** | Keyboard shortcuts, buttons, context menu, hover/selection, camera helpers. | sa-core |
| **sa-object-library.js** | Loads object library, preview thumbnails, add objects to scene. | sa-core |
| **sa-main.js** | `loadScene`, `refreshScene`; window exports for rp1.js. | sa-* |
| **sa-shell.js** | Bootstrap tooltips, code editor panel fade/resize, object library panel resize. | sa-config |
| **sa-tutorial.js** | Getting Started walkthrough using driver.js; sets `sceneAssemblerTutorialActive`. | sa-core, sa-bootstrap, sa-config, driver.js |

---

## Key Concepts

- **Object Root** – A `THREE.Group` that holds all scene objects. `userData.isCanvasRoot === true`.
- **Editor Group** – A group that can contain multiple models. `userData.isEditorGroup === true`.
- **Selection** – `selectedObject` (single), `selectedObjects` (array). Updated by `selectObject` in sa-selection.js.
- **JSON ↔ Scene** – The JSON editor and 3D scene stay in sync. Changes in one update the other via sa-json-sync.js.

---

## Important DOM IDs

| ID | Purpose |
|----|---------|
| `modelList` | Outliner (scene hierarchy) |
| `properties` | Properties panel container |
| `propertiesPanel` | Properties panel card |
| `jsonEditor` | Code editor container |
| `objLibPanel` | Object library offcanvas |
| `objLibGrid` | Object library grid |
| `objLibToggle` | Object library toggle button |
| `snap` | Snap-to-grid checkbox |
| `canvasSize` | Canvas size input |
| `setCanvasSize` | Set canvas size button |
| `translate`, `rotate`, `scale` | Transform mode buttons |
| `delete` | Delete button |
| `undo`, `redo` | Undo/redo buttons |
| `resetCamera` | Reset camera button |

---

## Exposed API (for rp1.js)

| Function | Module | Purpose |
|---------|--------|---------|
| `loadScene` | sa-main.js | Load a scene from Fabric/URL |
| `loadObjectLibrary` | sa-main.js | Load object library from URL |
| `generateSceneJSONEx` | sa-main.js | Export scene as JSON |

---

## Config (sa-config.js)

Constants used across modules. Edit here to change behavior:

- **Scene:** `SCENE_BACKGROUND`, `GRID_COLOR`, `GRID_COLOR_MINOR`, `RULER_COLOR`, `HUMAN_GUIDE_COLOR`
- **Selection:** `BOX_COLORS`, `BOX_HELPER_COLOR`, `OBJECT_ROOT_BOX_COLOR`, `ERROR_OBJECT_COLOR`
- **Camera:** `ORBIT_MAX_DISTANCE_MULTIPLIER`, `PAN_SPEED`, `FREE_MOVE_SPEED`
- **Lighting:** `LIGHT_HEMISPHERE_SKY`, `LIGHT_HEMISPHERE_GROUND`, `LIGHT_HEMISPHERE_INTENSITY`
- **Preview:** `PREVIEW_SIZE`, `PREVIEW_ROTATION_SPEED`, `PREVIEW_BACKGROUND`, `PREVIEW_SCALE_FIT`
- **Client Render Limits:** `TRI_SCENE_MAX`, `TEX_SCENE_MAX_MP`
- **Undo History:** `MAX_UNDO_HISTORY`
- **UI:** `MIN_CODE_EDITOR_WIDTH`, `MIN_OBJECT_LIBRARY_HEIGHT`

---

## Vendor Code

- **`vendor/mv/`** – Metaversal Fabric (multi-user, scene sync). Do not modify unless needed for integration.
- **`rp1.js`** – Fabric integration; entry point for scene loading.
- **`maputil.js`** – Map utilities used by rp1.js.

---

## Conventions

- **Naming:** `sa-*` = Scene Assembler module. `sa-` prefix keeps globals organized.
- **Globals:** Core state lives in sa-core.js. DOM refs in sa-bootstrap.js. Config in sa-config.js.
- **Dependencies:** Each module lists its dependencies in the file header. Load order in `index.html` must match.
- **userData:** Three.js objects use `userData` for app metadata (e.g. `isSelectable`, `isCanvasRoot`, `isEditorGroup`, `listItem`).

---

## For Contributors

1. **Add a feature:** Identify the right module and extend it. Add a new `sa-*.js` only if the responsibility is clearly separate.
2. **Change config:** Edit `sa-config.js`; avoid hardcoding values elsewhere.
3. **Debug:** Use browser DevTools. Key globals: `scene`, `camera`, `selectedObjects`, `canvasRoot`.
4. **Test:** Run a local server; open `index.html`. Fabric requires auth; JSON editor can be used without it.

---

## License

Apache-2.0. See repository root and file headers.
