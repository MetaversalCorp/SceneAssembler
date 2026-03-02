/**
 * sa-ui.js
 * Keyboard shortcuts, buttons, context menu, hover/selection, render loop, camera helpers.
 * Depends: sa-core, sa-selection, sa-groups, sa-sidebar, sa-json-sync, sa-transforms
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

// ===== Camera helpers =====
function animateCamera(toPos, toTarget, duration = 800) {
    const fromPos = camera.position.clone();
    const fromTarget = orbit.target.clone();
    const start = performance.now();
    const ease = t => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
    function step(now) {
        const t = Math.min(1, (now - start) / duration);
        const k = ease(t);
        camera.position.lerpVectors(fromPos, toPos, k);
        orbit.target.lerpVectors(fromTarget, toTarget, k);
        camera.lookAt(orbit.target);
        if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function frameCameraOn(obj) {
    const box = getBox(obj);
    const sizeLen = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    const newPos = center.clone().add(new THREE.Vector3(sizeLen, sizeLen, sizeLen));
    animateCamera(newPos, center);
}

function resetCamera() {
    if (selectedObject) frameCameraOn(selectedObject);
    else animateCamera(new THREE.Vector3(groundSize, groundSize, groundSize), new THREE.Vector3(0, 0, 0));
}

// ===== Hover & selection (canvas) =====
renderer.domElement.addEventListener("mousemove", e => {
    if (justFinishedTransform && !transform.dragging) justFinishedTransform = false;

    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([canvasRoot], true);
    let obj = null;
    if (hits.length > 0) {
        obj = hits[0].object;
        while (obj.parent && !obj.userData.isSelectable) obj = obj.parent;

        if (obj.userData.isSelectable) {
            let topmostSelectable = obj;
            let current = obj;
            while (current.parent && current.parent !== canvasRoot) {
                if (current.parent.userData.isSelectable) topmostSelectable = current.parent;
                current = current.parent;
            }
            obj = topmostSelectable;
        } else obj = null;
    }
    if (hoveredObject && !selectedObjects.includes(hoveredObject)) setHelperVisible(hoveredObject, false);
    hoveredObject = obj;
    if (hoveredObject && !selectedObjects.includes(hoveredObject)) {
        updateBoxHelper(hoveredObject, BOX_COLORS.hover);
        setHelperVisible(hoveredObject, true);
    }
});

renderer.domElement.addEventListener("click", e => {
    if (hasUnsavedCodeChanges()) {
        if (!checkUnsavedChangesBeforeEdit()) return;
    }

    if (justFinishedTransform) {
        justFinishedTransform = false;
        return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([canvasRoot], true);
    if (hits.length > 0) {
        let obj = hits[0].object;
        while (obj.parent && !obj.userData.isSelectable) obj = obj.parent;

        if (obj.userData.isSelectable) {
            let topmostSelectable = obj;
            let current = obj;
            while (current.parent && current.parent !== canvasRoot) {
                if (current.parent.userData.isSelectable) topmostSelectable = current.parent;
                current = current.parent;
            }
            selectFromCanvas(topmostSelectable, e.shiftKey);
        }
    } else clearUIStates();
});

renderer.domElement.addEventListener("dblclick", e => {
    if (transform.dragging) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([canvasRoot], true);
    let target = null;
    if (hits.length > 0) {
        let obj = hits[0].object;
        while (obj.parent && !obj.userData.isSelectable) obj = obj.parent;

        if (obj.userData.isSelectable) {
            let topmostSelectable = obj;
            let current = obj;
            while (current.parent && current.parent !== canvasRoot) {
                if (current.parent.userData.isSelectable) topmostSelectable = current.parent;
                current = current.parent;
            }
            target = topmostSelectable;
        }
    }
    if (target) {
        selectFromCanvas(target, false);
        frameCameraOn(target);
    }
});

// ===== Keyboard shortcuts =====
window.addEventListener("keydown", e => {
    if (!e.key) return;

    const key = e.key.toLowerCase();
    const inForm = (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");
    const isJSONEditor = jsonEditor && (jsonEditor === e.target || (jsonEditor.contains && jsonEditor.contains(e.target)));
    const isHotkey = ["w", "e", "r", "q", "f", "z", "delete", "d", "alt", " "].includes(key);

    if (isJSONEditor) return;
    if (inForm && !isHotkey) return;

    if (key === "alt") isAltPressed = true;

    if (!inForm && (key === " " || e.code === "Space")) {
        e.preventDefault();
        isSpacePressed = true;
        if (freeMoveDirection.left) panDirection.left = true;
        if (freeMoveDirection.right) panDirection.right = true;
        if (freeMoveDirection.up) panDirection.up = true;
        if (freeMoveDirection.down) panDirection.down = true;
        freeMoveDirection.left = false;
        freeMoveDirection.right = false;
        freeMoveDirection.up = false;
        freeMoveDirection.down = false;
    }

    if (isSpacePressed && !inForm) {
        if (e.key === "ArrowLeft" || e.code === "ArrowLeft") { e.preventDefault(); panDirection.left = true; }
        else if (e.key === "ArrowRight" || e.code === "ArrowRight") { e.preventDefault(); panDirection.right = true; }
        else if (e.key === "ArrowUp" || e.code === "ArrowUp") { e.preventDefault(); panDirection.up = true; }
        else if (e.key === "ArrowDown" || e.code === "ArrowDown") { e.preventDefault(); panDirection.down = true; }
    } else if (!inForm) {
        if (e.key === "ArrowLeft" || e.code === "ArrowLeft") { e.preventDefault(); freeMoveDirection.left = true; }
        else if (e.key === "ArrowRight" || e.code === "ArrowRight") { e.preventDefault(); freeMoveDirection.right = true; }
        else if (e.key === "ArrowUp" || e.code === "ArrowUp") { e.preventDefault(); freeMoveDirection.up = true; }
        else if (e.key === "ArrowDown" || e.code === "ArrowDown") { e.preventDefault(); freeMoveDirection.down = true; }
    }

    switch (key) {
        case "w":
            if (!checkUnsavedChangesBeforeEdit()) break;
            if (isEditingAllowed()) { transform.setMode("translate"); updateTransformButtonActiveState(); }
            break;
        case "e":
            if (!checkUnsavedChangesBeforeEdit()) break;
            if (isEditingAllowed()) { transform.setMode("rotate"); updateTransformButtonActiveState(); }
            break;
        case "r":
            if (!checkUnsavedChangesBeforeEdit()) break;
            if (isEditingAllowed()) { transform.setMode("scale"); updateTransformButtonActiveState(); }
            break;
        case "q":
            if (e.shiftKey) { if (selectedObject) transform.attach(selectedObject); }
            else { transform.detach(); updateTransformButtonActiveState(); }
            break;
        case "f":
            if (selectedObject) frameCameraOn(selectedObject);
            break;
        case "delete":
            if (!checkUnsavedChangesBeforeEdit()) break;
            const objectsToDelete = selectedObjects.filter(obj => !obj.userData?.isCanvasRoot);
            if (objectsToDelete.length) [...objectsToDelete].forEach(deleteObject);
            else if (selectedObject && !selectedObject.userData?.isCanvasRoot) deleteObject(selectedObject);
            if (selectedObjects.length === 1 && selectedObjects[0].userData?.isCanvasRoot) return;
            break;
        case "d":
            if ((e.ctrlKey || e.metaKey) && !inForm) {
                e.preventDefault();
                if (!checkUnsavedChangesBeforeEdit()) break;
                duplicateSelectedObjects();
            }
            break;
        default:
            if (!isCodeEditorFocused()) {
                if ((e.ctrlKey || e.metaKey) && key === "z") {
                    e.preventDefault();
                    if (e.shiftKey) redo();
                    else undo();
                }
            }
            break;
    }
});

// Reset modifier/key state when window loses focus (e.g. opening DevTools, switching apps)
// Prevents isAltPressed, isSpacePressed, etc. from staying stuck when keyup never fires
window.addEventListener("blur", () => {
    isAltPressed = false;
    isSpacePressed = false;
    panDirection.left = false;
    panDirection.right = false;
    panDirection.up = false;
    panDirection.down = false;
    freeMoveDirection.left = false;
    freeMoveDirection.right = false;
    freeMoveDirection.up = false;
    freeMoveDirection.down = false;
    isDuplicating = false;
    originalObject = null;
});

window.addEventListener("keyup", e => {
    if (!e.key) return;

    const key = e.key.toLowerCase();

    if (key === "alt") isAltPressed = false;

    if (key === " " || e.code === "Space") {
        isSpacePressed = false;
        if (panDirection.left) freeMoveDirection.left = true;
        if (panDirection.right) freeMoveDirection.right = true;
        if (panDirection.up) freeMoveDirection.up = true;
        if (panDirection.down) freeMoveDirection.down = true;
        panDirection.left = false;
        panDirection.right = false;
        panDirection.up = false;
        panDirection.down = false;
    }

    if (isSpacePressed) {
        if (e.key === "ArrowLeft" || e.code === "ArrowLeft") panDirection.left = false;
        else if (e.key === "ArrowRight" || e.code === "ArrowRight") panDirection.right = false;
        else if (e.key === "ArrowUp" || e.code === "ArrowUp") panDirection.up = false;
        else if (e.key === "ArrowDown" || e.code === "ArrowDown") panDirection.down = false;
    } else {
        if (e.key === "ArrowLeft" || e.code === "ArrowLeft") freeMoveDirection.left = false;
        else if (e.key === "ArrowRight" || e.code === "ArrowRight") freeMoveDirection.right = false;
        else if (e.key === "ArrowUp" || e.code === "ArrowUp") freeMoveDirection.up = false;
        else if (e.key === "ArrowDown" || e.code === "ArrowDown") freeMoveDirection.down = false;
    }
});

// ===== Fix #ui buttons =====
if (typeof btnTranslate !== 'undefined') {
    btnTranslate.onclick = () => {
        if (!checkUnsavedChangesBeforeEdit()) return;
        if (isEditingAllowed()) { transform.setMode("translate"); updateTransformButtonActiveState(); }
    };
}
if (typeof btnRotate !== 'undefined') {
    btnRotate.onclick = () => {
        if (!checkUnsavedChangesBeforeEdit()) return;
        if (isEditingAllowed()) { transform.setMode("rotate"); updateTransformButtonActiveState(); }
    };
}
if (typeof btnScale !== 'undefined') {
    btnScale.onclick = () => {
        if (!checkUnsavedChangesBeforeEdit()) return;
        if (isEditingAllowed()) { transform.setMode("scale"); updateTransformButtonActiveState(); }
    };
}
if (typeof btnDelete !== 'undefined') {
    btnDelete.onclick = () => {
        if (!checkUnsavedChangesBeforeEdit()) return;
        const objectsToDelete = selectedObjects.filter(obj => !obj.userData?.isCanvasRoot);
        if (objectsToDelete.length) [...objectsToDelete].forEach(deleteObject);
        else if (selectedObject && !selectedObject.userData?.isCanvasRoot) deleteObject(selectedObject);
        if (selectedObjects.length === 1 && selectedObjects[0].userData?.isCanvasRoot) return;
    };
}
if (typeof btnUndo !== 'undefined') btnUndo.onclick = () => undo();
if (typeof btnRedo !== 'undefined') btnRedo.onclick = () => redo();
if (typeof btnResetCamera !== 'undefined') btnResetCamera.onclick = () => resetCamera();

// ===== Resize =====
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    selectedObjects.forEach(o => updateBoxHelper(o));
    if (hoveredObject) updateBoxHelper(hoveredObject);
});

// ===== Render loop =====
function animate() {
    requestAnimationFrame(animate);

    if (isSpacePressed) {
        const panVector = new THREE.Vector3();
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        const right = new THREE.Vector3();
        right.crossVectors(forward, camera.up).normalize();
        if (panDirection.left) panVector.add(right.clone().multiplyScalar(-PAN_SPEED));
        if (panDirection.right) panVector.add(right.clone().multiplyScalar(PAN_SPEED));
        if (panDirection.up) panVector.add(camera.up.clone().multiplyScalar(PAN_SPEED));
        if (panDirection.down) panVector.add(camera.up.clone().multiplyScalar(-PAN_SPEED));
        if (panVector.length() > 0) {
            camera.position.add(panVector);
            orbit.target.add(panVector);
        }
    }

    if (!isSpacePressed) {
        const moveVector = new THREE.Vector3();
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        const right = new THREE.Vector3();
        right.crossVectors(forward, camera.up).normalize();
        if (freeMoveDirection.left) moveVector.add(right.clone().multiplyScalar(-FREE_MOVE_SPEED));
        if (freeMoveDirection.right) moveVector.add(right.clone().multiplyScalar(FREE_MOVE_SPEED));
        if (freeMoveDirection.up) moveVector.add(forward.clone().multiplyScalar(FREE_MOVE_SPEED));
        if (freeMoveDirection.down) moveVector.add(forward.clone().multiplyScalar(-FREE_MOVE_SPEED));
        if (moveVector.length() > 0) camera.position.add(moveVector);
    }

    orbit.update();
    renderer.render(scene, camera);
}
animate();

// ===== Context menu =====
const contextMenu = (function () {
    const menu = document.createElement('ul');
    menu.id = 'contextMenu';
    document.body.appendChild(menu);
    return menu;
})();

const contextActions = {
    "Duplicate": () => { if (!checkUnsavedChangesBeforeEdit()) return; duplicateSelectedObjects(); },
    "Dissolve Group": () => { if (!checkUnsavedChangesBeforeEdit()) return; ungroupSelectedObject(); },
    "Detach from Group": () => { if (!checkUnsavedChangesBeforeEdit()) return; detachSelectedFromGroup(); },
    "Reset Transform": () => { if (!checkUnsavedChangesBeforeEdit()) return; selectedObjects.forEach(resetTransform); },
    "Drop to Floor": () => { if (!checkUnsavedChangesBeforeEdit()) return; selectedObjects.forEach(dropToFloor); },
    "Select All": () => selectAllSidebar(),
    "Deselect All": () => deselectAllSidebar()
};

function showContextMenu(x, y, actions) {
    contextMenu.innerHTML = "";
    actions.forEach(action => {
        const li = document.createElement("li");
        li.textContent = action;
        li.style.padding = "4px 12px";
        li.style.cursor = "pointer";
        li.onmouseenter = () => li.style.background = "#444";
        li.onmouseleave = () => li.style.background = "transparent";
        li.onclick = () => {
            contextMenu.style.display = "none";
            contextActions[action]?.();
        };
        contextMenu.appendChild(li);
    });
    contextMenu.style.left = x + "px";
    contextMenu.style.top = y + "px";
    contextMenu.style.display = "block";
}
document.addEventListener("click", () => contextMenu.style.display = "none");

// Canvas context menu
renderer.domElement.addEventListener("contextmenu", e => {
    e.preventDefault();
    let actions = ["Select All", "Deselect All"];
    const nonCanvasObjects = selectedObjects.filter(obj => !obj.userData?.isCanvasRoot);

    if (selectedObjects.length === 1 && selectedObjects[0].userData?.isCanvasRoot) {
        actions = ["Select All", "Deselect All"];
    } else if (nonCanvasObjects.length > 0) {
        actions = ["Duplicate", "Reset Transform", "Drop to Floor", "Select All", "Deselect All"];
        if (nonCanvasObjects.length === 1) {
            const obj = nonCanvasObjects[0];
            if (isChildObjectInGroup(obj)) {
                const parentGroup = obj.parent;
                if (parentGroup.children.length >= 3) actions.splice(1, 0, "Detach from Group");
                else actions.splice(1, 0, "Dissolve Group");
            } else if ((obj instanceof THREE.Group) && obj.userData?.isEditorGroup === true) {
                actions.splice(1, 0, "Dissolve Group");
            }
        } else {
            const hasDetachableChildren = nonCanvasObjects.some(obj => {
                if (!isChildObjectInGroup(obj)) return false;
                const parentGroup = obj.parent;
                return parentGroup.children.length >= 3;
            });
            if (hasDetachableChildren) actions.splice(1, 0, "Detach from Group");
        }
    }
    showContextMenu(e.clientX, e.clientY, actions);
});

// Sidebar context menu
modelList.addEventListener("contextmenu", e => {
    e.preventDefault();
    const li = e.target.closest("li");
    if (!li) return;
    const obj = findObjectByListItem(li);
    if (!obj) return;
    if (!selectedObjects.includes(obj)) selectFromSidebar(obj, li, e);

    let actions = ["Select All", "Deselect All"];
    const nonCanvasObjects = selectedObjects.filter(obj => !obj.userData?.isCanvasRoot);

    if (selectedObjects.length === 1 && selectedObjects[0].userData?.isCanvasRoot) {
        actions = ["Select All", "Deselect All"];
    } else if (nonCanvasObjects.length > 0) {
        actions = ["Duplicate", "Reset Transform", "Drop to Floor", "Select All", "Deselect All"];
        if (nonCanvasObjects.length === 1) {
            const obj = nonCanvasObjects[0];
            if (isChildObjectInGroup(obj)) {
                const parentGroup = obj.parent;
                if (parentGroup.children.length >= 3) actions.splice(1, 0, "Detach from Group");
                else actions.splice(1, 0, "Dissolve Group");
            } else if ((obj instanceof THREE.Group) && obj.userData?.isEditorGroup === true) {
                actions.splice(1, 0, "Dissolve Group");
            }
        } else {
            const hasDetachableChildren = nonCanvasObjects.some(obj => {
                if (!isChildObjectInGroup(obj)) return false;
                const parentGroup = obj.parent;
                return parentGroup.children.length >= 3;
            });
            if (hasDetachableChildren) actions.splice(1, 0, "Detach from Group");
        }
    }
    showContextMenu(e.clientX, e.clientY, actions);
});

function findObjectByListItem(li) {
    let found = null;
    scene.traverse(obj => {
        if (obj.userData?.listItem === li) found = obj;
    });
    return found;
}
