import './style.css';
import {
  readPdfFiles,
  createPageRecord,
  exportPdfDocument,
  renderPdfPageThumbnail,
  objectUrlFromBlob,
  revokeObjectUrl,
} from './pdf.js';
import {
  createInitialState,
  pushHistory,
  undo,
  redo,
  addPages,
  removePageAt,
  movePage,
  rotatePage,
  resetDocument,
} from './state.js';

const appState = createInitialState();
const elements = {
  emptyState: document.getElementById('emptyState'),
  editorState: document.getElementById('editorState'),
  pageGrid: document.getElementById('pageGrid'),
  fileInput: document.getElementById('fileInput'),
  addPdfBtn: document.getElementById('addPdfBtn'),
  addMorePdfBtn: document.getElementById('addMorePdfBtn'),
  undoBtn: document.getElementById('undoBtn'),
  redoBtn: document.getElementById('redoBtn'),
  resetBtn: document.getElementById('resetBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  downloadToolbarBtn: document.getElementById('downloadToolbarBtn'),
  pageCount: document.getElementById('pageCount'),
  statusBanner: document.getElementById('statusBanner'),
};

function setStatus(message, visible = true) {
  elements.statusBanner.textContent = message || '';
  elements.statusBanner.classList.toggle('visible', visible && !!message);
}

function getNextPageId() {
  return `page-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function refreshButtons() {
  const hasPages = appState.pages.length > 0;
  elements.undoBtn.disabled = appState.history.length === 0;
  elements.redoBtn.disabled = appState.future.length === 0;
  elements.downloadBtn.disabled = !hasPages;
  elements.downloadToolbarBtn.disabled = !hasPages;
  elements.pageCount.textContent = `${appState.pages.length} page${appState.pages.length === 1 ? '' : 's'}`;
}

function showEditor() {
  elements.emptyState.classList.add('hidden');
  elements.editorState.classList.remove('hidden');
}

function showEmptyState() {
  elements.emptyState.classList.remove('hidden');
  elements.editorState.classList.add('hidden');
}

function triggerPdfPicker() {
  elements.fileInput.value = '';
  elements.fileInput.click();
}

function buildPageCards() {
  elements.pageGrid.innerHTML = '';

  if (!appState.pages.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-workspace';
    empty.innerHTML = '<p>Nothing to cut yet</p><button class="tool-button" type="button" data-empty-add>ADD PDF</button>';
    empty.querySelector('[data-empty-add]').addEventListener('click', () => triggerPdfPicker());
    elements.pageGrid.appendChild(empty);
    refreshButtons();
    return;
  }

  appState.pages.forEach((page, index) => {
    const card = document.createElement('article');
    card.className = 'page-card';
    const sourcePdf = appState.sourcePdfs.find((pdf) => pdf.id === page.sourcePdfId);
    const previewUrl = sourcePdf?.previewUrls?.[page.sourcePageIndex] || '';

    const img = document.createElement('img');
    img.className = 'page-preview';
    img.alt = `Page ${index + 1} preview`;
    img.src = previewUrl;

    if (sourcePdf?.previewDocument && page.rotation !== 0) {
      renderPdfPageThumbnail(sourcePdf.previewDocument, page.sourcePageIndex, page.rotation, 0.2).then((rotatedUrl) => {
        img.src = rotatedUrl;
      });
    }

    const meta = document.createElement('div');
    meta.className = 'page-meta';
    meta.innerHTML = `<span class="page-index">${index + 1}</span><span>${sourcePdf?.fileName || 'PDF'}</span>`;

    const actions = document.createElement('div');
    actions.className = 'page-actions';

    const moveUpButton = document.createElement('button');
    moveUpButton.type = 'button';
    moveUpButton.className = 'icon-button';
    moveUpButton.title = 'Move page up';
    moveUpButton.textContent = '↑';
    moveUpButton.disabled = index === 0;
    moveUpButton.addEventListener('click', (event) => {
      event.stopPropagation();
      if (index > 0) reorderPage(index, index - 1);
    });

    const moveDownButton = document.createElement('button');
    moveDownButton.type = 'button';
    moveDownButton.className = 'icon-button';
    moveDownButton.title = 'Move page down';
    moveDownButton.textContent = '↓';
    moveDownButton.disabled = index === appState.pages.length - 1;
    moveDownButton.addEventListener('click', (event) => {
      event.stopPropagation();
      if (index < appState.pages.length - 1) reorderPage(index, index + 1);
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'icon-button';
    deleteButton.title = 'Delete page';
    deleteButton.textContent = '✕';
    deleteButton.addEventListener('click', (event) => {
      event.stopPropagation();
      deletePage(index);
    });

    const rotateButton = document.createElement('button');
    rotateButton.type = 'button';
    rotateButton.className = 'icon-button';
    rotateButton.title = 'Rotate page';
    rotateButton.textContent = '⟳';
    rotateButton.addEventListener('click', (event) => {
      event.stopPropagation();
      rotatePageBy(index, 90);
    });

    actions.append(moveUpButton, moveDownButton, deleteButton, rotateButton);
    card.append(img, meta, actions);

    card.draggable = true;
    card.addEventListener('dragstart', (event) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    });
    card.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    });
    card.addEventListener('drop', (event) => {
      event.preventDefault();
      const fromIndex = Number(event.dataTransfer.getData('text/plain'));
      reorderPage(fromIndex, index);
    });

    card.addEventListener('click', () => {
      card.classList.toggle('selected');
    });

    elements.pageGrid.appendChild(card);
  });

  refreshButtons();
}

async function loadAndAppendPdfFiles(files, shouldReset = false) {
  const list = [...files].filter(Boolean);
  if (!list.length) return;

  setStatus('Loading pages…');

  try {
    const parsed = await readPdfFiles(list);
    if (shouldReset) {
      appState.pages = [];
      appState.sourcePdfs = [];
      appState.history = [];
      appState.future = [];
    }

    const addedPages = [];

    for (const pdf of parsed) {
      const sourcePdfRecord = {
        ...pdf,
        previewUrls: [],
      };
      appState.sourcePdfs.push(sourcePdfRecord);

      for (let pageIndex = 0; pageIndex < pdf.pageCount; pageIndex += 1) {
        sourcePdfRecord.previewUrls[pageIndex] = await renderPdfPageThumbnail(pdf.previewDocument, pageIndex, 0, 0.2);

        addedPages.push(createPageRecord({
          sourcePdfId: pdf.id,
          sourcePageIndex: pageIndex,
          rotation: 0,
          id: getNextPageId(),
        }));
      }
    }

    if (!shouldReset) {
      addPages(appState, addedPages);
    } else {
      appState.pages = addedPages;
      showEditor();
    }

    if (appState.pages.length > 0) {
      showEditor();
    }

    pushHistory(appState);
    buildPageCards();
    setStatus(`${appState.pages.length} page${appState.pages.length === 1 ? '' : 's'} ready`);
  } catch (error) {
    console.error(error);
    setStatus(error?.message || 'Could not load PDF');
  }
}

function deletePage(index) {
  if (index < 0 || index >= appState.pages.length) return;
  pushHistory(appState);
  removePageAt(appState, index);
  buildPageCards();
  setStatus('Page deleted');

  if (!appState.pages.length) {
    showEmptyState();
  }
}

function rotatePageBy(index, angle) {
  if (index < 0 || index >= appState.pages.length) return;
  pushHistory(appState);
  rotatePage(appState, index, angle);
  buildPageCards();
  setStatus(`Page ${index + 1} rotated`);
}

function reorderPage(fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
  if (fromIndex >= appState.pages.length || toIndex >= appState.pages.length) return;
  pushHistory(appState);
  movePage(appState, fromIndex, toIndex);
  buildPageCards();
  setStatus('Page order updated');
}

function handleReset() {
  const confirmed = window.confirm('Reset the document and clear all pages?');
  if (!confirmed) return;

  pushHistory(appState);
  resetDocument(appState);
  buildPageCards();
  showEmptyState();
  setStatus('Document reset');
}

async function exportDocument() {
  if (!appState.pages.length) {
    setStatus('No pages to download');
    return;
  }

  try {
    const bytes = await exportPdfDocument(appState.pages, appState.sourcePdfs);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const fileUrl = objectUrlFromBlob(blob);
    const anchor = document.createElement('a');
    anchor.href = fileUrl;
    anchor.download = 'paper-cut-edited.pdf';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    revokeObjectUrl(fileUrl);
    setStatus('PDF downloaded');
  } catch (error) {
    console.error(error);
    setStatus(error?.message || 'Export failed');
  }
}

async function handleFileInput(event) {
  const files = event.target.files;
  if (!files || !files.length) return;

  const isInitialLoad = appState.pages.length === 0 && appState.sourcePdfs.length === 0;
  await loadAndAppendPdfFiles(files, isInitialLoad);
  event.target.value = '';
}

function attachControls() {
  elements.fileInput.addEventListener('change', handleFileInput);
  elements.addPdfBtn.addEventListener('click', triggerPdfPicker);
  elements.addMorePdfBtn.addEventListener('click', triggerPdfPicker);
  elements.downloadBtn.addEventListener('click', exportDocument);
  elements.downloadToolbarBtn.addEventListener('click', exportDocument);

  elements.undoBtn.addEventListener('click', () => {
    if (undo(appState)) {
      buildPageCards();
      refreshButtons();
      setStatus('Undid last edit');
    } else {
      setStatus('Nothing to undo');
    }
  });

  elements.redoBtn.addEventListener('click', () => {
    if (redo(appState)) {
      buildPageCards();
      refreshButtons();
      setStatus('Redid last edit');
    } else {
      setStatus('Nothing to redo');
    }
  });

  elements.resetBtn.addEventListener('click', handleReset);

  elements.emptyState.addEventListener('dragover', (event) => {
    event.preventDefault();
    elements.emptyState.classList.add('drag-over');
  });

  elements.emptyState.addEventListener('dragleave', () => {
    elements.emptyState.classList.remove('drag-over');
  });

  elements.emptyState.addEventListener('drop', (event) => {
    event.preventDefault();
    const files = [...event.dataTransfer.files];
    if (files.length) {
      const isInitialLoad = appState.pages.length === 0 && appState.sourcePdfs.length === 0;
      loadAndAppendPdfFiles(files, isInitialLoad);
    }
  });

  elements.editorState.addEventListener('dragover', (event) => {
    event.preventDefault();
  });
}

function initialize() {
  refreshButtons();
  attachControls();
  buildPageCards();
  setStatus('Ready for PDFs');
}

initialize();

window.PAPER_CUT = {
  state: appState,
  exportDocument,
  addPdf: (files) => loadAndAppendPdfFiles(files, appState.pages.length === 0 && appState.sourcePdfs.length === 0),
};
