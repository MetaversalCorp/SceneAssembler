/**
 * sa-bootstrap.js
 * DOM refs, getJSONEditorText, attachment point UX; init on DOMContentLoaded; expose API for rp1.js
 * Depends: sa-config, sa-core
 * Used by: rp1.js (loadScene, loadObjectLibrary, generateSceneJSONEx)
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

// ===== UI refs =====
const loader = new THREE.GLTFLoader();

const modelList = document.getElementById("modelList");
const propertiesPanel = document.getElementById("properties");
const propertiesPanelCard = document.getElementById("propertiesPanel");
const triCountElement = document.getElementById("triCount");
const triBadge = document.getElementById("triBadge");
const triGaugeCount = document.getElementById("triGaugeCount");
const vertCountElement = document.getElementById("vertCount");
const triGaugeFill = document.getElementById("triGaugeFill");
const triGaugeBar = document.getElementById("triGaugeBar");
const triGaugeStatus = document.getElementById("triGaugeStatus");
const triSceneCount = document.getElementById("triSceneCount");
const triSceneGaugeFill = document.getElementById("triSceneGaugeFill");
const triSceneGaugeBar = document.getElementById("triSceneGaugeBar");
const triSceneGaugeStatus = document.getElementById("triSceneGaugeStatus");
const triStatsStatViewer = document.querySelector("#triStats .stat-viewer");
const triStatusBtn = document.getElementById("triStatus");
const triStatusIcon = triStatusBtn ? triStatusBtn.querySelector("i") : null;
let lastTriTier = -1;
const texCountElement = document.getElementById("texCount");
const texBadge = document.getElementById("texBadge");
const texGaugeFill = document.getElementById("texGaugeFill");
const texGaugeBar = document.getElementById("texGaugeBar");
const texGaugeStatus = document.getElementById("texGaugeStatus");
const texGaugeDims = document.getElementById("texGaugeDims");
const texSceneCount = document.getElementById("texSceneCount");
const texSceneGaugeFill = document.getElementById("texSceneGaugeFill");
const texSceneGaugeBar = document.getElementById("texSceneGaugeBar");
const texSceneGaugeStatus = document.getElementById("texSceneGaugeStatus");
const texList = document.getElementById("texList");
const texStatsStatViewer = document.querySelector("#texStats .stat-viewer");
const texStatusBtn = document.getElementById("texStatus");
const texStatusIcon = texStatusBtn ? texStatusBtn.querySelector("i") : null;
let lastTexTier = -1;
let lastTotalMegapixels = -1;
let lastTexDimsString = null;
const snapCheckbox = document.getElementById("snap");
const canvasSizeInput = document.getElementById("canvasSize");
const btnSetCanvasSize = document.getElementById("setCanvasSize");
const btnTranslate = document.getElementById("translate");
const btnRotate = document.getElementById("rotate");
const btnScale = document.getElementById("scale");
const btnDelete = document.getElementById("delete");
const objControls = document.getElementById("objControls");
const btnUndo = document.getElementById("undo");
const btnRedo = document.getElementById("redo");
const btnResetCamera = document.getElementById("resetCamera");
const fabricUrlInput = document.getElementById("fabricUrl");
const copyFabricUrlBtn = document.getElementById("copyFabricUrl");
const jsonEditor = document.getElementById("jsonEditor");
const exportJson = document.getElementById("exportJson");
const exportJsonExt = document.getElementById("exportJsonExt");
const applyChanges = document.getElementById("applyChanges");

function getJSONEditorText() {
    if (window.jsonEditorAPI && typeof window.jsonEditorAPI.getValue === 'function') {
        return window.jsonEditorAPI.getValue();
    }
    if (jsonEditor) {
        if (jsonEditor.dataset && jsonEditor.dataset.initial) return jsonEditor.dataset.initial;
        if ('value' in jsonEditor && jsonEditor.value) return jsonEditor.value;
        return jsonEditor.textContent || '';
    }
    return '';
}

function setJSONEditorText(text) {
    if (window.jsonEditorAPI && typeof window.jsonEditorAPI.setValue === 'function') {
        window.jsonEditorAPI.setValue(text);
    } else if (jsonEditor) {
        if (jsonEditor.dataset) jsonEditor.dataset.initial = text;
        if ('value' in jsonEditor) jsonEditor.value = text;
    }
}

// ===== Attachment Point URL copy-link UX =====
function setAttachmentPointUrl(url) {
    const value = url || '';
    if (fabricUrlInput) fabricUrlInput.value = value;
    if (copyFabricUrlBtn) {
        copyFabricUrlBtn.disabled = !value;
        copyFabricUrlBtn.setAttribute('data-bs-original-title', 'Copy URL');
        if (window.bootstrap && bootstrap.Tooltip) {
            const tip = bootstrap.Tooltip.getInstance(copyFabricUrlBtn);
            if (tip) tip.hide();
        }
    }
}

document.addEventListener('attachment-point-url', (e) => {
    setAttachmentPointUrl(e?.detail?.url);
});

if (fabricUrlInput) {
    fabricUrlInput.addEventListener('click', () => {
        if (fabricUrlInput.value) fabricUrlInput.select();
    });
}

async function copyAttachmentPointUrlToClipboard() {
    const value = fabricUrlInput?.value || '';
    if (!value) return;
    let copied = false;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(value);
            copied = true;
        }
    } catch (err) {
        copied = false;
    }
    if (!copied && fabricUrlInput && document.queryCommandSupported && document.queryCommandSupported('copy')) {
        try {
            fabricUrlInput.select();
            copied = document.execCommand('copy');
        } catch (err) {
            copied = false;
        }
    }
    if (copied && copyFabricUrlBtn && window.bootstrap && bootstrap.Tooltip) {
        copyFabricUrlBtn.setAttribute('data-bs-original-title', 'Copied!');
        const tip = bootstrap.Tooltip.getOrCreateInstance(copyFabricUrlBtn);
        tip.show();
        setTimeout(() => {
            try {
                copyFabricUrlBtn.setAttribute('data-bs-original-title', 'Copy URL');
                tip.hide();
            } catch (err) {}
        }, 900);
    }
}

if (copyFabricUrlBtn) {
    copyFabricUrlBtn.addEventListener('click', () => copyAttachmentPointUrlToClipboard());
}

if (window.g_pMap && typeof window.g_pMap.UpdateAttachmentPointUrl === 'function') {
    window.g_pMap.UpdateAttachmentPointUrl();
}

let modelCounter = 1;
let loadedFont = null;

// ===== Init (deferred to DOMContentLoaded so all modules are loaded) =====
function saBootstrapInit() {
    addCanvasRootToList();
    createBoxHelperFor(canvasRoot);
    if (typeof wireCanvasSizeAndSnapEvents === 'function') wireCanvasSizeAndSnapEvents();
    if (typeof wireTransformEvents === 'function') wireTransformEvents();
    const fontLoader = new THREE.FontLoader();
    fontLoader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', font => {
        loadedFont = font;
        ruler = createRuler(groundSize, 1);
        addRulerLabels(ruler, groundSize, 1, loadedFont);
        ruler.userData.isSelectable = false;
        scene.add(ruler);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', saBootstrapInit);
} else {
    saBootstrapInit();
}
