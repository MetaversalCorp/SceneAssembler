/**
 * sa-models.js
 * Model cache, loadModelFromReference, URL utilities.
 * Depends: sa-config, sa-core, sa-bootstrap (loader)
 * Used by: sa-selection, sa-json-sync, sa-object-library
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

// ===== Model Cache System =====
const modelCache = new Map();
const loadingPromises = new Map();

// ===== URL and Model Loading Utilities =====
function isUrl(sReference) {
    let bResult = false;
    if (sReference) {
        sReference = sReference.toLowerCase();
        if (sReference.startsWith('http://') || sReference.startsWith('https://'))
            bResult = true;
    }
    return bResult;
}

function calculateBoxDimensionsForRotatedAABB(aabb, quaternion) {
    if (!quaternion || !aabb || aabb.length < 3) return aabb;
    const tempBox = new THREE.Box3();
    tempBox.setFromCenterAndSize(new THREE.Vector3(0, 0, 0), new THREE.Vector3(aabb[0], aabb[1], aabb[2]));
    const corners = [
        new THREE.Vector3(tempBox.min.x, tempBox.min.y, tempBox.min.z),
        new THREE.Vector3(tempBox.max.x, tempBox.min.y, tempBox.min.z),
        new THREE.Vector3(tempBox.min.x, tempBox.max.y, tempBox.min.z),
        new THREE.Vector3(tempBox.max.x, tempBox.max.y, tempBox.min.z),
        new THREE.Vector3(tempBox.min.x, tempBox.min.y, tempBox.max.z),
        new THREE.Vector3(tempBox.max.x, tempBox.min.y, tempBox.max.z),
        new THREE.Vector3(tempBox.min.x, tempBox.max.y, tempBox.max.z),
        new THREE.Vector3(tempBox.max.x, tempBox.max.y, tempBox.max.z)
    ];
    const invQuaternion = quaternion.clone().invert();
    const rotatedCorners = corners.map(corner => corner.applyQuaternion(invQuaternion));
    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    rotatedCorners.forEach(corner => {
        min.min(corner);
        max.max(corner);
    });
    return [max.x - min.x, max.y - min.y, max.z - min.z];
}

function getCacheKey(sReference, scale = null, rotation = null) {
    if (!isUrl(sReference)) {
        let key = sReference || '';
        if (scale && Array.isArray(scale) && scale.length >= 3) {
            key += `|scale:${scale[0]},${scale[1]},${scale[2]}`;
        }
        if (rotation && Array.isArray(rotation) && rotation.length >= 4) {
            key += `|rot:${rotation[0]},${rotation[1]},${rotation[2]},${rotation[3]}`;
        }
        return key;
    }
    return sReference || '';
}

function normalizeReferencePath(sReference) {
    if (sReference && isUrl(sReference) == false) {
        let sRootUrl = g_pMap.GetRootUrl();
        sReference = new URL(sReference, sRootUrl).href;
    }
    return sReference;
}

async function loadModelFromReference(sReference, boundingBox = null, scale = null, rotation = null) {
    const normalizedReference = normalizeReferencePath(sReference);
    const cacheKey = getCacheKey(normalizedReference, scale, rotation);
    if (modelCache.has(cacheKey)) return modelCache.get(cacheKey);
    if (loadingPromises.has(cacheKey)) return loadingPromises.get(cacheKey);
    const loadingPromise = new Promise((resolve, reject) => {
        loader.load(normalizedReference, (gltf) => {
            const model = gltf.scene;
            modelCache.set(cacheKey, model);
            loadingPromises.delete(cacheKey);
            resolve(model);
        }, undefined, (error) => {
            console.error(`Failed to load model from URL: ${normalizedReference}`, error);
            loadingPromises.delete(cacheKey);
            let dimensions = boundingBox && Array.isArray(boundingBox) && boundingBox.length >= 3 ? boundingBox : [1, 1, 1];
            if (rotation && Array.isArray(rotation) && rotation.length >= 4) {
                const quaternion = new THREE.Quaternion(rotation[0], rotation[1], rotation[2], rotation[3]);
                dimensions = calculateBoxDimensionsForRotatedAABB(dimensions, quaternion);
            }
            if (scale && Array.isArray(scale) && scale.length >= 3) {
                dimensions = [
                    dimensions[0] / (scale[0] !== 0 ? scale[0] : 1),
                    dimensions[1] / (scale[1] !== 0 ? scale[1] : 1),
                    dimensions[2] / (scale[2] !== 0 ? scale[2] : 1)
                ];
            }
            const geometry = new THREE.BoxGeometry(dimensions[0], dimensions[1], dimensions[2]);
            geometry.translate(0, dimensions[1] / 2, 0);
            const material = new THREE.MeshBasicMaterial({ color: ERROR_OBJECT_COLOR });
            const placeholder = new THREE.Mesh(geometry, material);
            placeholder.name = normalizedReference ? normalizedReference.replace(/\.[^/.]+$/, "") : "Placeholder (Failed)";
            modelCache.set(cacheKey, placeholder);
            resolve(placeholder);
        });
    });
    loadingPromises.set(cacheKey, loadingPromise);
    return loadingPromise;
}
