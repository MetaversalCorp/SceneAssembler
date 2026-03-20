/**
 * sa-json-autocomplete.js
 * CodeMirror 6 completions for Scene Assembler scene JSON (context-aware keys).
 * Hints use the same beginner-friendly tone as sa-json-lint.js (detail + info tooltips).
 * After each completion, if the document parses as JSON, the whole file is replaced using the
 * same rules as 3D sync export: JSON.stringify(..., null, 2) plus compact one-line arrays for
 * aPosition, aRotation, aScale, aBound (see generateSceneJSONEx in sa-json-sync.js). Invalid JSON
 * keeps the raw insert only. Very large pasted JSON skips full-document reformat to avoid stalls.
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

import { syntaxTree } from 'https://esm.sh/@codemirror/language@6';
import { jsonLanguage } from 'https://esm.sh/@codemirror/lang-json@6';
import { EditorSelection } from 'https://esm.sh/@codemirror/state@6';

const KEYS_ROOT = ['sName', 'pTransform', 'aBound', 'aChildren', 'wClass', 'twObjectIx'];
const KEYS_CHILD = ['sName', 'pResource', 'pTransform', 'aBound', 'aChildren', 'wClass', 'twObjectIx'];
const KEYS_P_TRANSFORM = ['aPosition', 'aRotation', 'aScale'];
const KEYS_P_RESOURCE = ['sReference', 'sName'];

const ALL_KEYS = [...new Set([...KEYS_ROOT, ...KEYS_CHILD, ...KEYS_P_TRANSFORM, ...KEYS_P_RESOURCE])];

/**
 * Above this size (UTF-16 code units, same as string.length), skip parse/stringify/format on
 * autocomplete so pasting a huge JSON blob cannot freeze the UI. Normal scene files stay far below.
 */
const MAX_JSON_AUTOCOMPLETE_FORMAT_CHARS = 400_000;

/** Short line in the list; longer text in the completion info panel — for people new to scene JSON. */
const SCENE_KEY_HELP = {
   sName: {
      detail: 'Title in the sidebar',
      info: 'A readable name for this scene (root) or object. It shows in the outliner so you can tell models apart — e.g. "Park Scene" or "Bench".'
   },
   pTransform: {
      detail: 'Where it sits in 3D',
      info: 'Placement: aPosition [x,y,z] in meters, aRotation as a quaternion [x,y,z,w], and aScale [x,y,z]. When valid, the file is reformatted like 3D sync JSON: readable structure with transform/bound arrays on one line.'
   },
   aBound: {
      detail: 'Box size (meters)',
      info: 'Optional bounding box [width, height, depth]. On the canvas root it is your scene size (e.g. [20,20,20]). On objects it helps loading and layout.'
   },
   aChildren: {
      detail: 'List of nested objects',
      info: 'An array of child objects. After a completion, valid JSON is rewritten to match 3D sync style; an empty array stays []. Put the cursor inside the brackets to type {. The root holds the whole scene; groups use aChildren too.'
   },
   wClass: {
      detail: 'Object kind (73 or 0)',
      info: 'Use 73 for normal Scene Assembler objects. Use 0 for brand-new imports or JSON from outside the app — the linter will warn if something looks unusual.'
   },
   twObjectIx: {
      detail: 'Database id (0 if new)',
      info: '0 means "not saved to a database yet" — perfect while you are learning or sharing JSON. When a scene is published, this may be set to the saved id.'
   },
   pResource: {
      detail: 'Link to the 3D file',
      info: 'Wraps sReference for your model (.glb / .gltf, etc.). Autocomplete adds a small formatted object and puts the cursor in the URL string. Leaf objects usually need this; empty groups can skip it.'
   },
   aPosition: {
      detail: '[x, y, z] position',
      info: 'Three numbers in meters. [0, 0, 0] is the origin. Bump y to lift something off the ground, e.g. [0, 0.5, 0].'
   },
   aRotation: {
      detail: '[x, y, z, w] quaternion',
      info: 'Four numbers describing rotation. [0, 0, 0, 1] means "no rotation" — a good default while you are getting started.'
   },
   aScale: {
      detail: '[x, y, z] size',
      info: 'Three numbers; [1, 1, 1] is normal size. Smaller values shrink the model, larger values stretch it on each axis.'
   },
   sReference: {
      detail: 'Model URL or path',
      info: 'The string that points to your file, e.g. https://…/model.glb or a path your app understands. This is what actually loads the 3D mesh.'
   }
};

