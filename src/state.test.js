import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { createPageRecord, exportPdfDocument } from './pdf.js';
import {
  addPages,
  createInitialState,
  movePage,
  pushHistory,
  redo,
  removePageAt,
  rotatePage,
  undo,
} from './state.js';

describe('editor state operations', () => {
  it('keeps page order and rotation in sync', () => {
    const state = createInitialState();
    const pageA = createPageRecord({ sourcePdfId: 'a', sourcePageIndex: 0, rotation: 0, id: 'a1' });
    const pageB = createPageRecord({ sourcePdfId: 'a', sourcePageIndex: 1, rotation: 0, id: 'a2' });
    const pageC = createPageRecord({ sourcePdfId: 'b', sourcePageIndex: 0, rotation: 0, id: 'b1' });

    addPages(state, [pageA, pageB, pageC]);
    movePage(state, 0, 1);
    expect(state.pages.map((page) => page.id)).toEqual(['a2', 'a1', 'b1']);

    rotatePage(state, 0, 90);
    expect(state.pages[0].rotation).toBe(90);

    removePageAt(state, 1);
    expect(state.pages.map((page) => page.id)).toEqual(['a2', 'b1']);
  });

  it('undos and redoes structural edits with stable page IDs', () => {
    const state = createInitialState();
    const pageA = createPageRecord({ sourcePdfId: 'pdf-1', sourcePageIndex: 0, rotation: 0, id: 'page-1' });
    const pageB = createPageRecord({ sourcePdfId: 'pdf-1', sourcePageIndex: 1, rotation: 0, id: 'page-2' });

    addPages(state, [pageA, pageB]);
    pushHistory(state);
    movePage(state, 0, 1);
    rotatePage(state, 1, 180);

    expect(state.pages.map((page) => page.id)).toEqual(['page-2', 'page-1']);
    expect(state.pages[1].rotation).toBe(180);

    undo(state);
    expect(state.pages.map((page) => page.id)).toEqual(['page-1', 'page-2']);
    expect(state.pages[1].rotation).toBe(0);

    redo(state);
    expect(state.pages.map((page) => page.id)).toEqual(['page-2', 'page-1']);
    expect(state.pages[1].rotation).toBe(180);
  });
});

describe('pdf export assembly', () => {
  it('exports pages in order and preserves requested rotation', async () => {
    const sourcePdf = await PDFDocument.create();
    sourcePdf.addPage();
    sourcePdf.addPage();
    sourcePdf.addPage();

    const sourcePdfs = [{
      id: 'source-1',
      pdf: sourcePdf,
      fileName: 'sample.pdf',
      previewUrls: [],
    }];

    const pages = [
      createPageRecord({ sourcePdfId: 'source-1', sourcePageIndex: 2, rotation: 90, id: 'page-3' }),
      createPageRecord({ sourcePdfId: 'source-1', sourcePageIndex: 0, rotation: 0, id: 'page-1' }),
    ];

    const bytes = await exportPdfDocument(pages, sourcePdfs);
    const exportedPdf = await PDFDocument.load(bytes);

    expect(exportedPdf.getPageCount()).toBe(2);
    expect(exportedPdf.getPage(0).getRotation().angle).toBe(90);
    expect(exportedPdf.getPage(1).getRotation().angle).toBe(0);
  });
});
