/**
 * sa-transforms.js
 * Transform controls, box helpers, undo/redo, canvas size/snap, and transform events.
 * Depends: sa-config, sa-core, sa-properties (or main.js globals)
 * Used by: main
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

// ===== Selection validation helpers =====

function isEditingAllowed() {
    // No editing if no objects selected
    if (selectedObjects.length === 0)
        return false;

    // Single object selected
    if (selectedObjects.length === 1) {
        const obj = selectedObjects[0];

        // Prevent editing canvas root
        if (obj.userData?.isCanvasRoot)
            return false;

        // If it's a child object in a group, only allow editing if selected from sidebar
        if (isChildObjectInGroup(obj)) {
            return isChildObjectSelectedFromSidebar(obj);
        }

        // Otherwise, always allow editing
        return true;
    }

    // Multiple objects selected - transforms are disabled
    // Users can still delete or duplicate, but not transform
    if (selectedObjects.length > 1) {
        return false;
    }

    return false;
}

function isChildObjectInGroup(obj) {
    return obj.parent && obj.parent.userData?.isEditorGroup === true;
}

function isChildObjectSelectedFromSidebar(obj) {
    // Check if this object is a child of a group and was selected from sidebar
    if (!isChildObjectInGroup(obj))
        return false;

    // Check if the object has a list item that's nested under a group
    const listItem = obj.userData?.listItem;
    if (!listItem)
        return false;

    // Check if this list item is nested under a group's child list
    const parentLi = listItem.parentElement;
    if (!parentLi || parentLi.tagName !== 'UL')
        return false;

    const groupLi = parentLi.previousElementSibling;
    if (!groupLi || !groupLi.querySelector('.caret'))
        return false;

    return true;
}

// ===== Box helpers =====

function createBoxHelperFor(model) {
    if (model.userData?.isCanvasRoot) {
        // Create special canvas bounding box
        createCanvasBoxHelper(model);
    } else {
        const helper = new THREE.BoxHelper(model,BOX_COLORS.selected);
        helper.material.transparent = true;
        helper.material.opacity = 0.9;
        helper.visible = false;
        model.userData.boxHelper = helper;
        scene.add(helper);
    }
}

function createCanvasBoxHelper(canvasRoot) {
    // Create a bounding box that represents the canvas size from surface up
    const halfSize = groundSize / 2;
    const height = groundSize;
    // Canvas height from surface up

    const geometry = new THREE.BoxGeometry(groundSize,height,groundSize);
    const edges = new THREE.EdgesGeometry(geometry);
    const material = new THREE.LineBasicMaterial({
        color: BOX_COLORS.selected,
        transparent: true,
        opacity: 0.9
    });

    const helper = new THREE.LineSegments(edges,material);
    helper.position.set(0, height / 2, 0);
    // Position from surface up
    helper.visible = false;

    canvasRoot.userData.boxHelper = helper;
    scene.add(helper);
}

function updateBoxHelper(model, color=null) {
    if (!model?.userData.boxHelper)
        return;

    if (model.userData?.isCanvasRoot) {
        // For canvas root, update the canvas box helper size
        updateCanvasBoxHelper(model, color);
    } else {
        model.userData.boxHelper.update();
        if (color)
            model.userData.boxHelper.material.color.setHex(color);
    }
}

function updateCanvasBoxHelper(canvasRoot, color=null) {
    if (!canvasRoot?.userData.boxHelper)
        return;

    // Update the canvas box helper size based on current ground size
    const halfSize = groundSize / 2;
    const height = groundSize;

    // Update geometry
    const geometry = new THREE.BoxGeometry(groundSize,height,groundSize);
    const edges = new THREE.EdgesGeometry(geometry);
    canvasRoot.userData.boxHelper.geometry.dispose();
    canvasRoot.userData.boxHelper.geometry = edges;

    // Update position
    canvasRoot.userData.boxHelper.position.set(0, height / 2, 0);

    // Update color if provided
    if (color)
        canvasRoot.userData.boxHelper.material.color.setHex(color);
}

function setHelperVisible(model, visible) {
    if (model?.userData.boxHelper)
        model.userData.boxHelper.visible = !!visible;
}

function createParentBoxHelperFor(parentGroup) {
    if (!parentGroup || parentGroup.userData.parentBoxHelper)
        return;
    const helper = new THREE.BoxHelper(parentGroup, BOX_HELPER_COLOR);
    // Gray color for parent
    helper.material.transparent = true;
    helper.material.opacity = 0.5;
    helper.visible = false;
    parentGroup.userData.parentBoxHelper = helper;
    scene.add(helper);
}

function updateParentBoxHelper(parentGroup, color=null) {
    if (!parentGroup?.userData.parentBoxHelper)
        return;
    parentGroup.userData.parentBoxHelper.update();
    if (color)
        parentGroup.userData.parentBoxHelper.material.color.setHex(color);
}

function setParentHelperVisible(parentGroup, visible) {
    if (parentGroup?.userData.parentBoxHelper)
        parentGroup.userData.parentBoxHelper.visible = !!visible;
}

function showChildBoundingBoxes(group, visible, color=BOX_HELPER_COLOR, recursive=true) {
    if (!group || !group.userData?.isEditorGroup)
        return;

    group.children.forEach(child => {
        // Ensure child has a box helper
        if (!child.userData.boxHelper) {
            createBoxHelperFor(child);
        }

        if (visible) {
            child.userData.boxHelper.visible = true;
            child.userData.boxHelper.material.color.setHex(color);
            child.userData.boxHelper.material.opacity = 0.5;
            // Semi-transparent for child boxes
        } else {
            child.userData.boxHelper.visible = false;
        }

        // Recursively handle nested groups
        if (recursive && child.userData?.isEditorGroup) {
            showChildBoundingBoxes(child, visible, color, recursive);
        }
    }
    );
}

function updateChildBoundingBoxes(group, recursive=true) {
    if (!group || !group.userData?.isEditorGroup)
        return;

    group.children.forEach(child => {
        if (child.userData.boxHelper) {
            child.userData.boxHelper.update();
        }

        // Recursively handle nested groups
        if (recursive && child.userData?.isEditorGroup) {
            updateChildBoundingBoxes(child, recursive);
        }
    }
    );
}

function showObjectRootChildrenBoundingBoxes(objectRoot, visible, color=OBJECT_ROOT_BOX_COLOR, opacity=0.3) {
    if (!objectRoot || !objectRoot.userData?.isCanvasRoot)
        return;

    objectRoot.children.forEach(child => {
        // Ensure child has a box helper
        if (!child.userData.boxHelper) {
            createBoxHelperFor(child);
        }

        if (visible) {
            child.userData.boxHelper.visible = true;
            child.userData.boxHelper.material.color.setHex(color);
            child.userData.boxHelper.material.opacity = opacity;
        } else {
            child.userData.boxHelper.visible = false;
        }

        // Recursively handle nested groups
        if (child.userData?.isEditorGroup) {
            showChildBoundingBoxes(child, visible, color, true);
        }
    }
    );
}

function addBoundingBoxDimensions(model) {
    if (!loadedFont)
        return;
    if (model.userData.dimGroup) {
        scene.remove(model.userData.dimGroup);
        model.userData.dimGroup.traverse(c => {
            c.geometry?.dispose();
            c.material?.dispose();
        }
        );
    }
    const box = getBox(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
        color: 0xffff00
    });
    const label = (text, pos) => {
        const mesh = new THREE.Mesh(new THREE.TextGeometry(text,{
            font: loadedFont,
            size: LABEL_SIZE,
            height: 0
        }),mat);
        mesh.position.copy(pos);
        group.add(mesh);
    }
    ;
    label(`${size.x.toFixed(2)}m`, new THREE.Vector3(center.x,box.max.y + 0.2,box.min.z - LABEL_OFFSET));
    label(`${size.y.toFixed(2)}m`, new THREE.Vector3(box.max.x + LABEL_OFFSET,center.y,box.min.z - LABEL_OFFSET));
    label(`${size.z.toFixed(2)}m`, new THREE.Vector3(center.x,box.min.y - LABEL_OFFSET,box.max.z + LABEL_OFFSET));
    scene.add(group);
    model.userData.dimGroup = group;
}

// ===== Transforms: initial & helpers =====

function storeInitialTransform(obj) {
    obj.userData.initialTransform = {
        pos: obj.position.clone(),
        rot: obj.quaternion.clone(),
        scale: obj.scale.clone()
    };
}

function resetTransform(obj) {
    if (!obj.userData.initialTransform)
        return;
    const t = obj.userData.initialTransform;
    obj.position.copy(t.pos);
    obj.quaternion.copy(t.rot);
    obj.scale.copy(t.scale);
    updateAllVisuals(obj);
}

function dropToFloor(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty())
        return;
    obj.position.y -= box.min.y;
    updateAllVisuals(obj);
}

// ===== Transform button active state & UI =====

function updateTransformButtonActiveState() {
    // Remove active class from all buttons
    btnTranslate.classList.remove('active');
    btnRotate.classList.remove('active');
    btnScale.classList.remove('active');

    // Add active class to the button matching current transform mode
    if (transform && transform.visible) {
        const mode = transform.getMode();
        if (mode === 'translate') {
            btnTranslate.classList.add('active');
        } else if (mode === 'rotate') {
            btnRotate.classList.add('active');
        } else if (mode === 'scale') {
            btnScale.classList.add('active');
        }
    }
}

function clearUIStates() {
    // Clear all Bootstrap tooltips
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipTriggerList.forEach(triggerEl => {
        const tooltipInstance = bootstrap.Tooltip.getInstance(triggerEl);
        if (tooltipInstance) {
            tooltipInstance.hide();
        }
    });

    // Clear focus states from buttons
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'BUTTON' || activeElement.closest('button'))) {
        activeElement.blur();
    }
}

// ===== Canvas size & snap =====

function setCanvasSize() {
    // Block canvas size change if there are unsaved changes
    if (!checkUnsavedChangesBeforeEdit()) {
        // Reset to previous value
        if (canvasSizeInput) {
            canvasSizeInput.value = groundSize;
        }
        return;
    }

    const newSize = parseFloat(canvasSizeInput.value) || 20;
    if (newSize === groundSize) {
        return; // No change needed
    }

    groundSize = newSize;
    scene.remove(grid);
    grid = new THREE.GridHelper(groundSize, groundSize, GRID_COLOR, GRID_COLOR_MINOR);
    grid.userData.isSelectable = false;
    scene.add(grid);
    if (ruler)
        scene.remove(ruler);
    if (loadedFont) {
        ruler = createRuler(groundSize, 1);
        addRulerLabels(ruler, groundSize, 1, loadedFont);
        ruler.userData.isSelectable = false;
        scene.add(ruler);
    }
    orbit.maxDistance = groundSize * ORBIT_MAX_DISTANCE_MULTIPLIER;
    updateCameraFarPlane();
    selectedObjects.forEach(o => updateAllVisuals(o));

    // Update canvas root box helper if it exists
    if (canvasRoot.userData.boxHelper) {
        updateCanvasBoxHelper(canvasRoot);
    }

    // Update Object Root aBound and properties to reflect new canvas size
    canvasRoot.userData.aBound = [groundSize, groundSize, groundSize];
    updateModelProperties(canvasRoot);
    if (selectedObjects.includes(canvasRoot)) {
        updatePropertiesPanel(canvasRoot);
    }

    // Update JSON editor
    updateJSONEditor();
}

// ===== Undo/Redo System =====
let undoStack = [];
let redoStack = [];
let isUndoRedoInProgress = false;

// Check if code editor is focused
function isCodeEditorFocused() {
    if (!jsonEditor) return false;
    // Check if CodeMirror view has focus
    if (window.jsonEditorAPI && window.jsonEditorAPI.hasFocus) {
        return window.jsonEditorAPI.hasFocus();
    }
    // Fallback: check if jsonEditor container or any child has focus
    return document.activeElement && jsonEditor.contains(document.activeElement);
}

// Save complete scene state
function saveSceneState(actionType = 'transform', affectedObjects = null) {
    if (isUndoRedoInProgress) return;

    // Clear redo stack when new action is performed after an undo
    // This ensures that redo is only available for states that are still reachable
    if (redoStack.length > 0) {
        redoStack = [];
    }

    const state = {
        type: actionType,
        timestamp: Date.now(),
        sceneJSON: generateSceneJSON(),
        affectedObjects: affectedObjects ? affectedObjects.map(obj => ({
            uuid: obj.uuid,
            name: obj.name
        })) : null
    };

    undoStack.push(state);

    // Limit stack size
    if (undoStack.length > MAX_UNDO_HISTORY) {
        undoStack.shift();
    }

    updateUndoRedoButtons();
}

// Undo function
function undo() {
    // If code editor is focused, use CodeMirror's undo
    if (isCodeEditorFocused() && window.jsonEditorAPI && window.jsonEditorAPI.undo) {
        window.jsonEditorAPI.undo();
        updateUndoRedoButtons();
        return;
    }

    if (undoStack.length < 2) return; // Need at least 2 states to undo (current + previous)

    isUndoRedoInProgress = true;

    // The undoStack has the current state at the top
    // Save the current state to redo stack BEFORE popping
    const currentState = undoStack.pop(); // Pop the current state
    redoStack.push(currentState); // Save it to redo stack so we can redo back to it

    // Get the previous state (now at the top of undoStack) to restore
    const stateToRestore = undoStack[undoStack.length - 1];

    // Restore scene from JSON (skip state save to avoid infinite loop)
    parseJSONAndUpdateScene(stateToRestore.sceneJSON, true).then(() => {
        isUndoRedoInProgress = false;
        updateUndoRedoButtons();
    }).catch(error => {
        console.error('Error during undo:', error);
        // On error, restore the state we just popped back to undo stack
        undoStack.push(currentState);
        redoStack.pop(); // Remove the state we just added
        isUndoRedoInProgress = false;
        updateUndoRedoButtons();
    });
}

// Redo function
function redo() {
    // If code editor is focused, use CodeMirror's redo
    if (isCodeEditorFocused() && window.jsonEditorAPI && window.jsonEditorAPI.redo) {
        window.jsonEditorAPI.redo();
        updateUndoRedoButtons();
        return;
    }

    if (redoStack.length === 0) return;

    isUndoRedoInProgress = true;

    // Get the state we're redoing TO (from redo stack)
    const stateToRestore = redoStack.pop();

    // Restore scene from JSON (skip state save to avoid infinite loop)
    parseJSONAndUpdateScene(stateToRestore.sceneJSON, true).then(() => {
        // After restoring, push the restored state to undo stack
        // This makes the restored state the new "current" state
        // The previous current state is already in undoStack, so we don't need to push it again
        undoStack.push(stateToRestore);
        isUndoRedoInProgress = false;
        updateUndoRedoButtons();
    }).catch(error => {
        console.error('Error during redo:', error);
        // On error, restore the state we just popped back to redo stack
        redoStack.push(stateToRestore);
        isUndoRedoInProgress = false;
        updateUndoRedoButtons();
    });
}

// Update button states
function updateUndoRedoButtons() {
    if (btnUndo) {
        let canUndo = false;
        if (isCodeEditorFocused()) {
            // CodeMirror always has undo available (it manages its own history)
            canUndo = true;
        } else {
            // Need at least 2 states to undo (current + previous)
            // This matches the check in the undo() function
            canUndo = undoStack.length > 1;
        }
        btnUndo.disabled = !canUndo;
        btnUndo.classList.toggle('opacity-50', !canUndo);
        btnUndo.style.cursor = canUndo ? 'pointer' : 'not-allowed';
    }

    if (btnRedo) {
        let canRedo = false;
        if (isCodeEditorFocused()) {
            // CodeMirror always has redo available (it manages its own history)
            canRedo = true;
        } else {
            canRedo = redoStack.length > 0;
        }
        btnRedo.disabled = !canRedo;
        btnRedo.classList.toggle('opacity-50', !canRedo);
        btnRedo.style.cursor = canRedo ? 'pointer' : 'not-allowed';
    }
}

// Legacy saveState function for backward compatibility (now saves full scene)
function saveState() {
    if (isUndoRedoInProgress) return;

    const affectedObjects = selectedObject ? [selectedObject] : selectedObjects.length > 0 ? selectedObjects : null;
    saveSceneState('transform', affectedObjects);
}

// ===== Canvas size & snap event wiring =====
// (Must be called after DOM and globals are ready - typically from main.js init)

function wireCanvasSizeAndSnapEvents() {
    if (canvasSizeInput) {
        canvasSizeInput.addEventListener("change", e => {
            setCanvasSize();
        });
    }

    if (btnSetCanvasSize) {
        btnSetCanvasSize.addEventListener("click", e => {
            e.preventDefault();
            setCanvasSize();
        });
    }

    if (snapCheckbox) {
        snapCheckbox.addEventListener("change", e => {
            if (!checkUnsavedChangesBeforeEdit()) {
                e.target.checked = !e.target.checked;
                return;
            }
            const enabled = e.target.checked;
            transform.setTranslationSnap(enabled ? 1 : null);
            transform.setRotationSnap(enabled ? THREE.MathUtils.degToRad(15) : null);
        });
    }
}

// ===== Transform event listeners =====
// (Must be called after transform, orbit, etc. are ready - typically from main.js init)

function wireTransformEvents() {
    transform.addEventListener("dragging-changed", e => {
        orbit.enabled = !e.value;

        if (e.value) {
            if (!checkUnsavedChangesBeforeEdit()) {
                transform.detach();
                orbit.enabled = true;
                return;
            }
            if (selectedObject && !selectedObject.userData?.isCanvasRoot) {
                lastValidPosition = selectedObject.position.clone();
                lastValidQuaternion = selectedObject.quaternion.clone();
                lastValidScale = selectedObject.scale.clone();
            }

            if (isAltPressed && selectedObject && !isDuplicating && !selectedObject.userData?.isCanvasRoot) {
                isDuplicating = true;
                originalObject = selectedObject;

                const duplicate = duplicateObject(selectedObject, new THREE.Vector3(0,0,0));
                if (duplicate) {
                    const originalParent = selectedObject.parent;
                    if (originalParent && originalParent.userData?.isEditorGroup && originalParent !== scene) {
                        originalParent.add(duplicate);
                        rebuildGroupSidebar(originalParent);
                    } else {
                        canvasRoot.add(duplicate);
                        if (duplicate.userData?.isEditorGroup) {
                            addGroupToList(duplicate, duplicate.name);
                        } else {
                            addModelToList(duplicate, duplicate.name);
                        }
                    }

                    createBoxHelperFor(duplicate);
                    storeInitialTransform(duplicate);

                    selectedObjects.forEach(obj => {
                        obj.userData.listItem?.classList.remove("selected");
                        setHelperVisible(obj, false);
                        if (obj.userData.dimGroup)
                            scene.remove(obj.userData.dimGroup);
                    });

                    selectedObjects = [duplicate];
                    selectedObject = duplicate;

                    duplicate.userData.listItem?.classList.add("selected");
                    setHelperVisible(duplicate, true);
                    updateBoxHelper(duplicate, BOX_COLORS.editing);

                    transform.attach(duplicate);

                    updateModelProperties(duplicate);
                    updatePropertiesPanel(duplicate);
                }
            }
        } else {
            lastValidPosition = null;
            lastValidQuaternion = null;
            lastValidScale = null;

            justFinishedTransform = true;
            setTimeout(() => {
                justFinishedTransform = false;
            }, 100);

            if (isDuplicating) {
                isDuplicating = false;
                originalObject = null;

                if (selectedObject) {
                    clampToCanvasRecursive(selectedObject);
                    updateAllVisuals(selectedObject);
                    addBoundingBoxDimensions(selectedObject);
                }
            } else {
                if (selectedObject) {
                    clampToCanvasRecursive(selectedObject);
                    updateAllVisuals(selectedObject);
                }
            }

            selectedObjects.forEach(o => {
                updateBoxHelper(o, BOX_COLORS.selected);
                setHelperVisible(o, true);
            });

            if (!isDuplicating) {
                const affectedObjects = selectedObject ? [selectedObject] : selectedObjects.length > 0 ? selectedObjects : null;
                saveSceneState('transform', affectedObjects);
            } else {
                if (selectedObject) {
                    saveSceneState('duplicate', [selectedObject]);
                }
            }
        }
    });

    transform.addEventListener("objectChange", () => {
        if (!selectedObject)
            return;

        const mode = transform.getMode();

        if (transform.dragging && wouldExceedBounds(selectedObject)) {
            if (lastValidPosition && lastValidQuaternion && lastValidScale) {
                selectedObject.position.copy(lastValidPosition);
                selectedObject.quaternion.copy(lastValidQuaternion);
                selectedObject.scale.copy(lastValidScale);
                return;
            }
        } else if (transform.dragging) {
            lastValidPosition = selectedObject.position.clone();
            lastValidQuaternion = selectedObject.quaternion.clone();
            lastValidScale = selectedObject.scale.clone();
        }

        if (mode === "scale") {
            const s = selectedObject.scale.x;
            selectedObject.scale.set(s, s, s);
            snapUniformScale(selectedObject, SNAP_STEP);
        }

        updateAllVisuals(selectedObject);
        updateJSONEditorFromScene();
    });
}
