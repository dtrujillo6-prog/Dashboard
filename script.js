const STORAGE_KEY = 'photoshoot_planner_state_v2';
const FOLDER_HANDLE_KEY = 'photoshoot_folder_handle';
const HIGHLIGHT_COLORS = ['red', 'blue', 'green', 'yellow', 'pink'];

const dom = {
    setupModal: document.getElementById('setup-modal'),
    setupForm: document.getElementById('setup-form'),
    shootTypeSelect: document.getElementById('shoot-type'),
    customTypeGroup: document.getElementById('custom-type-group'),
    customTypeInput: document.getElementById('custom-type'),
    appContainer: document.getElementById('app-container'),
    projectTitle: document.getElementById('project-title'),
    projectKicker: document.getElementById('project-kicker'),
    boardSummary: document.getElementById('board-summary'),
    boardStats: document.getElementById('board-stats'),
    saveIndicator: document.getElementById('save-indicator'),
    saveIndicatorText: document.getElementById('save-indicator-text'),
    notesStatus: document.getElementById('notes-status'),
    masterNotepad: document.getElementById('master-notepad'),
    preshootChecklist: document.getElementById('preshoot-checklist'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    workspace: document.getElementById('workspace-canvas'),
    boardScene: document.getElementById('board-scene'),
    boardEmptyState: document.getElementById('board-empty-state'),
    arrowCanvas: document.getElementById('arrow-layer'),
    zoomOut: document.getElementById('zoom-out'),
    zoomIn: document.getElementById('zoom-in'),
    zoomReset: document.getElementById('zoom-reset'),
    zoomLevel: document.getElementById('zoom-level'),
    toolImageInput: document.getElementById('image-upload'),
    emptyImageUpload: document.getElementById('empty-image-upload'),
    emptyAddNote: document.getElementById('empty-add-note'),
    toolText: document.getElementById('tool-text'),
    toolArrow: document.getElementById('tool-arrow'),
    toolClear: document.getElementById('tool-clear'),
    btnExportToggle: document.getElementById('btn-export-toggle'),
    exportDropdown: document.getElementById('export-dropdown'),
    exportPng: document.getElementById('export-png'),
    exportPdf: document.getElementById('export-pdf'),
    exportEmail: document.getElementById('export-email'),
    settingsPanel: document.getElementById('settings-panel'),
    btnSettings: document.getElementById('btn-settings'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
    appThemeSelect: document.getElementById('app-theme'),
    googleCalendarUrlInput: document.getElementById('google-calendar-url'),
    googleCalendarIframe: document.getElementById('google-calendar-iframe'),
    calendarPlaceholder: document.getElementById('calendar-placeholder'),
    projectsPanel: document.getElementById('projects-panel'),
    btnProjects: document.getElementById('btn-projects'),
    btnCloseProjects: document.getElementById('btn-close-projects'),
    btnPickFolder: document.getElementById('btn-pick-folder'),
    btnOpenFile: document.getElementById('btn-open-file'),
    projectImportInput: document.getElementById('project-import-input'),
    btnSaveProject: document.getElementById('btn-save-project'),
    btnNewProject: document.getElementById('btn-new-project'),
    btnGrantAccess: document.getElementById('btn-grant-access'),
    folderStatusEl: document.getElementById('folder-status'),
    projectsListEl: document.getElementById('projects-list'),
    projectFileName: document.getElementById('project-file-name'),
    projectTitleWrapper: document.getElementById('project-title-wrapper'),
    shootTypeDropdown: document.getElementById('shoot-type-dropdown'),
    toastRegion: document.getElementById('toast-region')
};

const arrowCtx = dom.arrowCanvas.getContext('2d');

const appState = {
    projectName: 'Untitled Shoot',
    projectType: 'Session plan',
    projectFileName: '',
    nodes: [],
    arrows: [],
    currentId: 0,
    settings: {
        theme: 'light',
        googleCalendarUrl: ''
    }
};

const interactionState = {
    mode: 'select',
    isDraggingNode: false,
    dragNode: null,
    offsetX: 0,
    offsetY: 0,
    selectedNode: null,
    isDrawing: false,
    arrowStartNode: null,
    mouseX: 0,
    mouseY: 0,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    cameraX: 320,
    cameraY: 180,
    zoom: 1
};

let saveTimeout = null;
let projectFolderHandle = null;
let toastTimeouts = new Set();
const supportsDirectoryAccess = 'showDirectoryPicker' in window;
const BOARD_WIDTH = 4000;
const BOARD_HEIGHT = 3000;

function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    dom.shootTypeSelect.addEventListener('change', handleShootTypeChange);
    dom.setupForm.addEventListener('submit', handleSetupSubmit);
    dom.tabBtns.forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

    [dom.toolImageInput, dom.emptyImageUpload].forEach((input) => {
        input.addEventListener('change', handleImageUpload);
    });
    dom.emptyAddNote.addEventListener('click', handleAddText);
    dom.toolText.addEventListener('click', handleAddText);
    dom.toolArrow.addEventListener('click', toggleArrowMode);
    dom.toolClear.addEventListener('click', clearBoard);
    dom.zoomOut.addEventListener('click', () => zoomBy(-0.1));
    dom.zoomIn.addEventListener('click', () => zoomBy(0.1));
    dom.zoomReset.addEventListener('click', resetBoardView);

    dom.btnExportToggle.addEventListener('click', toggleExportDropdown);
    dom.exportPng.addEventListener('click', () => handleExport('png'));
    dom.exportPdf.addEventListener('click', () => handleExport('pdf'));
    dom.exportEmail.addEventListener('click', () => handleExport('email'));

    dom.btnSettings.addEventListener('click', toggleSettingsPanel);
    dom.btnCloseSettings.addEventListener('click', toggleSettingsPanel);
    dom.btnSaveSettings.addEventListener('click', handleSaveSettings);

    dom.btnProjects.addEventListener('click', toggleProjectsPanel);
    dom.btnCloseProjects.addEventListener('click', toggleProjectsPanel);
    dom.btnPickFolder.addEventListener('click', pickProjectFolder);
    dom.btnOpenFile.addEventListener('click', openProjectImport);
    dom.projectImportInput.addEventListener('change', handleImportedProject);
    dom.btnSaveProject.addEventListener('click', saveProjectToFile);
    dom.btnNewProject.addEventListener('click', startNewProject);
    dom.btnGrantAccess.addEventListener('click', grantFolderAccess);

    dom.projectTitleWrapper.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleShootTypeDropdown();
    });
    document.querySelectorAll('.shoot-type-option').forEach((button) => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            handleShootTypeSwitch(button.dataset.type);
        });
    });

    dom.workspace.addEventListener('mousedown', handleWorkspaceMouseDown);
    dom.workspace.addEventListener('wheel', handleWorkspaceWheel, { passive: false });
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleGlobalClick);
    dom.masterNotepad.addEventListener('input', handleNotesInput);
    dom.preshootChecklist.addEventListener('input', handleNotesInput);
    dom.projectFileName.addEventListener('input', handleProjectFileNameInput);

    loadState().then(() => {
        configureProjectPanel();
        loadSettingsUI();
        applyTheme();
        tryRestoreFolder();
        updateProjectUI();
        updateBoardStats();
        updateEmptyState();
        applyCameraTransform();
        requestAnimationFrame(renderLoop);
    });
}