/** sName inside pResource means something different from sName on the object. */
const P_RESOURCE_SNAME_HELP = {
   detail: 'Optional asset name',
   info: 'Used with sReference in some pipelines to identify the same asset across tools. For simple scenes you can omit it and rely on sReference alone.'
};

function metaForKey(label, contextKind) {
   if (label === 'sName' && contextKind === 'pResource') return P_RESOURCE_SNAME_HELP;
   return SCENE_KEY_HELP[label];
}

function findChildNamed(node, name) {
   let ch = node.firstChild;
   while (ch) {
      if (ch.type.name === name) return ch;
      ch = ch.nextSibling;
   }
   return null;
}

function stripPropertyNameContent(doc, from, to) {
   const raw = doc.sliceString(from, to);
   if (raw.length >= 2 && raw[0] === '"' && raw[raw.length - 1] === '"')
      return raw.slice(1, -1);
   if (raw.length >= 1 && raw[0] === '"') return raw.slice(1);
   return raw;
}

function propertyNamesInObject(objectNode, doc) {
   const names = new Set();
   let ch = objectNode.firstChild;
   while (ch) {
      if (ch.type.name === 'Property') {
         const pn = findChildNamed(ch, 'PropertyName');
         if (pn) {
            const inner = stripPropertyNameContent(doc, pn.from, pn.to);
            if (inner) names.add(inner);
         }
      }
      ch = ch.nextSibling;
   }
   return names;
}

function classifySceneObject(objectNode, doc) {
   const arr = objectNode.parent;
   if (!arr || arr.type.name !== 'Array') return 'unknown';
   const gp = arr.parent;
   if (gp?.type.name === 'JsonText') return 'root';
   if (gp?.type.name === 'Property') {
      const propName = findChildNamed(gp, 'PropertyName');
      if (propName && stripPropertyNameContent(doc, propName.from, propName.to) === 'aChildren')
         return 'child';
   }
   return 'unknown';
}

function contextForObject(objectNode, doc) {
   const parent = objectNode.parent;
   if (parent?.type.name === 'Property') {
      const propName = findChildNamed(parent, 'PropertyName');
      if (propName) {
         const key = stripPropertyNameContent(doc, propName.from, propName.to);
         if (key === 'pTransform') return { keys: KEYS_P_TRANSFORM, kind: 'pTransform' };
         if (key === 'pResource') return { keys: KEYS_P_RESOURCE, kind: 'pResource' };
      }
   }
   if (parent?.type.name === 'Array') {
      const c = classifySceneObject(objectNode, doc);
      if (c === 'root') return { keys: KEYS_ROOT, kind: 'root' };
      if (c === 'child') return { keys: KEYS_CHILD, kind: 'child' };
   }
   return { keys: ALL_KEYS, kind: 'unknown' };
}

function findEnclosingObject(tree, pos) {
   let n = tree.resolveInner(pos, -1);
   for (let i = 0; i < 32 && n; i++) {
      if (n.type.name === 'Object') return n;
      n = n.parent;
   }
   return null;
}

/** Indent for snippets before merge; final text follows sync export (2-space + compact arrays). */
const INDENT_UNIT = '  ';

/**
 * Append `,` after a finished property when more JSON may follow (next key or array element).
 * Skips before `}` / `]` or when a comma is already next — keeps JSON valid (no trailing comma).
 */
function shouldAppendCommaAfterProperty(doc, posAfterInsertPoint) {
   const len = doc.length;
   let i = posAfterInsertPoint;
   while (i < len) {
      const ch = doc.sliceString(i, i + 1);
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
         i++;
         continue;
      }
      if (ch === '}' || ch === ']') return false;
      if (ch === ',') return false;
      return true;
   }
   return true;
}

