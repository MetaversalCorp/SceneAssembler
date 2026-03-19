/**
 * sa-json-lint.js
 * CodeMirror linting for Scene Assembler JSON schema.
 * Warm, educational messages for beginner developers coding from scratch.
 * Validates scene structure, wClass, twObjectIx, pTransform, aBound, pResource, etc.
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

import { jsonParseLinter } from 'https://esm.sh/@codemirror/lang-json@6';

/** Map terse JSON parse errors to warm, helpful messages for beginners. */
function warmifyJsonError(msg) {
   if (!msg || typeof msg !== 'string') return msg;
   const m = msg.toLowerCase();
   if (m.includes('unexpected token }') || m.includes("unexpected '}'"))
      return "Extra } or a trailing comma? JSON doesn't allow commas before } or ]. Remove the comma or the extra bracket.";
   if (m.includes('unexpected token ]') || m.includes("unexpected ']'"))
      return "Extra ] or a trailing comma? Remove any comma right before ], or check for an extra bracket.";
   if (m.includes('unexpected token ,') || m.includes("unexpected ','"))
      return "Stray comma – maybe after the last item? JSON doesn't allow trailing commas. Remove it.";
   if (m.includes('unexpected end of json') || m.includes('unexpected end of'))
      return "The JSON seems cut off. Check for a missing } or ] to close an object or array.";
   if (m.includes("expected property name") || m.includes("expected '}'"))
      return "Missing property name or extra comma? Use \"name\": value with double quotes, and commas between properties.";
   if (m.includes("expected ':'") || m.includes('expected ":"'))
      return "Missing colon after a property name. Use \"sName\": \"My Scene\" – the colon goes between name and value.";
   if (m.includes("expected ',' or ']'") || m.includes("expected ',' or '}'"))
      return "Missing comma between items, or an extra comma. Add a comma between properties, or remove one before } or ].";
   if (m.includes('unexpected string') || m.includes('unexpected number'))
      return "Check the order: property names need quotes, then a colon, then the value. Example: \"sName\": \"value\"";
   if (m.includes('unexpected token'))
      return "Unexpected character here. Common fixes: add a missing comma, remove a trailing comma, or fix a typo in a key.";
   return msg;
}

/**
 * Scene Assembler JSON schema linter.
 * Returns diagnostics for CodeMirror lint extension.
 * Messages are warm and educational for beginner developers.
 * @param {import('@codemirror/view').EditorView} view
 * @returns {Array<{from: number, to: number, severity: 'error'|'warning', message: string}>}
 */