function handleGlobalClick(event) {
    if (!dom.exportDropdown.contains(event.target) && event.target !== dom.btnExportToggle && !dom.btnExportToggle.contains(event.target)) {
        dom.exportDropdown.classList.add('hidden');
    }

    if (!dom.projectTitleWrapper.contains(event.target)) {
        closeShootTypeDropdown();
    }
}

function handleShootTypeChange(event) {
    const isCustom = event.target.value === 'Custom';
    dom.customTypeGroup.classList.toggle('hidden', !isCustom);
    dom.customTypeInput.required = isCustom;
}

function handleSetupSubmit(event) {
    event.preventDefault();
    const selectedType = dom.shootTypeSelect.value;
    const name = selectedType === 'Custom' ? dom.customTypeInput.value.trim() : selectedType;
    if (!name) {
        showToast('Add a custom session name to continue.', 'error');
        return;
    }

    appState.projectName = name;
    appState.projectType = selectedType === 'Custom' ? 'Custom session' : selectedType;
    dom.setupModal.classList.add('hidden');
    dom.appContainer.classList.remove('hidden');
    updateProjectUI();
    resetBoardView();
    setSaveIndicator('dirty', 'New workspace ready');
    queueSave();
    setTimeout(resizeCanvas, 0);
}

function switchTab(tabId) {
    dom.tabBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tabId));
    dom.tabPanes.forEach((pane) => pane.classList.toggle('active', pane.id === `tab-${tabId}`));

    if (tabId === 'board') {
        setTimeout(() => {
            resizeCanvas();
            applyCameraTransform();
        }, 0);
    }
}

function generateId() {
    appState.currentId += 1;
    return `node_${appState.currentId}`;
}

function handleImageUpload(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    files.forEach((file, index) => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            createImageNode(loadEvent.target.result, 140 + index * 24, 160 + index * 24);
            updateBoardStats();
            updateEmptyState();
            queueSave();
        };
        reader.readAsDataURL(file);
    });

    event.target.value = '';
    switchTab('board');
}

function handleAddText() {
    switchTab('board');
    const node = createTextElement('Add a pose cue, prop reminder, or direction note.', 240, 220);
    const editable = node.querySelector('.node-text-content');
    editable.focus();
    placeCaretAtEnd(editable);
    updateBoardStats();
    updateEmptyState();
    queueSave();
}

function createNodeWrapper(id, x, y, type) {
    const node = document.createElement('div');
    node.id = id;
    node.className = `node node-${type}`;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.zIndex = String(10 + appState.nodes.length);

    const controls = document.createElement('div');
    controls.className = 'node-controls';

    ['none', ...HIGHLIGHT_COLORS].forEach((color) => {
        const button = document.createElement('button');
        button.className = 'control-btn';
        button.type = 'button';

        if (color === 'none') {
            button.innerHTML = '<span class="material-icons-round" style="font-size:16px;">format_color_reset</span>';
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                setNodeColor(node, 'none');
            });
        } else {
            const dot = document.createElement('span');
            dot.className = 'color-dot';
            dot.style.backgroundColor = `var(--highlight-${color})`;
            button.appendChild(dot);
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                setNodeColor(node, color);
            });
        }
        controls.appendChild(button);
    });

    const cloneButton = document.createElement('button');
    cloneButton.className = 'control-btn';
    cloneButton.type = 'button';
    cloneButton.innerHTML = '<span class="material-icons-round" style="font-size:16px;">content_copy</span>';
    cloneButton.addEventListener('click', (event) => {
        event.stopPropagation();
        cloneNode(node);
    });
    controls.appendChild(cloneButton);

    const deleteButton = document.createElement('button');
    deleteButton.className = 'control-btn';
    deleteButton.type = 'button';
    deleteButton.innerHTML = '<span class="material-icons-round" style="font-size:16px; color: var(--danger-color);">delete</span>';
    deleteButton.addEventListener('click', (event) => {
        event.stopPropagation();
        deleteNode(node);
    });
    controls.appendChild(deleteButton);

    node.appendChild(controls);
    dom.boardScene.appendChild(node);
    appState.nodes.push(node);
    return node;
}

