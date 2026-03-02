/**
 * sa-json-sync.js
 * JSON editor sync, buildNode, parseJSONAndUpdateScene, export.
 * Depends: sa-config, sa-core, sa-bootstrap, sa-models, sa-properties, sa-transforms
 * Uses at runtime: sa-sidebar (addModelToList, addGroupToList, createSidebarItem), sa-selection (deselectAllSidebar)
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

// ===== Export JSON (quaternions) =====
function buildNode(obj) {
    if (!obj.userData?.isSelectable)
        return null;

    const box = getBox(obj);
    const size = box.getSize(new THREE.Vector3());

    const localPosition = obj.position.clone();
    const localQuaternion = obj.quaternion.clone();
    const localScale = obj.scale.clone();

    const rawName = (obj.name && obj.name.length) ? obj.name : (obj.userData.listItem ? obj.userData.listItem.textContent : "FILE");
    const baseName = rawName.replace(/\.[^/.]+$/, "");
    const sourceRef = obj.userData?.sourceRef;

    // Special handling for Object Root - different JSON structure
    if (obj.userData?.isCanvasRoot) {
        const listItemLabel = obj.userData.listItem?.querySelector('span:not(.caret)');
        const displayName = listItemLabel?.textContent?.trim() || obj.name || baseName || "Object Root";

        const node = {
            sName: displayName,
            pTransform: {
                aPosition: [localPosition.x, localPosition.y, localPosition.z],
                aRotation: [localQuaternion.x, localQuaternion.y, localQuaternion.z, localQuaternion.w],
                aScale: [localScale.x, localScale.y, localScale.z]
            },
            aBound: [size.x, size.y, size.z],
            aChildren: []
        };

        if (obj.userData?.wClass !== undefined) node.wClass = obj.userData.wClass;
        if (obj.userData?.twObjectIx !== undefined) node.twObjectIx = obj.userData.twObjectIx;

        if (obj instanceof THREE.Group) {
            obj.children.forEach(child => {
                const childNode = buildNode(child);
                if (childNode) node.aChildren.push(childNode);
            });
        }

        return node;
    }

    // Regular objects
    const node = {
        sName: obj.name || baseName,
        pResource: {
            sReference: (obj instanceof THREE.Group && obj.userData?.isEditorGroup === true) ? (obj.children[0]?.userData?.sourceRef?.reference || (baseName + ".glb")) : (sourceRef?.reference || (baseName + ".glb"))
        },
        pTransform: {
            aPosition: [localPosition.x, localPosition.y, localPosition.z],
            aRotation: [localQuaternion.x, localQuaternion.y, localQuaternion.z, localQuaternion.w],
            aScale: [localScale.x, localScale.y, localScale.z]
        },
        aBound: [size.x, size.y, size.z],
        aChildren: []
    };

    if (obj.userData?.wClass !== undefined) node.wClass = obj.userData.wClass;
    if (obj.userData?.twObjectIx !== undefined) node.twObjectIx = obj.userData.twObjectIx;

    if (obj instanceof THREE.Group) {
        const childrenToExport = obj.userData?.isEditorGroup === true ? obj.children.slice(1) : obj.children;
        childrenToExport.forEach(child => {
            const childNode = buildNode(child);
            if (childNode) node.aChildren.push(childNode);
        });
    }

    return node;
}

function generateSceneJSONEx(sJSON) {
    return sJSON.replace(/("(?:aPosition|aRotation|aScale|aBound)"\s*:\s*)\[[\s\n\r]*(.*?)[\s\n\r]*\]/gs, (match, prefix, values) => {
        const compactValues = values.replace(/[\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
        return prefix + '[' + compactValues + ']';
    });
}

function generateSceneJSON() {
    const objectRootNode = buildNode(canvasRoot);
    const exportData = objectRootNode ? [objectRootNode] : [];
    return generateSceneJSONEx(JSON.stringify(exportData, null, 2));
}

function updateJSONEditor() {
    if (jsonEditor) {
        isProgrammaticUpdate = true;
        const generatedJSON = generateSceneJSON();
        setJSONEditorText(generatedJSON);
        originalJSON = generatedJSON;
        hasUnsavedChanges = false;
        applyChanges.style.display = 'none';
        setTimeout(() => { isProgrammaticUpdate = false; }, 0);
    }
}

// Export JSON button
if (typeof exportJson !== 'undefined') {
    exportJson.onclick = () => {
        const jsonText = generateSceneJSON();
        const blob = new Blob([jsonText], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "scene.json";
        a.click();
        URL.revokeObjectURL(url);
    };
}

// ===== JSON Editor Sync =====
let originalJSON = '';
let hasUnsavedChanges = false;
let isProgrammaticUpdate = false;

function hasUnsavedCodeChanges() {
    return applyChanges && applyChanges.style.display !== 'none' && applyChanges.style.display !== '';
}

function checkUnsavedChangesBeforeEdit() {
    if (hasUnsavedCodeChanges()) {
        const modal = new bootstrap.Modal(document.getElementById('unsavedChangesModal'));
        modal.show();
        return false;
    }
    return true;
}

function ShowDeleteWarning(sName) {
    const modal = new bootstrap.Modal(document.getElementById('deleteChangesModal'));
    $('.jsModalScene').find('.jsSceneName').text(sName);
    modal.show();
}

function DismissDeleteWarning() {
    const modalElement = document.getElementById('deleteChangesModal');
    const modal = bootstrap.Modal.getInstance(modalElement);
    if (modal) modal.hide();
}

function updateJSONEditorFromScene() {
    if (jsonEditor && !hasUnsavedChanges) {
        isProgrammaticUpdate = true;
        originalJSON = generateSceneJSON();
        setJSONEditorText(originalJSON);
        setTimeout(() => { isProgrammaticUpdate = false; }, 0);
    }
}

function discardCodeEditorChanges() {
    if (!jsonEditor || !originalJSON) return;

    isProgrammaticUpdate = true;
    setJSONEditorText(originalJSON);
    hasUnsavedChanges = false;
    applyChanges.style.display = 'none';
    setTimeout(() => { isProgrammaticUpdate = false; }, 0);
}

// Parse JSON and update scene
async function parseJSONAndUpdateScene(jsonText, skipStateSave = false) {
    try {
        const data = JSON.parse(jsonText);

        if (!Array.isArray(data) || data.length === 0) return;

        const rootNode = data[0];
        const isObjectRootFormat = rootNode && rootNode.twObjectIx !== undefined && rootNode.sName !== undefined;
        const isRegularFormat = rootNode && rootNode.pResource;

        if (!rootNode || (!isObjectRootFormat && !isRegularFormat)) return;

        // Handle Object Root updates from JSON
        if (isObjectRootFormat) {
            if (rootNode.wClass !== undefined) canvasRoot.userData.wClass = rootNode.wClass;
            if (rootNode.twObjectIx !== undefined) canvasRoot.userData.twObjectIx = rootNode.twObjectIx;

            if (rootNode.sName) {
                canvasRoot.name = rootNode.sName;
                if (canvasRoot.userData.listItem) {
                    const label = canvasRoot.userData.listItem.querySelector('span:not(.caret)');
                    if (label) label.textContent = rootNode.sName;
                }
            }
        }

        // Handle Object Root aBound changes - update canvas size
        if (rootNode.aBound && Array.isArray(rootNode.aBound) && rootNode.aBound.length >= 3) {
            const newCanvasSize = rootNode.aBound[0];
            if (newCanvasSize !== groundSize) {
                groundSize = newCanvasSize;

                canvasSizeInput.value = groundSize;

                scene.remove(grid);
                grid = new THREE.GridHelper(groundSize, groundSize, GRID_COLOR, GRID_COLOR_MINOR);
                grid.userData.isSelectable = false;
                scene.add(grid);

                if (ruler) scene.remove(ruler);
                if (loadedFont) {
                    ruler = createRuler(groundSize, 1);
                    addRulerLabels(ruler, groundSize, 1, loadedFont);
                    ruler.userData.isSelectable = false;
                    scene.add(ruler);
                }

                orbit.maxDistance = groundSize * ORBIT_MAX_DISTANCE_MULTIPLIER;
                updateCameraFarPlane();

                canvasRoot.userData.aBound = [groundSize, groundSize, groundSize];
                updateModelProperties(canvasRoot);
                if (selectedObjects.includes(canvasRoot)) updatePropertiesPanel(canvasRoot);
            }
        }

        deselectAllSidebar();

        const objectsToCleanup = [];
        canvasRoot.traverse(obj => {
            if (obj !== canvasRoot && obj.userData?.isSelectable) objectsToCleanup.push(obj);
        });

        objectsToCleanup.forEach(obj => cleanupObject(obj));

        const childrenToRemove = [...canvasRoot.children].filter(child => child.userData?.isSelectable);
        childrenToRemove.forEach(obj => canvasRoot.remove(obj));

        if (canvasRoot.userData.listItem) {
            const canvasChildList = canvasRoot.userData.listItem.nextSibling;
            if (canvasChildList && canvasChildList.tagName === "UL") {
                while (canvasChildList.firstChild) canvasChildList.removeChild(canvasChildList.firstChild);
            }
        }

        const existingObjects = new Map();
        const processedObjects = new Set();
        const matchedBaseKeys = new Set();

        if (isObjectRootFormat && rootNode.aChildren && Array.isArray(rootNode.aChildren)) {
            for (const childNode of rootNode.aChildren) {
                await processNodeHierarchically(childNode, canvasRoot, existingObjects, processedObjects, matchedBaseKeys);
            }
        } else if (isRegularFormat && rootNode.aChildren && Array.isArray(rootNode.aChildren)) {
            for (const childNode of rootNode.aChildren) {
                await processNodeHierarchically(childNode, canvasRoot, existingObjects, processedObjects, matchedBaseKeys);
            }
        }

        scene.traverse(obj => {
            if (obj.userData?.isImportedFromJSON) delete obj.userData.isImportedFromJSON;
            if (obj.userData?.jsonBounds) delete obj.userData.jsonBounds;
        });

        if (canvasRoot.userData.boxHelper) updateCanvasBoxHelper(canvasRoot);

        updateJSONEditor();

        if (!skipStateSave && !isUndoRedoInProgress) saveSceneState('code-edit', null);

    } catch (error) {
        console.error('❌ Error parsing JSON:', error);
        alert('Invalid JSON format. Please check your syntax.');
        isProgrammaticUpdate = true;
        setJSONEditorText(originalJSON);
        hasUnsavedChanges = false;
        applyChanges.style.display = 'none';
        setTimeout(() => { isProgrammaticUpdate = false; }, 0);
    }
}

async function processNodeHierarchically(node, parent, existingObjects, processedObjects, matchedBaseKeys) {
    if (!node || (!node.pResource && !node.sName)) return null;

    const obj = await updateOrCreateObject(node, parent, existingObjects, processedObjects, matchedBaseKeys);
    if (!obj) return null;

    if (processedObjects) processedObjects.add(obj);

    if (node.aChildren && Array.isArray(node.aChildren) && node.aChildren.length > 0) {
        let group;
        if (obj instanceof THREE.Group && obj.userData?.isEditorGroup) {
            group = obj;

            if (node.pTransform) {
                if (node.pTransform.aPosition) group.position.set(node.pTransform.aPosition[0], node.pTransform.aPosition[1], node.pTransform.aPosition[2]);
                if (node.pTransform.aRotation) group.quaternion.set(node.pTransform.aRotation[0], node.pTransform.aRotation[1], node.pTransform.aRotation[2], node.pTransform.aRotation[3]);
                if (node.pTransform.aScale) group.scale.set(node.pTransform.aScale[0], node.pTransform.aScale[1], node.pTransform.aScale[2]);
            }

            if (node.aBound && Array.isArray(node.aBound) && node.aBound.length >= 3) {
                group.userData.jsonBounds = { size: new THREE.Vector3(node.aBound[0], node.aBound[1], node.aBound[2]) };
            }

            if (node.wClass !== undefined) group.userData.wClass = node.wClass;
            if (node.twObjectIx !== undefined) group.userData.twObjectIx = node.twObjectIx;
            group.userData.isImportedFromJSON = true;

        } else {
            group = new THREE.Group();
            group.userData.isSelectable = true;
            group.userData.isEditorGroup = true;
            group.userData.isImportedFromJSON = true;
            group.name = obj.name || "Attached " + Date.now();

            if (obj.userData?.twObjectIx !== undefined) group.userData.twObjectIx = obj.userData.twObjectIx;
            else if (node.twObjectIx !== undefined) group.userData.twObjectIx = node.twObjectIx;
            if (obj.userData?.wClass !== undefined) group.userData.wClass = obj.userData.wClass;
            else if (node.wClass !== undefined) group.userData.wClass = node.wClass;

            if (node.pTransform) {
                if (node.pTransform.aPosition) group.position.set(node.pTransform.aPosition[0], node.pTransform.aPosition[1], node.pTransform.aPosition[2]);
                if (node.pTransform.aRotation) group.quaternion.set(node.pTransform.aRotation[0], node.pTransform.aRotation[1], node.pTransform.aRotation[2], node.pTransform.aRotation[3]);
                if (node.pTransform.aScale) group.scale.set(node.pTransform.aScale[0], node.pTransform.aScale[1], node.pTransform.aScale[2]);
            }

            if (node.aBound && Array.isArray(node.aBound) && node.aBound.length >= 3) {
                group.userData.jsonBounds = { size: new THREE.Vector3(node.aBound[0], node.aBound[1], node.aBound[2]) };
            }

            parent.remove(obj);
            group.add(obj);

            const originalPosition = obj.position.clone();
            const originalQuaternion = obj.quaternion.clone();
            const originalScale = obj.scale.clone();

            obj.position.set(0, 0, 0);
            obj.quaternion.set(0, 0, 0, 1);
            obj.scale.set(1, 1, 1);

            group.position.copy(originalPosition);
            group.quaternion.copy(originalQuaternion);
            group.scale.copy(originalScale);

            if (obj.userData.listItem) {
                const li = obj.userData.listItem;
                const next = li.nextSibling;
                li.remove();
                if (next && next.tagName === "UL") next.remove();
                delete obj.userData.listItem;
            }

            parent.add(group);
            scene.updateMatrixWorld(true);
        }

        for (const childNode of node.aChildren) {
            const childObject = await processNodeHierarchically(childNode, group, existingObjects, processedObjects, matchedBaseKeys);
            if (childObject) {
                if (!childObject.userData) childObject.userData = {};
                childObject.userData.originalListType = childObject.userData.listType || (childObject instanceof THREE.Group ? "group" : "model");
                childObject.userData.originalName = childObject.name;

                if (childNode.pTransform?.aPosition) childObject.userData.expectedLocalPosition = childNode.pTransform.aPosition;

                if (childObject.userData.boxHelper) {
                    scene.remove(childObject.userData.boxHelper);
                    delete childObject.userData.boxHelper;
                }
                if (childObject.userData.dimGroup) {
                    scene.remove(childObject.userData.dimGroup);
                    delete childObject.userData.dimGroup;
                }
                if (childObject.userData.listItem) {
                    const li = childObject.userData.listItem;
                    const next = li.nextSibling;
                    li.remove();
                    if (next && next.tagName === "UL") next.remove();
                    delete childObject.userData.listItem;
                }

                if (childNode.pTransform) {
                    if (childNode.pTransform.aPosition) childObject.position.set(childNode.pTransform.aPosition[0], childNode.pTransform.aPosition[1], childNode.pTransform.aPosition[2]);
                    if (childNode.pTransform.aRotation) childObject.quaternion.set(childNode.pTransform.aRotation[0], childNode.pTransform.aRotation[1], childNode.pTransform.aRotation[2], childNode.pTransform.aRotation[3]);
                    if (childNode.pTransform.aScale) childObject.scale.set(childNode.pTransform.aScale[0], childNode.pTransform.aScale[1], childNode.pTransform.aScale[2]);
                }

                if (childNode.aBound && Array.isArray(childNode.aBound) && childNode.aBound.length >= 3) {
                    childObject.userData.jsonBounds = { size: new THREE.Vector3(childNode.aBound[0], childNode.aBound[1], childNode.aBound[2]) };
                }

                if (childObject.parent) childObject.parent.remove(childObject);
                group.add(childObject);
            }
        }

        createBoxHelperFor(group);
        createParentBoxHelperFor(group);
        addGroupToList(group, group.name);

        updateAllVisuals(group);
        storeInitialTransform(group);

        return group;
    } else {
        return obj;
    }
}

function collectObjectKeysRecursively(node, keys) {
    if (node && node.pResource && node.pResource.sName) {
        const sReference = node.pResource.sReference || '';
        const baseCompositeKey = `${node.pResource.sName}|${sReference}`;
        keys.add(baseCompositeKey);
    }
    if (node.aChildren && Array.isArray(node.aChildren)) {
        node.aChildren.forEach(childNode => collectObjectKeysRecursively(childNode, keys));
    }
}

function collectObjectKeys(node, keys) {
    if (node && node.pResource && node.pResource.sName) {
        const sReference = node.pResource.sReference || '';
        const compositeKey = `${node.pResource.sName}|${sReference}`;
        keys.add(compositeKey);
    }
    if (node.aChildren && Array.isArray(node.aChildren)) {
        node.aChildren.forEach(childNode => collectObjectKeys(childNode, keys));
    }
}

async function updateOrCreateObject(node, parent, existingObjects, processedObjects, matchedBaseKeys) {
    if (!node || (!node.pResource && !node.sName)) return null;

    const objectName = node.sName || (node.pResource?.sName) || "Imported Object";
    const sReference = (node.pResource?.sReference) || '';
    const baseKey = `${objectName}|${sReference}`;
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const compositeKey = `${objectName}|${sReference}|${uniqueId}`;

    let obj = existingObjects.get(compositeKey);

    if (!obj && (!matchedBaseKeys || !matchedBaseKeys.has(baseKey))) {
        for (const [key, existingObj] of existingObjects) {
            if ((key.startsWith(baseKey + '|') || key === baseKey) && (!processedObjects || !processedObjects.has(existingObj))) {
                obj = existingObj;
                if (matchedBaseKeys) matchedBaseKeys.add(baseKey);
                const existingUniqueId = existingObj.userData?.uniqueInternalId || uniqueId;
                if (existingUniqueId && existingUniqueId !== uniqueId) {
                    const updatedCompositeKey = `${objectName}|${sReference}|${existingUniqueId}`;
                    if (key !== updatedCompositeKey) {
                        existingObjects.delete(key);
                        existingObjects.set(updatedCompositeKey, existingObj);
                    }
                }
                break;
            }
        }
    }

    if (obj) {
        updateObjectFromNode(obj, node, existingObjects);
        return obj;
    } else {
        let modelToReuse = null;
        if (sReference) {
            for (const [, existingObj] of existingObjects) {
                if (existingObj.userData?.sourceRef?.reference === sReference) {
                    modelToReuse = existingObj;
                    break;
                }
            }
        }

        if (modelToReuse) {
            obj = modelToReuse.clone(true);
            obj.name = objectName;

            obj.traverse(n => {
                if (n.isMesh) {
                    if (n.material) {
                        if (Array.isArray(n.material)) n.material = n.material.map(mat => mat.clone());
                        else n.material = n.material.clone();
                    }
                    if (n.geometry) n.geometry = n.geometry.clone();
                }
            });

            obj.userData = {
                isSelectable: true,
                isImportedFromJSON: true,
                uniqueInternalId: uniqueId,
                sourceRef: { reference: sReference, originalFileName: sReference, baseName: objectName }
            };

            if (node.wClass !== undefined) obj.userData.wClass = node.wClass;
            if (node.twObjectIx !== undefined) obj.userData.twObjectIx = node.twObjectIx;

            if (node.aBound && Array.isArray(node.aBound) && node.aBound.length >= 3) {
                obj.userData.jsonBounds = { size: new THREE.Vector3(node.aBound[0], node.aBound[1], node.aBound[2]) };
            }

            if (node.pTransform) {
                if (node.pTransform.aPosition) obj.position.set(node.pTransform.aPosition[0], node.pTransform.aPosition[1], node.pTransform.aPosition[2]);
                if (node.pTransform.aRotation) obj.quaternion.set(node.pTransform.aRotation[0], node.pTransform.aRotation[1], node.pTransform.aRotation[2], node.pTransform.aRotation[3]);
                if (node.pTransform.aScale) obj.scale.set(node.pTransform.aScale[0], node.pTransform.aScale[1], node.pTransform.aScale[2]);
            }

            parent.add(obj);
            createBoxHelperFor(obj);
            addModelToList(obj, obj.name);
            storeInitialTransform(obj);
            existingObjects.set(compositeKey, obj);
            if (matchedBaseKeys) matchedBaseKeys.add(baseKey);
        } else {
            obj = await createObjectFromNode(node);
            if (obj) {
                obj.name = objectName;
                if (!obj.userData) obj.userData = {};
                obj.userData.uniqueInternalId = uniqueId;

                parent.add(obj);
                createBoxHelperFor(obj);
                addModelToList(obj, obj.name);
                storeInitialTransform(obj);
                existingObjects.set(compositeKey, obj);
                if (matchedBaseKeys) matchedBaseKeys.add(baseKey);
            }
        }
    }

    return obj;
}

function updateObjectFromNode(obj, node, existingObjects) {
    const uniqueId = obj.userData?.uniqueInternalId || '';
    const oldCompositeKey = uniqueId ? `${obj.name}|${obj.userData.sourceRef?.reference || ''}|${uniqueId}` : `${obj.name}|${obj.userData.sourceRef?.reference || ''}`;

    obj.userData.isImportedFromJSON = true;

    if (node.wClass !== undefined) obj.userData.wClass = node.wClass;
    if (node.twObjectIx !== undefined) obj.userData.twObjectIx = node.twObjectIx;

    const nodeSName = node.sName || (node.pResource?.sName);

    if (nodeSName && obj.name !== nodeSName) {
        obj.name = nodeSName;
        if (obj.userData.listItem) {
            const label = obj.userData.listItem.querySelector('span');
            if (label) label.textContent = obj.name;
        }
    }

    if (node.pResource && node.pResource.sReference !== undefined) {
        obj.userData.sourceRef = {
            reference: node.pResource.sReference || '',
            originalFileName: node.pResource.sReference || '',
            baseName: nodeSName || obj.name || "Imported Object"
        };
    }

    if (node.aBound && Array.isArray(node.aBound) && node.aBound.length >= 3) {
        obj.userData.jsonBounds = { size: new THREE.Vector3(node.aBound[0], node.aBound[1], node.aBound[2]) };
    }

    if (existingObjects) {
        const newCompositeKey = uniqueId ? `${obj.name}|${obj.userData.sourceRef?.reference || ''}|${uniqueId}` : `${obj.name}|${obj.userData.sourceRef?.reference || ''}`;
        if (oldCompositeKey !== newCompositeKey) {
            existingObjects.delete(oldCompositeKey);
            existingObjects.set(newCompositeKey, obj);
        }
    }

    if (node.pTransform) {
        if (node.pTransform.aPosition) obj.position.set(node.pTransform.aPosition[0], node.pTransform.aPosition[1], node.pTransform.aPosition[2]);
        if (node.pTransform.aRotation) obj.quaternion.set(node.pTransform.aRotation[0], node.pTransform.aRotation[1], node.pTransform.aRotation[2], node.pTransform.aRotation[3]);
        if (node.pTransform.aScale) obj.scale.set(node.pTransform.aScale[0], node.pTransform.aScale[1], node.pTransform.aScale[2]);
    }

    updateAllVisuals(obj);
}

async function createObjectFromNode(node) {
    const objectName = node.sName || (node.pResource?.sName) || "Imported Object";
    const sReference = (node.pResource?.sReference) || '';

    try {
        const scale = node.pTransform?.aScale || null;
        const rotation = node.pTransform?.aRotation || null;
        const sourceModel = await loadModelFromReference(sReference, node.aBound, scale, rotation);

        const obj = sourceModel.clone(true);

        obj.traverse(n => {
            if (n.isMesh) {
                if (n.material) {
                    if (Array.isArray(n.material)) n.material = n.material.map(mat => mat.clone());
                    else n.material = n.material.clone();
                }
                if (n.geometry) n.geometry = n.geometry.clone();
            }
        });

        obj.userData.isSelectable = true;
        obj.userData.isImportedFromJSON = true;
        obj.name = objectName;

        if (node.wClass !== undefined) obj.userData.wClass = node.wClass;
        if (node.twObjectIx !== undefined) obj.userData.twObjectIx = node.twObjectIx;

        obj.userData.sourceRef = { reference: sReference, originalFileName: sReference, baseName: objectName };

        if (node.aBound && Array.isArray(node.aBound) && node.aBound.length >= 3) {
            obj.userData.jsonBounds = { size: new THREE.Vector3(node.aBound[0], node.aBound[1], node.aBound[2]) };
        }

        if (node.pTransform) {
            if (node.pTransform.aPosition) obj.position.set(node.pTransform.aPosition[0], node.pTransform.aPosition[1], node.pTransform.aPosition[2]);
            if (node.pTransform.aRotation) obj.quaternion.set(node.pTransform.aRotation[0], node.pTransform.aRotation[1], node.pTransform.aRotation[2], node.pTransform.aRotation[3]);
            if (node.pTransform.aScale) obj.scale.set(node.pTransform.aScale[0], node.pTransform.aScale[1], node.pTransform.aScale[2]);
        }

        return obj;
    } catch (error) {
        console.error(`Failed to create object from node with sReference: ${sReference}`, error);

        const dimensions = node.aBound && Array.isArray(node.aBound) && node.aBound.length >= 3 ? node.aBound : [1, 1, 1];
        const geometry = new THREE.BoxGeometry(dimensions[0], dimensions[1], dimensions[2]);
        geometry.translate(0, dimensions[1] / 2, 0);
        const material = new THREE.MeshBasicMaterial({ color: ERROR_OBJECT_COLOR });
        const obj = new THREE.Mesh(geometry, material);

        obj.userData.isSelectable = true;
        obj.userData.isImportedFromJSON = true;
        obj.name = `${objectName} (Failed to Load)`;

        if (node.wClass !== undefined) obj.userData.wClass = node.wClass;
        if (node.twObjectIx !== undefined) obj.userData.twObjectIx = node.twObjectIx;

        obj.userData.sourceRef = { reference: sReference, originalFileName: sReference, baseName: objectName };

        if (node.aBound && Array.isArray(node.aBound) && node.aBound.length >= 3) {
            obj.userData.jsonBounds = { size: new THREE.Vector3(node.aBound[0], node.aBound[1], node.aBound[2]) };
        }

        if (node.pTransform) {
            if (node.pTransform.aPosition) obj.position.set(node.pTransform.aPosition[0], node.pTransform.aPosition[1], node.pTransform.aPosition[2]);
            if (node.pTransform.aRotation) obj.quaternion.set(node.pTransform.aRotation[0], node.pTransform.aRotation[1], node.pTransform.aRotation[2], node.pTransform.aRotation[3]);
            if (node.pTransform.aScale) obj.scale.set(node.pTransform.aScale[0], node.pTransform.aScale[1], node.pTransform.aScale[2]);
        }

        return obj;
    }
}

// JSON editor event listeners (run after DOM ready; addModelToList etc. exist when handlers fire)
function wireJSONEditorEvents() {
    if (!jsonEditor) return;

    jsonEditor.addEventListener('json-change', (e) => {
        if (isProgrammaticUpdate) return;
        const current = e?.detail?.value ?? getJSONEditorText();
        hasUnsavedChanges = current !== originalJSON;
        applyChanges.style.display = hasUnsavedChanges ? 'block' : 'none';
    });

    jsonEditor.addEventListener('focus', () => {
        deselectAllSidebar();
        updateUndoRedoButtons();
    });

    jsonEditor.addEventListener('blur', () => {
        updateUndoRedoButtons();
    });

    applyChanges.addEventListener('click', async () => {
        await parseJSONAndUpdateScene(getJSONEditorText());
    });

    const applyChangesFromModal = document.getElementById('applyChangesFromModal');
    if (applyChangesFromModal) {
        applyChangesFromModal.addEventListener('click', async () => {
            const modalElement = document.getElementById('unsavedChangesModal');
            const modal = bootstrap.Modal.getInstance(modalElement);
            applyChangesFromModal.disabled = true;
            applyChangesFromModal.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Applying...';
            try {
                await parseJSONAndUpdateScene(getJSONEditorText());
                if (modal) modal.hide();
            } catch (error) {
                console.error('Error applying changes:', error);
                alert('Error applying changes. Please check the console for details.');
            } finally {
                applyChangesFromModal.disabled = false;
                applyChangesFromModal.innerHTML = '<i class="fa-solid fa-arrows-spin fa-spin me-2"></i>Apply Changes';
            }
        });
    }

    const discardChangesFromModal = document.getElementById('discardChangesFromModal');
    if (discardChangesFromModal) {
        discardChangesFromModal.addEventListener('click', () => {
            const modalElement = document.getElementById('unsavedChangesModal');
            const modal = bootstrap.Modal.getInstance(modalElement);
            discardCodeEditorChanges();
            if (modal) modal.hide();
        });
    }
}

// Wire events when DOM is ready (deselectAllSidebar, updateUndoRedoButtons exist after sa-selection, sa-transforms load)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireJSONEditorEvents);
} else {
    wireJSONEditorEvents();
}
