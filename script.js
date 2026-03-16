// Photoshoot Planner Core Logic

// DOM Elements
const setupModal = document.getElementById('setup-modal');
const setupForm = document.getElementById('setup-form');
const shootTypeSelect = document.getElementById('shoot-type');
const customTypeGroup = document.getElementById('custom-type-group');
const customTypeInput = document.getElementById('custom-type');
const appContainer = document.getElementById('app-container');
const projectTitle = document.getElementById('project-title');

const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

const workspace = document.getElementById('workspace-canvas');
const toolImageInput = document.getElementById('image-upload');
const toolText = document.getElementById('tool-text');
const toolArrow = document.getElementById('tool-arrow');
const toolClear = document.getElementById('tool-clear');
const btnExportToggle = document.getElementById('btn-export-toggle');
const exportDropdown = document.getElementById('export-dropdown');
const exportPng = document.getElementById('export-png');
const exportPdf = document.getElementById('export-pdf');
const exportEmail = document.getElementById('export-email');

// Settings Elements
const settingsPanel = document.getElementById('settings-panel');
const btnSettings = document.getElementById('btn-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const appThemeSelect = document.getElementById('app-theme');
const googleCalendarUrlInput = document.getElementById('google-calendar-url');
const googleCalendarIframe = document.getElementById('google-calendar-iframe');
const calendarPlaceholder = document.getElementById('calendar-placeholder');

// Projects Panel Elements
const projectsPanel = document.getElementById('projects-panel');
const btnProjects = document.getElementById('btn-projects');
const btnCloseProjects = document.getElementById('btn-close-projects');
const btnPickFolder = document.getElementById('btn-pick-folder');
const btnOpenFile = document.getElementById('btn-open-file');
const btnSaveProject = document.getElementById('btn-save-project');
const btnNewProject = document.getElementById('btn-new-project');
const btnGrantAccess = document.getElementById('btn-grant-access');
const folderStatusEl = document.getElementById('folder-status');
const projectsListEl = document.getElementById('projects-list');

// Shoot Type Switcher
const projectTitleWrapper = document.getElementById('project-title-wrapper');
const shootTypeDropdown = document.getElementById('shoot-type-dropdown');

const arrowCanvas = document.getElementById('arrow-layer');
const arrowCtx = arrowCanvas.getContext('2d');

// State
let appState = {
    projectName: 'Untitled Shoot',
    nodes: [],      // Array of dom elements
    arrows: [],     // Array of {fromId, toId}
    currentId: 0,
    settings: {
        theme: 'light',
        googleCalendarUrl: ''
    }
};

let interactionState = {
    mode: 'select', // select, draw_arrow
    isDraggingNode: false,
    dragNode: null,
    offsetX: 0,
    offsetY: 0,
    selectedNode: null,

    // Arrow drawing temp state
    isDrawing: false,
    arrowStartNode: null,
    mouseX: 0,
    mouseY: 0,

    // Panning canvas state
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    camX: 0,
    camY: 0
};

// --- INIT & SETUP --- //
async function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Setup listeners
    shootTypeSelect.addEventListener('change', handleShootTypeChange);
    setupForm.addEventListener('submit', handleSetupSubmit);

    // Tabs
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => switchTab(btn.dataset.tab));
    });

    // Tools
    toolImageInput.addEventListener('change', handleImageUpload);
    toolText.addEventListener('click', handleAddText);
    toolArrow.addEventListener('click', toggleArrowMode);
    toolClear.addEventListener('click', clearBoard);
    btnExportToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        exportDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
        exportDropdown.classList.add('hidden');
    });

    exportPng.addEventListener('click', () => handleExport('png'));
    exportPdf.addEventListener('click', () => handleExport('pdf'));
    exportEmail.addEventListener('click', () => handleExport('email'));

    // Settings
    btnSettings.addEventListener('click', toggleSettingsPanel);
    btnCloseSettings.addEventListener('click', toggleSettingsPanel);
    btnSaveSettings.addEventListener('click', handleSaveSettings);

    // Projects Panel
    btnProjects.addEventListener('click', toggleProjectsPanel);
    btnCloseProjects.addEventListener('click', toggleProjectsPanel);
    btnPickFolder.addEventListener('click', pickProjectFolder);
    btnOpenFile.addEventListener('click', openProjectFilePicker);
    btnSaveProject.addEventListener('click', saveProjectToFile);
    btnNewProject.addEventListener('click', startNewProject);
    btnGrantAccess.addEventListener('click', grantFolderAccess);

    // Shoot type switcher
    projectTitleWrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleShootTypeDropdown();
    });
    document.querySelectorAll('.shoot-type-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleShootTypeSwitch(btn.dataset.type);
        });
    });
    // Close shoot type dropdown when clicking outside
    document.addEventListener('click', () => {
        closeShootTypeDropdown();
    });

    // Workspace events
    workspace.addEventListener('mousedown', handleWorkspaceMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Load from IndexedDB (MUST await — this is why settings were resetting!)
    await loadState();
    
    // Apply theme after load
    applyTheme();

    // Restore last used folder handle if browser supports it
    tryRestoreFolder();

    requestAnimationFrame(renderLoop);
}