function createImageNode(src, x, y, customId = null) {
    const node = createNodeWrapper(customId || generateId(), x, y, 'image');
    const img = document.createElement('img');
    img.src = src;
    img.alt = 'Reference image';
    node.appendChild(img);
    return node;
}

function createTextElement(content, x, y, customId = null) {
    const node = createNodeWrapper(customId || generateId(), x, y, 'text');
    const textDiv = document.createElement('div');
    textDiv.className = 'node-text-content';
    textDiv.contentEditable = true;
    textDiv.innerHTML = content;
    textDiv.spellcheck = true;

    textDiv.addEventListener('mousedown', (event) => {
        if (document.activeElement === textDiv) {
            event.stopPropagation();
        }
    });
    textDiv.addEventListener('focus', () => selectNode(node));
    textDiv.addEventListener('input', () => {
        setSaveIndicator('dirty', 'Changes not saved yet');
        queueSave();
    });

    const frame = document.createElement('div');
    frame.className = 'node-text';
    frame.appendChild(textDiv);
    node.appendChild(frame);
    return node;
}

function placeCaretAtEnd(element) {
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
}

function setNodeColor(node, color) {
    HIGHLIGHT_COLORS.forEach((shade) => node.classList.remove(`highlight-${shade}`));
    if (color !== 'none') {
        node.classList.add(`highlight-${color}`);
    }
    queueSave();
}

function deleteNode(node) {
    appState.arrows = appState.arrows.filter((arrow) => arrow.from !== node.id && arrow.to !== node.id);
    appState.nodes = appState.nodes.filter((entry) => entry.id !== node.id);
    if (interactionState.selectedNode === node) {
        interactionState.selectedNode = null;
    }
    node.remove();
    updateBoardStats();
    updateEmptyState();
    queueSave();
    showToast('Board item removed.', 'success');
}

function cloneNode(node) {
    const x = parseFloat(node.style.left) + 30;
    const y = parseFloat(node.style.top) + 30;

    if (node.classList.contains('node-image')) {
        const img = node.querySelector('img');
        createImageNode(img.src, x, y);
    } else {
        const text = node.querySelector('.node-text-content').innerHTML;
        createTextElement(text, x, y);
    }

    updateBoardStats();
    updateEmptyState();
    queueSave();
}

function clearBoard() {
    if (!appState.nodes.length) {
        showToast('The board is already empty.', 'success');
        return;
    }

    if (!window.confirm('Clear the board? Your local autosaved version will update immediately.')) {
        return;
    }

    appState.nodes.forEach((node) => node.remove());
    appState.nodes = [];
    appState.arrows = [];
    interactionState.selectedNode = null;
    updateBoardStats();
    updateEmptyState();
    queueSave();
    showToast('Board cleared.', 'success');
}

function deselectAll() {
    appState.nodes.forEach((node) => node.classList.remove('selected'));
    interactionState.selectedNode = null;
}

function selectNode(node) {
    deselectAll();
    node.classList.add('selected');
    interactionState.selectedNode = node;
}

function handleWorkspaceMouseDown(event) {
    const node = event.target.closest('.node');

    if (interactionState.mode === 'draw_arrow') {
        if (node) {
            event.preventDefault();
            interactionState.isDrawing = true;
            interactionState.arrowStartNode = node;
            const point = screenToScene(event.clientX, event.clientY);
            interactionState.mouseX = point.x;
            interactionState.mouseY = point.y;
        } else {
            setInteractionMode('select');
        }
        return;
    }

    if (node) {
        if (document.activeElement?.contentEditable === 'true' && document.activeElement !== event.target) {
            document.activeElement.blur();
        }

        selectNode(node);
        interactionState.isDraggingNode = true;
        interactionState.dragNode = node;
        const rect = node.getBoundingClientRect();
        interactionState.offsetX = event.clientX - rect.left;
        interactionState.offsetY = event.clientY - rect.top;
        bringNodeToFront(node);
    } else {
        deselectAll();
        interactionState.isPanning = true;
        interactionState.panStartX = event.clientX - interactionState.cameraX;
        interactionState.panStartY = event.clientY - interactionState.cameraY;
        dom.workspace.classList.add('is-panning');
    }
}

function bringNodeToFront(node) {
    appState.nodes.forEach((entry, index) => {
        entry.style.zIndex = String(10 + index);
    });
    node.style.zIndex = String(20 + appState.nodes.length);
}

function handleMouseMove(event) {
    if (interactionState.isDraggingNode && interactionState.dragNode) {
        const workspaceRect = dom.workspace.getBoundingClientRect();
        const x = (event.clientX - workspaceRect.left - interactionState.cameraX - interactionState.offsetX) / interactionState.zoom;
        const y = (event.clientY - workspaceRect.top - interactionState.cameraY - interactionState.offsetY) / interactionState.zoom;
        interactionState.dragNode.style.left = `${Math.max(12, x)}px`;
        interactionState.dragNode.style.top = `${Math.max(100, y)}px`;
        return;
    }

    if (interactionState.isDrawing) {
        const point = screenToScene(event.clientX, event.clientY);
        interactionState.mouseX = point.x;
        interactionState.mouseY = point.y;
        return;
    }

    if (interactionState.isPanning) {
        interactionState.cameraX = event.clientX - interactionState.panStartX;
        interactionState.cameraY = event.clientY - interactionState.panStartY;
        clampCamera();
        applyCameraTransform();
    }
}