/**
 * Leading whitespace on the line that contains the opening `{` of this object,
 * plus one indent level — where a new property should start.
 */
function propertyIndentFor(doc, objectNode) {
   const line = doc.lineAt(objectNode.from);
   const lead = line.text.match(/^\s*/);
   return (lead ? lead[0] : '') + INDENT_UNIT;
}

/**
 * If the cursor sits on a blank / whitespace-only continuation line, only pad to
 * the target indent. Otherwise start a new line with proper indent (after `{` or `,`).
 */
function insertLinePrefix(doc, pos, propertyIndent) {
   const line = doc.lineAt(pos);
   const beforeInLine = doc.sliceString(line.from, pos);
   if (/^\s+$/.test(beforeInLine)) {
      const need = propertyIndent.length - beforeInLine.length;
      return need > 0 ? ' '.repeat(need) : '';
   }
   return `\n${propertyIndent}`;
}

/**
 * Formatted value (and optional inner structure) for a key; `propertyIndent` is the
 * column where `"key"` sits — inner lines use +2 spaces per level.
 */
function formattedValueForKey(key, propertyIndent, contextKind) {
   const in1 = propertyIndent + INDENT_UNIT;
   switch (key) {
      case 'pTransform':
         return `{\n${in1}"aPosition": [0, 0, 0],\n${in1}"aRotation": [0, 0, 0, 1],\n${in1}"aScale": [1, 1, 1]\n${propertyIndent}}`;
      case 'pResource':
         return `{\n${in1}"sReference": ""\n${propertyIndent}}`;
      case 'aChildren':
         return `[\n${in1}\n${propertyIndent}]`;
      case 'aBound':
         return '[20, 20, 20]';
      case 'wClass':
         return '73';
      case 'twObjectIx':
         return '0';
      case 'aPosition':
         return '[0, 0, 0]';
      case 'aRotation':
         return '[0, 0, 0, 1]';
      case 'aScale':
         return '[1, 1, 1]';
      case 'sReference':
         return '""';
      case 'sName':
         return '""';
      default:
         return 'null';
   }
}

/**
 * Cursor offset from start of inserted text (after apply range) for common edits.
 * Returns null to place caret at end of insertion.
 */
function caretOffsetAfterInsert(key, contextKind, insertedText) {
   if (key === 'sName' || key === 'sReference') {
      const i = insertedText.indexOf('""');
      if (i >= 0) return i + 1;
   }
   if (key === 'pResource') {
      const needle = '"sReference": ""';
      const i = insertedText.indexOf(needle);
      if (i >= 0) return i + '"sReference": "'.length;
   }
   if (key === 'aChildren') {
      const i = insertedText.indexOf('[\n');
      if (i < 0) return null;
      const lineEnd = insertedText.indexOf('\n', i + 2);
      if (lineEnd < 0) return null;
      return lineEnd;
   }
   return null;
}

function skipWs(s, i) {
   while (i < s.length && /\s/.test(s[i])) i++;
   return i;
}

/**
 * Same shaping as generateSceneJSONEx (sa-json-sync.js): pretty-print, then single-line
 * aPosition / aRotation / aScale / aBound arrays. Keep regex in sync with that function.
 */