function handleShootTypeChange(e) {
    if (e.target.value === 'Custom') {
        customTypeGroup.classList.remove('hidden');
        customTypeInput.required = true;
    } else {
        customTypeGroup.classList.add('hidden');
        customTypeInput.required = false;
    }
}

function handleSetupSubmit(e) {
    e.preventDefault();
    const type = shootTypeSelect.value;
    const name = type === 'Custom' ? customTypeInput.value : type;

    appState.projectName = name;
    projectTitle.textContent = name;

    setupModal.classList.add('hidden');
    appContainer.classList.remove('hidden');

    // Crucial: The canvas area is now visible, we must resize it so it's not 0x0.
    setTimeout(resizeCanvas, 0);

    saveState();
}

function switchTab(tabId) {
    tabBtns.forEach(b => b.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));

    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');

    if (tabId === 'board') {
        setTimeout(resizeCanvas, 0);
    }
}

// --- NODE CREATION --- //

function generateId() {
    return 'node_' + (++appState.currentId);
}

function handleImageUpload(e) {
    const files = e.target.files;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;

        const reader = new FileReader();
        reader.onload = (event) => {
            createImageNode(event.target.result, 100 + (i * 20), 100 + (i * 20));
        };
        reader.readAsDataURL(file);
    }
    e.target.value = ''; // Reset
}

function handleAddText() {
    createTextElement('New Note', 200, 200);
}