function handleMouseUp(event) {
    if (interactionState.isDraggingNode) {
        interactionState.isDraggingNode = false;
        interactionState.dragNode = null;
        queueSave();
    }

    if (interactionState.isDrawing) {
        const targetNode = event.target.closest('.node');
        if (targetNode && targetNode !== interactionState.arrowStartNode) {
            appState.arrows.push({ from: interactionState.arrowStartNode.id, to: targetNode.id });
            updateBoardStats();
            queueSave();
            showToast('Connection added.', 'success');
        }

        interactionState.isDrawing = false;
        interactionState.arrowStartNode = null;
        setInteractionMode('select');
    }

    if (interactionState.isPanning) {
        interactionState.isPanning = false;
        dom.workspace.classList.remove('is-panning');
    }
}

function toggleArrowMode() {
    setInteractionMode(interactionState.mode === 'draw_arrow' ? 'select' : 'draw_arrow');
}

function setInteractionMode(mode) {
    interactionState.mode = mode;
    const isArrowMode = mode === 'draw_arrow';
    dom.toolArrow.classList.toggle('active', isArrowMode);
    dom.workspace.style.cursor = isArrowMode ? 'crosshair' : 'grab';
    if (isArrowMode) {
        deselectAll();
        showToast('Click one item, then another, to connect them.', 'success');
    }
}

function resizeCanvas() {
    dom.arrowCanvas.width = BOARD_WIDTH;
    dom.arrowCanvas.height = BOARD_HEIGHT;
    applyCameraTransform();
}

function getNodeCenter(node) {
    const rect = node.getBoundingClientRect();
    const workspaceRect = dom.workspace.getBoundingClientRect();
    return {
        x: rect.left - workspaceRect.left + rect.width / 2,
        y: rect.top - workspaceRect.top + rect.height / 2
    };
}

function drawArrowBetweenPoints(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    const headLength = 14;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim();

    arrowCtx.beginPath();
    arrowCtx.moveTo(x1, y1);
    const ctrlDistance = Math.max(60, Math.abs(dx) * 0.28);
    arrowCtx.bezierCurveTo(x1 + ctrlDistance, y1, x2 - ctrlDistance, y2, x2, y2);
    arrowCtx.lineWidth = 3;
    arrowCtx.strokeStyle = accent;
    arrowCtx.stroke();

    arrowCtx.beginPath();
    arrowCtx.moveTo(x2, y2);
    arrowCtx.lineTo(
        x2 - headLength * Math.cos(angle - Math.PI / 6),
        y2 - headLength * Math.sin(angle - Math.PI / 6)
    );
    arrowCtx.moveTo(x2, y2);
    arrowCtx.lineTo(
        x2 - headLength * Math.cos(angle + Math.PI / 6),
        y2 - headLength * Math.sin(angle + Math.PI / 6)
    );
    arrowCtx.stroke();
}

function renderLoop() {
    arrowCtx.clearRect(0, 0, dom.arrowCanvas.width, dom.arrowCanvas.height);

    appState.arrows.forEach((arrow) => {
        const fromNode = document.getElementById(arrow.from);
        const toNode = document.getElementById(arrow.to);
        if (!fromNode || !toNode) return;
        const start = getNodeCenter(fromNode);
        const end = getNodeCenter(toNode);
        drawArrowBetweenPoints(start.x, start.y, end.x, end.y);
    });

    if (interactionState.isDrawing && interactionState.arrowStartNode) {
        const start = getNodeCenter(interactionState.arrowStartNode);
        drawArrowBetweenPoints(start.x, start.y, interactionState.mouseX, interactionState.mouseY);
    }

    requestAnimationFrame(renderLoop);
}

function handleWorkspaceWheel(event) {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.1 : -0.1;
    zoomBy(delta, event.clientX, event.clientY);
}

function zoomBy(delta, clientX = null, clientY = null) {
    const nextZoom = clampZoom(interactionState.zoom + delta);
    zoomTo(nextZoom, clientX, clientY);
}

function zoomTo(nextZoom, clientX = null, clientY = null) {
    const previousZoom = interactionState.zoom;
    if (nextZoom === previousZoom) return;

    const workspaceRect = dom.workspace.getBoundingClientRect();
    const anchorX = clientX ?? (workspaceRect.left + workspaceRect.width / 2);
    const anchorY = clientY ?? (workspaceRect.top + workspaceRect.height / 2);
    const worldPoint = screenToScene(anchorX, anchorY);

    interactionState.zoom = nextZoom;
    interactionState.cameraX = anchorX - workspaceRect.left - worldPoint.x * nextZoom;
    interactionState.cameraY = anchorY - workspaceRect.top - worldPoint.y * nextZoom;
    clampCamera();
    applyCameraTransform();
}

function clampZoom(value) {
    return Math.min(2.5, Math.max(0.35, Number(value.toFixed(2))));
}

function applyCameraTransform() {
    dom.boardScene.style.transform = `translate(${interactionState.cameraX}px, ${interactionState.cameraY}px) scale(${interactionState.zoom})`;
    dom.zoomLevel.textContent = `${Math.round(interactionState.zoom * 100)}%`;
}

