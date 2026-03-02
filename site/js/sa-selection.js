/**
 * sa-selection.js
 * Selection logic: selectObject, selectFromSidebar, selectFromCanvas, selectAllSidebar, deselectAllSidebar.
 * Depends: sa-core, sa-transforms, sa-properties, sa-json-sync
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

// ===== Selection (unified) =====
function selectObject(obj, additive = false, toggle = false) {
    if (toggle && selectedObjects.includes(obj)) {
        // Deselection, allow it
    } else if (!additive && !toggle && hasUnsavedCodeChanges()) {
        if (!checkUnsavedChangesBeforeEdit()) return;
    }

    if (!additive && !toggle) {
        selectedObjects.forEach(o => {
            o.userData.listItem?.classList.remove("selected");
            setHelperVisible(o, false);
            if (isChildObjectInGroup(o) && o.parent) setParentHelperVisible(o.parent, false);
            if (o.userData?.isEditorGroup) showChildBoundingBoxes(o, false);
            if (o.userData?.isCanvasRoot) showObjectRootChildrenBoundingBoxes(o, false);
            if (o.userData.dimGroup) scene.remove(o.userData.dimGroup);
        });
        selectedObjects = [];
        updateTransformButtonStates();
    }

    if (toggle && selectedObjects.includes(obj)) {
        selectedObjects = selectedObjects.filter(o => o !== obj);
        obj.userData.listItem?.classList.remove("selected");
        setHelperVisible(obj, false);
        if (isChildObjectInGroup(obj) && obj.parent) setParentHelperVisible(obj.parent, false);
        if (obj.userData?.isEditorGroup) showChildBoundingBoxes(obj, false);
        if (obj.userData?.isCanvasRoot) showObjectRootChildrenBoundingBoxes(obj, false);
        updatePropertiesPanel(selectedObjects[selectedObjects.length - 1] || null);
        updateTransformButtonStates();
        return;
    }

    if (!selectedObjects.includes(obj)) selectedObjects.push(obj);
    selectedObject = obj;

    obj.userData.listItem?.classList.add("selected");

    if (!obj.userData.boxHelper) createBoxHelperFor(obj);

    setHelperVisible(obj, true);
    updateBoxHelper(obj, BOX_COLORS.selected);

    if (isChildObjectInGroup(obj) && obj.parent) {
        const parentGroup = obj.parent;
        if (!parentGroup.userData.parentBoxHelper) createParentBoxHelperFor(parentGroup);
        setParentHelperVisible(parentGroup, true);
        updateParentBoxHelper(parentGroup, BOX_HELPER_COLOR);
    }

    if (obj.userData?.isEditorGroup) showChildBoundingBoxes(obj, true, BOX_HELPER_COLOR);
    if (obj.userData?.isCanvasRoot) showObjectRootChildrenBoundingBoxes(obj, true);

    addBoundingBoxDimensions(obj);
    updateModelProperties(obj);
    updatePropertiesPanel(obj);
    updateTransformButtonStates();
}

function selectFromSidebar(obj, li, e) {
    const additive = !!(e && (e.shiftKey || e.ctrlKey || e.metaKey));
    const toggle = !!(e && (e.ctrlKey || e.metaKey));
    selectObject(obj, additive, toggle);
}

function selectFromCanvas(obj, additive) {
    selectObject(obj, !!additive, false);
}

function selectAllSidebar() {
    deselectAllSidebar();

    const allObjects = [];
    canvasRoot.traverse(obj => {
        if (obj.userData?.isSelectable && obj !== canvasRoot) allObjects.push(obj);
    });

    allObjects.forEach(obj => {
        if (obj.userData.listItem) {
            obj.userData.listItem.classList.add("selected");
            selectedObjects.push(obj);
            setHelperVisible(obj, true);
            updateBoxHelper(obj, BOX_COLORS.selected);
            addBoundingBoxDimensions(obj);
        }
    });

    selectedObject = selectedObjects[selectedObjects.length - 1] || null;
    if (selectedObject) {
        updateModelProperties(selectedObject);
        updatePropertiesPanel(selectedObject);
    }
    updateTransformButtonStates();
}

function deselectAllSidebar() {
    selectedObjects.forEach(o => {
        o.userData.listItem?.classList.remove("selected");
        setHelperVisible(o, false);
        if (isChildObjectInGroup(o) && o.parent) setParentHelperVisible(o.parent, false);
        if (o.userData?.isEditorGroup) showChildBoundingBoxes(o, false);
        if (o.userData?.isCanvasRoot) showObjectRootChildrenBoundingBoxes(o, false);
        if (o.userData.dimGroup) scene.remove(o.userData.dimGroup);
    });
    selectedObjects = [];
    selectedObject = null;
    transform.detach();
    updatePropertiesPanel(null);
    updateTransformButtonStates();
}