function formatSceneJsonLikeSync(source) {
   try {
      const pretty = JSON.stringify(JSON.parse(source), null, 2);
      return pretty.replace(
         /("(?:aPosition|aRotation|aScale|aBound)"\s*:\s*)\[[\s\n\r]*(.*?)[\s\n\r]*\]/gs,
         (match, prefix, values) => {
            const compactValues = values.replace(/[\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
            return prefix + '[' + compactValues + ']';
         }
      );
   } catch {
      return null;
   }
}

/**
 * Last `"key":` value start in prettified text (good enough when the user just added that key).
 */
function lastPropertyValueStart(pretty, key) {
   const ref = `"${key}"`;
   let last = -1;
   let i = 0;
   while (true) {
      i = pretty.indexOf(ref, i);
      if (i < 0) break;
      let j = skipWs(pretty, i + ref.length);
      if (pretty[j] === ':') {
         j = skipWs(pretty, j + 1);
         last = j;
      }
      i += 1;
   }
   return last;
}

function cursorInArrayOrString(pretty, vs) {
   if (vs < 0 || vs >= pretty.length) return 0;
   const c = pretty[vs];
   if (c === '"') return vs + 1;
   if (c === '[') {
      let j = skipWs(pretty, vs + 1);
      if (pretty[j] === ']') return vs + 1;
      return j;
   }
   return vs;
}

/**
 * Caret position in prettified document after autocomplete (beginner-friendly edit point).
 */
function cursorAfterPrettify(pretty, key, sceneKind) {
   if (key === 'pResource') {
      const vs = lastPropertyValueStart(pretty, 'pResource');
      if (vs < 0 || vs >= pretty.length) return 0;
      if (pretty[vs] === '{') {
         const sr = pretty.indexOf('"sReference"', vs);
         if (sr >= 0) {
            let j = skipWs(pretty, sr + '"sReference"'.length);
            if (pretty[j] === ':') {
               j = skipWs(pretty, j + 1);
               if (pretty[j] === '"') return j + 1;
               return j;
            }
         }
         return skipWs(pretty, vs + 1);
      }
      return cursorInArrayOrString(pretty, vs);
   }

   if (key === 'sName' && sceneKind === 'pResource') {
      const vs = lastPropertyValueStart(pretty, 'sName');
      if (vs >= 0 && pretty[vs] === '"') return vs + 1;
      return Math.max(0, vs);
   }

   if (key === 'aChildren') {
      const vs = lastPropertyValueStart(pretty, 'aChildren');
      if (vs < 0 || vs >= pretty.length) return 0;
      if (pretty[vs] === '[') {
         let j = skipWs(pretty, vs + 1);
         if (pretty[j] === ']') return vs + 1;
         return j;
      }
      return vs;
   }

   if (key === 'pTransform') {
      const vs = lastPropertyValueStart(pretty, 'pTransform');
      if (vs < 0 || vs >= pretty.length) return 0;
      if (pretty[vs] === '{') {
         const ap = pretty.indexOf('"aPosition"', vs);
         if (ap >= 0) {
            let j = skipWs(pretty, ap + '"aPosition"'.length);
            if (pretty[j] === ':') {
               j = skipWs(pretty, j + 1);
               return cursorInArrayOrString(pretty, j);
            }
         }
         return skipWs(pretty, vs + 1);
      }
      return vs;
   }

   if (key === 'aPosition' || key === 'aRotation' || key === 'aScale' || key === 'aBound') {
      const vs = lastPropertyValueStart(pretty, key);
      return cursorInArrayOrString(pretty, vs);
   }

   if (key === 'sName' || key === 'sReference') {
      const vs = lastPropertyValueStart(pretty, key);
      if (vs >= 0 && pretty[vs] === '"') return vs + 1;
      return Math.max(0, vs);
   }

   if (key === 'wClass' || key === 'twObjectIx') {
      const vs = lastPropertyValueStart(pretty, key);
      return vs >= 0 ? vs : 0;
   }

   const vs = lastPropertyValueStart(pretty, key);
   return vs >= 0 ? vs : 0;
}

/**
 * Insert snippet; if the document is valid JSON, replace all with prettified output (one transaction).
 */
function applyCompletionWithPrettify(view, { from, to, body, comma, completionLabel, sceneKind }) {
   const doc = view.state.doc;
   const insert = body + comma;
   const docStr = doc.toString();
   const merged = docStr.slice(0, from) + insert + docStr.slice(to);
   const formatted =
      merged.length > MAX_JSON_AUTOCOMPLETE_FORMAT_CHARS ? null : formatSceneJsonLikeSync(merged);
   if (formatted !== null) {
      const head = cursorAfterPrettify(formatted, completionLabel, sceneKind);
      const safe = Math.max(0, Math.min(head, formatted.length));
      view.dispatch({
         changes: { from: 0, to: doc.length, insert: formatted },
         selection: EditorSelection.cursor(safe)
      });
      return;
   }
   const caretRel = caretOffsetAfterInsert(completionLabel, sceneKind, body);
   const anchor = caretRel == null ? from + insert.length : from + caretRel;
   view.dispatch({
      changes: { from, to, insert },
      selection: EditorSelection.cursor(anchor)
   });
}

function keyOptions(keys, existing, prefix, contextKind) {
   const p = (prefix || '').toLowerCase();
   return keys
      .filter(k => !existing.has(k) && (!p || k.toLowerCase().startsWith(p)))
      .map(label => {
         const help = metaForKey(label, contextKind);
         return {
            label,
            type: 'property',
            detail: help?.detail ?? 'Scene JSON',
            info: help?.info ?? 'Property used in Scene Assembler scene files. When the file is valid JSON and not extremely large, the editor reformats the whole document like 3D sync after a completion; huge pastes skip that step so the editor stays responsive.'
         };
      });
}

/**
 * @param {import('@codemirror/autocomplete').CompletionContext} context
 */
export function sceneJsonAutocomplete(context) {
   const doc = context.state.doc;
   const pos = context.pos;

   const bare = context.matchBefore(/[{,]\s*$/);
   if (bare && (context.explicit || bare.from < pos)) {
      const tree = syntaxTree(context.state);
      const obj = findEnclosingObject(tree, pos);
      const { keys, kind } = obj ? contextForObject(obj, doc) : { keys: ALL_KEYS, kind: 'unknown' };
      const existing = obj ? propertyNamesInObject(obj, doc) : new Set();
      const opts = keyOptions(keys, existing, '', kind);
      if (!opts.length) return null;
      return {
         from: pos,
         to: pos,
         options: opts.map(o => ({
            ...o,
            sceneKind: kind,
            apply(view, completion, from, to) {
               const doc = view.state.doc;
               const tree = syntaxTree(view.state);
               const obj = findEnclosingObject(tree, from);
               const ind = obj ? propertyIndentFor(doc, obj) : INDENT_UNIT;
               const linePref = insertLinePrefix(doc, from, ind);
               const val = formattedValueForKey(completion.label, ind, completion.sceneKind);
               const body = `${linePref}"${completion.label}": ${val}`;
               const comma = shouldAppendCommaAfterProperty(doc, to) ? ',' : '';
               applyCompletionWithPrettify(view, {
                  from,
                  to,
                  body,
                  comma,
                  completionLabel: completion.label,
                  sceneKind: completion.sceneKind
               });
            }
         }))
      };
   }

   const quoted = context.matchBefore(/"([\w]*)$/);
   if (quoted) {
      const prefix = quoted.text.slice(1);
      if (!context.explicit && prefix.length === 0) return null;

      const tree = syntaxTree(context.state);
      const obj = findEnclosingObject(tree, pos);
      const { keys, kind } = obj ? contextForObject(obj, doc) : { keys: ALL_KEYS, kind: 'unknown' };
      const existing = obj ? propertyNamesInObject(obj, doc) : new Set();

      const keyFrom = quoted.from + 1;
      const opts = keyOptions(keys, existing, prefix, kind).map(o => ({
         ...o,
         sceneKind: kind,
         apply(view, completion, from, to) {
            const doc = view.state.doc;
            const tree = syntaxTree(view.state);
            const obj = findEnclosingObject(tree, from);
            const ind = obj ? propertyIndentFor(doc, obj) : INDENT_UNIT;
            const suffix = completion.label.slice(prefix.length);
            const val = formattedValueForKey(completion.label, ind, completion.sceneKind);
            const body = `${suffix}": ${val}`;
            const comma = shouldAppendCommaAfterProperty(doc, to) ? ',' : '';
            applyCompletionWithPrettify(view, {
               from,
               to,
               body,
               comma,
               completionLabel: completion.label,
               sceneKind: completion.sceneKind
            });
         }
      }));

      if (opts.length) {
         return {
            from: keyFrom,
            to: pos,
            options: opts
         };
      }
   }

   return null;
}

/** Attach scene completions to the JSON language (include next to json()). */
export const sceneJsonAutocompleteFacet = jsonLanguage.data.of({
   autocomplete: sceneJsonAutocomplete
});
