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
const btnAi = document.getElementById('btn-ai');

// Settings Elements
const settingsPanel = document.getElementById('settings-panel');
const btnSettings = document.getElementById('btn-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const aiProviderSelect = document.getElementById('ai-provider');
const chatgptKeyInput = document.getElementById('chatgpt-key');
const geminiKeyInput = document.getElementById('gemini-key');

// AI Elements
const aiPanel = document.getElementById('ai-panel');
const btnCloseAi = document.getElementById('btn-close-ai');
const aiMessagesContainer = document.getElementById('ai-messages');
const aiInput = document.getElementById('ai-input');
const btnSendAi = document.getElementById('btn-send-ai');

const arrowCanvas = document.getElementById('arrow-layer');
const arrowCtx = arrowCanvas.getContext('2d');

// State
let appState = {
    projectName: 'Untitled Shoot',
    nodes: [],      // Array of dom elements
    arrows: [],     // Array of {fromId, toId}
    currentId: 0,
    settings: {
        aiProvider: 'chatgpt',
        chatgptKey: '',
        geminiKey: ''
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
function init() {
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

    // Settings
    btnSettings.addEventListener('click', toggleSettingsPanel);
    btnCloseSettings.addEventListener('click', toggleSettingsPanel);
    btnSaveSettings.addEventListener('click', handleSaveSettings);

    // AI
    btnAi.addEventListener('click', toggleAiPanel);
    btnCloseAi.addEventListener('click', toggleAiPanel);
    btnSendAi.addEventListener('click', handleSendAiMessage);
    aiInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendAiMessage();
        }
    });

    // Workspace events
    workspace.addEventListener('mousedown', handleWorkspaceMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Load from local storage if exists
    loadState();

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

function createImageNode(src, x, y) {
    const id = generateId();
    const el = createNodeWrapper(id, x, y, 'image');

    const img = document.createElement('img');
    img.src = src;
    el.appendChild(img);
}

function createTextElement(content, x, y) {
    const id = generateId();
    const el = createNodeWrapper(id, x, y, 'text');

    const textDiv = document.createElement('div');
    textDiv.className = 'node-text-content';
    textDiv.dataset.id = id;
    textDiv.contentEditable = true;
    textDiv.textContent = content;

    textDiv.addEventListener('mousedown', (e) => {
        // Prevent drag if editing text
        if (document.activeElement === textDiv) {
            e.stopPropagation();
        }
    });

    textDiv.addEventListener('input', saveStateDebounced);

    el.appendChild(textDiv);
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

let saveTimeout = null;
function saveStateDebounced() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveState, 1000);
}

function saveState() {
    // For a real app, serialize DOM cleanly. 
    // Here we will just save the project name and notes text
    // as full DOM serialization of image b64 can exceed localstorage limits fast.

    const notesData = {};
    document.querySelectorAll('.rich-textarea').forEach((ta, idx) => {
        notesData[idx] = ta.value;
    });

    localStorage.setItem('photoshoot_planner_state', JSON.stringify({
        projectName: appState.projectName,
        notes: notesData,
        settings: appState.settings
    }));
    console.log('State saved passively.');
}

function loadState() {
    const saved = localStorage.getItem('photoshoot_planner_state');
    if (saved) {
        try {
            const data = JSON.parse(saved);

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

        } catch (e) {
            console.error('Failed to load state', e);
        }
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
    appState.settings.aiProvider = aiProviderSelect.value;
    appState.settings.chatgptKey = chatgptKeyInput.value.trim();
    appState.settings.geminiKey = geminiKeyInput.value.trim();

    saveState();
    toggleSettingsPanel();
}

function loadSettingsUI() {
    if (appState.settings) {
        aiProviderSelect.value = appState.settings.aiProvider || 'chatgpt';
        chatgptKeyInput.value = appState.settings.chatgptKey || '';
        geminiKeyInput.value = appState.settings.geminiKey || '';
    }
}

// --- AI ASSISTANT --- //
function toggleAiPanel() {
    if (aiPanel.classList.contains('hidden')) {
        aiPanel.classList.remove('hidden');
        setTimeout(() => {
            aiPanel.classList.add('open');
            aiInput.focus();
        }, 10);
    } else {
        aiPanel.classList.remove('open');
        setTimeout(() => {
            aiPanel.classList.add('hidden');
        }, 400);
    }
}

function getShootContext() {
    // Gather all text from the notes to serve as context
    let contextStr = `Role: You are an expert photoshoot planning assistant.\n`;
    contextStr += `Project Name: ${appState.projectName}\n\n`;
    contextStr += `Photographer's Current Notes:\n`;

    document.querySelectorAll('.rich-textarea').forEach(ta => {
        if (ta.value.trim().length > 0) {
            contextStr += `---\n${ta.value}\n---\n`;
        }
    });
    return contextStr;
}

function appendAiMessage(text, isUser = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    // Basic text formatting (could add a simple markdown parser here later if desired)
    contentDiv.innerText = text;

    msgDiv.appendChild(contentDiv);
    aiMessagesContainer.appendChild(msgDiv);

    // Scroll to bottom
    aiMessagesContainer.scrollTop = aiMessagesContainer.scrollHeight;
}

function showLoadingIndicator() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message ai-message loading-indicator';
    loadingDiv.id = 'ai-loading';
    loadingDiv.innerHTML = `
        <div class="message-content">
            <div class="typing-indicator"><span></span><span></span><span></span></div>
        </div>
    `;
    aiMessagesContainer.appendChild(loadingDiv);
    aiMessagesContainer.scrollTop = aiMessagesContainer.scrollHeight;
}

function hideLoadingIndicator() {
    const loader = document.getElementById('ai-loading');
    if (loader) loader.remove();
}

async function handleSendAiMessage() {
    const text = aiInput.value.trim();
    if (!text) return;

    const provider = appState.settings.aiProvider;
    const apiKey = provider === 'chatgpt' ? appState.settings.chatgptKey : appState.settings.geminiKey;

    if (!apiKey) {
        alert(`Please open settings and enter your API Key for ${provider === 'chatgpt' ? 'ChatGPT' : 'Gemini'}.`);
        return;
    }

    aiInput.value = '';
    appendAiMessage(text, true);
    showLoadingIndicator();

    const systemContext = getShootContext();

    try {
        let responseText = '';

        if (provider === 'chatgpt') {
            responseText = await callOpenAI(apiKey, systemContext, text);
        } else {
            responseText = await callGemini(apiKey, systemContext, text);
        }

        hideLoadingIndicator();
        appendAiMessage(responseText, false);

    } catch (error) {
        hideLoadingIndicator();
        console.error("AI Error:", error);
        appendAiMessage(`Error connecting to AI: ${error.message}. Please check your API key and connection.`);
    }
}

// Minimal OpenAI / Gemini Fetch implementations
async function callOpenAI(apiKey, systemContext, userPrompt) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: systemContext },
                { role: "user", content: userPrompt }
            ]
        })
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || res.statusText);
    }

    const data = await res.json();
    return data.choices[0].message.content;
}

async function callGemini(apiKey, systemContext, userPrompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    // Note: Gemini doesn't have a strict "system" role in the basic generateContent API format we easily use with fetch, 
    // so we combine it into the user prompt or use the system_instruction field (newer).
    // Let's combine them into a single string for simplicity here.
    const combinedPrompt = `${systemContext}\n\nUser Question:\n${userPrompt}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: combinedPrompt }]
            }]
        })
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || res.statusText);
    }

    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
}

// Start
init();
