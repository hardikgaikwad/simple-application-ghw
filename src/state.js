export function createInitialState() {
  return {
    pages: [],
    sourcePdfs: [],
    history: [],
    future: [],
  };
}

export function snapshotState(state) {
  return {
    pages: state.pages.map((page) => ({ ...page })),
    sourcePdfs: state.sourcePdfs.map((pdf) => ({
      ...pdf,
      previewUrls: [...(pdf.previewUrls || [])],
      pdf: pdf.pdf,
    })),
  };
}

export function applySnapshot(state, snapshot) {
  state.pages = (snapshot?.pages || []).map((page) => ({ ...page }));
  state.sourcePdfs = (snapshot?.sourcePdfs || []).map((pdf) => ({ ...pdf, previewUrls: [...(pdf.previewUrls || [])] }));
}

export function pushHistory(state) {
  state.history.push(snapshotState(state));
  if (state.history.length > 40) {
    state.history.shift();
  }
  state.future = [];
}

export function undo(state) {
  if (!state.history.length) return false;
  const previous = state.history.pop();
  state.future.push(snapshotState(state));
  applySnapshot(state, previous);
  return true;
}

export function redo(state) {
  if (!state.future.length) return false;
  const next = state.future.pop();
  state.history.push(snapshotState(state));
  applySnapshot(state, next);
  return true;
}

export function movePageBy(state, index, delta) {
  const targetIndex = index + delta;
  return movePage(state, index, targetIndex);
}

export function addPages(state, newPages) {
  if (!newPages.length) return;
  state.pages.push(...newPages);
}

export function removePageAt(state, index) {
  if (index < 0 || index >= state.pages.length) return false;
  state.pages.splice(index, 1);
  return true;
}

export function movePage(state, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return false;
  if (fromIndex >= state.pages.length || toIndex >= state.pages.length) return false;
  const [page] = state.pages.splice(fromIndex, 1);
  state.pages.splice(toIndex, 0, page);
  return true;
}

export function rotatePage(state, index, delta) {
  if (index < 0 || index >= state.pages.length) return false;
  state.pages[index].rotation = (state.pages[index].rotation + delta + 360) % 360;
  return true;
}

export function resetDocument(state) {
  state.pages = [];
  state.sourcePdfs = [];
  state.history = [];
  state.future = [];
}
