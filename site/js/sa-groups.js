/**
 * sa-groups.js
 * Attach/detach, drag-drop, group operations, duplicate, delete.
 * Depends: sa-core, sa-transforms, sa-sidebar, sa-selection, sa-json-sync, sa-properties
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

// ===== Attach / Detach =====
function groupSelectedObjects() {
    if (selectedObjects.length < 2) return;
    if (!checkUnsavedChangesBeforeEdit()) return;

    const parentObj = selectedObjects[0];
    const otherObjects = selectedObjects.slice(1);

    const group = new THREE.Group();
    group.userData.isSelectable = true;
    group.userData.isEditorGroup = true;
    group.name = parentObj.name || "Attached " + Date.now();

    if (parentObj.userData?.twObjectIx !== undefined) group.userData.twObjectIx = parentObj.userData.twObjectIx;
    if (parentObj.userData?.wClass !== undefined) group.userData.wClass = parentObj.userData.wClass;

    const parentWorldPos = new THREE.Vector3();
    const parentWorldQuat = new THREE.Quaternion();
    const parentWorldScale = new THREE.Vector3();
    parentObj.getWorldPosition(parentWorldPos);
    parentObj.getWorldQuaternion(parentWorldQuat);
    parentObj.getWorldScale(parentWorldScale);

    group.position.copy(parentObj.position);
    group.quaternion.copy(parentObj.quaternion);
    group.scale.copy(parentObj.scale);

    const parentParent = parentObj.parent;
    if (parentParent) parentParent.remove(parentObj);
    else scene.remove(parentObj);
    group.add(parentObj);

    parentObj.position.set(0, 0, 0);
    parentObj.quaternion.set(0, 0, 0, 1);
    parentObj.scale.set(1, 1, 1);

    if (parentObj.userData.listItem) {
        const li = parentObj.userData.listItem;
        const next = li.nextSibling;
        li.remove();
        if (next && next.tagName === "UL") next.remove();
        delete parentObj.userData.listItem;
    }

    otherObjects.forEach(obj => {
        if (obj.parent) obj.parent.remove(obj);
        else scene.remove(obj);
        group.add(obj);

        if (obj.userData.boxHelper) {
            scene.remove(obj.userData.boxHelper);
            delete obj.userData.boxHelper;
        }
        if (obj.userData.dimGroup) {
            scene.remove(obj.userData.dimGroup);
            delete obj.userData.dimGroup;
        }
        if (obj.userData.listItem) {
            const li = obj.userData.listItem;
            const next = li.nextSibling;
            li.remove();
            if (next && next.tagName === "UL") next.remove();
            delete obj.userData.listItem;
        }

        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();
        obj.getWorldPosition(worldPos);
        obj.getWorldQuaternion(worldQuat);
        obj.getWorldScale(worldScale);

        scene.updateMatrixWorld(true);
        const groupWorld = new THREE.Matrix4();
        group.updateMatrixWorld(true);
        groupWorld.copy(group.matrixWorld);
        const targetWorld = new THREE.Matrix4();
        targetWorld.compose(worldPos, worldQuat, worldScale);
        const localMatrix = new THREE.Matrix4();
        localMatrix.copy(groupWorld).invert().multiply(targetWorld);
        const localPos = new THREE.Vector3();
        const localQuat = new THREE.Quaternion();
        const localScale = new THREE.Vector3();
        localMatrix.decompose(localPos, localQuat, localScale);
        obj.position.copy(localPos);
        obj.quaternion.copy(localQuat);
        obj.scale.copy(localScale);
    });

    if (parentParent && parentParent.userData?.isEditorGroup) {
        parentParent.add(group);
        rebuildGroupSidebar(parentParent);
    } else {
        canvasRoot.add(group);
    }

    createBoxHelperFor(group);
    createParentBoxHelperFor(group);
    addGroupToList(group, group.name);

    if (isChildObjectInGroup(group)) {
        showChildBoundingBoxes(group, false);
    }

    updateAllVisuals(group);
    storeInitialTransform(group);
    selectObject(group);
    saveSceneState('group', [group]);
    updateJSONEditorFromScene();
}

function ungroupSelectedObject() {
    if (selectedObjects.length !== 1) return;
    if (!checkUnsavedChangesBeforeEdit()) return;

    let group = selectedObjects[0];

    if (isChildObjectInGroup(group)) group = group.parent;

    if (!(group instanceof THREE.Group) || !group.userData?.isEditorGroup) return;

    showChildBoundingBoxes(group, false);

    const groupParent = group.parent || scene;
    const wasInParentGroup = groupParent && groupParent !== scene && groupParent.userData?.isEditorGroup;

    let isFirstChild = true;
    while (group.children.length > 0) {
        const child = group.children[0];

        if (groupParent === scene) canvasRoot.attach(child);
        else groupParent.attach(child);

        if (isFirstChild) {
            if (group.userData?.twObjectIx !== undefined) child.userData.twObjectIx = group.userData.twObjectIx;
            if (group.userData?.wClass !== undefined) child.userData.wClass = group.userData.wClass;
            isFirstChild = false;
        }

        createBoxHelperFor(child);
        setHelperVisible(child, false);

        if (child.userData?.originalName) child.name = child.userData.originalName;
        const listType = child.userData?.originalListType || child.userData?.listType || (child instanceof THREE.Group ? "group" : "model");

        if (!wasInParentGroup) {
            if (listType === "group") addGroupToList(child, child.name || "Attached");
            else addModelToList(child, child.name || "Model");
        }

        delete child.userData?.originalListType;
        delete child.userData?.originalName;

        updateModelProperties(child);
        updatePropertiesPanel(child);
        updateBoxHelper(child);

        if (child.userData?.isEditorGroup) updateChildBoundingBoxes(child);
    }

    cleanupObject(group);
    if (group.parent) group.parent.remove(group);
    else scene.remove(group);

    if (wasInParentGroup) rebuildGroupSidebar(groupParent);

    selectedObjects = [];
    selectedObject = null;
    transform.detach();
    updatePropertiesPanel(null);
    updateJSONEditorFromScene();
}

function detachFromGroup(obj, skipSelection = false) {
    if (!obj) return false;
    if (!isChildObjectInGroup(obj)) return false;

    const parentGroup = obj.parent;

    if (parentGroup.children.length < 3) {
        console.warn("Cannot detach: group must have at least 2 non-parent children. Use 'Detach' to dissolve the group instead.");
        return false;
    }

    if (parentGroup.userData.parentBoxHelper) setParentHelperVisible(parentGroup, false);

    const grandParent = parentGroup.parent || scene;
    const wasInParentGroup = grandParent && grandParent !== scene && grandParent.userData?.isEditorGroup;

    if (grandParent === scene) canvasRoot.attach(obj);
    else grandParent.attach(obj);

    createBoxHelperFor(obj);
    setHelperVisible(obj, false);

    if (obj.userData?.originalName) obj.name = obj.userData.originalName;
    const listType = obj.userData?.originalListType || obj.userData?.listType || (obj instanceof THREE.Group ? "group" : "model");

    if (!wasInParentGroup) {
        if (listType === "group") addGroupToList(obj, obj.name || "Attached");
        else addModelToList(obj, obj.name || "Model");
    }

    delete obj.userData?.originalListType;
    delete obj.userData?.originalName;

    updateModelProperties(obj);
    updatePropertiesPanel(obj);
    updateBoxHelper(obj);

    if (obj.userData?.isEditorGroup) updateChildBoundingBoxes(obj);

    rebuildGroupSidebar(parentGroup);

    if (wasInParentGroup) rebuildGroupSidebar(grandParent);

    updateParentGroupBounds(parentGroup);

    if (!skipSelection) {
        selectObject(obj);
        saveState();
        updateJSONEditorFromScene();
    }

    return true;
}

function detachSelectedFromGroup() {
    if (selectedObjects.length === 0) return;
    if (!checkUnsavedChangesBeforeEdit()) return;

    const objectsToDetach = selectedObjects.filter(obj => {
        if (!isChildObjectInGroup(obj)) return false;
        const parentGroup = obj.parent;
        return parentGroup.children.length >= 3;
    });
    if (objectsToDetach.length === 0) return;

    const detachedObjects = [];
    objectsToDetach.forEach(obj => {
        if (detachFromGroup(obj, true)) detachedObjects.push(obj);
    });

    selectedObjects = [...detachedObjects];
    selectedObject = detachedObjects[detachedObjects.length - 1];

    detachedObjects.forEach(obj => {
        obj.userData.listItem?.classList.add("selected");
        setHelperVisible(obj, true);
        updateBoxHelper(obj, BOX_COLORS.selected);
        addBoundingBoxDimensions(obj);
    });

    if (selectedObject) {
        updateModelProperties(selectedObject);
        updatePropertiesPanel(selectedObject);
    }
    updateTransformButtonStates();

    saveState();
    updateJSONEditorFromScene();
}

function shouldRemoveEmptyGroup(group) {
    if (!group || !group.userData?.isEditorGroup) return false;
    const nonRootChildren = group.children.filter(c => !c.userData?.isCanvasRoot);
    return nonRootChildren.length <= 1;
}

function cleanupEmptyParentGroups(parentGroup) {
    if (!parentGroup || !parentGroup.userData?.isEditorGroup) return;
    if (!shouldRemoveEmptyGroup(parentGroup)) return;

    const children = [...parentGroup.children];
    const nonRoot = children.filter(c => !c.userData?.isCanvasRoot);

    if (nonRoot.length === 1) {
        const onlyChild = nonRoot[0];
        const grandparent = parentGroup.parent;
        parentGroup.remove(onlyChild);
        if (grandparent) grandparent.add(onlyChild);
        else canvasRoot.add(onlyChild);

        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();
        onlyChild.getWorldPosition(worldPos);
        onlyChild.getWorldQuaternion(worldQuat);
        onlyChild.getWorldScale(worldScale);
        onlyChild.position.copy(worldPos);
        onlyChild.quaternion.copy(worldQuat);
        onlyChild.scale.copy(worldScale);

        cleanupObject(parentGroup);
        if (parentGroup.parent) parentGroup.parent.remove(parentGroup);
        else scene.remove(parentGroup);

        createBoxHelperFor(onlyChild);
        if (onlyChild.userData?.isEditorGroup) {
            addGroupToList(onlyChild, onlyChild.name);
            createParentBoxHelperFor(onlyChild);
        } else {
            addModelToList(onlyChild, onlyChild.name);
        }
        rebuildGroupSidebar(grandparent || canvasRoot);
        updateAllVisuals(onlyChild);
        storeInitialTransform(onlyChild);
        if (grandparent && grandparent.userData?.isEditorGroup) {
            cleanupEmptyParentGroups(grandparent);
        }
    }
}

// ===== Drag and Drop =====
function handleDragStart(e) {
    const li = e.target.closest('li');
    if (!li) return;

    const objectId = li.getAttribute('data-object-id');
    draggedObject = scene.getObjectByProperty('uuid', objectId);
    draggedItem = li;

    if (selectedObjects.includes(draggedObject)) {
        draggedObjects = [...selectedObjects];
        selectedObjects.forEach(obj => {
            if (obj.userData.listItem) {
                obj.userData.listItem.classList.add('dragging');
                if (selectedObjects.length > 1) obj.userData.listItem.classList.add('multi-select');
            }
        });
    } else {
        draggedObjects = [draggedObject];
        li.classList.add('dragging');
    }

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', objectId);
}

function handleDragEnd(e) {
    draggedObjects.forEach(obj => {
        if (obj.userData.listItem) {
            obj.userData.listItem.classList.remove('dragging');
            obj.userData.listItem.classList.remove('multi-select');
        }
    });
    document.querySelectorAll('#modelList li.drag-over').forEach(item => item.classList.remove('drag-over'));
    draggedObject = null;
    draggedObjects = [];
    draggedItem = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    const li = e.target.closest('li');
    if (!li || li === draggedItem) return;

    const targetObjectId = li.getAttribute('data-object-id');
    const targetObject = scene.getObjectByProperty('uuid', targetObjectId);

    if (draggedObjects.every(draggedObj => isValidDropTarget(draggedObj, targetObject))) {
        li.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    const li = e.target.closest('li');
    if (!li) return;

    const rect = li.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        li.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const li = e.target.closest('li');
    if (!li || li === draggedItem) return;

    const targetObjectId = li.getAttribute('data-object-id');
    const targetObject = scene.getObjectByProperty('uuid', targetObjectId);

    li.classList.remove('drag-over');
    draggedObjects.forEach(obj => {
        if (obj.userData.listItem) {
            obj.userData.listItem.classList.remove('dragging');
            obj.userData.listItem.classList.remove('multi-select');
        }
    });

    if (draggedObjects.length > 0 && targetObject) {
        if (draggedObjects.every(draggedObj => isValidDropTarget(draggedObj, targetObject))) {
            createGroupFromMultipleDragDrop(draggedObjects, targetObject);
        }
    }

    draggedObject = null;
    draggedObjects = [];
    draggedItem = null;
}

function isValidDropTarget(draggedObj, targetObj) {
    if (!draggedObj || !targetObj) return false;
    if (draggedObj === targetObj) return false;
    if (isDescendantOf(targetObj, draggedObj)) return false;
    if (draggedObj.parent && draggedObj.parent.userData?.isEditorGroup && targetObj === draggedObj.parent) return false;
    if (draggedObj.parent && draggedObj.parent.userData?.isCanvasRoot && targetObj.userData?.isCanvasRoot) return false;
    if (draggedObj.parent && draggedObj.parent.userData?.isEditorGroup) {
        if (targetObj.parent !== draggedObj.parent) return false;
    }
    return true;
}

function isDescendantOf(obj, ancestor) {
    let current = obj.parent;
    while (current && current !== scene) {
        if (current === ancestor) return true;
        current = current.parent;
    }
    return false;
}

function createGroupFromDragDrop(draggedObj, targetObj) {
    if (targetObj instanceof THREE.Group && targetObj.userData?.isEditorGroup) {
        addObjectToExistingGroup(draggedObj, targetObj);
        return;
    }

    const group = new THREE.Group();
    group.userData.isSelectable = true;
    group.userData.isEditorGroup = true;
    group.name = targetObj.name || "Attached " + Date.now();

    const targetWorldPosition = new THREE.Vector3();
    const targetWorldQuaternion = new THREE.Quaternion();
    const targetWorldScale = new THREE.Vector3();
    targetObj.getWorldPosition(targetWorldPosition);
    targetObj.getWorldQuaternion(targetWorldQuaternion);
    targetObj.getWorldScale(targetWorldScale);

    group.position.copy(targetObj.position);
    group.quaternion.copy(targetObj.quaternion);
    group.scale.copy(targetObj.scale);

    if (targetObj.userData?.twObjectIx !== undefined) group.userData.twObjectIx = targetObj.userData.twObjectIx;
    if (targetObj.userData?.wClass !== undefined) group.userData.wClass = targetObj.userData.wClass;

    const targetParent = targetObj.parent;
    const wasInGroup = targetParent && targetParent.userData?.isEditorGroup;

    if (targetParent) targetParent.remove(targetObj);
    else scene.remove(targetObj);
    group.add(targetObj);

    if (wasInGroup) targetParent.add(group);
    else canvasRoot.add(group);

    scene.updateMatrixWorld(true);
    const groupWorldMatrix = new THREE.Matrix4();
    group.updateMatrixWorld(true);
    groupWorldMatrix.copy(group.matrixWorld);

    const targetWorldMatrix = new THREE.Matrix4();
    targetWorldMatrix.compose(targetWorldPosition, targetWorldQuaternion, targetWorldScale);

    const localMatrix = new THREE.Matrix4();
    localMatrix.copy(groupWorldMatrix).invert().multiply(targetWorldMatrix);

    const localPosition = new THREE.Vector3();
    const localQuaternion = new THREE.Quaternion();
    const localScale = new THREE.Vector3();
    localMatrix.decompose(localPosition, localQuaternion, localScale);

    targetObj.position.copy(localPosition);
    targetObj.quaternion.copy(localQuaternion);
    targetObj.scale.copy(localScale);

    if (targetObj.userData.listItem) {
        const li = targetObj.userData.listItem;
        const next = li.nextSibling;
        li.remove();
        if (next && next.tagName === "UL") next.remove();
        delete targetObj.userData.listItem;
    }

    addObjectToGroup(draggedObj, group);

    if (wasInGroup) {
        rebuildGroupSidebar(targetParent);
        updateModelProperties(group);
        updatePropertiesPanel(group);
        updateBoxHelper(group);
        updateChildBoundingBoxes(group);
        updateParentGroupBounds(targetParent);
    } else {
        createBoxHelperFor(group);
        createParentBoxHelperFor(group);
        addGroupToList(group, group.name);
        updateAllVisuals(group);
    }

    storeInitialTransform(group);
    selectObject(group);
    saveState();
    updateJSONEditorFromScene();
}

function addObjectToExistingGroup(obj, group) {
    if (obj.parent === group) return;

    const objParent = obj.parent;

    addObjectToGroup(obj, group);

    if (objParent && objParent.userData?.isEditorGroup) {
        rebuildGroupSidebar(objParent);
        cleanupEmptyParentGroups(objParent);
    }

    rebuildGroupSidebar(group);

    updateModelProperties(group);
    updatePropertiesPanel(group);
    updateBoxHelper(group);

    if (group.userData?.isEditorGroup) updateChildBoundingBoxes(group);

    if (isChildObjectInGroup(group) && group.parent) updateParentGroupBounds(group.parent);

    saveState();
    updateJSONEditorFromScene();
}

function addObjectToGroup(obj, group) {
    if (!obj.userData) obj.userData = {};
    obj.userData.originalListType = obj.userData.listType || (obj instanceof THREE.Group ? "group" : "model");
    obj.userData.originalName = obj.name;

    if (obj.userData.boxHelper) {
        scene.remove(obj.userData.boxHelper);
        delete obj.userData.boxHelper;
    }
    if (obj.userData.dimGroup) {
        scene.remove(obj.userData.dimGroup);
        delete obj.userData.dimGroup;
    }

    if (obj.userData.listItem) {
        const li = obj.userData.listItem;
        const next = li.nextSibling;
        li.remove();
        if (next && next.tagName === "UL") next.remove();
        delete obj.userData.listItem;
    }

    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    obj.getWorldPosition(worldPosition);
    obj.getWorldQuaternion(worldQuaternion);
    obj.getWorldScale(worldScale);

    const objParent = obj.parent;
    if (objParent) objParent.remove(obj);

    group.add(obj);

    scene.updateMatrixWorld(true);

    const groupWorldMatrix = new THREE.Matrix4();
    group.updateMatrixWorld(true);
    groupWorldMatrix.copy(group.matrixWorld);

    const targetWorldMatrix = new THREE.Matrix4();
    targetWorldMatrix.compose(worldPosition, worldQuaternion, worldScale);

    const localMatrix = new THREE.Matrix4();
    localMatrix.copy(groupWorldMatrix).invert().multiply(targetWorldMatrix);

    const localPosition = new THREE.Vector3();
    const localQuaternion = new THREE.Quaternion();
    const localScale = new THREE.Vector3();
    localMatrix.decompose(localPosition, localQuaternion, localScale);

    obj.position.copy(localPosition);
    obj.quaternion.copy(localQuaternion);
    obj.scale.copy(localScale);
}

function createGroupFromMultipleDragDrop(draggedObjects, targetObj) {
    if (draggedObjects.length === 0) return;

    if (targetObj instanceof THREE.Group && targetObj.userData?.isEditorGroup) {
        draggedObjects.forEach(draggedObj => addObjectToExistingGroup(draggedObj, targetObj));
        return;
    }

    const group = new THREE.Group();
    group.userData.isSelectable = true;
    group.userData.isEditorGroup = true;
    group.name = targetObj.name || "Attached " + Date.now();

    const targetWorldPosition = new THREE.Vector3();
    const targetWorldQuaternion = new THREE.Quaternion();
    const targetWorldScale = new THREE.Vector3();
    targetObj.getWorldPosition(targetWorldPosition);
    targetObj.getWorldQuaternion(targetWorldQuaternion);
    targetObj.getWorldScale(targetWorldScale);

    group.position.copy(targetObj.position);
    group.quaternion.copy(targetObj.quaternion);
    group.scale.copy(targetObj.scale);

    if (targetObj.userData?.twObjectIx !== undefined) group.userData.twObjectIx = targetObj.userData.twObjectIx;
    if (targetObj.userData?.wClass !== undefined) group.userData.wClass = targetObj.userData.wClass;

    const targetParent = targetObj.parent;
    const wasInGroup = targetParent && targetParent.userData?.isEditorGroup;

    if (targetParent) targetParent.remove(targetObj);
    else scene.remove(targetObj);
    group.add(targetObj);

    if (wasInGroup) targetParent.add(group);
    else canvasRoot.add(group);

    scene.updateMatrixWorld(true);
    const groupWorldMatrix = new THREE.Matrix4();
    group.updateMatrixWorld(true);
    groupWorldMatrix.copy(group.matrixWorld);

    const targetWorldMatrix = new THREE.Matrix4();
    targetWorldMatrix.compose(targetWorldPosition, targetWorldQuaternion, targetWorldScale);

    const localMatrix = new THREE.Matrix4();
    localMatrix.copy(groupWorldMatrix).invert().multiply(targetWorldMatrix);

    const localPosition = new THREE.Vector3();
    const localQuaternion = new THREE.Quaternion();
    const localScale = new THREE.Vector3();
    localMatrix.decompose(localPosition, localQuaternion, localScale);

    targetObj.position.copy(localPosition);
    targetObj.quaternion.copy(localQuaternion);
    targetObj.scale.copy(localScale);

    if (targetObj.userData.listItem) {
        const li = targetObj.userData.listItem;
        const next = li.nextSibling;
        li.remove();
        if (next && next.tagName === "UL") next.remove();
        delete targetObj.userData.listItem;
    }

    draggedObjects.forEach(draggedObj => addObjectToGroup(draggedObj, group));

    if (wasInGroup) {
        rebuildGroupSidebar(targetParent);
        updateModelProperties(group);
        updatePropertiesPanel(group);
        updateBoxHelper(group);
        updateChildBoundingBoxes(group);
        updateParentGroupBounds(targetParent);
    } else {
        createBoxHelperFor(group);
        createParentBoxHelperFor(group);
        addGroupToList(group, group.name);
        updateAllVisuals(group);
    }

    storeInitialTransform(group);
    selectObject(group);
    saveState();
    updateJSONEditorFromScene();
}

// ===== Duplication =====
function duplicateObject(obj, offset = new THREE.Vector3(1, 0, 1)) {
    if (!obj || !obj.userData?.isSelectable || obj.userData?.isCanvasRoot) return null;

    let duplicate;

    if (obj instanceof THREE.Group && obj.userData?.isEditorGroup) {
        duplicate = new THREE.Group();
        duplicate.userData.isSelectable = true;
        duplicate.userData.isEditorGroup = true;

        duplicate.position.copy(obj.position).add(offset);
        duplicate.quaternion.copy(obj.quaternion);
        duplicate.scale.copy(obj.scale);

        duplicate.name = generateUniqueName(obj.name || "Attached");

        if (obj.children[0]?.userData?.sourceRef) {
            duplicate.userData.sourceRef = { ...obj.children[0].userData.sourceRef };
        }

        obj.children.forEach(child => {
            const childDuplicate = duplicateObject(child, new THREE.Vector3(0, 0, 0));
            if (childDuplicate) duplicate.add(childDuplicate);
        });
    } else {
        duplicate = obj.clone(true);

        duplicate.traverse(node => {
            if (node.isMesh) {
                if (node.material) {
                    if (Array.isArray(node.material)) node.material = node.material.map(mat => mat.clone());
                    else node.material = node.material.clone();
                }
                if (node.geometry) node.geometry = node.geometry.clone();
            }
        });

        duplicate.userData = { ...obj.userData };
        duplicate.userData.isSelectable = true;

        if (obj.userData?.sourceRef) {
            duplicate.userData.sourceRef = { ...obj.userData.sourceRef };
        }

        duplicate.name = generateUniqueName(obj.name || "Model");
        duplicate.position.copy(obj.position).add(offset);
    }

    delete duplicate.userData.boxHelper;
    delete duplicate.userData.parentBoxHelper;
    delete duplicate.userData.dimGroup;
    delete duplicate.userData.listItem;

    duplicate.userData.wClass = 73;
    duplicate.userData.twObjectIx = 0;

    if (duplicate instanceof THREE.Group) {
        duplicate.traverse(child => {
            if (child.userData) {
                child.userData.wClass = 73;
                child.userData.twObjectIx = 0;
            }
        });
    }

    return duplicate;
}

function generateUniqueName(baseName) {
    const existingNames = new Set();
    scene.traverse(obj => { if (obj.name) existingNames.add(obj.name); });

    let counter = 1;
    let newName = `${baseName} Copy`;

    while (existingNames.has(newName)) {
        counter++;
        newName = `${baseName} Copy ${counter}`;
    }

    return newName;
}

function duplicateSelectedObjects() {
    if (selectedObjects.length === 0) return;
    if (!checkUnsavedChangesBeforeEdit()) return;

    const duplicates = [];
    const offset = new THREE.Vector3(1, 0, 1);

    const objectsToDuplicate = selectedObjects.filter(obj => !obj.userData?.isCanvasRoot);
    if (objectsToDuplicate.length === 0) return;

    objectsToDuplicate.forEach(obj => {
        const duplicate = duplicateObject(obj, offset);
        if (duplicate) {
            const originalParent = obj.parent;
            if (originalParent && originalParent.userData?.isEditorGroup && originalParent !== scene) {
                originalParent.add(duplicate);
                rebuildGroupSidebar(originalParent);
            } else {
                canvasRoot.add(duplicate);
                if (duplicate.userData?.isEditorGroup) addGroupToList(duplicate, duplicate.name);
                else addModelToList(duplicate, duplicate.name);
            }

            createBoxHelperFor(duplicate);
            storeInitialTransform(duplicate);
            clampToCanvasRecursive(duplicate);
            updateAllVisuals(duplicate);

            duplicates.push(duplicate);
        }
    });

    if (duplicates.length > 0) {
        saveSceneState('duplicate', duplicates);

        selectedObjects.forEach(obj => {
            obj.userData.listItem?.classList.remove("selected");
            setHelperVisible(obj, false);
            if (obj.userData.dimGroup) scene.remove(obj.userData.dimGroup);
        });

        selectedObjects = [...duplicates];
        selectedObject = duplicates[duplicates.length - 1];

        duplicates.forEach(obj => {
            obj.userData.listItem?.classList.add("selected");
            setHelperVisible(obj, true);
            updateBoxHelper(obj, BOX_COLORS.selected);
            addBoundingBoxDimensions(obj);
        });

        updateModelProperties(selectedObject);
        updatePropertiesPanel(selectedObject);
        updateTransformButtonStates();

        if (selectedObject && isEditingAllowed()) transform.attach(selectedObject);

        saveState();
    }
}

// ===== Delete =====
function deleteObject(obj) {
    if (!obj || obj.userData?.isCanvasRoot) return;
    if (!checkUnsavedChangesBeforeEdit()) return;

    const objectsToDelete = obj instanceof THREE.Group ?
        [obj, ...obj.children.filter(child => !child.userData?.isCanvasRoot)] : [obj];
    saveSceneState('delete', objectsToDelete);

    if (transform.object === obj) transform.detach();

    const parentGroup = obj.parent && obj.parent.userData?.isEditorGroup ? obj.parent : null;

    if (obj instanceof THREE.Group) {
        const children = [...obj.children];
        children.forEach(child => {
            cleanupObject(child);
            obj.remove(child);
        });
    }
    cleanupObject(obj);
    if (obj.parent) obj.parent.remove(obj);
    selectedObjects = selectedObjects.filter(o => o !== obj);
    if (selectedObject === obj) selectedObject = null;
    updatePropertiesPanel(selectedObject || null);

    if (parentGroup) cleanupEmptyParentGroups(parentGroup);

    updateJSONEditorFromScene();
}
