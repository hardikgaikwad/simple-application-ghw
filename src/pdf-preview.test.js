import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { parsePdfFile, renderPdfPageThumbnail } from './pdf.js';

const pdfjsMocks = vi.hoisted(() => {
  const page = {
    getViewport: vi.fn(() => ({ width: 120, height: 160 })),
    render: vi.fn(() => ({ promise: Promise.resolve() })),
  };
  const previewDocument = {
    getPage: vi.fn(async () => page),
  };

  return {
    page,
    previewDocument,
    getDocument: vi.fn(() => ({ promise: Promise.resolve(previewDocument) })),
  };
});

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: pdfjsMocks.getDocument,
}));

describe('PDF thumbnail loading', () => {
  beforeEach(() => {
    pdfjsMocks.page.getViewport.mockClear();
    pdfjsMocks.page.render.mockClear();
    pdfjsMocks.previewDocument.getPage.mockClear();
    pdfjsMocks.getDocument.mockClear();

    const context = {};
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        getContext: vi.fn(() => context),
        toDataURL: vi.fn(() => 'data:image/png;base64,preview'),
      })),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads a PDF.js page and renders its thumbnail through getViewport', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const bytes = await pdf.save();
    const file = {
      name: 'sample.pdf',
      type: 'application/pdf',
      lastModified: 1,
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    };

    const parsedPdf = await parsePdfFile(file);
    const thumbnail = await renderPdfPageThumbnail(parsedPdf.previewDocument, 0, 90);

    expect(pdfjsMocks.getDocument).toHaveBeenCalledOnce();
    expect(pdfjsMocks.previewDocument.getPage).toHaveBeenCalledWith(1);
    expect(pdfjsMocks.page.getViewport).toHaveBeenCalledWith({ scale: 0.2, rotation: 90 });
    expect(pdfjsMocks.page.render).toHaveBeenCalledOnce();
    expect(thumbnail).toBe('data:image/png;base64,preview');
  });
});
