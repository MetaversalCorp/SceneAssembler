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
        updateModelListCount();
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
        updateModelListCount();
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
    updateModelListCount();
    updateTransformButtonStates();
}

function updateModelListCount() {
    const el = document.getElementById("modelListCount");
    if (el) el.textContent = selectedObjects.length > 1 ? `${selectedObjects.length} selected` : "";
}

function getVisibleListItemsInOrder(container) {
    const items = [];
    function walk(ul) {
        if (!ul || ul.tagName !== "UL") return;
        for (const li of ul.children) {
            if (li.tagName !== "LI") continue;
            items.push(li);
            const childList = li.nextSibling;
            if (childList?.tagName === "UL" && !childList.classList.contains("children-collapsed")) {
                walk(childList);
            }
        }
    }
    walk(container);
    return items;
}

function selectFromSidebar(obj, li, e) {
    const additive = !!(e && (e.shiftKey || e.ctrlKey || e.metaKey));
    const toggle = !!(e && (e.ctrlKey || e.metaKey));

    if (additive && !toggle && selectedObjects.length > 0) {
        const visibleItems = getVisibleListItemsInOrder(modelList);
        const clickedIdx = visibleItems.indexOf(li);
        const anchorObj = selectedObjects[selectedObjects.length - 1];
        const anchorLi = anchorObj?.userData?.listItem;
        const anchorIdx = anchorLi ? visibleItems.indexOf(anchorLi) : -1;

        if (clickedIdx >= 0 && anchorIdx >= 0 && clickedIdx !== anchorIdx) {
            const [lo, hi] = clickedIdx < anchorIdx ? [clickedIdx, anchorIdx] : [anchorIdx, clickedIdx];
            const toAdd = [];
            for (let i = lo; i <= hi; i++) {
                const itemObj = findObjectByListItem(visibleItems[i]);
                if (itemObj && itemObj.userData?.isSelectable && !selectedObjects.includes(itemObj)) {
                    toAdd.push(itemObj);
                }
            }
            if (obj && !selectedObjects.includes(obj) && !toAdd.includes(obj)) toAdd.push(obj);
            const idx = toAdd.indexOf(obj);
            if (idx >= 0 && toAdd.length > 1) {
                toAdd.splice(idx, 1);
                toAdd.push(obj);
            }
            toAdd.forEach(o => selectObject(o, true, false));
            return;
        }
    }

    selectObject(obj, additive, toggle);
}

function selectFromCanvas(obj, e) {
    const additive = !!(e && e.shiftKey);
    const toggle = !!(e && (e.ctrlKey || e.metaKey));
    selectObject(obj, additive, toggle);
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
    updateModelListCount();
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
    updateModelListCount();
    updateTransformButtonStates();
}
