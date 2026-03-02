/**
 * sa-properties.js
 * Object properties, bounds, clamping, texture info, and properties panel updates.
 * Depends: sa-config, sa-core (or main.js globals: scene, canvasRoot, groundSize, selectedObjects, etc.)
 * Used by: sa-transforms, main
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

let lastValidPosition = null;
let lastValidQuaternion = null;
let lastValidScale = null;

// ===== Bounds & geometry =====

// Function to check if an object would exceed the bounding box constraints
function wouldExceedBounds(obj) {
    // Get the object root's bounding box (aBound) for clamping constraints
    const rootBox = getBox(canvasRoot);
    const rootSize = rootBox.getSize(new THREE.Vector3());
    const rootCenter = rootBox.getCenter(new THREE.Vector3());

    // Calculate root bounds
    const rootMinX = rootCenter.x - rootSize.x / 2;
    const rootMaxX = rootCenter.x + rootSize.x / 2;
    const rootMinY = rootCenter.y - rootSize.y / 2;
    const rootMaxY = rootCenter.y + rootSize.y / 2;
    const rootMinZ = rootCenter.z - rootSize.z / 2;
    const rootMaxZ = rootCenter.z + rootSize.z / 2;

    // Get the object's current world bounding box
    const worldBox = new THREE.Box3().setFromObject(obj);
    const worldSize = worldBox.getSize(new THREE.Vector3());
    const worldCenter = worldBox.getCenter(new THREE.Vector3());

    const worldMinX = worldCenter.x - worldSize.x / 2
      , worldMaxX = worldCenter.x + worldSize.x / 2;
    const worldMinY = worldCenter.y - worldSize.y / 2
      , worldMaxY = worldCenter.y + worldSize.y / 2;
    const worldMinZ = worldCenter.z - worldSize.z / 2
      , worldMaxZ = worldCenter.z + worldSize.z / 2;

    // Check if any part of the object would exceed the bounds
    const exceedsX = worldMinX < rootMinX || worldMaxX > rootMaxX;
    const exceedsY = CLAMP_Y_AXIS && (worldMinY < rootMinY || worldMaxY > rootMaxY);
    const exceedsZ = worldMinZ < rootMinZ || worldMaxZ > rootMaxZ;
    return exceedsX || exceedsY || exceedsZ;
}

function getBox(obj) {
    // Special handling for Object Root - return bounding box based on aBound or fallback to groundSize
    if (obj.userData?.isCanvasRoot) {
        const box = new THREE.Box3();

        // Check if object root has aBound data stored
        let sizeX, sizeY, sizeZ;
        if (obj.userData?.aBound && Array.isArray(obj.userData.aBound) && obj.userData.aBound.length >= 3) {
            // Use stored aBound values
            sizeX = obj.userData.aBound[0];
            sizeY = obj.userData.aBound[1];
            sizeZ = obj.userData.aBound[2];
        } else {
            // Fallback to groundSize for backward compatibility
            sizeX = groundSize;
            sizeY = groundSize;
            sizeZ = groundSize;
        }

        box.setFromCenterAndSize(new THREE.Vector3(0,sizeY / 2,0), // Center at half height
        new THREE.Vector3(sizeX,sizeY,sizeZ)// Use aBound dimensions
        );
        return box;
    }

    // Use JSON bounding box if available (for imported objects)
    if (obj.userData?.jsonBounds) {
        const box = new THREE.Box3();
        const center = obj.position.clone();
        // Use local position
        box.setFromCenterAndSize(center, obj.userData.jsonBounds.size);
        return box;
    }

    return new THREE.Box3().setFromObject(obj);
}

function getTriangleCount(obj) {
    let triangleCount = 0;

    // Special handling for Object Root - show combined count of all children
    if (obj.userData?.isCanvasRoot) {
        obj.children.forEach(child => {
            triangleCount += getTriangleCount(child);
        }
        );
        return triangleCount;
    }

    obj.traverse( (child) => {
        if (child.isMesh && child.geometry) {
            const geometry = child.geometry;
            if (geometry.index) {
                // Indexed geometry
                triangleCount += geometry.index.count / 3;
            } else {
                // Non-indexed geometry
                triangleCount += geometry.attributes.position.count / 3;
            }
        }
    }
    );

    return Math.floor(triangleCount);
}

function getVertexCount(obj) {
    let vertexCount = 0;

    if (obj.userData?.isCanvasRoot) {
        obj.children.forEach(child => {
            vertexCount += getVertexCount(child);
        });
        return vertexCount;
    }

    obj.traverse((child) => {
        if (child.isMesh && child.geometry?.attributes?.position) {
            vertexCount += child.geometry.attributes.position.count;
        }
    });

    return vertexCount;
}

function updateAllVisuals(obj) {

    if (!obj)
        return;

    // Skip canvas clamping for objects imported from JSON (they should use exact local positions)
    if (!obj.userData?.isImportedFromJSON) {
        // Apply canvas clamp restrictions to any object being transformed (including nested objects)
        clampToCanvasRecursive(obj);
    } else {}

    updateModelProperties(obj);
    updatePropertiesPanel(obj);
    updateBoxHelper(obj);

    // If this is a group, also update child bounding boxes
    if (obj.userData?.isEditorGroup) {
        updateChildBoundingBoxes(obj);
    }

    // If this object is a child in a group, update the parent group's bounding box
    if (isChildObjectInGroup(obj) && obj.parent) {
        updateParentGroupBounds(obj.parent);
    }

    // Only add dimension labels for selected objects
    if (selectedObjects.includes(obj)) {
        addBoundingBoxDimensions(obj);
    }

    // Update JSON editor
    updateJSONEditorFromScene();
}

function updateParentGroupBounds(parentGroup) {
    if (!parentGroup || !parentGroup.userData?.isEditorGroup)
        return;

    // Update the parent group's box helper
    if (parentGroup.userData.boxHelper) {
        parentGroup.userData.boxHelper.update();
    }

    // Update the parent group's parent box helper (gray one)
    if (parentGroup.userData.parentBoxHelper) {
        parentGroup.userData.parentBoxHelper.update();
    }

    // Recursively update parent groups if this group is nested
    if (isChildObjectInGroup(parentGroup) && parentGroup.parent) {
        updateParentGroupBounds(parentGroup.parent);
    }
}

function cleanupObject(obj) {
    if (!obj)
        return;
    if (obj.userData.boxHelper) {
        scene.remove(obj.userData.boxHelper);
        obj.userData.boxHelper.geometry?.dispose();
        obj.userData.boxHelper.material?.dispose();
        delete obj.userData.boxHelper;
    }
    if (obj.userData.parentBoxHelper) {
        scene.remove(obj.userData.parentBoxHelper);
        obj.userData.parentBoxHelper.geometry?.dispose();
        obj.userData.parentBoxHelper.material?.dispose();
        delete obj.userData.parentBoxHelper;
    }
    if (obj.userData.dimGroup) {
        scene.remove(obj.userData.dimGroup);
        obj.userData.dimGroup.traverse(c => {
            c.geometry?.dispose();
            c.material?.dispose();
        }
        );
        delete obj.userData.dimGroup;
    }
    if (obj.userData.listItem) {
        const li = obj.userData.listItem;
        const next = li.nextSibling;
        li.remove();
        if (next && next.tagName === "UL")
            next.remove();
        delete obj.userData.listItem;
    }
}

function snapUniformScale(obj, step=SNAP_STEP) {
    const box = getBox(obj);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const snapped = Math.max(step, Math.round(maxDim / step) * step);
    if (maxDim > 0)
        obj.scale.multiplyScalar(snapped / maxDim);
}

function clampToCanvas(obj) {

    // Get the object root's bounding box (aBound) for clamping constraints
    const rootBox = getBox(canvasRoot);
    const rootSize = rootBox.getSize(new THREE.Vector3());
    const rootCenter = rootBox.getCenter(new THREE.Vector3());

    // Calculate root bounds
    const rootMinX = rootCenter.x - rootSize.x / 2;
    const rootMaxX = rootCenter.x + rootSize.x / 2;
    const rootMinY = rootCenter.y - rootSize.y / 2;
    const rootMaxY = rootCenter.y + rootSize.y / 2;
    const rootMinZ = rootCenter.z - rootSize.z / 2;
    const rootMaxZ = rootCenter.z + rootSize.z / 2;

    // For nested objects, we need to work with world positions
    const worldBox = new THREE.Box3().setFromObject(obj);
    const worldSize = worldBox.getSize(new THREE.Vector3());
    const worldCenter = worldBox.getCenter(new THREE.Vector3());

    const worldMinX = worldCenter.x - worldSize.x / 2
      , worldMaxX = worldCenter.x + worldSize.x / 2;
    const worldMinY = worldCenter.y - worldSize.y / 2
      , worldMaxY = worldCenter.y + worldSize.y / 2;
    const worldMinZ = worldCenter.z - worldSize.z / 2
      , worldMaxZ = worldCenter.z + worldSize.z / 2;

    // Calculate adjustments needed
    let adjustmentX = 0
      , adjustmentY = 0
      , adjustmentZ = 0;

    // Clamp X axis
    if (worldMinX < rootMinX) {
        adjustmentX = rootMinX - worldMinX;
    }
    if (worldMaxX > rootMaxX) {
        adjustmentX = rootMaxX - worldMaxX;
    }

    // Clamp Y axis (only when CLAMP_Y_AXIS is enabled in sa-config)
    if (CLAMP_Y_AXIS) {
        if (worldMinY < rootMinY) {
            adjustmentY = rootMinY - worldMinY;
        }
        if (worldMaxY > rootMaxY) {
            adjustmentY = rootMaxY - worldMaxY;
        }
    }

    // Clamp Z axis
    if (worldMinZ < rootMinZ) {
        adjustmentZ = rootMinZ - worldMinZ;
    }
    if (worldMaxZ > rootMaxZ) {
        adjustmentZ = rootMaxZ - worldMaxZ;
    }

    // Apply adjustments
    if (adjustmentX !== 0 || adjustmentY !== 0 || adjustmentZ !== 0) {
        // For nested objects, we need to adjust the world position
        // by modifying the local position relative to the parent
        const worldAdjustment = new THREE.Vector3(adjustmentX,adjustmentY,adjustmentZ);

        if (obj.parent && obj.parent !== scene) {
            // Convert world adjustment to local adjustment
            const localAdjustment = worldAdjustment.clone();
            obj.parent.worldToLocal(localAdjustment);
            obj.position.add(localAdjustment);
        } else {
            // Direct world position adjustment for top-level objects
            obj.position.add(worldAdjustment);
        }
    }

}

function clampToCanvasRecursive(obj) {

    // Always clamp the object itself, regardless of whether it's in a group or not
    // This ensures that ALL objects (including nested ones) respect the bounding box constraints
    clampToCanvas(obj);

    // If this is a group, also clamp all its children recursively
    if (obj.userData?.isEditorGroup) {
        obj.children.forEach(child => {
            if (child.userData?.isSelectable) {
                clampToCanvasRecursive(child);
            }
        }
        );
    }

}

function findTopLevelGroup(obj) {
    // Find the top-level group in the hierarchy (the one directly attached to scene)
    let current = obj;
    while (current.parent && current.parent !== scene && current.parent.userData?.isEditorGroup) {
        current = current.parent;
    }
    return current;
}

// ===== Texture resolution =====

// Function to extract texture resolution information from GLTF models
function getTextureResolutionInfo(model) {
    const textureInfo = {
        textures: [],
        totalTextures: 0,
        maxResolution: {
            width: 0,
            height: 0
        },
        minResolution: {
            width: Infinity,
            height: Infinity
        }
    };

    if (!model)
        return textureInfo;

    // Traverse the model to find all materials and their textures
    model.traverse( (child) => {
        if (child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];

            materials.forEach(material => {
                // Check various texture maps
                const textureMaps = [{
                    name: 'map',
                    texture: material.map
                }, {
                    name: 'normalMap',
                    texture: material.normalMap
                }, {
                    name: 'roughnessMap',
                    texture: material.roughnessMap
                }, {
                    name: 'metalnessMap',
                    texture: material.metalnessMap
                }, {
                    name: 'emissiveMap',
                    texture: material.emissiveMap
                }, {
                    name: 'aoMap',
                    texture: material.aoMap
                }, {
                    name: 'displacementMap',
                    texture: material.displacementMap
                }, {
                    name: 'alphaMap',
                    texture: material.alphaMap
                }, {
                    name: 'lightMap',
                    texture: material.lightMap
                }, {
                    name: 'bumpMap',
                    texture: material.bumpMap
                }, {
                    name: 'envMap',
                    texture: material.envMap
                }];

                textureMaps.forEach( ({name, texture}) => {
                    if (texture && texture.image) {
                        const width = texture.image.width || texture.image.videoWidth || 0;
                        const height = texture.image.height || texture.image.videoHeight || 0;

                        if (width > 0 && height > 0) {
                            const img = texture.image;
                            const fileName = texture.name || (img.src ? img.src.replace(/^.*[/\\]/, '') : null) || (img.currentSrc ? img.currentSrc.replace(/^.*[/\\]/, '') : null) || '';
                            const fileExtension = fileName && fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
                            // Identifiable info for cached textures (blob/data URLs or no filename)
                            const rawSrc = img.src || img.currentSrc || '';
                            const sourceHint = rawSrc.indexOf('blob:') === 0 ? 'blob' : rawSrc.indexOf('data:') === 0 ? 'data' : undefined;
                            // Find sReference by walking up to nearest ancestor with sourceRef (for grouping by model)
                            let sReference = '';
                            let p = child;
                            while (p) {
                                if (p.userData?.sourceRef?.reference) {
                                    sReference = p.userData.sourceRef.reference;
                                    break;
                                }
                                p = p.parent;
                            }
                            textureInfo.textures.push({
                                type: name,
                                width: width,
                                height: height,
                                resolution: `${width}x${height}`,
                                materialName: material.name || 'Unnamed Material',
                                fileName: fileName || undefined,
                                fileExtension: fileExtension || undefined,
                                megapixels: (width * height) / 1e6,
                                sourceHint: sourceHint,
                                textureName: (texture.name && texture.name.trim()) ? texture.name.trim() : undefined,
                                sReference: sReference || undefined
                            });

                            textureInfo.totalTextures++;

                            // Update max resolution
                            if (width > textureInfo.maxResolution.width || height > textureInfo.maxResolution.height) {
                                textureInfo.maxResolution.width = Math.max(textureInfo.maxResolution.width, width);
                                textureInfo.maxResolution.height = Math.max(textureInfo.maxResolution.height, height);
                            }

                            // Update min resolution
                            if (width < textureInfo.minResolution.width || height < textureInfo.minResolution.height) {
                                textureInfo.minResolution.width = Math.min(textureInfo.minResolution.width, width);
                                textureInfo.minResolution.height = Math.min(textureInfo.minResolution.height, height);
                            }
                        }
                    }
                }
                );
            }
            );
        }
    }
    );

    // Reset min resolution if no textures found
    if (textureInfo.totalTextures === 0) {
        textureInfo.minResolution = {
            width: 0,
            height: 0
        };
    }

    textureInfo.totalPixels = textureInfo.textures.reduce((sum, t) => sum + t.width * t.height, 0);
    return textureInfo;
}

function updateModelProperties(model) {
    if (!model)
        return;

    // Special handling for Object Root - use canvas dimensions
    if (model.userData?.isCanvasRoot) {
        const canvasSize = new THREE.Vector3(groundSize,groundSize,groundSize);
        const worldPosition = new THREE.Vector3(0,groundSize / 2,0);
        // Canvas center (matches canvas box helper)
        const worldScale = new THREE.Vector3(1,1,1);
        // No scaling for canvas
        const worldQuaternion = new THREE.Quaternion(0,0,0,1);
        // Identity quaternion for canvas

        // Calculate triangle count
        const triangleCount = getTriangleCount(model);

        // Get texture resolution information
        const textureInfo = getTextureResolutionInfo(model);

        // Store aBound data for clamping constraints
        model.userData.aBound = [groundSize, groundSize, groundSize];

        model.userData.properties = {
            pos: worldPosition,
            scl: worldScale,
            rot: worldQuaternion.clone(),
            size: canvasSize.clone(),
            triangles: triangleCount,
            vertices: getVertexCount(model),
            textures: textureInfo
        };
        return;
    }

    const box = getBox(model);
    const size = box.getSize(new THREE.Vector3());

    // Use local transforms for consistent local positioning
    const localPosition = model.position.clone();
    const localScale = model.scale.clone();
    const localQuaternion = model.quaternion.clone();

    // Calculate triangle count
    const triangleCount = getTriangleCount(model);

    // Get texture resolution information
    const textureInfo = getTextureResolutionInfo(model);

    model.userData.properties = {
        pos: localPosition,
        scl: localScale,
        rot: localQuaternion.clone(),
        size: size.clone(),
        triangles: triangleCount,
        vertices: getVertexCount(model),
        textures: textureInfo
    };
}

function aggregateTriangleCount(objects) {
    let totalTriangles = 0;
    objects.forEach(obj => {
        if (obj && obj.userData?.properties) {
            totalTriangles += obj.userData.properties.triangles || 0;
        }
    });
    return totalTriangles;
}

function aggregateVertexCount(objects) {
    let totalVertices = 0;
    objects.forEach(obj => {
        if (obj && obj.userData?.properties) {
            totalVertices += obj.userData.properties.vertices || 0;
        }
    });
    return totalVertices;
}

function aggregateTextureInfo(objects) {
    const aggregated = {
        totalTextures: 0,
        totalPixels: 0,
        maxResolution: {
            width: 0,
            height: 0
        },
        minResolution: {
            width: Infinity,
            height: Infinity
        }
    };

    objects.forEach(obj => {
        if (obj && obj.userData?.properties && obj.userData.properties.textures) {
            const texInfo = obj.userData.properties.textures;
            if (texInfo.totalTextures > 0) {
                aggregated.totalTextures += texInfo.totalTextures;
                aggregated.totalPixels += texInfo.totalPixels || 0;

                // Update max resolution
                if (texInfo.maxResolution.width > aggregated.maxResolution.width || texInfo.maxResolution.height > aggregated.maxResolution.height) {
                    aggregated.maxResolution.width = Math.max(aggregated.maxResolution.width, texInfo.maxResolution.width);
                    aggregated.maxResolution.height = Math.max(aggregated.maxResolution.height, texInfo.maxResolution.height);
                }

                // Update min resolution
                if (texInfo.minResolution.width < aggregated.minResolution.width || texInfo.minResolution.height < aggregated.minResolution.height) {
                    aggregated.minResolution.width = Math.min(aggregated.minResolution.width, texInfo.minResolution.width);
                    aggregated.minResolution.height = Math.min(aggregated.minResolution.height, texInfo.minResolution.height);
                }
            }
        }
    });

    // Reset min resolution if no textures found
    if (aggregated.totalTextures === 0) {
        aggregated.minResolution = {
            width: 0,
            height: 0
        };
    }

    return aggregated;
}

/** Returns a flat list of texture entries for the given objects (for #texList). Each entry includes sReference for grouping by model. */
function getSelectedTextureList(objects) {
    const list = [];
    (objects || []).forEach(obj => {
        const tex = obj?.userData?.properties?.textures;
        const objRef = obj?.userData?.sourceRef?.reference || '';
        if (tex && Array.isArray(tex.textures))
            tex.textures.forEach(t => list.push({ ...t, sReference: t.sReference || objRef }));
    });
    return list;
}