function clampCamera() {
    const rect = dom.workspace.getBoundingClientRect();
    const scaledWidth = BOARD_WIDTH * interactionState.zoom;
    const scaledHeight = BOARD_HEIGHT * interactionState.zoom;
    const minX = Math.min(0, rect.width - scaledWidth);
    const minY = Math.min(0, rect.height - scaledHeight);
    const maxX = Math.max(0, rect.width - scaledWidth);
    const maxY = Math.max(0, rect.height - scaledHeight);

    interactionState.cameraX = Math.min(maxX + 220, Math.max(minX - 220, interactionState.cameraX));
    interactionState.cameraY = Math.min(maxY + 220, Math.max(minY - 220, interactionState.cameraY));
}

function resetBoardView() {
    const rect = dom.workspace.getBoundingClientRect();
    interactionState.zoom = 0.75;
    interactionState.cameraX = (rect.width - BOARD_WIDTH * interactionState.zoom) / 2;
    interactionState.cameraY = (rect.height - BOARD_HEIGHT * interactionState.zoom) / 2;
    clampCamera();
    applyCameraTransform();
}

function screenToScene(clientX, clientY) {
    const workspaceRect = dom.workspace.getBoundingClientRect();
    return {
        x: (clientX - workspaceRect.left - interactionState.cameraX) / interactionState.zoom,
        y: (clientY - workspaceRect.top - interactionState.cameraY) / interactionState.zoom
    };
}

function serializeNodes() {
    return appState.nodes.map((node) => {
        const isImage = node.classList.contains('node-image');
        const color = HIGHLIGHT_COLORS.find((shade) => node.classList.contains(`highlight-${shade}`)) || 'none';
        return {
            id: node.id,
            type: isImage ? 'image' : 'text',
            x: parseFloat(node.style.left),
            y: parseFloat(node.style.top),
            color,
            content: isImage
                ? node.querySelector('img')?.src || ''
                : node.querySelector('.node-text-content')?.innerHTML || ''
        };
    });
}

function queueSave() {
    setSaveIndicator('dirty', 'Changes not saved yet');
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveState, 700);
}

async function saveState() {
    setSaveIndicator('saving', 'Saving...');
    try {
        await localforage.setItem(STORAGE_KEY, {
            projectName: appState.projectName,
            projectType: appState.projectType,
            projectFileName: appState.projectFileName,
            settings: appState.settings,
            notes: dom.masterNotepad.value,
            preshootChecklist: dom.preshootChecklist.value,
            nodes: serializeNodes(),
            arrows: appState.arrows,
            currentId: appState.currentId
        });
        setSaveIndicator('saved', 'All changes saved');
        dom.notesStatus.textContent = 'Autosaved just now';
    } catch (error) {
        console.error('Failed to save state:', error);
        setSaveIndicator('dirty', 'Save failed');
        dom.notesStatus.textContent = 'Autosave failed';
        showToast('Autosave failed. Check browser storage permissions.', 'error');
    }
}

async function loadState() {
    try {
        const data = await localforage.getItem(STORAGE_KEY);
        if (!data) return;

        if (data.projectName && data.projectName !== 'Untitled Shoot') {
            appState.projectName = data.projectName;
            appState.projectType = data.projectType || data.projectName;
            appState.projectFileName = data.projectFileName || slugifyProjectName(data.projectName);
            dom.setupModal.classList.add('hidden');
            dom.appContainer.classList.remove('hidden');
        }

        if (typeof data.notes === 'string') {
            dom.masterNotepad.value = data.notes;
        }

        if (typeof data.preshootChecklist === 'string') {
            dom.preshootChecklist.value = data.preshootChecklist;
        }

        if (data.settings) {
            appState.settings = { ...appState.settings, ...data.settings };
        }

        appState.currentId = data.currentId || 0;

        if (Array.isArray(data.nodes)) {
            data.nodes.forEach((nodeData) => {
                let node = null;
                if (nodeData.type === 'image') {
                    node = createImageNode(nodeData.content, nodeData.x, nodeData.y, nodeData.id);
                } else {
                    node = createTextElement(nodeData.content, nodeData.x, nodeData.y, nodeData.id);
                }
                if (nodeData.color && nodeData.color !== 'none') {
                    node.classList.add(`highlight-${nodeData.color}`);
                }
            });
        }

        if (Array.isArray(data.arrows)) {
            appState.arrows = data.arrows;
        }

        setSaveIndicator('saved', 'Last session restored');
        dom.notesStatus.textContent = dom.masterNotepad.value ? 'Restored from autosave' : 'Autosaves as you type';
    } catch (error) {
        console.error('Failed to load state:', error);
        showToast('Could not restore the last autosaved session.', 'error');
    }
}

function updateProjectUI() {
    dom.projectTitle.textContent = appState.projectName;
    dom.projectKicker.textContent = appState.projectType || 'Session plan';
    dom.boardSummary.textContent = `${appState.projectName} stays organized across the board, prep notes, and schedule so the shoot day feels lighter.`;
    if (!appState.projectFileName) {
        appState.projectFileName = slugifyProjectName(appState.projectName);
    }
    dom.projectFileName.value = appState.projectFileName;
}

