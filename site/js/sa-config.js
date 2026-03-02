/**
 * sa-config.js
 * Constants and shared configuration values.
 * Depends: none
 * Used by: sa-core, sa-models, sa-transforms, sa-selection, sa-json-sync, sa-object-library, sa-bootstrap, sa-properties, sa-shell
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

// ===== Constants & Styles =====
const SNAP_STEP = 1;
const LABEL_SIZE = 0.2;
const LABEL_OFFSET = 0.5;
const HUMAN_HEIGHT = 1.75; // meters (5'9")
const BOX_COLORS = {
    hover: 0x99ccff,
    selected: 0x0000ff,
    editing: 0xffffff
};

// ===== Scene & Viewport Colors =====
const SCENE_BACKGROUND = 0x202020;
const GRID_COLOR = 0x888888;
const GRID_COLOR_MINOR = 0x444444;
const RULER_COLOR = 0xaaaaaa;
const HUMAN_GUIDE_COLOR = 0x66aaff;
const BOX_HELPER_COLOR = 0x888888;
const OBJECT_ROOT_BOX_COLOR = 0x666666;
const ERROR_OBJECT_COLOR = 0xff0000;

// ===== Camera & Orbit =====
const ORBIT_MAX_DISTANCE_MULTIPLIER = 1.5;
const PAN_SPEED = 0.05;
const FREE_MOVE_SPEED = 0.1;

// ===== Lighting =====
const LIGHT_HEMISPHERE_SKY = 0xffffff;
const LIGHT_HEMISPHERE_GROUND = 0x444444;
const LIGHT_HEMISPHERE_INTENSITY = 1.2;

// ===== Object Library Preview =====
const PREVIEW_SIZE = 256;
const PREVIEW_ROTATION_SPEED = 0.03;
const PREVIEW_BACKGROUND = 0x2a2a2a;
const PREVIEW_SCALE_FIT = 1.5;

// ===== Client Render Limits =====
const TRI_SCENE_MAX = 200000;
const TEX_SCENE_MAX_MP = 2;

// ===== Undo =====
const MAX_UNDO_HISTORY = 50;

// ===== UI Layout =====
const MIN_CODE_EDITOR_WIDTH = 320;
const MIN_OBJECT_LIBRARY_HEIGHT = 200;

// ===== Clamping =====
/** When true, objects are clamped to canvas bounds on the Y axis during transforms. When false, Y is free (use Drop to Floor to snap down). */
const CLAMP_Y_AXIS = false;
