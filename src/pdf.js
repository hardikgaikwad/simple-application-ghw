import { PDFDocument } from 'pdf-lib';

const PDF_MIME = 'application/pdf';
let pdfjsModulePromise;

async function getPdfJs() {
  pdfjsModulePromise ||= import('pdfjs-dist').then((pdfjsLib) => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
    return pdfjsLib;
  });

  return pdfjsModulePromise;
}

function isPdfFile(file) {
  return file && file.type === PDF_MIME
    ? true
    : file && typeof file.name === 'string' && file.name.toLowerCase().endsWith('.pdf');
}

export async function parsePdfFile(file) {
  if (!isPdfFile(file)) {
    throw new Error('Only PDF files are supported.');
  }

  const bytes = await file.arrayBuffer();
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const pdfjsLib = await getPdfJs();
  const previewDocument = await pdfjsLib.getDocument({
    data: new Uint8Array(bytes.slice(0)),
  }).promise;

  return {
    id: `${file.name}-${file.lastModified || Date.now()}-${Math.random().toString(16).slice(2)}`,
    fileName: file.name,
    bytes,
    pdf,
    previewDocument,
    pageCount: pdf.getPageCount(),
  };
}

export async function readPdfFiles(files) {
  const results = [];

  for (const file of files) {
    if (!isPdfFile(file)) {
      throw new Error(`Unsupported file: ${file ? file.name : 'unknown'}`);
    }

    results.push(await parsePdfFile(file));
  }

  return results;
}

export function createPageRecord({ sourcePdfId, sourcePageIndex, rotation = 0, id }) {
  return {
    id,
    sourcePdfId,
    sourcePageIndex,
    rotation,
  };
}

export function rotateDegreesToPdfLibRotation(rotationDegrees) {
  const normalized = ((rotationDegrees % 360) + 360) % 360;
  return (normalized / 90) % 4;
}

export async function exportPdfDocument(pageRecords, sourcePdfs) {
  const pdfDoc = await PDFDocument.create();
  const pdfMap = new Map(sourcePdfs.map((pdf) => [pdf.id, pdf.pdf]));

  for (const pageRecord of pageRecords) {
    const sourcePdf = pdfMap.get(pageRecord.sourcePdfId);
    if (!sourcePdf) {
      throw new Error(`Missing source PDF for page ${pageRecord.id}`);
    }

    const [copiedPage] = await pdfDoc.copyPages(sourcePdf, [pageRecord.sourcePageIndex]);
    const currentRotation = copiedPage.getRotation().angle || 0;
    const totalRotation = (currentRotation + pageRecord.rotation) % 360;
    copiedPage.setRotation(degrees(totalRotation));
    pdfDoc.addPage(copiedPage);
  }

  return await pdfDoc.save();
}

function degrees(number) {
  return { type: 'degrees', angle: number };
}

export async function renderThumbnail(page, rotation = 0, scale = 0.2) {
  const viewport = page.getViewport({ scale, rotation: rotation % 360 });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: context, viewport }).promise;
  return canvas.toDataURL('image/png');
}

export async function renderPdfPageThumbnail(previewDocument, zeroBasedPageIndex, rotation = 0, scale = 0.2) {
  const page = await previewDocument.getPage(zeroBasedPageIndex + 1);
  return renderThumbnail(page, rotation, scale);
}

export function revokeObjectUrl(url) {
  if (url) {
    URL.revokeObjectURL(url);
  }
}

export function objectUrlFromBlob(blob) {
  return URL.createObjectURL(blob);
}