export function sceneAssemblerLinter(view) {
   const doc = view.state.doc.toString();
   const diags = [];
   const pos = (key, fromIdx = 0) => {
      const i = doc.indexOf(key, fromIdx);
      return i >= 0 ? { from: i, to: i + key.length } : null;
   };
   try {
      const data = JSON.parse(doc);

      // ─── Top-level structure ─────────────────────────────────────────────
      if (!Array.isArray(data)) {
         diags.push({ from: 0, to: Math.min(20, doc.length), severity: 'error', message: "Start with a JSON array – wrap your root object in [ ]. Like this: [ { \"sName\": \"My Scene\", ... } ]" });
         return diags;
      }
      if (data.length === 0) {
         diags.push({ from: 0, to: 2, severity: 'error', message: "Your scene is empty. Add one root object inside the brackets. Need a template? Use: { \"sName\": \"My Scene\", \"pTransform\": { \"aPosition\": [0,0,0], \"aRotation\": [0,0,0,1], \"aScale\": [1,1,1] }, \"aBound\": [20,20,20], \"aChildren\": [], \"wClass\": 73, \"twObjectIx\": 0 }" });
         return diags;
      }
      if (data.length > 1) {
         diags.push({ from: 0, to: Math.min(30, doc.length), severity: 'warning', message: "Heads up: only the first object is used as the scene root. The rest are ignored – one root is all you need!" });
      }
      const root = data[0];
      if (!root || typeof root !== 'object') {
         diags.push({ from: 1, to: 2, severity: 'error', message: "The first item should be an object { } – that's your scene root. It holds the canvas name, size, and all your 3D objects." });
         return diags;
      }

      const objLabel = (node, isRoot, idx) => isRoot ? (node.sName ? `Root "${node.sName}"` : 'Root object') : (node.sName ? `"${node.sName}"` : `child at index ${idx}`);
      const fallback = () => pos('"sName"', 0) || pos('"aChildren"', 0) || { from: 1, to: 2 };

      // ─── Root: sName ────────────────────────────────────────────────────
      if (!root.sName) {
         const p = fallback();
         diags.push({ from: p.from, to: p.to, severity: 'error', message: 'Add sName to give your scene a title – e.g. "My First Scene". It shows in the sidebar and helps you find it later.' });
      }

      // ─── Root: pTransform ────────────────────────────────────────────────
      if (!root.pTransform) {
         const p = pos('"pTransform"', 0) || fallback();
         diags.push({ from: p.from, to: p.to, severity: 'warning', message: 'Root usually has pTransform with aPosition, aRotation, aScale. Use [0,0,0], [0,0,0,1], [1,1,1] for default placement.' });
      } else {
         const pt = root.pTransform;
         if (!pt.aPosition) {
            const p = pos('"aPosition"', 0) || pos('"pTransform"', 0) || fallback();
            diags.push({ from: p.from, to: p.to, severity: 'warning', message: 'pTransform.aPosition: [x, y, z] – position in meters. Try [0, 0, 0] for center.' });
         } else if (!Array.isArray(pt.aPosition) || pt.aPosition.length !== 3) {
            const p = pos('"aPosition"', 0) || fallback();
            diags.push({ from: p.from, to: p.to, severity: 'warning', message: 'aPosition needs 3 numbers [x, y, z] – e.g. [0, 0, 0] for center.' });
         }
         if (!pt.aRotation) {
            const p = pos('"aRotation"', 0) || pos('"pTransform"', 0) || fallback();
            diags.push({ from: p.from, to: p.to, severity: 'warning', message: 'pTransform.aRotation: quaternion [x, y, z, w]. Use [0, 0, 0, 1] for no rotation.' });
         } else if (!Array.isArray(pt.aRotation) || pt.aRotation.length !== 4) {
            const p = pos('"aRotation"', 0) || fallback();
            diags.push({ from: p.from, to: p.to, severity: 'warning', message: 'aRotation uses a quaternion – 4 numbers [x, y, z, w]. Use [0, 0, 0, 1] for no rotation.' });
         }
         if (!pt.aScale) {
            const p = pos('"aScale"', 0) || pos('"pTransform"', 0) || fallback();
            diags.push({ from: p.from, to: p.to, severity: 'warning', message: 'pTransform.aScale: [x, y, z]. Use [1, 1, 1] for normal size.' });
         } else if (!Array.isArray(pt.aScale) || pt.aScale.length !== 3) {
            const p = pos('"aScale"', 0) || fallback();
            diags.push({ from: p.from, to: p.to, severity: 'warning', message: 'aScale needs 3 numbers [x, y, z]. [1, 1, 1] means normal size.' });
         }
      }

      // ─── Root: aBound ────────────────────────────────────────────────────
      if (!root.aBound) {
         const p = pos('"aBound"', 0) || fallback();
         diags.push({ from: p.from, to: p.to, severity: 'warning', message: 'aBound: [width, height, depth] in meters – your canvas size. Try [20, 20, 20] for a 20m space.' });
      } else if (!Array.isArray(root.aBound) || root.aBound.length !== 3) {
         const p = pos('"aBound"', 0) || fallback();
         diags.push({ from: p.from, to: p.to, severity: 'warning', message: 'aBound needs 3 numbers [x, y, z] for canvas size – try [20, 20, 20] for a 20m space.' });
      }

      // ─── Root: aChildren ─────────────────────────────────────────────────
      if (root.aChildren === undefined) {
         const p = pos('"aChildren"', 0) || fallback();
         diags.push({ from: p.from, to: p.to, severity: 'error', message: 'Add aChildren – the list of objects in your scene. Use [] for now, then add objects with sName, pResource, pTransform when you\'re ready.' });
      } else if (!Array.isArray(root.aChildren)) {
         const p = pos('"aChildren"', 0) || fallback();
         diags.push({ from: p.from, to: p.to, severity: 'error', message: 'aChildren should be an array [ ]. Start with [] and add your 3D objects one by one.' });
      }

      // ─── wClass & twObjectIx (root) ──────────────────────────────────────
      const checkIds = (node, isRoot, idx = 0) => {
         const label = objLabel(node, isRoot, idx);
         if (node.wClass === undefined) {
            const p = pos('"wClass"', 0) || fallback();
            diags.push({ from: p.from, to: p.to, severity: 'error', message: `${label}: Add wClass – use 73 for scene objects, or 0 for brand-new imports or JSON from elsewhere.` });
            } else if (typeof node.wClass !== 'number') {
               const p = pos('"wClass"', 0) || fallback();
               if (p) diags.push({ from: p.from, to: p.to, severity: 'error', message: `${label}: wClass should be a number (73 or 0). No quotes – just the number.` });
            } else if (node.wClass !== 73 && node.wClass !== 0) {
               const p = pos('"wClass"', 0) || fallback();
               if (p) diags.push({ from: p.from, to: p.to, severity: 'warning', message: `${label}: wClass ${node.wClass} is uncommon. Most objects use 73; use 0 only for new imports or external JSON.` });
         }
         if (node.twObjectIx === undefined) {
            const p = pos('"twObjectIx"', 0) || fallback();
            const msg = isRoot
               ? 'Add twObjectIx. Use 0 for new scenes (not published yet). When restoring from a database, use the ID it was saved with.'
               : 'Add twObjectIx. Use 0 for objects that haven\'t been saved to a database yet.';
            diags.push({ from: p.from, to: p.to, severity: 'error', message: `${label}: ${msg}` });
         } else if (typeof node.twObjectIx !== 'number') {
            const p = pos('"twObjectIx"', 0) || fallback();
            if (p) diags.push({ from: p.from, to: p.to, severity: 'error', message: `${label}: twObjectIx should be a number. Use 0 for new objects – no quotes.` });
         } else if (node.twObjectIx === 0 && isRoot) {
            const p = pos('"twObjectIx"', 0) || fallback();
            if (p) diags.push({ from: p.from, to: p.to, severity: 'warning', message: `${objLabel(root, true)}: twObjectIx 0 means your scene isn't in the database yet – that's fine for new work or sharing elsewhere!` });
         }
      };
      checkIds(root, true);

      // ─── Child objects ──────────────────────────────────────────────────
      const validateChildren = (nodes, path = []) => {
         if (!Array.isArray(nodes)) return;
         nodes.forEach((node, i) => {
            if (!node || typeof node !== 'object') return;
            const seg = node.sName ? `"${node.sName}"` : `[${i}]`;
            const label = path.length ? path.join(' > ') + ' > ' + seg : seg;

            if (!node.sName) {
               const p = pos('"aChildren"', 0) || fallback();
               diags.push({ from: p.from, to: p.to, severity: 'error', message: `${label}: Add sName so you can identify this object – e.g. "My Model" or "Tree".` });
            }

            checkIds(node, false, i);

            // pResource for leaf objects (3D models); groups can omit it
            if (!node.aChildren?.length) {
               if (!node.pResource) {
                  const p = pos('"pResource"', 0) || pos('"aChildren"', 0) || fallback();
                  diags.push({ from: p.from, to: p.to, severity: 'error', message: `${label}: Add pResource with sReference – that's the URL to your 3D model (.glb, .gltf, or Ordinals content).` });
               } else if (!node.pResource.sReference) {
                  const p = pos('"sReference"', 0) || pos('"pResource"', 0) || fallback();
                  diags.push({ from: p.from, to: p.to, severity: 'error', message: `${label}: pResource needs sReference – the URL or path to your model. Example: "https://example.com/model.glb"` });
               } else if (typeof node.pResource.sReference !== 'string') {
                  const p = pos('"sReference"', 0) || fallback();
                  diags.push({ from: p.from, to: p.to, severity: 'error', message: `${label}: sReference should be a string in quotes – e.g. "model.glb" or "https://..."` });
               } else if (node.pResource.sReference.trim() === '') {
                  const p = pos('"sReference"', 0) || fallback();
                  diags.push({ from: p.from, to: p.to, severity: 'warning', message: `${label}: sReference is empty. Paste a URL to a .glb/.gltf file or Ordinals content to load your model.` });
               }
            } else {
               // Group/container – has children, pResource optional
               if (!node.pTransform && node.aChildren?.length > 0) {
                  const p = pos('"pTransform"', 0) || fallback();
                  diags.push({ from: p.from, to: p.to, severity: 'warning', message: `${label}: You can add pTransform to move this group as a whole. Optional – only if you want to position it!` });
               }
            }

            // pTransform for children
            if (node.pTransform) {
               const pt = node.pTransform;
               if (pt.aPosition && (!Array.isArray(pt.aPosition) || pt.aPosition.length !== 3)) {
                  const p = pos('"aPosition"', 0) || fallback();
                  if (p) diags.push({ from: p.from, to: p.to, severity: 'warning', message: `${label}: aPosition needs [x, y, z] – e.g. [0, 0.5, 0] to sit slightly above the ground.` });
               }
               if (pt.aRotation && (!Array.isArray(pt.aRotation) || pt.aRotation.length !== 4)) {
                  const p = pos('"aRotation"', 0) || fallback();
                  if (p) diags.push({ from: p.from, to: p.to, severity: 'warning', message: `${label}: aRotation needs 4 numbers [x,y,z,w]. [0,0,0,1] = no rotation.` });
               }
               if (pt.aScale && (!Array.isArray(pt.aScale) || pt.aScale.length !== 3)) {
                  const p = pos('"aScale"', 0) || fallback();
                  if (p) diags.push({ from: p.from, to: p.to, severity: 'warning', message: `${label}: aScale needs [x,y,z]. [1,1,1] keeps the model at normal size.` });
               }
            } else if (!node.aChildren?.length) {
               const p = pos('"pTransform"', 0) || fallback();
               diags.push({ from: p.from, to: p.to, severity: 'warning', message: `${label}: Add pTransform to place your object – aPosition [x,y,z], aRotation [0,0,0,1], aScale [1,1,1].` });
            }

            // aBound for children
            if (node.aBound && (!Array.isArray(node.aBound) || node.aBound.length !== 3)) {
               const p = pos('"aBound"', 0) || fallback();
               if (p) diags.push({ from: p.from, to: p.to, severity: 'warning', message: `${label}: aBound is optional – if you add it, use [x,y,z] for the bounding box.` });
            }

            // Recursive
            if (node.aChildren?.length) validateChildren(node.aChildren, [...path, seg]);
         });
      };
      validateChildren(root.aChildren || [], [root.sName ? `"${root.sName}"` : 'Root']);

      // ─── Beginner tip when scene is valid but empty ────────────────────────
      if (diags.length === 0 && Array.isArray(root.aChildren) && root.aChildren.length === 0) {
         const p = pos('"aChildren"', 0) || fallback();
         diags.push({ from: p.from, to: p.to, severity: 'warning', message: "You're off to a great start! Add objects to aChildren – each needs sName, pResource.sReference (model URL), pTransform, wClass: 73 (or 0 for external JSON), twObjectIx: 0." });
      }
   } catch (_) {
      /* JSON invalid – jsonParseLinter handles it */
   }
   return diags;
}

/**
 * Combined lint source: JSON parse errors first, then schema validation.
 * @param {import('@codemirror/view').EditorView} view
 * @returns {Array<{from: number, to: number, severity: string, message: string}>}
 */
export function createSceneAssemblerLintSource() {
   return (view) => {
      const jsonDiags = jsonParseLinter()(view) || [];
      if (jsonDiags.length > 0) {
         return jsonDiags.map(d => ({
            ...d,
            message: warmifyJsonError(d.message) || d.message
         }));
      }
      return sceneAssemblerLinter(view);
   };
}
