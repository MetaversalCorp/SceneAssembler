/**
 * sa-shell.js
 * UI chrome: Bootstrap tooltips, code editor panel fade/resize, object library panel resize.
 * Depends: Bootstrap (loaded in HTML). Runs after DOM ready.
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

(function initShell() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initShell);
        return;
    }

    // Bootstrap tooltips
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    if (tooltipTriggerList.length && typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
        [...tooltipTriggerList].forEach(el => new bootstrap.Tooltip(el));
    }

    // Code editor panel: fade #codeToggle when visible
    const codeEditorPanel = document.getElementById('codeEditorPanel');
    const codeToggle = document.getElementById('codeToggle');
    const codeEditorResizeHandle = document.getElementById('codeEditorResizeHandle');

    if (codeEditorPanel && codeToggle) {
        codeEditorPanel.addEventListener('shown.bs.offcanvas', () => {
            codeToggle.classList.add('opacity-0');
            codeToggle.style.pointerEvents = 'none';
        });
        codeEditorPanel.addEventListener('hidden.bs.offcanvas', () => {
            codeToggle.classList.remove('opacity-0');
            codeToggle.style.pointerEvents = '';
        });
    }

    // Code editor panel: horizontal resize
    if (codeEditorPanel && codeEditorResizeHandle) {
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        codeEditorResizeHandle.addEventListener('mousedown', (e) => {
            if (!codeEditorPanel.classList.contains('show')) return;
            isResizing = true;
            startX = e.clientX;
            startWidth = codeEditorPanel.offsetWidth;
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const deltaX = startX - e.clientX;
            const newWidth = Math.max(MIN_CODE_EDITOR_WIDTH, Math.min(window.innerWidth * 0.95, startWidth + deltaX));
            codeEditorPanel.style.width = newWidth + 'px';
            codeEditorPanel.style.setProperty('--bs-offcanvas-width', newWidth + 'px');
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }

    // Object library panel: vertical resize
    const objLibPanel = document.getElementById('objLibPanel');
    const objLibResizeHandle = document.getElementById('objLibResizeHandle');

    if (objLibPanel && objLibResizeHandle) {
        let isResizingVertical = false;
        let startY = 0;
        let startHeight = 0;

        objLibResizeHandle.addEventListener('mousedown', (e) => {
            if (!objLibPanel.classList.contains('show')) return;
            isResizingVertical = true;
            startY = e.clientY;
            startHeight = objLibPanel.offsetHeight;
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizingVertical) return;
            const deltaY = startY - e.clientY;
            const minHeight = MIN_OBJECT_LIBRARY_HEIGHT;
            const maxHeight = window.innerHeight * 0.9;
            const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
            objLibPanel.style.height = newHeight + 'px';
            objLibPanel.style.setProperty('--bs-offcanvas-height', newHeight + 'px');
        });

        document.addEventListener('mouseup', () => {
            if (isResizingVertical) {
                isResizingVertical = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }
})();