function createNodeWrapper(id, x, y, type) {
    const el = document.createElement('div');
    el.id = id;
    el.className = `node node-${type}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    // Controls overlay
    const controls = document.createElement('div');
    controls.className = 'node-controls';

    // Color highlights
    const colors = ['none', 'red', 'blue', 'green', 'yellow', 'pink'];
    colors.forEach(color => {
        const btn = document.createElement('button');
        btn.className = 'control-btn';
        if (color !== 'none') {
            const dot = document.createElement('span');
            dot.className = 'color-dot';
            dot.style.backgroundColor = `var(--highlight-${color}, ${color})`;
            btn.appendChild(dot);
            btn.onclick = (e) => { e.stopPropagation(); setNodeColor(el, color); };
        } else {
            btn.innerHTML = '<span class="material-icons-round" style="font-size:16px;">format_color_reset</span>';
            btn.onclick = (e) => { e.stopPropagation(); setNodeColor(el, 'none'); };
        }
        controls.appendChild(btn);
    });

    // Clone
    const cloneBtn = document.createElement('button');
    cloneBtn.className = 'control-btn';
    cloneBtn.innerHTML = '<span class="material-icons-round" style="font-size:16px;">content_copy</span>';
    cloneBtn.onclick = (e) => { e.stopPropagation(); cloneNode(el); };
    controls.appendChild(cloneBtn);

    // Delete
    const delBtn = document.createElement('button');
    delBtn.className = 'control-btn';
    delBtn.innerHTML = '<span class="material-icons-round" style="font-size:16px; color:#ef4444;">delete</span>';
    delBtn.onclick = (e) => { e.stopPropagation(); deleteNode(el); };
    controls.appendChild(delBtn);

    el.appendChild(controls);
    workspace.appendChild(el);
    appState.nodes.push(el);
    return el;
}

function createImageNode(src, x, y, customId = null) {
    const id = customId || generateId();
    const el = createNodeWrapper(id, x, y, 'image');

    const img = document.createElement('img');
    img.src = src;
    el.appendChild(img);
    return el;
}

function createTextElement(content, x, y, customId = null) {
    const id = customId || generateId();
    const el = createNodeWrapper(id, x, y, 'text');

    const textDiv = document.createElement('div');
    textDiv.className = 'node-text-content';
    textDiv.dataset.id = id;
    textDiv.contentEditable = true;
    textDiv.innerHTML = content;

    textDiv.addEventListener('mousedown', (e) => {
        // Prevent drag if editing text
        if (document.activeElement === textDiv) {
            e.stopPropagation();
        }
    });

    textDiv.addEventListener('input', saveStateDebounced);

    el.appendChild(textDiv);
    return el;
}

// --- NODE OPERATIONS --- //

function setNodeColor(node, color) {
    // Remove old highlight classes
    node.className = node.className.replace(/\bhighlight-\S+/g, '');
    if (color !== 'none') {
        node.classList.add(`highlight-${color}`);
    }
    saveState();
}

function deleteNode(node) {
    // cascade delete arrows
    appState.arrows = appState.arrows.filter(a => a.from !== node.id && a.to !== node.id);

    appState.nodes = appState.nodes.filter(n => n.id !== node.id);
    node.remove();
    if (interactionState.selectedNode === node) deselectAll();
    saveState();
}

function cloneNode(node) {
    const rect = node.getBoundingClientRect();
    const workRect = workspace.getBoundingClientRect();
    const x = rect.left - workRect.left + 30;
    const y = rect.top - workRect.top + 30;

    if (node.classList.contains('node-image')) {
        const img = node.querySelector('img');
        createImageNode(img.src, x, y);
    } else if (node.classList.contains('node-text')) {
        const text = node.querySelector('.node-text-content').textContent;
        createTextElement(text, x, y);
    }
}

function clearBoard() {
    if (confirm('Are you sure you want to clear the entire board?')) {
        appState.nodes.forEach(n => n.remove());
        appState.nodes = [];
        appState.arrows = [];
        saveState();
    }
}

// --- INTERACTION / DRAGGING --- //

function deselectAll() {
    appState.nodes.forEach(n => n.classList.remove('selected'));
    interactionState.selectedNode = null;
}

function handleWorkspaceMouseDown(e) {
    // Find closest node
    const node = e.target.closest('.node');

    if (interactionState.mode === 'draw_arrow') {
        if (node) {
            e.preventDefault(); // Prevent native browser drag/selection of images/text
            interactionState.isDrawing = true;
            interactionState.arrowStartNode = node;

            // Get proper relative mouse position to draw arrow instantly
            const workRect = workspace.getBoundingClientRect();
            interactionState.mouseX = e.clientX - workRect.left;
            interactionState.mouseY = e.clientY - workRect.top;
        } else {
            // Cancel draw mode on click empty
            interactionState.mode = 'select';
            document.getElementById('tool-arrow').classList.remove('active');
            workspace.style.cursor = 'default'; // grab
        }
        return; // Skip normal drag logic
    }

    if (node) {
        // Stop editing text if active
        if (document.activeElement && document.activeElement.contentEditable === 'true' && document.activeElement !== e.target) {
            document.activeElement.blur();
        }

        deselectAll();
        node.classList.add('selected');
        interactionState.selectedNode = node;

        interactionState.isDraggingNode = true;
        interactionState.dragNode = node;

        // Calculate offset
        const rect = node.getBoundingClientRect();
        interactionState.offsetX = e.clientX - rect.left;
        interactionState.offsetY = e.clientY - rect.top;

        // Ensure z-index layering is preserved, but no re-appending so arrows don't bug out
        const allNodes = Array.from(document.querySelectorAll('.node'));
        allNodes.forEach(n => n.style.zIndex = '10');
        node.style.zIndex = '100';

    } else {
        deselectAll();
        // Start panning
        interactionState.isPanning = true;
        interactionState.panStartX = e.clientX - interactionState.camX;
        interactionState.panStartY = e.clientY - interactionState.camY;
    }
}

function handleMouseMove(e) {
    if (interactionState.isDraggingNode && interactionState.dragNode) {
        const workRect = workspace.getBoundingClientRect();
        let x = e.clientX - workRect.left - interactionState.offsetX;
        let y = e.clientY - workRect.top - interactionState.offsetY;

        interactionState.dragNode.style.left = `${x}px`;
        interactionState.dragNode.style.top = `${y}px`;
    }
    else if (interactionState.isDrawing) {
        const workRect = workspace.getBoundingClientRect();
        interactionState.mouseX = e.clientX - workRect.left;
        interactionState.mouseY = e.clientY - workRect.top;
    }
    /* Panning disabled for simple single-page layout for now, canvas is absolute
    else if (interactionState.isPanning) {
        interactionState.camX = e.clientX - interactionState.panStartX;
        interactionState.camY = e.clientY - interactionState.panStartY;
        // Apply transform to nodes...
    }*/
}

function handleMouseUp(e) {
    if (interactionState.isDraggingNode) {
        interactionState.isDraggingNode = false;
        interactionState.dragNode = null;
        saveState();
    }

    if (interactionState.isDrawing) {
        const node = e.target.closest('.node');
        if (node && node !== interactionState.arrowStartNode) {
            // Complete arrow
            appState.arrows.push({
                from: interactionState.arrowStartNode.id,
                to: node.id
            });
            saveState();
        }

        interactionState.isDrawing = false;
        interactionState.arrowStartNode = null;
    }

    interactionState.isPanning = false;
}

// --- ARROWS & RENDERING --- //

function toggleArrowMode() {
    if (interactionState.mode === 'draw_arrow') {
        interactionState.mode = 'select';
        toolArrow.classList.remove('active');
        workspace.style.cursor = 'grab';
    } else {
        interactionState.mode = 'draw_arrow';
        toolArrow.classList.add('active');
        workspace.style.cursor = 'crosshair';
        deselectAll();
    }
}

function resizeCanvas() {
    const rect = workspace.getBoundingClientRect();
    arrowCanvas.width = rect.width;
    arrowCanvas.height = rect.height;
}

function getCenter(el) {
    const rect = el.getBoundingClientRect();
    const workRect = workspace.getBoundingClientRect();
    // Use the element's actual visual center relative to the workspace container
    return {
        x: rect.left - workRect.left + (rect.width / 2),
        y: rect.top - workRect.top + (rect.height / 2)
    };
}

function drawArrowBetweenPoints(x1, y1, x2, y2) {
    // Arrow head calc
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    const headlen = 15;

    arrowCtx.beginPath();
    arrowCtx.moveTo(x1, y1);

    // Smooth bezier curve
    const ctrlDist = Math.abs(dx) * 0.3;
    arrowCtx.bezierCurveTo(x1 + ctrlDist, y1, x2 - ctrlDist, y2, x2, y2);

    arrowCtx.lineWidth = 3;
    arrowCtx.strokeStyle = 'rgba(0,0,0,0.3)';
    arrowCtx.stroke();

    // Draw head
    arrowCtx.beginPath();
    arrowCtx.moveTo(x2, y2);
    arrowCtx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
    arrowCtx.moveTo(x2, y2);
    arrowCtx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
    arrowCtx.stroke();
}

function renderLoop() {
    arrowCtx.clearRect(0, 0, arrowCanvas.width, arrowCanvas.height);

    // Draw committed arrows
    appState.arrows.forEach(arr => {
        const fromEl = document.getElementById(arr.from);
        const toEl = document.getElementById(arr.to);
        if (fromEl && toEl) {
            const p1 = getCenter(fromEl);
            const p2 = getCenter(toEl);
            drawArrowBetweenPoints(p1.x, p1.y, p2.x, p2.y);
        }
    });

    // Draw temp arrow
    if (interactionState.isDrawing && interactionState.arrowStartNode) {
        const p1 = getCenter(interactionState.arrowStartNode);
        const p2 = {
            x: interactionState.mouseX,
            y: interactionState.mouseY
        };
        drawArrowBetweenPoints(p1.x, p1.y, p2.x, p2.y);
    }

    requestAnimationFrame(renderLoop);
}

// --- PERSISTENCE --- //

function serializeNodes() {
    return appState.nodes.map(node => {
        const type = node.classList.contains('node-image') ? 'image' : 'text';
        
        // Extract color class if any
        let color = 'none';
        ['red', 'blue', 'green', 'yellow', 'pink'].forEach(c => {
            if (node.classList.contains(`highlight-${c}`)) {
                color = c;
            }
        });

        const x = parseFloat(node.style.left);
        const y = parseFloat(node.style.top);

        let content = '';
        if (type === 'image') {
            const img = node.querySelector('img');
            content = img ? img.src : '';
        } else {
            const textDiv = node.querySelector('.node-text-content');
            content = textDiv ? textDiv.innerHTML : '';
        }

        return {
            id: node.id,
            type,
            x,
            y,
            color,
            content
        };
    });
}

let saveTimeout = null;
function saveStateDebounced() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveState, 1000);
}

async function saveState() {
    const notesData = {};
    document.querySelectorAll('.rich-textarea').forEach((ta, idx) => {
        notesData[idx] = ta.value;
    });

    const stateToSave = {
        projectName: appState.projectName,
        notes: notesData,
        settings: appState.settings,
        nodes: serializeNodes(),
        arrows: appState.arrows,
        currentId: appState.currentId
    };

    try {
        await localforage.setItem('photoshoot_planner_state', stateToSave);
        console.log('State saved passively to IndexedDB.');
    } catch (e) {
        console.error('Failed to save state to indexedDB:', e);
    }
}

async function loadState() {
    try {
        const data = await localforage.getItem('photoshoot_planner_state');
        if (data) {
            // Restore modal state if already setup
            if (data.projectName && data.projectName !== 'Untitled Shoot') {
                appState.projectName = data.projectName;
                projectTitle.textContent = data.projectName;
                setupModal.classList.add('hidden');
                appContainer.classList.remove('hidden');

                // Crucial: Resize once it is visible otherwise arrows won't draw
                setTimeout(resizeCanvas, 0);
            }

            // Restore notes
            if (data.notes) {
                document.querySelectorAll('.rich-textarea').forEach((ta, idx) => {
                    if (data.notes[idx] && data.notes[idx].trim() !== '') {
                        ta.value = data.notes[idx];
                    }
                });
            }

            // Restore Settings
            if (data.settings) {
                appState.settings = data.settings;
                loadSettingsUI();
            }

            // Restore Nodes
            if (data.currentId) {
                appState.currentId = data.currentId;
            }

            if (data.nodes && Array.isArray(data.nodes)) {
                data.nodes.forEach(nodeData => {
                    let el;
                    if (nodeData.type === 'image') {
                        el = createImageNode(nodeData.content, nodeData.x, nodeData.y, nodeData.id);
                    } else if (nodeData.type === 'text') {
                        el = createTextElement(nodeData.content, nodeData.x, nodeData.y, nodeData.id);
                    }
                    
                    if (el && nodeData.color && nodeData.color !== 'none') {
                        el.classList.add(`highlight-${nodeData.color}`);
                    }
                });
            }

            // Restore arrows
            if (data.arrows && Array.isArray(data.arrows)) {
                appState.arrows = data.arrows;
                setTimeout(resizeCanvas, 0);
            }
        }
    } catch (e) {
        console.error('Failed to load state from IndexedDB', e);
    }
}

// --- EXPORT --- //
function handleExport(format) {
    deselectAll(); // Hide controls

    // Switch to board if not there to ensure canvas renders
    if (!document.getElementById('tab-board').classList.contains('active')) {
        switchTab('board');
    }

    const boardArea = document.getElementById('tab-board');
    btnExportToggle.innerHTML = '<span class="material-icons-round">hourglass_empty</span>Exporting...';

    // Allow DOM to settle, especially if we just switched tabs or removed controls
    setTimeout(() => {
        // we use html2canvas to capture the "boardArea" div
        window.html2canvas(boardArea, {
            backgroundColor: '#f8f9fa',
            scale: 2, // high res
            onclone: (clonedDoc) => {
                // Force opacity to 1 and remove animation class
                const clonedBoard = clonedDoc.getElementById('tab-board');
                if (clonedBoard) {
                    clonedBoard.classList.remove('fade-in');
                    clonedBoard.style.opacity = '1';
                    clonedBoard.style.animation = 'none';
                }

                // Remove backdrop filters as they frequently cause html2canvas to render elements or the entire canvas semi-transparent
                clonedDoc.querySelectorAll('.glass-panel, .node-text').forEach(el => {
                    el.style.backdropFilter = 'none';
                    el.style.webkitBackdropFilter = 'none';
                });
            }
        }).then(canvas => {
            const imgData = canvas.toDataURL("image/png");
            const safeName = appState.projectName.replace(/\s+/g, '_');

            if (format === 'png') {
                // Save Image Natively
                const link = document.createElement('a');
                link.download = `${safeName}_Board.png`;
                link.href = imgData;
                link.click();
            } else if (format === 'pdf') {
                // Save PDF 
                const { jsPDF } = window.jspdf;
                // Calculate orientation based on canvas dimensions
                const orientation = canvas.width > canvas.height ? 'landscape' : 'portrait';
                const pdf = new jsPDF({
                    orientation: orientation,
                    unit: 'px',
                    format: [canvas.width, canvas.height]
                });

                pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
                pdf.save(`${safeName}_Planner.pdf`);
            } else if (format === 'email') {
                // Convert canvas to blob for Web Share API
                canvas.toBlob(async (blob) => {
                    const file = new File([blob], `${safeName}_Board.png`, { type: 'image/png' });
                    
                    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                        try {
                            await navigator.share({
                                files: [file],
                                title: `${appState.projectName} Photoshoot Plan`,
                                text: 'Here is the photoshoot plan we created!'
                            });
                        } catch (error) {
                            console.log('Error sharing or share cancelled by user:', error);
                        }
                    } else {
                        alert('Your browser does not fully support direct file attachments via the share menu. We will download the image for you instead, and you can attach it to your email manually.');
                        // Fallback to standard download
                        const link = document.createElement('a');
                        link.download = `${safeName}_Board.png`;
                        link.href = imgData;
                        link.click();
                        
                        // Optional: attempt to open mail client (without attachment, just subject)
                        window.location.href = `mailto:?subject=${encodeURIComponent(appState.projectName + ' Photoshoot Plan')}&body=${encodeURIComponent('Please find the attached photoshoot plan.')}`;
                    }
                }, 'image/png');
            }

            btnExportToggle.innerHTML = '<span class="material-icons-round">ios_share</span>Export';
        }).catch(err => {
            console.error(err);
            alert('Failed to export. Note: some external images may taint the canvas preventing export due to CORS.');
            btnExportToggle.innerHTML = '<span class="material-icons-round">ios_share</span>Export';
        });
    }, 100);
}

// --- SETTINGS --- //
function toggleSettingsPanel() {
    if (settingsPanel.classList.contains('hidden')) {
        // Open
        settingsPanel.classList.remove('hidden');
        // Small delay to allow display to apply before transitioning right
        setTimeout(() => {
            settingsPanel.classList.add('open');
        }, 10);
    } else {
        // Close
        settingsPanel.classList.remove('open');
        // Wait for slide animation to finish
        setTimeout(() => {
            settingsPanel.classList.add('hidden');
        }, 400); // matches var(--transition) time essentially, maybe longer
    }
}

function handleSaveSettings() {
    appState.settings.theme = appThemeSelect.value;
    appState.settings.googleCalendarUrl = googleCalendarUrlInput.value.trim();

    saveState();
    toggleSettingsPanel();
    updateCalendarIframe();
    applyTheme();
}

function loadSettingsUI() {
    if (appState.settings) {
        googleCalendarUrlInput.value = appState.settings.googleCalendarUrl || '';
        appThemeSelect.value = appState.settings.theme || 'light';
        updateCalendarIframe();
        applyTheme();
    }
}

function applyTheme() {
    const theme = appState.settings.theme || 'light';
    document.documentElement.setAttribute('data-theme', theme);
}

function updateCalendarIframe() {
    const url = appState.settings.googleCalendarUrl;
    if (url) {
        // Try to handle both direct src urls and full iframe embed codes
        let srcUrl = url;
        if (url.includes('<iframe') && url.includes('src="')) {
            const match = url.match(/src="([^"]+)"/);
            if (match && match[1]) srcUrl = match[1];
        }
        
        googleCalendarIframe.src = srcUrl;
        googleCalendarIframe.classList.remove('hidden');
        calendarPlaceholder.classList.add('hidden');
    } else {
        googleCalendarIframe.src = '';
        googleCalendarIframe.classList.add('hidden');
        calendarPlaceholder.classList.remove('hidden');
    }
}

// --- PROJECT MANAGER (File System Access API) --- //

let projectFolderHandle = null; // FileSystemDirectoryHandle

function toggleProjectsPanel() {
    if (projectsPanel.classList.contains('hidden')) {
        projectsPanel.classList.remove('hidden');
        setTimeout(() => projectsPanel.classList.add('open'), 10);
    } else {
        projectsPanel.classList.remove('open');
        setTimeout(() => projectsPanel.classList.add('hidden'), 400);
    }
}

async function tryRestoreFolder() {
    // Try to restore the folder handle from IndexedDB
    try {
        const handle = await localforage.getItem('photoshoot_folder_handle');
        if (handle) {
            projectFolderHandle = handle;
            // Verify we still have permission
            const perm = await handle.queryPermission({ mode: 'readwrite' });
            if (perm === 'granted') {
                folderStatusEl.textContent = `📁 Folder: ${handle.name}`;
                btnSaveProject.disabled = false;
                btnGrantAccess.style.display = 'none';
                await refreshProjectsList();
            } else {
                folderStatusEl.textContent = `🔒 Access Required: ${handle.name}`;
                btnGrantAccess.style.display = 'flex';
                btnSaveProject.disabled = true;
            }
        }
    } catch (e) {
        console.log('No previously stored folder handle or permission revoked.');
    }
}

async function grantFolderAccess() {
    if (!projectFolderHandle) return;
    try {
        const perm = await projectFolderHandle.requestPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
            btnGrantAccess.style.display = 'none';
            btnSaveProject.disabled = false;
            folderStatusEl.textContent = `📁 Folder: ${projectFolderHandle.name}`;
            await refreshProjectsList();
        }
    } catch (e) {
        console.error('Failed to get permission:', e);
    }
}

async function pickProjectFolder() {
    if (!('showDirectoryPicker' in window)) {
        alert('Your browser does not support the File System Access API. Please use Chrome or Edge.');
        return;
    }
    try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        projectFolderHandle = handle;

        // Persist for next session
        await localforage.setItem('photoshoot_folder_handle', handle);

        folderStatusEl.textContent = `📁 Folder: ${handle.name}`;
        btnSaveProject.disabled = false;
        btnGrantAccess.style.display = 'none';
        await refreshProjectsList();
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.error('Error picking folder:', e);
        }
    }
}

async function openProjectFilePicker() {
    if (!('showOpenFilePicker' in window)) {
        alert('Your browser does not support the File System Access API. Please use Chrome or Edge.');
        return;
    }
    try {
        const [handle] = await window.showOpenFilePicker({
            types: [{
                description: 'Photoshoot Project',
                accept: { 'application/json': ['.json'] }
            }],
            multiple: false
        });
        if (handle) {
            await loadProjectFromFile(handle);
        }
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.error('Error opening file:', e);
        }
    }
}

async function saveProjectToFile() {
    if (!projectFolderHandle) {
        alert('Please choose a save folder first.');
        return;
    }

    // Use the current project name as the filename
    const rawName = appState.projectName || 'Untitled Shoot';
    const fileName = rawName.replace(/[^a-z0-9_\-\s]/gi, '_') + '.json';

    try {
        const notesData = {};
        document.querySelectorAll('.rich-textarea').forEach((ta, idx) => {
            notesData[idx] = ta.value;
        });

        const projectData = {
            version: 1,
            savedAt: new Date().toISOString(),
            projectName: appState.projectName,
            notes: notesData,
            settings: appState.settings,
            nodes: serializeNodes(),
            arrows: appState.arrows,
            currentId: appState.currentId
        };

        const fileHandle = await projectFolderHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(projectData, null, 2));
        await writable.close();

        folderStatusEl.textContent = `✅ Saved: ${fileName}`;
        setTimeout(() => { folderStatusEl.textContent = `📁 Folder: ${projectFolderHandle.name}`; }, 3000);

        await refreshProjectsList();
    } catch (e) {
        console.error('Error saving project:', e);
        alert('Failed to save project: ' + e.message);
    }
}

async function refreshProjectsList() {
    if (!projectFolderHandle) return;

    projectsListEl.innerHTML = '';
    const projects = [];

    try {
        for await (const [name, handle] of projectFolderHandle.entries()) {
            if (handle.kind === 'file' && name.endsWith('.json')) {
                projects.push({ name, handle });
            }
        }
    } catch (e) {
        console.error('Error reading directory entries:', e);
        projectsListEl.innerHTML = '<div style="color:#ef4444; font-size:0.85rem; text-align:center; padding:1rem;">Access denied. Click "Grant Access" above.</div>';
        btnGrantAccess.style.display = 'flex';
        return;
    }

    if (projects.length === 0) {
        projectsListEl.innerHTML = '<div style="color:var(--text-secondary); font-size:0.85rem; text-align:center; padding:1rem;">No saved projects yet. Save your current project to get started!</div>';
        return;
    }

    // Sort alphabetically
    projects.sort((a, b) => a.name.localeCompare(b.name));

    projects.forEach(({ name, handle }) => {
        const item = document.createElement('div');
        item.style.cssText = 'display:flex; align-items:center; gap:0.5rem; padding:0.6rem 0.75rem; background:rgba(0,0,0,0.05); border-radius:8px; cursor:pointer;';
        item.innerHTML = `
            <span class="material-icons-round" style="font-size:18px; color:var(--accent-color);">description</span>
            <span style="flex:1; font-size:0.85rem; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${name.replace('.json', '')}</span>
            <button class="btn btn-icon btn-secondary" style="padding:4px; min-width:auto;" title="Load Project">
                <span class="material-icons-round" style="font-size:16px;">folder_open</span>
            </button>
        `;

        item.querySelector('button').addEventListener('click', (e) => {
            e.stopPropagation();
            loadProjectFromFile(handle);
        });
        item.addEventListener('click', () => loadProjectFromFile(handle));

        projectsListEl.appendChild(item);
    });
}

async function loadProjectFromFile(fileHandle) {
    try {
        const file = await fileHandle.getFile();
        const text = await file.text();
        const data = JSON.parse(text);

        if (!confirm(`Load project "${data.projectName}"? Unsaved changes to the current project will be lost.`)) return;

        // Clear the current board
        appState.nodes.forEach(n => n.remove());
        appState.nodes = [];
        appState.arrows = [];

        // Restore project 
        appState.projectName = data.projectName;
        projectTitle.textContent = data.projectName;
        setupModal.classList.add('hidden');
        appContainer.classList.remove('hidden');

        if (data.currentId) appState.currentId = data.currentId;

        if (data.notes) {
            document.querySelectorAll('.rich-textarea').forEach((ta, idx) => {
                ta.value = data.notes[idx] || '';
            });
        }

        if (data.settings) {
            appState.settings = data.settings;
            loadSettingsUI();
        }

        if (data.nodes && Array.isArray(data.nodes)) {
            data.nodes.forEach(nodeData => {
                let el;
                if (nodeData.type === 'image') {
                    el = createImageNode(nodeData.content, nodeData.x, nodeData.y, nodeData.id);
                } else if (nodeData.type === 'text') {
                    el = createTextElement(nodeData.content, nodeData.x, nodeData.y, nodeData.id);
                }
                if (el && nodeData.color && nodeData.color !== 'none') {
                    el.classList.add(`highlight-${nodeData.color}`);
                }
            });
        }

        if (data.arrows && Array.isArray(data.arrows)) {
            appState.arrows = data.arrows;
        }

        setTimeout(resizeCanvas, 0);
        toggleProjectsPanel();

        folderStatusEl.textContent = `✅ Loaded: ${data.projectName}`;
        setTimeout(() => { folderStatusEl.textContent = `📁 Folder: ${projectFolderHandle.name}`; }, 3000);

    } catch (e) {
        console.error('Error loading project:', e);
        alert('Failed to load project: ' + e.message);
    }
}

function startNewProject() {
    if (!confirm('Start a new project? Unsaved changes to the current project will be lost.')) return;

    // Clear board
    appState.nodes.forEach(n => n.remove());
    appState.nodes = [];
    appState.arrows = [];
    appState.currentId = 0;
    appState.projectName = 'Untitled Shoot';
    projectTitle.textContent = 'Untitled Shoot';

    // Clear notes
    document.querySelectorAll('.rich-textarea').forEach(ta => { ta.value = ''; });

    // Show setup modal again
    appContainer.classList.add('hidden');
    setupModal.classList.remove('hidden');

    toggleProjectsPanel();
}

// --- SHOOT TYPE SWITCHER --- //

function toggleShootTypeDropdown() {
    const isOpen = !shootTypeDropdown.classList.contains('hidden');
    if (isOpen) {
        closeShootTypeDropdown();
    } else {
        shootTypeDropdown.classList.remove('hidden');
        projectTitleWrapper.classList.add('open');
    }
}

function closeShootTypeDropdown() {
    shootTypeDropdown.classList.add('hidden');
    projectTitleWrapper.classList.remove('open');
}

async function handleShootTypeSwitch(type) {
    closeShootTypeDropdown();

    let newName = type;
    if (type === 'Custom') {
        const input = prompt('Enter a custom shoot name:', appState.projectName);
        if (!input || !input.trim()) return; // Cancelled
        newName = input.trim();
    }

    appState.projectName = newName;
    projectTitle.textContent = newName;

    // Highlight the active type in the dropdown
    document.querySelectorAll('.shoot-type-option').forEach(btn => {
        btn.style.fontWeight = btn.dataset.type === type ? '700' : '';
        btn.style.color = btn.dataset.type === type ? 'var(--accent-color)' : '';
    });

    await saveState();
}

// Start
init();
