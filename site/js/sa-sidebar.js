/**
 * sa-sidebar.js
 * Sidebar: createSidebarItem, addGroupToList, addCanvasRootToList, addModelToList, rebuildGroupSidebar, makeLabelEditable.
 * Depends: sa-bootstrap, sa-selection, sa-groups, sa-json-sync
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

// ===== Sidebar (DRY creation) =====
function createSidebarItem(obj, name, isGroup = false, parentList = null) {
    const li = document.createElement("li");
    let caret = null;
    const label = document.createElement("span");
    label.textContent = name;

    li.draggable = true;
    li.setAttribute('data-object-id', obj.uuid);

    if (isGroup) {
        caret = document.createElement("span");
        caret.className = "caret";
        caret.title = "Toggle children";
        caret.addEventListener("click", e => {
            e.stopPropagation();
            if (obj.userData?.isCanvasRoot) return;
            setGroupExpanded(li, !(caret.classList.contains("expanded")));
        });
        li.appendChild(caret);
    }

    li.appendChild(label);

    li.onclick = e => selectFromSidebar(obj, li, e);
    li.ondblclick = e => {
        if (e.target === label) makeLabelEditable(label, obj);
        else {
            selectFromSidebar(obj, li, e);
            if (obj.userData?.isCanvasRoot) resetCamera();
            else frameCameraOn(obj);
        }
    };

    li.addEventListener('dragstart', handleDragStart);
    li.addEventListener('dragend', handleDragEnd);
    li.addEventListener('dragover', handleDragOver);
    li.addEventListener('dragenter', handleDragEnter);
    li.addEventListener('dragleave', handleDragLeave);
    li.addEventListener('drop', handleDrop);

    obj.userData.listItem = li;
    const targetList = parentList || modelList;
    targetList.appendChild(li);

    if (isGroup) {
        const childList = ensureChildList(li);
        caret?.classList.add("expanded");
        childList.classList.remove("children-collapsed");
        childList.style.display = "block";
    }
}

function addGroupToList(group, name, parentList = null) {
    const targetList = parentList || modelList;
    if (!parentList) {
        const canvasChildList = canvasRoot.userData.listItem.nextSibling;
        createSidebarItem(group, name, true, canvasChildList);
    } else {
        createSidebarItem(group, name, true, targetList);
    }
    group.userData.listType = "group";
    const childList = group.userData.listItem.nextSibling;

    const childrenToShow = group.children.slice(1);
    childrenToShow.forEach(child => {
        if (child.userData?.isEditorGroup) addGroupToList(child, child.name || "Attached", childList);
        else addModelToList(child, child.name || "Model", childList);
    });
}

function addCanvasRootToList() {
    createSidebarItem(canvasRoot, canvasRoot.name, true, modelList);
    canvasRoot.userData.listType = "canvas";
    const childList = canvasRoot.userData.listItem.nextSibling;

    const caret = canvasRoot.userData.listItem.querySelector(".caret");
    if (caret) {
        caret.classList.add("expanded");
        caret.style.pointerEvents = "none";
        caret.style.opacity = "0.5";
    }

    childList.classList.remove("children-collapsed");
    childList.style.display = "block";
}

function addModelToList(model, name, parentList = null) {
    const targetList = parentList || modelList;
    if (!parentList) {
        const canvasChildList = canvasRoot.userData.listItem.nextSibling;
        createSidebarItem(model, name, false, canvasChildList);
    } else {
        createSidebarItem(model, name, false, targetList);
    }
    model.userData.listType = "model";
}

function rebuildGroupSidebar(group) {
    if (!group || !group.userData?.isEditorGroup) return;

    const groupLi = group.userData.listItem;
    if (!groupLi) return;

    const childList = groupLi.nextSibling;
    if (childList && childList.tagName === "UL") {
        while (childList.firstChild) childList.removeChild(childList.firstChild);

        const childrenToShow = group.children.slice(1);
        childrenToShow.forEach(child => {
            if (child.userData?.isEditorGroup) addGroupToList(child, child.name || "Attached", childList);
            else addModelToList(child, child.name || "Model", childList);
        });
    }
}

function ensureChildList(li) {
    let childList = li.nextSibling;
    if (!(childList && childList.tagName === "UL")) {
        childList = document.createElement("ul");
        childList.style.listStyle = "none";
        childList.style.paddingLeft = "12px";
        childList.style.margin = "4px 0 6px 0";
        li.after(childList);
    }
    return childList;
}

function setGroupExpanded(li, expanded) {
    const caret = li.querySelector(".caret");
    const childList = ensureChildList(li);

    const obj = findObjectByListItem(li);
    if (obj && obj.userData?.isCanvasRoot) {
        caret?.classList.add("expanded");
        childList.classList.remove("children-collapsed");
        childList.style.display = "block";
        return;
    }

    if (expanded) {
        caret?.classList.add("expanded");
        childList.classList.remove("children-collapsed");
        childList.style.display = "block";
    } else {
        caret?.classList.remove("expanded");
        childList.classList.add("children-collapsed");
        childList.style.display = "none";
    }
}

// ===== Inline renaming =====
function makeLabelEditable(label, obj) {
    const input = document.createElement("input");
    input.type = "text";
    input.value = label.textContent;
    input.style.width = "80%";

    label.replaceWith(input);
    input.focus();

    let finished = false;
    const finish = () => {
        if (finished) return;
        finished = true;
        obj.name = (input.value.trim() || obj.name || "Unnamed");
        const newLabel = document.createElement("span");
        newLabel.textContent = obj.name;
        newLabel.ondblclick = () => makeLabelEditable(newLabel, obj);
        input.replaceWith(newLabel);
        updateJSONEditorFromScene();
    };
    input.addEventListener("blur", finish);
    input.addEventListener("keydown", e => {
        if (e.key === "Enter") finish();
        if (e.key === "Escape") {
            input.value = obj.name;
            finish();
        }
    });
}

function renameSelectedObject() {
    if (selectedObjects.length !== 1) return;
    const li = selectedObjects[0].userData.listItem;
    const label = li?.querySelector("span");
    if (label) makeLabelEditable(label, selectedObjects[0]);
}
