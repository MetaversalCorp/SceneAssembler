/**
 * sa-main.js
 * Orchestration: loadScene, refreshScene; window exports for rp1.js.
 * Depends: sa-config, sa-core, sa-bootstrap, sa-models, sa-properties, sa-transforms,
 *         sa-json-sync, sa-selection, sa-groups, sa-sidebar, sa-ui, sa-object-library
 * Exposes: loadScene, loadObjectLibrary, generateSceneJSONEx (for rp1.js)
 */
/*
** Copyright 2025 Metaversal Corporation.
**
** Licensed under the Apache License, Version 2.0 (the "License");
** you may not use this file except in compliance with the License.
** You may obtain a copy of the License at
**
**    https://www.apache.org/licenses/LICENSE-2.0
**
** Unless required by applicable law or agreed to in writing, software
** distributed under the License is distributed on an "AS IS" BASIS,
** WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
** See the License for the specific language governing permissions and
** limitations under the License.
**
** SPDX-License-Identifier: Apache-2.0
*/

async function loadScene(sJSONScene, clearHistory = true) {
   if (clearHistory) {
      undoStack = [];
      redoStack = [];

      if (window.jsonEditorAPI && window.jsonEditorAPI.clearHistory) {
         window.jsonEditorAPI.clearHistory();
      }

      deselectAllSidebar();

      animateCamera(new THREE.Vector3(groundSize, groundSize, groundSize), new THREE.Vector3(0, 0, 0));
   }

   await parseJSONAndUpdateScene(sJSONScene, true);

   if (clearHistory) {
      if (window.jsonEditorAPI && window.jsonEditorAPI.clearHistory) {
         window.jsonEditorAPI.clearHistory();
      }

      if (!isUndoRedoInProgress) {
         const initialState = {
            type: 'load',
            timestamp: Date.now(),
            sceneJSON: generateSceneJSON()
         };
         undoStack.push(initialState);
      }
   }

   updateUndoRedoButtons();
}

async function refreshScene(sJSONScene) {
   await loadScene(sJSONScene, false);
}

// Initialize undo/redo and transform button states
updateUndoRedoButtons();
updateTransformButtonStates();

setInterval(() => {
    updateUndoRedoButtons();
}, 100);

// Expose for rp1.js (must be global)
window.generateSceneJSONEx = generateSceneJSONEx;
window.loadScene = loadScene;
window.loadObjectLibrary = loadObjectLibrary;
