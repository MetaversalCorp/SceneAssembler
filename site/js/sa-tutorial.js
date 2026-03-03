/**
 * sa-tutorial.js
 * Getting Started tutorial using driver.js – walks through major editor functions.
 * Depends: sa-core, sa-bootstrap, sa-config, driver.js (CDN)
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

(function () {
    const driverFn = typeof window !== 'undefined' && window.driver && window.driver.js ? window.driver.js.driver : null;
    if (!driverFn) return;

    const TUTORIAL_PREVIEW_CLASS = 'sa-tutorial-preview';
    const PANEL_OPEN_DELAY_MS = 1200;
    let codePanelShownListener = null;
    let objLibPanelShownListener = null;
    let codePanelOpenTimeout = null;
    let objLibPanelOpenTimeout = null;
    let codePanelRefreshing = false;
    let objLibPanelRefreshing = false;

    const tourSteps = [
        {
            popover: {
               title: '<i class="fa-regular fa-hand fa-shake" style="--fa-animation-duration: 5s;"></i> Hello',
                description: 'This quick tour will walk you through the main features of the editor. Click <strong>Next</strong> to continue, or <strong>Close</strong> to skip.',
                side: 'bottom',
                align: 'center'
            }
        },
        {
            element: '#viewportCanvas',
            popover: {
                title: '<i class="fa-solid fa-cube"></i> 3D Viewport',
                description: 'This is your main workspace. Click and drag to orbit the camera. Add objects from the <i class="fa-solid fa-shapes"></i> Object Library (bottom bar), then click objects to select and transform them.',
                side: 'bottom',
                align: 'start'
            },
            onHighlightStarted: () => {
                document.body.classList.add('sa-tutorial-viewport-step');
            },
            onDeselected: () => {
                document.body.classList.remove('sa-tutorial-viewport-step');
            }
        },
        {
            element: 'button[data-bs-target="#sceneManagerPanel"]',
            popover: {
                title: '<i class="fa-solid fa-folder-open"></i> Scene Manager',
                description: 'Create or switch scenes, delete scenes, or disconnect from the Fabric. Your active scene name appears on this button.',
                side: 'bottom',
                align: 'start'
            }
        },
        {
            element: '#settingsToggle',
            popover: {
                title: '<i class="fa-solid fa-cog"></i> Scene Settings',
                description: 'Configure snap-to-grid, <i class="fa-solid fa-ruler-combined"></i> canvas size (in meters), and view the <i class="fa-solid fa-paperclip"></i> Spatial Fabric URL after publishing your scene. This is the url you will need to attach your Fabric in RP1.',
                side: 'bottom',
                align: 'start'
            }
        },
        {
            element: '#undo',
            popover: {
                title: '<i class="fa-solid fa-rotate-left"></i> Undo & Redo',
                description: '<i class="fa-solid fa-rotate-left"></i> Undo (<kbd>Ctrl+Z</kbd>) and <i class="fa-solid fa-rotate-right"></i> Redo (<kbd>Ctrl+Shift+Z</kbd>) let you revert or reapply changes. History is tracked for transforms, adds, and deletes.',
                side: 'bottom',
                align: 'start'
            }
        },
        {
            element: '#delete',
            popover: {
                title: '<i class="fa-solid fa-trash"></i> Delete',
                description: 'Delete the selected object(s). You can also press <kbd>Delete</kbd>. Use <kbd>Ctrl+D</kbd> to <i class="fa-solid fa-copy"></i> duplicate instead.',
                side: 'bottom',
                align: 'start'
            }
        },
        {
            element: '#resetCamera',
            popover: {
                title: '<i class="fa-solid fa-camera"></i> Reset Camera',
                description: 'Reset the camera to the default view. Press <kbd>F</kbd> to frame the camera on the selected object(s).',
                side: 'bottom',
                align: 'start'
            }
        },
        {
            element: '#exportJson',
            popover: {
                title: '<i class="fa-solid fa-file-export"></i> Export JSON',
                description: 'Export your scene as JSON. Use this to save a copy, share, or integrate with other tools.',
                side: 'bottom',
                align: 'start'
            }
        },
        {
            element: '.jsPublish',
            popover: {
                title: '<i class="fa-solid fa-cloud-arrow-up"></i> Publish',
                description: 'Publish your scene to the Spatial Fabric. After publishing, the Fabric URL will appear in <i class="fa-solid fa-cog"></i> Scene Settings.',
                side: 'bottom',
                align: 'start'
            }
        },
        {
            element: () => {
                const panel = document.getElementById('codeEditorPanel');
                return (panel && panel.classList.contains('show')) ? panel : document.getElementById('codeToggle');
            },
            popover: {
                title: '<i class="fa-solid fa-code"></i> Code Editor',
                description: 'Open the Code Editor to view and edit your scene as JSON. Your code changes sync to the 3D view after you click <strong>Apply Changes</strong>.',
                side: 'bottom',
                align: 'end'
            },
            onHighlightStarted: (el, step, options) => {
                const panel = document.getElementById('codeEditorPanel');
                if (panel && options.driver) {
                    codePanelShownListener = () => {
                        panel.classList.add('sa-tutorial-offcanvas-view');
                        codePanelRefreshing = true;
                        const idx = options.driver.getActiveIndex();
                        if (typeof idx === 'number') options.driver.drive(idx);
                    };
                    panel.addEventListener('shown.bs.offcanvas', codePanelShownListener);
                }
                if (panel && typeof bootstrap !== 'undefined' && bootstrap.Offcanvas) {
                    codePanelOpenTimeout = setTimeout(() => {
                        codePanelOpenTimeout = null;
                        const instance = bootstrap.Offcanvas.getInstance(panel) || new bootstrap.Offcanvas(panel);
                        instance.show();
                        panel.classList.add('sa-tutorial-offcanvas-view');
                    }, PANEL_OPEN_DELAY_MS);
                }
            },
            onDeselected: () => {
                if (codePanelOpenTimeout) {
                    clearTimeout(codePanelOpenTimeout);
                    codePanelOpenTimeout = null;
                }
                const panel = document.getElementById('codeEditorPanel');
                if (panel && codePanelShownListener) {
                    panel.removeEventListener('shown.bs.offcanvas', codePanelShownListener);
                    codePanelShownListener = null;
                }
                if (codePanelRefreshing) {
                    codePanelRefreshing = false;
                } else {
                    if (panel) panel.classList.remove('sa-tutorial-offcanvas-view');
                    const instance = panel && typeof bootstrap !== 'undefined' ? bootstrap.Offcanvas.getInstance(panel) : null;
                    if (instance) instance.hide();
                }
            }
        },
        {
            element: '#objControls .transforms',
            popover: {
                title: '<i class="fa-solid fa-arrows-up-down-left-right"></i> Transform Tools',
                description: 'When an object is selected, these buttons appear: <i class="fa-solid fa-arrows-up-down-left-right"></i> <strong>Move</strong> (W), <i class="fa-solid fa-rotate"></i> <strong>Rotate</strong> (E), <i class="fa-solid fa-expand"></i> <strong>Scale</strong> (R). Use the gizmo in the viewport or these shortcuts.',
                side: 'bottom',
                align: 'center'
            },
            onHighlightStarted: (el) => {
                const codePanel = document.getElementById('codeEditorPanel');
                const codeInstance = codePanel && typeof bootstrap !== 'undefined' ? bootstrap.Offcanvas.getInstance(codePanel) : null;
                if (codeInstance) codeInstance.hide();
                const container = el ? el.closest('#objControls') : null;
                if (container) {
                    container.classList.remove('d-none');
                    container.classList.add(TUTORIAL_PREVIEW_CLASS);
                    container.style.pointerEvents = 'none';
                }
            },
            onDeselected: (el) => {
                const container = el ? el.closest('#objControls') : document.getElementById('objControls');
                if (container) {
                    container.classList.remove(TUTORIAL_PREVIEW_CLASS);
                    container.style.pointerEvents = '';
                    if (typeof selectedObjects !== 'undefined' && (!selectedObjects || selectedObjects.length === 0)) {
                        container.classList.add('d-none');
                    }
                }
            }
        },
        {
            element: '#modelsPanel',
            popover: {
                title: '<i class="fa-solid fa-list"></i> Scene Outliner',
                description: 'The hierarchy of objects in your scene. Click an item to select it. Double-click an object name on this list to rename it. You can also drag objects to group them.',
                side: 'right',
                align: 'start'
            }
        },
        {
            element: '#propertiesPanel',
            popover: {
                title: '<i class="fa-solid fa-sliders"></i> Properties Panel',
                description: 'Shows bounds, <i class="fa-solid fa-play fa-rotate-270"></i> triangle count, and <i class="fa-solid fa-image"></i> texture info for the selected object. Use the <i class="fa-solid fa-info-circle"></i> info buttons for efficiency tips and tier specs.',
                side: 'right',
                align: 'start'
            },
            onHighlightStarted: (el) => {
                if (el) {
                    el.style.display = '';
                    el.classList.add(TUTORIAL_PREVIEW_CLASS);
                    el.style.pointerEvents = 'none';
                }
            },
            onDeselected: (el) => {
                if (el) {
                    el.classList.remove(TUTORIAL_PREVIEW_CLASS);
                    el.style.pointerEvents = '';
                    if (typeof selectedObjects !== 'undefined' && (!selectedObjects || selectedObjects.length === 0)) {
                        el.style.display = 'none';
                    }
                }
            }
        },
        {
            element: () => {
                const panel = document.getElementById('objLibPanel');
                return (panel && panel.classList.contains('show')) ? panel : document.getElementById('objLibToggle');
            },
            popover: {
                title: '<i class="fa-solid fa-shapes"></i> Object Library',
                description: 'Opens the Object Library panel. Browse the 3D models (.glb/.gltf) in your Metaverse Server\'s /objects folder, click to add them to the scene. Each preview shows <i class="fa-solid fa-play fa-rotate-270"></i> triangle and <i class="fa-solid fa-image"></i> texture stats.',
                side: 'top',
                align: 'center'
            },
            onHighlightStarted: (el, step, options) => {
                const panel = document.getElementById('objLibPanel');
                if (panel && options.driver) {
                    objLibPanelShownListener = () => {
                        panel.classList.add('sa-tutorial-offcanvas-view');
                        objLibPanelRefreshing = true;
                        const idx = options.driver.getActiveIndex();
                        if (typeof idx === 'number') options.driver.drive(idx);
                    };
                    panel.addEventListener('shown.bs.offcanvas', objLibPanelShownListener);
                }
                if (panel && typeof bootstrap !== 'undefined' && bootstrap.Offcanvas) {
                    objLibPanelOpenTimeout = setTimeout(() => {
                        objLibPanelOpenTimeout = null;
                        const instance = bootstrap.Offcanvas.getInstance(panel) || new bootstrap.Offcanvas(panel);
                        instance.show();
                        panel.classList.add('sa-tutorial-offcanvas-view');
                    }, PANEL_OPEN_DELAY_MS);
                }
            },
            onDeselected: () => {
                if (objLibPanelOpenTimeout) {
                    clearTimeout(objLibPanelOpenTimeout);
                    objLibPanelOpenTimeout = null;
                }
                const panel = document.getElementById('objLibPanel');
                if (panel && objLibPanelShownListener) {
                    panel.removeEventListener('shown.bs.offcanvas', objLibPanelShownListener);
                    objLibPanelShownListener = null;
                }
                if (objLibPanelRefreshing) {
                    objLibPanelRefreshing = false;
                } else {
                    if (panel) panel.classList.remove('sa-tutorial-offcanvas-view');
                    const instance = panel && typeof bootstrap !== 'undefined' ? bootstrap.Offcanvas.getInstance(panel) : null;
                    if (instance) instance.hide();
                }
            }
        },
        {
            element: '#helpToggle',
            popover: {
                title: '<i class="fa-solid fa-graduation-cap"></i> Help & Hotkeys',
                description: 'Reopen the Help menu anytime for a quick reference of keyboard shortcuts. You can also restart this tutorial from here.',
                side: 'bottom',
                align: 'end'
            },
            onHighlightStarted: () => {
                const objPanel = document.getElementById('objLibPanel');
                const objInstance = objPanel && typeof bootstrap !== 'undefined' ? bootstrap.Offcanvas.getInstance(objPanel) : null;
                if (objInstance) objInstance.hide();
            }
        },
        {
            element: '#viewportCanvas',
            popover: {
                title: '<i class="fa-solid fa-mouse-pointer fa-xs"></i><i style="margin-left:-2px;" class="fa-solid fa-bars text-secondary"></i> Context Menu',
                description: 'Right-click on the viewport or in the Scene Outliner to open a context menu with actions like Duplicate, Reset Transform, Drop to Floor, and group options.',
                side: 'bottom',
                align: 'start'
            },
            onHighlightStarted: () => {
                document.body.classList.add('sa-tutorial-context-menu-step');
            },
            onDeselected: () => {
                document.body.classList.remove('sa-tutorial-context-menu-step');
            }
        },
        {
            popover: {
                title: '<i class="fa-solid fa-thumbs-up"></i> You\'re All Set!',
                description: 'You now know the main features of Scene Assembler. Add objects, transform them, remember to <i class="fa-solid fa-cloud-arrow-up"></i> publish your scene to save your progress. Happy building!',
                side: 'bottom',
                align: 'center'
            }
        }
    ];

    function closeHelpDropdown() {
        const trigger = document.getElementById('helpToggle');
        if (trigger && typeof bootstrap !== 'undefined' && bootstrap.Dropdown) {
            const instance = bootstrap.Dropdown.getInstance(trigger);
            if (instance) instance.hide();
        }
    }

    function cleanupTutorialState() {
        window.sceneAssemblerTutorialActive = false;
        document.body.classList.remove('sa-tutorial-active', 'sa-tutorial-viewport-step', 'sa-tutorial-context-menu-step');
        if (codePanelOpenTimeout) {
            clearTimeout(codePanelOpenTimeout);
            codePanelOpenTimeout = null;
        }
        if (objLibPanelOpenTimeout) {
            clearTimeout(objLibPanelOpenTimeout);
            objLibPanelOpenTimeout = null;
        }
        codePanelRefreshing = false;
        objLibPanelRefreshing = false;
        const codePanel = document.getElementById('codeEditorPanel');
        if (codePanel && codePanelShownListener) {
            codePanel.removeEventListener('shown.bs.offcanvas', codePanelShownListener);
            codePanelShownListener = null;
        }
        if (codePanel) codePanel.classList.remove('sa-tutorial-offcanvas-view');
        const codeInstance = codePanel && typeof bootstrap !== 'undefined' ? bootstrap.Offcanvas.getInstance(codePanel) : null;
        if (codeInstance) codeInstance.hide();
        const objPanel = document.getElementById('objLibPanel');
        if (objPanel && objLibPanelShownListener) {
            objPanel.removeEventListener('shown.bs.offcanvas', objLibPanelShownListener);
            objLibPanelShownListener = null;
        }
        if (objPanel) objPanel.classList.remove('sa-tutorial-offcanvas-view');
        const objInstance = objPanel && typeof bootstrap !== 'undefined' ? bootstrap.Offcanvas.getInstance(objPanel) : null;
        if (objInstance) objInstance.hide();
        closeHelpDropdown();
        const objControls = document.getElementById('objControls');
        if (objControls) {
            objControls.classList.remove(TUTORIAL_PREVIEW_CLASS);
            objControls.style.pointerEvents = '';
            if (typeof selectedObjects !== 'undefined' && (!selectedObjects || selectedObjects.length === 0)) {
                objControls.classList.add('d-none');
            }
        }
        const propertiesPanel = document.getElementById('propertiesPanel');
        if (propertiesPanel) {
            propertiesPanel.classList.remove(TUTORIAL_PREVIEW_CLASS);
            propertiesPanel.style.pointerEvents = '';
            if (typeof selectedObjects !== 'undefined' && (!selectedObjects || selectedObjects.length === 0)) {
                propertiesPanel.style.display = 'none';
            }
        }
    }

    function startTutorial() {
        closeHelpDropdown();
        document.querySelectorAll('.offcanvas').forEach((el) => {
            const instance = typeof bootstrap !== 'undefined' && bootstrap.Offcanvas
                ? bootstrap.Offcanvas.getOrCreateInstance(el)
                : null;
            if (instance) instance.hide();
        });
        window.sceneAssemblerTutorialActive = true;

        const driverObj = driverFn({
            showProgress: true,
            progressText: '{{current}} of {{total}}',
            nextBtnText: 'Next',
            prevBtnText: 'Previous',
            doneBtnText: 'Finish',
            steps: tourSteps,
            overlayOpacity: 0.6,
            smoothScroll: true,
            allowClose: true,
            onDestroyed: () => {
                cleanupTutorialState();
            }
        });

        driverObj.drive();
    }

    const startBtn = document.getElementById('startTutorial');
    if (startBtn) {
        startBtn.addEventListener('click', startTutorial);
    }

    if (typeof window !== 'undefined') {
        window.startSceneAssemblerTutorial = startTutorial;
    }
})();