function updateBoardStats() {
    const itemCount = appState.nodes.length;
    const connectionCount = appState.arrows.length;
    dom.boardStats.textContent = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}, ${connectionCount} ${connectionCount === 1 ? 'connection' : 'connections'}`;
}

function updateEmptyState() {
    dom.boardEmptyState.classList.toggle('hidden', appState.nodes.length > 0);
}

function setSaveIndicator(state, text) {
    dom.saveIndicator.dataset.state = state;
    dom.saveIndicatorText.textContent = text;
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    dom.toastRegion.appendChild(toast);

    const timeoutId = window.setTimeout(() => {
        toast.remove();
        toastTimeouts.delete(timeoutId);
    }, 2800);
    toastTimeouts.add(timeoutId);
}

function handleNotesInput() {
    dom.notesStatus.textContent = 'Typing... autosave queued';
    queueSave();
}

function handleProjectFileNameInput() {
    appState.projectFileName = sanitizeFileStem(dom.projectFileName.value);
    queueSave();
}

function configureProjectPanel() {
    if (supportsDirectoryAccess) {
        dom.folderStatusEl.textContent = 'No folder selected';
        return;
    }

    dom.btnPickFolder.innerHTML = '<span class="material-icons-round">download</span><span>Save To Device</span>';
    dom.folderStatusEl.textContent = 'Browser download mode: projects save as .json files to your device.';
    dom.btnSaveProject.disabled = false;
    dom.projectsListEl.innerHTML = '<div class="projects-empty">Import a saved .json project from your device whenever you want to reopen one.</div>';
}

function toggleExportDropdown(event) {
    event.stopPropagation();
    dom.exportDropdown.classList.toggle('hidden');
}

function loadSettingsUI() {
    dom.appThemeSelect.value = appState.settings.theme || 'light';
    dom.googleCalendarUrlInput.value = appState.settings.googleCalendarUrl || '';
    updateCalendarIframe();
}

function applyTheme() {
    document.documentElement.setAttribute('data-theme', appState.settings.theme || 'light');
}

function handleSaveSettings() {
    appState.settings.theme = dom.appThemeSelect.value;
    appState.settings.googleCalendarUrl = dom.googleCalendarUrlInput.value.trim();
    loadSettingsUI();
    applyTheme();
    queueSave();
    toggleSettingsPanel();
    showToast('Settings updated.', 'success');
}

function updateCalendarIframe() {
    const value = appState.settings.googleCalendarUrl || '';
    let src = value;
    if (value.includes('<iframe') && value.includes('src=')) {
        const match = value.match(/src="([^"]+)"/);
        if (match?.[1]) {
            src = match[1];
        }
    }

    if (src) {
        dom.googleCalendarIframe.src = src;
        dom.googleCalendarIframe.classList.remove('hidden');
        dom.calendarPlaceholder.classList.add('hidden');
    } else {
        dom.googleCalendarIframe.src = '';
        dom.googleCalendarIframe.classList.add('hidden');
        dom.calendarPlaceholder.classList.remove('hidden');
    }
}

function toggleSettingsPanel() {
    toggleSlidingPanel(dom.settingsPanel);
}

function toggleProjectsPanel() {
    toggleSlidingPanel(dom.projectsPanel);
}

function toggleSlidingPanel(panel) {
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        requestAnimationFrame(() => panel.classList.add('open'));
        return;
    }

    panel.classList.remove('open');
    window.setTimeout(() => panel.classList.add('hidden'), 260);
}

async function handleExport(format) {
    deselectAll();
    dom.exportDropdown.classList.add('hidden');
    if (!document.getElementById('tab-board').classList.contains('active')) {
        switchTab('board');
    }

    dom.btnExportToggle.disabled = true;
    setSaveIndicator('saving', 'Preparing export...');

    window.setTimeout(() => {
        window.html2canvas(document.getElementById('tab-board'), {
            backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-color').trim(),
            scale: 2,
            onclone: (clonedDocument) => {
                clonedDocument.getElementById('board-empty-state')?.classList.add('hidden');
                clonedDocument.querySelectorAll('.node-controls').forEach((controls) => {
                    controls.style.display = 'none';
                });
            }
        }).then((canvas) => {
            const imageData = canvas.toDataURL('image/png');
            const safeName = appState.projectName.replace(/\s+/g, '_');

            if (format === 'png') {
                downloadDataUrl(imageData, `${safeName}_board.png`);
            } else if (format === 'pdf') {
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF({
                    orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
                    unit: 'px',
                    format: [canvas.width, canvas.height]
                });
                pdf.addImage(imageData, 'PNG', 0, 0, canvas.width, canvas.height);
                pdf.save(`${safeName}_planner.pdf`);
            } else {
                canvas.toBlob(async (blob) => {
                    const file = new File([blob], `${safeName}_board.png`, { type: 'image/png' });
                    if (navigator.share && navigator.canShare?.({ files: [file] })) {
                        await navigator.share({
                            title: `${appState.projectName} board`,
                            text: 'Sharing the current shoot plan board.',
                            files: [file]
                        });
                    } else {
                        downloadDataUrl(imageData, `${safeName}_board.png`);
                        window.location.href = `mailto:?subject=${encodeURIComponent(`${appState.projectName} board`)}&body=${encodeURIComponent('Attached is the latest shoot planning board.')}`;
                    }
                }, 'image/png');
            }

            dom.btnExportToggle.disabled = false;
            setSaveIndicator('saved', 'Export ready');
            showToast('Export complete.', 'success');
        }).catch((error) => {
            console.error(error);
            dom.btnExportToggle.disabled = false;
            setSaveIndicator('dirty', 'Export failed');
            showToast('Export failed. Browser image security can block some external images.', 'error');
        });
    }, 100);
}

function downloadDataUrl(dataUrl, filename) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
}

async function tryRestoreFolder() {
    if (!supportsDirectoryAccess) {
        return;
    }
    try {
        const handle = await localforage.getItem(FOLDER_HANDLE_KEY);
        if (!handle) return;

        projectFolderHandle = handle;
        const permission = await handle.queryPermission({ mode: 'readwrite' });
        if (permission === 'granted') {
            dom.folderStatusEl.textContent = `Folder ready: ${handle.name}`;
            dom.btnSaveProject.disabled = false;
            dom.btnGrantAccess.classList.add('hidden');
            await refreshProjectsList();
        } else {
            dom.folderStatusEl.textContent = `Access needed for: ${handle.name}`;
            dom.btnSaveProject.disabled = true;
            dom.btnGrantAccess.classList.remove('hidden');
        }
    } catch (error) {
        console.log('Could not restore folder access.', error);
    }
}

async function grantFolderAccess() {
    if (!supportsDirectoryAccess) {
        return;
    }
    if (!projectFolderHandle) return;
    try {
        const permission = await projectFolderHandle.requestPermission({ mode: 'readwrite' });
        if (permission === 'granted') {
            dom.folderStatusEl.textContent = `Folder ready: ${projectFolderHandle.name}`;
            dom.btnSaveProject.disabled = false;
            dom.btnGrantAccess.classList.add('hidden');
            await refreshProjectsList();
            showToast('Folder access restored.', 'success');
        }
    } catch (error) {
        console.error('Failed to request folder access:', error);
        showToast('Could not restore folder permission.', 'error');
    }
}

async function pickProjectFolder() {
    if (!supportsDirectoryAccess) {
        await saveProjectToFile();
        return;
    }

    try {
        projectFolderHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        await localforage.setItem(FOLDER_HANDLE_KEY, projectFolderHandle);
        dom.folderStatusEl.textContent = `Folder ready: ${projectFolderHandle.name}`;
        dom.btnSaveProject.disabled = false;
        dom.btnGrantAccess.classList.add('hidden');
        await refreshProjectsList();
        showToast('Project folder connected.', 'success');
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error choosing folder:', error);
            showToast('Could not connect that folder.', 'error');
        }
    }
}

async function saveProjectToFile() {
    const fileStem = getProjectFileStem();
    const filename = `${fileStem}.json`;
    const projectData = {
        version: 2,
        savedAt: new Date().toISOString(),
        projectName: appState.projectName,
        projectType: appState.projectType,
        projectFileName: fileStem,
        settings: appState.settings,
        notes: dom.masterNotepad.value,
        preshootChecklist: dom.preshootChecklist.value,
        nodes: serializeNodes(),
        arrows: appState.arrows,
        currentId: appState.currentId
    };

    if (!supportsDirectoryAccess) {
        downloadProjectFile(filename, projectData);
        setSaveIndicator('saved', 'Project file downloaded');
        showToast('Project downloaded to your device.', 'success');
        return;
    }

    if (!projectFolderHandle) {
        showToast('Choose a save folder first.', 'error');
        return;
    }

    try {
        const fileHandle = await projectFolderHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(projectData, null, 2));
        await writable.close();

        dom.folderStatusEl.textContent = `Saved: ${filename}`;
        window.setTimeout(() => {
            if (projectFolderHandle) {
                dom.folderStatusEl.textContent = `Folder ready: ${projectFolderHandle.name}`;
            }
        }, 2400);

        await refreshProjectsList();
        setSaveIndicator('saved', 'Project file saved');
        showToast('Project saved to disk.', 'success');
    } catch (error) {
        console.error('Error saving project:', error);
        showToast(`Could not save project: ${error.message}`, 'error');
    }
}

async function refreshProjectsList() {
    if (!supportsDirectoryAccess) {
        dom.projectsListEl.innerHTML = '<div class="projects-empty">Import a saved .json project from your device whenever you want to reopen one.</div>';
        return;
    }
    if (!projectFolderHandle) {
        dom.projectsListEl.innerHTML = '<div class="projects-empty">Choose a project folder to browse saved files.</div>';
        return;
    }

    const projects = [];
    dom.projectsListEl.innerHTML = '';

    try {
        for await (const [name, handle] of projectFolderHandle.entries()) {
            if (handle.kind === 'file' && name.endsWith('.json')) {
                projects.push({ name, handle });
            }
        }
    } catch (error) {
        console.error('Error reading project folder:', error);
        dom.projectsListEl.innerHTML = '<div class="projects-empty">Folder access expired. Use "Grant Folder Access" to reconnect.</div>';
        dom.btnGrantAccess.classList.remove('hidden');
        return;
    }

    if (!projects.length) {
        dom.projectsListEl.innerHTML = '<div class="projects-empty">No saved projects yet. Save the current project to create your first file.</div>';
        return;
    }

    projects.sort((left, right) => left.name.localeCompare(right.name));
    projects.forEach(({ name, handle }) => {
        const row = document.createElement('div');
        row.className = 'project-row';
        row.innerHTML = `
            <span class="material-icons-round">description</span>
            <span class="project-name">${name.replace(/\.json$/, '')}</span>
            <button type="button" class="btn btn-icon btn-secondary">
                <span class="material-icons-round">upload_file</span>
            </button>
        `;

        row.addEventListener('click', () => loadProjectFromFile(handle));
        row.querySelector('button').addEventListener('click', (event) => {
            event.stopPropagation();
            loadProjectFromFile(handle);
        });
        dom.projectsListEl.appendChild(row);
    });
}

async function loadProjectFromFile(fileHandle) {
    try {
        const data = await readProjectData(fileHandle);
        if (!window.confirm(`Load "${data.projectName}"? Any unsaved board changes in memory will be replaced.`)) {
            return;
        }

        resetBoard();
        appState.projectName = data.projectName || 'Untitled Shoot';
        appState.projectType = data.projectType || appState.projectName;
        appState.projectFileName = data.projectFileName || slugifyProjectName(appState.projectName);
        appState.settings = { ...appState.settings, ...(data.settings || {}) };
        dom.masterNotepad.value = data.notes || '';
        dom.preshootChecklist.value = data.preshootChecklist || '';
        appState.currentId = data.currentId || 0;

        if (Array.isArray(data.nodes)) {
            data.nodes.forEach((nodeData) => {
                let node = null;
                if (nodeData.type === 'image') {
                    node = createImageNode(nodeData.content, nodeData.x, nodeData.y, nodeData.id);
                } else {
                    node = createTextElement(nodeData.content, nodeData.x, nodeData.y, nodeData.id);
                }
                if (nodeData.color && nodeData.color !== 'none') {
                    node.classList.add(`highlight-${nodeData.color}`);
                }
            });
        }

        appState.arrows = Array.isArray(data.arrows) ? data.arrows : [];
        dom.setupModal.classList.add('hidden');
        dom.appContainer.classList.remove('hidden');
        loadSettingsUI();
        applyTheme();
        updateProjectUI();
        updateBoardStats();
        updateEmptyState();
        resetBoardView();
        resizeCanvas();
        if (dom.projectsPanel.classList.contains('open')) {
            toggleProjectsPanel();
        }
        setSaveIndicator('saved', `Loaded ${appState.projectName}`);
        dom.notesStatus.textContent = dom.masterNotepad.value ? 'Project notes loaded' : 'Autosaves as you type';
        showToast('Project loaded.', 'success');
    } catch (error) {
        console.error('Error loading project:', error);
        showToast(`Could not load project: ${error.message}`, 'error');
    }
}

function openProjectImport() {
    dom.projectImportInput.value = '';
    dom.projectImportInput.click();
}

async function handleImportedProject(event) {
    const [file] = Array.from(event.target.files || []);
    if (!file) return;
    await loadProjectFromFile(file);
}

function resetBoard() {
    appState.nodes.forEach((node) => node.remove());
    appState.nodes = [];
    appState.arrows = [];
    deselectAll();
}

function startNewProject() {
    if (!window.confirm('Start a new project? The current in-memory workspace will be replaced.')) {
        return;
    }

    resetBoard();
    appState.projectName = 'Untitled Shoot';
    appState.projectType = 'Session plan';
    appState.projectFileName = '';
    appState.currentId = 0;
    dom.masterNotepad.value = '';
    dom.preshootChecklist.value = '';
    dom.setupForm.reset();
    dom.customTypeGroup.classList.add('hidden');
    dom.customTypeInput.required = false;
    dom.appContainer.classList.add('hidden');
    dom.setupModal.classList.remove('hidden');
    updateProjectUI();
    updateBoardStats();
    updateEmptyState();
    resetBoardView();
    if (dom.projectsPanel.classList.contains('open')) {
        toggleProjectsPanel();
    }
    queueSave();
}

function toggleShootTypeDropdown() {
    dom.shootTypeDropdown.classList.toggle('hidden');
    dom.projectTitleWrapper.classList.toggle('open', !dom.shootTypeDropdown.classList.contains('hidden'));
}

function closeShootTypeDropdown() {
    dom.shootTypeDropdown.classList.add('hidden');
    dom.projectTitleWrapper.classList.remove('open');
}

function handleShootTypeSwitch(type) {
    closeShootTypeDropdown();
    let nextName = type;
    let nextType = type;

    if (type === 'Custom') {
        const response = window.prompt('Enter a custom session name:', appState.projectName);
        if (!response || !response.trim()) return;
        nextName = response.trim();
        nextType = 'Custom session';
    }

    appState.projectName = nextName;
    appState.projectType = nextType;
    updateProjectUI();
    queueSave();
    showToast(`Session updated to ${nextName}.`, 'success');
}

function handleKeyDown(event) {
    const activeEl = document.activeElement;
    const isTyping = activeEl && (
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'INPUT' ||
        activeEl.contentEditable === 'true'
    );

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (projectFolderHandle) {
            saveProjectToFile();
        } else {
            saveState();
            showToast('Autosaved locally. Choose a folder to create a project file.', 'success');
        }
        return;
    }

    if (isTyping) return;

    if (event.key.toLowerCase() === 't') {
        event.preventDefault();
        handleAddText();
    }

    if (event.key.toLowerCase() === 'a') {
        event.preventDefault();
        toggleArrowMode();
    }

    if (event.key === 'Escape') {
        event.preventDefault();
        deselectAll();
        setInteractionMode('select');
    }

    if ((event.key === 'Backspace' || event.key === 'Delete') && interactionState.selectedNode) {
        event.preventDefault();
        deleteNode(interactionState.selectedNode);
    }
}

function slugifyProjectName(name) {
    return sanitizeFileStem(name.toLowerCase().trim().replace(/\s+/g, '-'));
}

function sanitizeFileStem(value) {
    return value
        .trim()
        .replace(/\.json$/i, '')
        .replace(/[^a-z0-9_-]+/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^[-_]+|[-_]+$/g, '') || 'untitled-shoot';
}

function getProjectFileStem() {
    const fileStem = sanitizeFileStem(dom.projectFileName.value || appState.projectFileName || appState.projectName);
    appState.projectFileName = fileStem;
    dom.projectFileName.value = fileStem;
    return fileStem;
}

function downloadProjectFile(filename, projectData) {
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function readProjectData(source) {
    if (source.getFile) {
        const file = await source.getFile();
        return JSON.parse(await file.text());
    }

    return JSON.parse(await source.text());
}

init();