// ===== Properties panel =====

function updatePropertiesPanel(model) {
    // Filter out canvas root from selected objects for aggregation
    const validSelectedObjects = selectedObjects.filter(obj => obj && obj.userData?.properties && !obj.userData?.isCanvasRoot);

    // Use aggregated data if multiple objects selected, otherwise use single model
    let totalTriangles = 0;
    let totalVertices = 0;
    let aggregatedTextureInfo = null;

    if (validSelectedObjects.length > 1) {
        // Multiple objects selected - aggregate data
        totalTriangles = aggregateTriangleCount(validSelectedObjects);
        totalVertices = aggregateVertexCount(validSelectedObjects);
        aggregatedTextureInfo = aggregateTextureInfo(validSelectedObjects);
    } else if (validSelectedObjects.length === 1) {
        // Single valid object selected - use its data
        const p = validSelectedObjects[0].userData.properties;
        totalTriangles = p.triangles || 0;
        totalVertices = p.vertices || 0;
        aggregatedTextureInfo = p.textures || null;
    } else if (model && model.userData?.properties) {
        // Fallback to model parameter if provided (for backward compatibility)
        const p = model.userData.properties;
        totalTriangles = p.triangles || 0;
        totalVertices = p.vertices || 0;
        aggregatedTextureInfo = p.textures || null;
    }

    if (vertCountElement) vertCountElement.textContent = totalVertices.toLocaleString();

    // Triangle analyser: one percentage, one tier (0=ok, 1=warning, 2=danger)
    const pctRaw = (totalTriangles / TRI_SCENE_MAX) * 100;
    const triTier = pctRaw > 100 ? 2 : pctRaw > 80 ? 1 : 0;

    if (triCountElement) triCountElement.textContent = totalTriangles.toLocaleString();
    if (triGaugeCount) triGaugeCount.textContent = totalTriangles.toLocaleString();
    if (triGaugeFill && triGaugeBar) {
        triGaugeFill.style.width = Math.min(100, pctRaw) + "%";
        triGaugeFill.classList.remove("bg-success", "bg-warning", "bg-danger");
        triGaugeFill.classList.add(triTier === 0 ? "bg-success" : triTier === 1 ? "bg-warning" : "bg-danger");
        triGaugeBar.setAttribute("aria-valuenow", totalTriangles);
    }
    if (triGaugeStatus) {
        triGaugeStatus.textContent = triTier === 0 ? "Good" : triTier === 1 ? "Consider simplifying/reducing objects" : "This is too much — reduce for better performance";
    }

    // Scene total triangle gauge
    const sceneTotalTriangles = getTriangleCount(canvasRoot);
    const scenePctRaw = (sceneTotalTriangles / TRI_SCENE_MAX) * 100;
    const sceneTriTier = scenePctRaw > 100 ? 2 : scenePctRaw > 80 ? 1 : 0;
    if (triSceneCount) triSceneCount.textContent = sceneTotalTriangles.toLocaleString();
    if (triSceneGaugeFill && triSceneGaugeBar) {
        triSceneGaugeFill.style.width = Math.min(100, scenePctRaw) + "%";
        triSceneGaugeFill.classList.remove("bg-success", "bg-warning", "bg-danger");
        triSceneGaugeFill.classList.add(sceneTriTier === 0 ? "bg-success" : sceneTriTier === 1 ? "bg-warning" : "bg-danger");
        triSceneGaugeBar.setAttribute("aria-valuenow", sceneTotalTriangles);
    }
    if (triSceneGaugeStatus) {
        triSceneGaugeStatus.textContent = sceneTriTier === 0 ? "Good" : sceneTriTier === 1 ? "Consider simplifying/reducing objects" : "This is too much — reduce for better performance";
    }

    if (lastTriTier !== triTier) {
        lastTriTier = triTier;
        if (triBadge) {
            triBadge.classList.toggle("text-bg-secondary", triTier < 2);
            triBadge.classList.toggle("text-bg-danger", triTier === 2);
        }
        if (triStatsStatViewer) {
            triStatsStatViewer.classList.remove("alert", "alert-warning", "alert-danger");
            if (triTier === 2) triStatsStatViewer.classList.add("alert", "alert-danger");
            else if (triTier === 1) triStatsStatViewer.classList.add("alert", "alert-warning");
        }
        if (triStatusBtn) {
            triStatusBtn.classList.remove("btn-outline-warning", "btn-outline-danger");
            triStatusBtn.classList.toggle("btn-outline-secondary", triTier === 0);
            triStatusBtn.classList.toggle("btn-outline-warning", triTier === 1);
            triStatusBtn.classList.toggle("btn-outline-danger", triTier === 2);
        }
        if (triStatusIcon) {
            triStatusIcon.classList.toggle("fa-info-circle", triTier !== 2);
            triStatusIcon.classList.toggle("fa-circle-exclamation", triTier === 2);
        }
    }

    // Texture: one pass for badge + analyzer (avoid duplicate resolution branching)
    const totalMegapixels = aggregatedTextureInfo && aggregatedTextureInfo.totalPixels
        ? aggregatedTextureInfo.totalPixels / 1e6
        : 0;
    const texPctRaw = (totalMegapixels / TEX_SCENE_MAX_MP) * 100;
    const texTier = texPctRaw > 100 ? 2 : texPctRaw > 80 ? 1 : 0;

    const a = aggregatedTextureInfo;
    const hasTex = a && a.totalTextures > 0;
    const sameRes = hasTex && a.maxResolution.width === a.minResolution.width && a.minResolution.width > 0;
    const mixedRes = hasTex && a.minResolution.width > 0 && !sameRes;

    let textureInfoText = "None";
    let texDimsString = "—";
    if (sameRes) {
        const w = a.maxResolution.width, h = a.maxResolution.height;
        textureInfoText = `${a.totalTextures} @ ${w}x${h}`;
        texDimsString = `${a.totalTextures} @ ${w}×${h} = ${totalMegapixels.toFixed(2)}`;
    } else if (mixedRes) {
        const mw = a.minResolution.width, mh = a.minResolution.height, xw = a.maxResolution.width, xh = a.maxResolution.height;
        textureInfoText = `${a.totalTextures} (${mw}x${mh} - ${xw}x${xh})`;
        texDimsString = `${a.totalTextures} (${mw}×${mh}–${xw}×${xh}) = ${totalMegapixels.toFixed(2)}`;
    } else if (hasTex) {
        textureInfoText = String(a.totalTextures);
        texDimsString = `${a.totalTextures} = ${totalMegapixels.toFixed(2)}`;
    }

    // Badge shows selected megapixel total
    if (texCountElement) texCountElement.textContent = hasTex ? `${totalMegapixels.toFixed(2)} MP` : "None";

    const texGaugeChanged = totalMegapixels !== lastTotalMegapixels || texTier !== lastTexTier;
    const texDimsChanged = texDimsString !== lastTexDimsString;
    if (texGaugeChanged) lastTotalMegapixels = totalMegapixels;
    if (texDimsChanged) lastTexDimsString = texDimsString;

    if (texGaugeChanged && texGaugeFill && texGaugeBar) {
        texGaugeFill.style.width = Math.min(100, texPctRaw) + "%";
        texGaugeFill.classList.remove("bg-success", "bg-warning", "bg-danger");
        texGaugeFill.classList.add(texTier === 0 ? "bg-success" : texTier === 1 ? "bg-warning" : "bg-danger");
        texGaugeBar.setAttribute("aria-valuenow", Math.round(totalMegapixels * 100) / 100);
    }
    if (texGaugeChanged && texGaugeStatus) {
        texGaugeStatus.textContent = texTier === 0 ? "Good" : texTier === 1 ? "Consider reducing size/number of textures" : "This is too much — reduce for smoother rendering";
    }
    if (texDimsChanged && texGaugeDims) texGaugeDims.textContent = texDimsString;

    // Scene total texture gauge: compute from scene graph so it's always correct
    // (avoids double-counting and missing objects that don't have userData.properties yet)
    const sceneTexInfo = getTextureResolutionInfo(canvasRoot);
    const sceneTotalMegapixels = (sceneTexInfo.totalPixels || 0) / 1e6;
    const sceneTexPctRaw = (sceneTotalMegapixels / TEX_SCENE_MAX_MP) * 100;
    const sceneTexTier = sceneTexPctRaw > 100 ? 2 : sceneTexPctRaw > 80 ? 1 : 0;
    if (texSceneCount) texSceneCount.textContent = sceneTotalMegapixels.toFixed(2);
    if (texSceneGaugeFill && texSceneGaugeBar) {
        texSceneGaugeFill.style.width = Math.min(100, sceneTexPctRaw) + "%";
        texSceneGaugeFill.classList.remove("bg-success", "bg-warning", "bg-danger");
        texSceneGaugeFill.classList.add(sceneTexTier === 0 ? "bg-success" : sceneTexTier === 1 ? "bg-warning" : "bg-danger");
        texSceneGaugeBar.setAttribute("aria-valuenow", Math.round(sceneTotalMegapixels * 100) / 100);
    }
    if (texSceneGaugeStatus) {
        texSceneGaugeStatus.textContent = sceneTexTier === 0 ? "Good" : sceneTexTier === 1 ? "Consider reducing size/number of textures" : "This is too much — reduce for smoother rendering";
    }

    // Texture list: selected objects' textures, or full scene when nothing selected. Group by model (sReference).
    const textureListForDisplay = validSelectedObjects.length > 0
        ? getSelectedTextureList(validSelectedObjects)
        : (sceneTexInfo.textures || []);
    if (texList) {
        if (textureListForDisplay.length === 0) {
            texList.innerHTML = '<ul class="list-group list-group-flush small mb-2"><li class="list-group-item text-muted py-1">No textures</li></ul>';
        } else {
            // Group textures by sReference (model reference from JSON pResource)
            const byModel = {};
            textureListForDisplay.forEach(t => {
                const ref = t.sReference || '(unknown)';
                if (!byModel[ref]) byModel[ref] = [];
                byModel[ref].push(t);
            });
            const renderTexItem = (t, num) => {
                const label = t.fileExtension ||
                    (t.textureName && t.textureName.length > 0 ? t.textureName : null) ||
                    (t.sourceHint ? t.sourceHint : null) ||
                    '—';
                const title = [t.fileName, t.textureName, t.sourceHint && ('src: ' + t.sourceHint)].filter(Boolean).join(' · ') || label;
                const dims = t.resolution || (t.width && t.height ? t.width + '×' + t.height : '—');
                const mp = t.megapixels != null ? (t.megapixels.toFixed(2) + ' MP') : (t.width && t.height ? ((t.width * t.height) / 1e6).toFixed(2) + ' MP' : '');
                const dimsAndMp = mp ? dims + ' · ' + mp : dims;
                return '<li class="list-group-item d-flex justify-content-between align-items-start py-1">' +
                    '<span class="me-2 flex-shrink-0 text-muted">' + num + '</span>' +
                    '<span class="me-2 text-break" title="' + (title.replace(/"/g, '&quot;')) + '">' + (label.replace(/</g, '&lt;')) + '</span>' +
                    '<span class="badge text-bg-secondary flex-shrink-0">' + (t.type || '') + '</span>' +
                    '<span class="text-body-secondary flex-shrink-0 ms-1">' + dimsAndMp + '</span>' +
                    '</li>';
            };
            let globalNum = 0;
            texList.innerHTML = '<ul class="list-group list-group-flush small mb-2">' +
                Object.entries(byModel).map(([ref, texs]) => {
                    const count = texs.length;
                    const header = '<li class="list-group-item list-group-item-secondary py-1 px-2 fw-medium small">' +
                        (ref !== '(unknown)' ? ref.replace(/^.*[/\\]/, '') : ref) +
                        (count > 1 ? ' <span class="text-body-secondary fw-normal">(' + count + ')</span>' : '') +
                        '</li>';
                    const items = texs.map(t => renderTexItem(t, ++globalNum)).join('');
                    return header + items;
                }).join('') +
                '</ul>';
        }
    }

    if (lastTexTier !== texTier) {
        lastTexTier = texTier;
        if (texBadge) {
            texBadge.classList.toggle("text-bg-secondary", texTier < 2);
            texBadge.classList.toggle("text-bg-danger", texTier === 2);
        }
        if (texStatsStatViewer) {
            texStatsStatViewer.classList.remove("alert", "alert-warning", "alert-danger");
            if (texTier === 2) texStatsStatViewer.classList.add("alert", "alert-danger");
            else if (texTier === 1) texStatsStatViewer.classList.add("alert", "alert-warning");
        }
        if (texStatusBtn) {
            texStatusBtn.classList.remove("btn-outline-warning", "btn-outline-danger");
            texStatusBtn.classList.toggle("btn-outline-secondary", texTier === 0);
            texStatusBtn.classList.toggle("btn-outline-warning", texTier === 1);
            texStatusBtn.classList.toggle("btn-outline-danger", texTier === 2);
        }
        if (texStatusIcon) {
            texStatusIcon.classList.toggle("fa-info-circle", texTier !== 2);
            texStatusIcon.classList.toggle("fa-circle-exclamation", texTier === 2);
        }
    }

    // Update properties panel text (only show for single selection)
    // Hide if multiple objects are selected (even if in same group)
    if (validSelectedObjects.length > 1) {
        if (propertiesPanel) {
            propertiesPanel.textContent = "";
        }
        return;
    }

    // Show properties for single object or group
    if (!model || !model.userData?.properties) {
        propertiesPanel.textContent = "";
        return;
    }

    const p = model.userData.properties;
    let propertiesText = `Position: (${p.pos.x.toFixed(2)}, ${p.pos.y.toFixed(2)}, ${p.pos.z.toFixed(2)})\n` + `Rotation: (${p.rot.x.toFixed(4)}, ${p.rot.y.toFixed(4)}, ${p.rot.z.toFixed(4)}, ${p.rot.w.toFixed(4)})\n` + `Scale: (${p.scl.x.toFixed(2)}, ${p.scl.y.toFixed(2)}, ${p.scl.z.toFixed(2)})\n` + `Bounds: (${p.size.x.toFixed(2)}, ${p.size.y.toFixed(2)}, ${p.size.z.toFixed(2)})`;
    propertiesPanel.textContent = propertiesText;
}

function updateTransformButtonStates() {
    const editingAllowed = isEditingAllowed();
    const buttons = [btnTranslate, btnRotate, btnScale];

    // Show/hide objControls based on selection
    if (objControls) {
        if (selectedObjects.length > 0) {
            objControls.classList.remove('d-none');
        } else {
            objControls.classList.add('d-none');
        }
    }

    // Show/hide properties panel card based on selection
    if (propertiesPanelCard) {
        if (selectedObjects.length > 0) {
            propertiesPanelCard.style.display = '';
        } else {
            propertiesPanelCard.style.display = 'none';
        }
    }

    buttons.forEach(btn => {
        if (editingAllowed) {
            btn.disabled = false;
            btn.style.opacity = "1";
            btn.style.cursor = "pointer";
        } else {
            btn.disabled = true;
            btn.style.opacity = "0.5";
            btn.style.cursor = "not-allowed";
        }
    }
    );

    // Update active state of buttons based on current transform mode
    updateTransformButtonActiveState();

    // Handle delete button - disable if only Object Root is selected
    const deleteAllowed = selectedObjects.length > 0 && !(selectedObjects.length === 1 && selectedObjects[0].userData?.isCanvasRoot);
    if (deleteAllowed) {
        btnDelete.disabled = false;
        btnDelete.style.opacity = "1";
        btnDelete.style.cursor = "pointer";
    } else {
        btnDelete.disabled = true;
        btnDelete.style.opacity = "0.5";
        btnDelete.style.cursor = "not-allowed";
    }

    // Detach transform gizmo if editing is not allowed
    if (!editingAllowed) {
        transform.detach();
        updateTransformButtonActiveState();
    } else if (selectedObject) {
        // Reattach to the selected object if editing is allowed
        transform.attach(selectedObject);
        updateTransformButtonActiveState();
    }
}
