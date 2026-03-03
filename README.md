# SceneAssembler

A web-based 3D scene editor that assembles scenes from GLB/GLTF models, syncs with a JSON representation, and integrates with **Metaversal Fabric** for multi-user editing.

---

## Table of Contents

- [For Beginners](#for-beginners)
  - [What is SceneAssembler?](#what-is-sceneassembler)
  - [Quick Start](#quick-start)
  - [Basic Workflow](#basic-workflow)
  - [Getting Started Tutorial](#getting-started-tutorial)
  - [Keyboard Shortcuts](#keyboard-shortcuts)
  - [Troubleshooting](#troubleshooting)
- [For Advanced Users](#for-advanced-users)
  - [Architecture](#architecture)
  - [Tech Stack](#tech-stack)
  - [Configuration](#configuration)
  - [Module Reference](#module-reference)
  - [API & Integration](#api--integration)
  - [Contributing](#contributing)
- [License](#license)

---

## For Beginners

### What is SceneAssembler?

SceneAssembler lets you:

- **Add 3D objects** from a library (GLB/GLTF models) into a scene
- **Move, rotate, and scale** objects with an interactive gizmo
- **Edit the scene as JSON** in a code editor (changes sync both ways)
- **Export** your scene for use in Metaversal Fabric or other tools
- **Collaborate** with others when connected to a Fabric

### Quick Start

1. **Serve the app locally** (required for proper loading):

   ```bash
   cd site
   python3 -m http.server 8080
   ```

   Or with Node.js:

   ```bash
   npx serve site -p 8080
   ```

2. **Open in your browser:** `http://localhost:8080`

3. **Log in** (if using Fabric): Enter your Fabric URL and admin key in the login modal.

4. **Or use without Fabric:** You can still use the JSON editor and object library to build scenes locally.

### Basic Workflow

| Step | Action |
|------|--------|
| Add objects | Click the **Object Library** icon (bottom bar) → click a model to add it to the scene |
| Select | Click an object in the 3D viewport or in the **Scene Outliner** (left sidebar) |
| Move / Rotate / Scale | Use the **W** / **E** / **R** buttons (or toolbar) and drag the gizmo handles |
| Edit JSON | Open the **Code Editor** panel to edit the scene structure directly |
| Undo / Redo | Use the toolbar buttons or keyboard shortcuts |
| Export | Use the export option to get your scene as JSON |

### Getting Started Tutorial

When you first open the app, a **Getting Started** tour guides you through the main features. You can restart it anytime from the help menu or settings.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `W` | Translate (move) mode |
| `E` | Rotate mode |
| `R` | Scale mode |
| `Delete` / `Backspace` | Delete selected object(s) |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+A` | Select all |
| `Escape` | Deselect |

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Blank screen | Serve the app over HTTP (don’t open `file://`). Use `python3 -m http.server` or `npx serve`. |
| Models not loading | Check the browser console for CORS or 404 errors. Ensure model URLs are accessible. |
| Login modal stuck | Fabric requires a valid URL and key. For local-only use, you can work with the JSON editor without logging in. |
| Gizmo not visible | Make sure an object is selected (highlighted in the outliner). |

---

## For Advanced Users

### Architecture

The app is split into **`sa-*`** modules. Each file has a single responsibility. Scripts load in dependency order (see `site/index.html`). Global state lives in `sa-core.js` (scene, camera, selection) and `sa-bootstrap.js` (DOM refs).

```
index.html
    └── rp1.js (Fabric integration, scene load)
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

**Key concepts:**

- **Object Root** – A `THREE.Group` that holds all scene objects. `userData.isCanvasRoot === true`.
- **Editor Group** – A group that can contain multiple models. `userData.isEditorGroup === true`.
- **Selection** – `selectedObject` (single), `selectedObjects` (array). Updated by `selectObject` in `sa-selection.js`.
- **JSON ↔ Scene** – The JSON editor and 3D scene stay in sync via `sa-json-sync.js`.

### Tech Stack

| Layer | Technology |
|-------|------------|
| 3D | Three.js (OrbitControls, TransformControls, GLTFLoader) |
| UI | Bootstrap 5, Font Awesome |
| Code editor | CodeMirror (via `window.jsonEditorAPI`) |
| Multi-user | Metaversal Fabric (`vendor/mv/*`) |
| Entry | `rp1.js` (Fabric integration), `maputil.js` |

### Configuration

Edit `site/js/sa-config.js` to change behavior:

| Category | Constants |
|----------|-----------|
| **Scene** | `SCENE_BACKGROUND`, `GRID_COLOR`, `GRID_COLOR_MINOR`, `RULER_COLOR`, `HUMAN_GUIDE_COLOR` |
| **Selection** | `BOX_COLORS`, `BOX_HELPER_COLOR`, `OBJECT_ROOT_BOX_COLOR`, `ERROR_OBJECT_COLOR` |
| **Camera** | `ORBIT_MAX_DISTANCE_MULTIPLIER`, `PAN_SPEED`, `FREE_MOVE_SPEED` |
| **Lighting** | `LIGHT_HEMISPHERE_SKY`, `LIGHT_HEMISPHERE_GROUND`, `LIGHT_HEMISPHERE_INTENSITY` |
| **Preview** | `PREVIEW_SIZE`, `PREVIEW_ROTATION_SPEED`, `PREVIEW_BACKGROUND`, `PREVIEW_SCALE_FIT` |
| **Limits** | `TRI_SCENE_MAX`, `TEX_SCENE_MAX_MP` |
| **Undo** | `MAX_UNDO_HISTORY` |
| **UI** | `MIN_CODE_EDITOR_WIDTH`, `MIN_OBJECT_LIBRARY_HEIGHT` |

### Module Reference

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

### API & Integration

**Exposed API (for `rp1.js` / Fabric):**

| Function | Module | Purpose |
|----------|--------|---------|
| `loadScene(sJSONScene, clearHistory)` | sa-main.js | Load a scene from Fabric/URL |
| `loadObjectLibrary(sRootUrl)` | sa-main.js | Load object library from URL |
| `generateSceneJSONEx()` | sa-main.js | Export scene as JSON |

**Important DOM IDs** (see `site/js/README.md` for full list):

- `modelList` – Outliner (scene hierarchy)
- `properties` / `propertiesPanel` – Properties panel
- `jsonEditor` – Code editor container
- `objLibPanel` / `objLibGrid` / `objLibToggle` – Object library
- `snap`, `canvasSize`, `setCanvasSize` – Scene settings
- `translate`, `rotate`, `scale` – Transform mode buttons
- `undo`, `redo`, `delete`, `resetCamera` – Toolbar actions

**Debugging:** Use browser DevTools. Key globals: `scene`, `camera`, `selectedObjects`, `canvasRoot`.

### Contributing

1. **Add a feature:** Identify the right module and extend it. Add a new `sa-*.js` only if the responsibility is clearly separate.
2. **Change config:** Edit `sa-config.js`; avoid hardcoding values elsewhere.
3. **Test:** Run a local server; open `index.html`. Fabric requires auth; JSON editor can be used without it.

For more detail on modules, conventions, and vendor code, see **[site/js/README.md](site/js/README.md)**.

---

## License

Apache-2.0. See [LICENSE](LICENSE) and file headers.
