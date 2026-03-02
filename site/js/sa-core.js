/**
 * sa-core.js
 * Three.js scene, camera, renderer, lights, grid, and render loop.
 * Depends: sa-config.js
 * Used by: sa-selection, sa-transforms, sa-groups, sa-json-sync, sa-ui
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

// ===== Scene setup =====
const scene = new THREE.Scene();
scene.background = new THREE.Color(SCENE_BACKGROUND);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(3, 3, 6);

let groundSize = 20;

function updateCameraFarPlane() {
    camera.far = Math.max(1000, groundSize * 3);
    camera.updateProjectionMatrix();
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const orbit = new THREE.OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.minDistance = 1;
orbit.maxDistance = groundSize * ORBIT_MAX_DISTANCE_MULTIPLIER;
updateCameraFarPlane();

const transform = new THREE.TransformControls(camera, renderer.domElement);
transform.setSpace('local');
transform.setSize(0.8);
scene.add(transform);

let selectedObject = null;
let selectedObjects = [];
let hoveredObject = null;
let draggedItem = null;
let draggedObject = null;
let draggedObjects = [];
let isAltPressed = false;
let isDuplicating = false;
let originalObject = null;
let justFinishedTransform = false;

// Camera panning state
let isSpacePressed = false;
let panDirection = { left: false, right: false, up: false, down: false };
// Free camera movement state (arrow keys without Space)
let freeMoveDirection = { left: false, right: false, up: false, down: false };

scene.add(new THREE.HemisphereLight(LIGHT_HEMISPHERE_SKY, LIGHT_HEMISPHERE_GROUND, LIGHT_HEMISPHERE_INTENSITY));
const dirLight = new THREE.DirectionalLight(LIGHT_HEMISPHERE_SKY, 1);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

let grid = new THREE.GridHelper(groundSize, groundSize, GRID_COLOR, GRID_COLOR_MINOR);
grid.userData.isSelectable = false;
grid.raycast = () => {};
scene.add(grid);

// Create Object Root as parent for all imported models
let canvasRoot = new THREE.Group();
canvasRoot.name = "Object Root";
canvasRoot.userData.isSelectable = true;
canvasRoot.userData.isCanvasRoot = true;
canvasRoot.userData.aBound = [groundSize, groundSize, groundSize];
scene.add(canvasRoot);

let ruler = null;
let humanGuide = null;

// ===== Ruler =====
function createRuler(size, step = 1) {
    const group = new THREE.Group();
    const mat = new THREE.LineBasicMaterial({ color: RULER_COLOR });
    for (let i = -size / 2; i <= size / 2; i += step) {
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(i, 0, -size / 2), new THREE.Vector3(i, 0.1, -size / 2)]), mat));
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(i, 0, size / 2), new THREE.Vector3(i, 0.1, size / 2)]), mat));
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-size / 2, 0, i), new THREE.Vector3(-size / 2, 0.1, i)]), mat));
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(size / 2, 0, i), new THREE.Vector3(size / 2, 0.1, i)]), mat));
    }
    return group;
}

function addRulerLabels(group, size, step, font) {
    const mat = new THREE.MeshBasicMaterial({ color: RULER_COLOR });
    for (let i = -size / 2; i <= size / 2; i += step) {
        if (i === 0) continue;
        const labelX = new THREE.Mesh(new THREE.TextGeometry(`${i}m`, { font, size: LABEL_SIZE, height: 0 }), mat);
        labelX.position.set(i, 0.1, -size / 2 - LABEL_OFFSET);
        group.add(labelX);
        const labelZ = new THREE.Mesh(new THREE.TextGeometry(`${i}m`, { font, size: LABEL_SIZE, height: 0 }), mat);
        labelZ.position.set(-size / 2 - LABEL_OFFSET, 0.1, i);
        group.add(labelZ);
    }
}

// ===== Human height guide (5'9" ≈ 1.75m) =====
function createHumanGuide(heightMeters = HUMAN_HEIGHT) {
    const group = new THREE.Group();
    const color = HUMAN_GUIDE_COLOR;
    const opacity = 0.25;
    const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    const headRadius = Math.min(0.09, heightMeters * 0.062);
    const legHeight = heightMeters * 0.50;
    const torsoHeight = heightMeters * 0.45;
    const shoulderWidth = heightMeters * 0.28;
    const waistWidth = heightMeters * 0.18;
    const limbWidth = Math.max(0.02, heightMeters * 0.06);
    const armLength = torsoHeight * 0.9;
    const torsoTop = new THREE.Mesh(new THREE.PlaneGeometry(shoulderWidth, torsoHeight * 0.55), mat);
    torsoTop.position.y = legHeight + (torsoHeight * 0.75);
    const torsoBottom = new THREE.Mesh(new THREE.PlaneGeometry(waistWidth, torsoHeight * 0.45), mat);
    torsoBottom.position.y = legHeight + (torsoHeight * 0.275);
    const legGeo = new THREE.PlaneGeometry(limbWidth, legHeight);
    const legL = new THREE.Mesh(legGeo, mat);
    legL.position.set(-waistWidth * 0.25, legHeight * 0.5, 0);
    const legR = new THREE.Mesh(legGeo.clone(), mat);
    legR.position.set(waistWidth * 0.25, legHeight * 0.5, 0);
    const armGeo = new THREE.PlaneGeometry(limbWidth, armLength);
    const armL = new THREE.Mesh(armGeo, mat);
    armL.position.set(-shoulderWidth * 0.5, legHeight + torsoHeight - armLength * 0.5, 0);
    const armR = new THREE.Mesh(armGeo.clone(), mat);
    armR.position.set(shoulderWidth * 0.5, legHeight + torsoHeight - armLength * 0.5, 0);
    const head = new THREE.Mesh(new THREE.CircleGeometry(headRadius, 24), mat);
    head.position.y = legHeight + torsoHeight + headRadius * 1.05;
    const axisGroupA = new THREE.Group();
    axisGroupA.add(torsoTop, torsoBottom, legL, legR, armL, armR, head);
    const axisGroupB = axisGroupA.clone();
    axisGroupB.traverse(node => {
        if (node.isMesh) node.geometry = node.geometry.clone();
    });
    axisGroupB.rotation.y = Math.PI / 2;
    group.add(axisGroupA, axisGroupB);
    group.userData.isSelectable = false;
    group.traverse(o => {
        o.userData.isSelectable = false;
        o.raycast = () => {};
    });
    group.name = "HumanGuide";
    return group;
}

// Human guide (reference only)
humanGuide = createHumanGuide(HUMAN_HEIGHT);
scene.add(humanGuide);

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
