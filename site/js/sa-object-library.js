/**
 * sa-object-library.js
 * Object library: loadObjectLibrary, createObjectLibraryItem, preview rendering.
 * Depends: sa-core, sa-bootstrap, sa-models, sa-properties, sa-transforms, sa-selection, sa-json-sync, sa-sidebar
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

// ===== Object Library =====
const objLibGrid = document.getElementById('objLibGrid');
const objLibPanel = document.getElementById('objLibPanel');
const objLibToggle = document.getElementById('objLibToggle');
const objectLibraryCache = new Map();
const hoveredPreviewPaths = new Set();
let sharedPreviewRenderer = null;
let sharedPreviewRenderTarget = null;

// Fade #objLibToggle when objLibPanel is visible
if (objLibPanel && objLibToggle) {
    setTimeout(() => {
        objLibPanel.addEventListener('shown.bs.offcanvas', function () {
            objLibToggle.classList.add('opacity-0');
            objLibToggle.style.pointerEvents = 'none';
        });
        objLibPanel.addEventListener('hidden.bs.offcanvas', function () {
            objLibToggle.classList.remove('opacity-0');
            objLibToggle.style.pointerEvents = '';
        });
    }, 100);
}

async function getObjectFiles(sRootUrl) {
    try {
        let jsonUrl = new URL('/objects.json', sRootUrl).href;
        const response = await fetch(jsonUrl);
        if (!response.ok) return [];

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (parseError) {
            return [];
        }

        const objectList = Array.isArray(data) ? data : (data.objects || data.files || []);
        if (Array.isArray(objectList) && objectList.length > 0) {
            return objectList.filter(file =>
                typeof file === 'string' && (file.endsWith('.glb') || file.endsWith('.gltf'))
            );
        }
    } catch (error) {
        console.error('Failed to load objects.json:', error);
    }
    return [];
}

function getSharedPreviewRenderer() {
    if (!sharedPreviewRenderer) {
        sharedPreviewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        sharedPreviewRenderer.setSize(PREVIEW_SIZE, PREVIEW_SIZE);
        sharedPreviewRenderer.setPixelRatio(1);
        sharedPreviewRenderer.domElement.style.display = 'none';
        sharedPreviewRenderTarget = new THREE.WebGLRenderTarget(PREVIEW_SIZE, PREVIEW_SIZE);
    }
    return sharedPreviewRenderer;
}

let previewAnimationId = null;
const previewPixelBuffer = new Uint8Array(PREVIEW_SIZE * PREVIEW_SIZE * 4);

function formatTriangleCompact(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
}

function formatTextureCompact(texInfo) {
    if (!texInfo || !texInfo.totalTextures) return '—';
    const { totalTextures, maxResolution, minResolution, totalPixels } = texInfo;
    const mp = totalPixels ? (totalPixels / 1e6).toFixed(2) : '0';
    const sameRes = maxResolution.width === minResolution.width && minResolution.width > 0;
    if (sameRes && maxResolution.width === maxResolution.height) {
        const w = maxResolution.width;
        return w >= 1024 ? (w / 1024).toFixed(0) + 'K²' : w + '²';
    }
    if (sameRes) {
        const w = maxResolution.width >= 1024 ? (maxResolution.width / 1024) + 'K' : maxResolution.width;
        const h = maxResolution.height >= 1024 ? (maxResolution.height / 1024) + 'K' : maxResolution.height;
        return w + '×' + h;
    }
    return mp + ' MP';
}

function runPreviewAnimationLoop() {
    if (hoveredPreviewPaths.size === 0 || !sharedPreviewRenderer) return;
    const renderer = sharedPreviewRenderer;
    const rt = sharedPreviewRenderTarget;

    hoveredPreviewPaths.forEach((objectPath) => {
        const entry = objectLibraryCache.get(objectPath);
        if (!entry) return;
        const { scene, camera, model, displayCanvas } = entry;
        if (!displayCanvas) return;
        if (model) model.rotation.y += PREVIEW_ROTATION_SPEED;

        renderer.setRenderTarget(rt);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);

        renderer.readRenderTargetPixels(rt, 0, 0, PREVIEW_SIZE, PREVIEW_SIZE, previewPixelBuffer);

        const ctx = displayCanvas.getContext('2d');
        if (ctx) {
            const imgData = ctx.createImageData(PREVIEW_SIZE, PREVIEW_SIZE);
            for (let y = PREVIEW_SIZE - 1; y >= 0; y--) {
                const srcRow = (PREVIEW_SIZE - 1 - y) * PREVIEW_SIZE * 4;
                const dstRow = y * PREVIEW_SIZE * 4;
                for (let x = 0; x < PREVIEW_SIZE * 4; x++) {
                    imgData.data[dstRow + x] = previewPixelBuffer[srcRow + x];
                }
            }
            ctx.putImageData(imgData, 0, 0);
        }
    });

    previewAnimationId = requestAnimationFrame(runPreviewAnimationLoop);
}

function renderPreviewToCanvas(objectPath) {
    const entry = objectLibraryCache.get(objectPath);
    if (!entry || !sharedPreviewRenderer) return;
    const { scene, camera, model, displayCanvas } = entry;
    if (!displayCanvas) return;

    sharedPreviewRenderer.setRenderTarget(sharedPreviewRenderTarget);
    sharedPreviewRenderer.render(scene, camera);
    sharedPreviewRenderer.setRenderTarget(null);

    sharedPreviewRenderer.readRenderTargetPixels(sharedPreviewRenderTarget, 0, 0, PREVIEW_SIZE, PREVIEW_SIZE, previewPixelBuffer);

    const ctx = displayCanvas.getContext('2d');
    if (ctx) {
        const imgData = ctx.createImageData(PREVIEW_SIZE, PREVIEW_SIZE);
        for (let y = PREVIEW_SIZE - 1; y >= 0; y--) {
            const srcRow = (PREVIEW_SIZE - 1 - y) * PREVIEW_SIZE * 4;
            const dstRow = y * PREVIEW_SIZE * 4;
            for (let x = 0; x < PREVIEW_SIZE * 4; x++) {
                imgData.data[dstRow + x] = previewPixelBuffer[srcRow + x];
            }
        }
        ctx.putImageData(imgData, 0, 0);
    }
}

function createObjectPreview(objectPath, container) {
    const width = PREVIEW_SIZE;
    const height = PREVIEW_SIZE;

    const displayCanvas = document.createElement('canvas');
    displayCanvas.width = width;
    displayCanvas.height = height;
    displayCanvas.style.width = '100%';
    displayCanvas.style.height = '100%';
    displayCanvas.style.display = 'block';
    container.appendChild(displayCanvas);

    const previewScene = new THREE.Scene();
    previewScene.background = new THREE.Color(PREVIEW_BACKGROUND);

    const previewCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    previewCamera.position.set(2, 2, 2);
    previewCamera.lookAt(0, 0, 0);

    previewScene.add(new THREE.HemisphereLight(LIGHT_HEMISPHERE_SKY, LIGHT_HEMISPHERE_GROUND, LIGHT_HEMISPHERE_INTENSITY));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 7);
    previewScene.add(dirLight);

    loader.load(objectPath, (gltf) => {
        const model = gltf.scene;

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        model.position.sub(center);

        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = PREVIEW_SCALE_FIT / maxDim;
        model.scale.multiplyScalar(scale);

        previewScene.add(model);

        getSharedPreviewRenderer();

        objectLibraryCache.set(objectPath, { scene: previewScene, camera: previewCamera, model, displayCanvas });

        renderPreviewToCanvas(objectPath);

        const triCount = typeof getTriangleCount === 'function' ? getTriangleCount(model) : 0;
        const texInfo = typeof getTextureResolutionInfo === 'function' ? getTextureResolutionInfo(model) : null;
        const badgesWrap = document.createElement('div');
        badgesWrap.className = 'position-absolute top-0 start-0 end-0 d-flex gap-1 p-1 justify-content-between';
        badgesWrap.style.pointerEvents = 'none';
        const triBadge = document.createElement('span');
        triBadge.className = 'badge text-white flex-grow-0';
        triBadge.style.fontSize = '0.6rem';
        triBadge.style.lineHeight = '1.2';
        triBadge.title = `${triCount.toLocaleString()} triangles`;
        triBadge.innerHTML = '<i class="fa-solid fa-play fa-rotate-270 fa-xs me-0"></i> ' + formatTriangleCompact(triCount);
        const texBadge = document.createElement('span');
        texBadge.className = 'badge text-white flex-grow-0';
        texBadge.style.fontSize = '0.6rem';
        texBadge.style.lineHeight = '1.2';
        texBadge.title = texInfo && texInfo.totalTextures ? `${texInfo.totalTextures} texture(s), ${((texInfo.totalPixels || 0) / 1e6).toFixed(2)} MP` : 'No textures';
        texBadge.innerHTML = '<i class="fa-solid fa-image fa-xs me-0"></i> ' + formatTextureCompact(texInfo);
        badgesWrap.appendChild(triBadge);
        badgesWrap.appendChild(texBadge);
        container.appendChild(badgesWrap);
    }, undefined, (error) => {
        console.error(`Failed to load preview for ${objectPath}:`, error);
        container.innerHTML = '<div class="text-center text-muted p-3"><i class="fa-solid fa-triangle-exclamation"></i><br>Failed to load</div>';
    });
}

function createObjectLibraryItem(objectPath) {
    const col = document.createElement('div');
    col.className = 'col-4 col-md-2 col-xxl-1';

    const card = document.createElement('div');
    card.className = 'card bg-dark bg-opacity-50 border-secondary h-100 user-select-none';
    card.style.cursor = 'pointer';
    card.style.transition = 'transform 0.2s, box-shadow 0.2s';

    const refPath = normalizeReferencePath('/objects/' + objectPath);
    card.dataset.objectRef = refPath;

    card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-5px)';
        card.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
        hoveredPreviewPaths.add(refPath);
        if (!previewAnimationId) runPreviewAnimationLoop();
    });

    card.addEventListener('mouseleave', () => {
        card.style.transform = '';
        card.style.boxShadow = '';
        hoveredPreviewPaths.delete(refPath);
        if (hoveredPreviewPaths.size === 0 && previewAnimationId) {
            cancelAnimationFrame(previewAnimationId);
            previewAnimationId = null;
        }
    });

    const previewContainer = document.createElement('div');
    previewContainer.className = 'card-img-top bg-dark';
    previewContainer.style.height = '100px';
    previewContainer.style.overflow = 'hidden';
    previewContainer.style.position = 'relative';

    const objectName = objectPath.replace(/^.*[\\\/]/, '').replace(/\.[^/.]+$/, '');
    const cardBody = document.createElement('div');
    cardBody.className = 'card-body p-2';

    const cardTitle = document.createElement('h6');
    cardTitle.className = 'card-title mb-0 text-center small text-truncate';
    cardTitle.textContent = objectName;
    cardTitle.title = objectName;

    cardBody.appendChild(cardTitle);

    card.appendChild(previewContainer);
    card.appendChild(cardBody);

    card.addEventListener('click', async () => {
        try {
            const fullPath = `/objects/${objectPath}`;
            const gltf = await new Promise((resolve, reject) => {
                loader.load(fullPath, resolve, undefined, reject);
            });

            const model = gltf.scene;
            model.userData.isSelectable = true;
            model.name = objectName;

            const referencePath = `/objects/${objectPath}`;
            model.userData.sourceRef = {
                originalFileName: objectPath,
                baseName: objectName,
                reference: referencePath
            };

            modelCache.set(referencePath, model);

            model.position.set(0, 0, 0);

            createBoxHelperFor(model);
            canvasRoot.add(model);
            addModelToList(model, model.name);
            storeInitialTransform(model);
            selectObject(model);
            updateBoxHelper(model);
            frameCameraOn(model);
            saveSceneState('create', [model]);
            updateJSONEditorFromScene();

            const bsOffcanvas = bootstrap.Offcanvas.getInstance(objLibPanel);
            if (bsOffcanvas) bsOffcanvas.hide();
        } catch (error) {
            console.error(`Failed to load object ${objectPath}:`, error);
            alert(`Failed to load object: ${objectName}`);
        }
    });

    col.appendChild(card);

    createObjectPreview(normalizeReferencePath('/objects/' + objectPath), previewContainer);

    return col;
}

async function loadObjectLibrary(sRootUrl) {
    if (!objLibGrid) {
        console.error('objLibGrid element not found');
        return;
    }

    objLibGrid.innerHTML = '<div class="col-12 text-center text-muted py-5"><i class="fa-solid fa-spinner fa-spin fa-2x mb-3"></i><p class="mb-0">Loading objects...</p></div>';

    try {
        const objectFiles = await getObjectFiles(sRootUrl);

        if (objectFiles.length === 0) {
            if (window.location.protocol === 'file:') {
                objLibGrid.innerHTML = '<div class="col-12 text-center text-muted py-5"><i class="fa-solid fa-triangle-exclamation fa-2x mb-3"></i><p class="mb-0">Cannot load objects</p><p class="small mt-2">Page must be accessed through the web server<br>(e.g., http://localhost:PORT)<br>not via file:// protocol</p></div>';
            } else {
                objLibGrid.innerHTML = '<div class="col-12 text-center text-muted py-5"><i class="fa-solid fa-folder-open fa-2x mb-3"></i><p class="mb-0">No objects found</p><p class="small mt-2">Check that you have .glb or .gltf files in your /objects/ directory</p></div>';
            }
            return;
        }

        objLibGrid.innerHTML = '';
        objectFiles.forEach(objectPath => {
            const item = createObjectLibraryItem(objectPath);
            objLibGrid.appendChild(item);
        });
    } catch (error) {
        console.error('Failed to load objects:', error);
        objLibGrid.innerHTML = '<div class="col-12 text-center text-muted py-5"><i class="fa-solid fa-triangle-exclamation fa-2x mb-3"></i><p class="mb-0">Failed to load objects</p></div>';
    }
}

// Load object library when panel is shown; cleanup when hidden
if (objLibPanel) {
    objLibPanel.addEventListener('shown.bs.offcanvas', function () {
        g_pMap.LoadObjectLibrary();
    });

    objLibPanel.addEventListener('hidden.bs.offcanvas', function () {
        if (previewAnimationId) {
            cancelAnimationFrame(previewAnimationId);
            previewAnimationId = null;
        }
        hoveredPreviewPaths.clear();
        if (objLibGrid) objLibGrid.innerHTML = '';
        if (typeof g_pMap?.ResetObjectLibLoaded === 'function') {
            g_pMap.ResetObjectLibLoaded();
        }
        objectLibraryCache.forEach(({ scene }) => {
            scene.traverse((object) => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(mat => {
                            if (mat.map) mat.map.dispose();
                            mat.dispose();
                        });
                    } else {
                        if (object.material.map) object.material.map.dispose();
                        object.material.dispose();
                    }
                }
            });
        });
        objectLibraryCache.clear();
        if (sharedPreviewRenderer) {
            sharedPreviewRenderTarget?.dispose();
            sharedPreviewRenderer.dispose();
            sharedPreviewRenderer = null;
            sharedPreviewRenderTarget = null;
        }
    });
}
