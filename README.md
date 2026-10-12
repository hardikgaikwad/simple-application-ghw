# PAPER CUT

PAPER CUT is a lightweight, browser-only PDF page editor built with Vite, vanilla JavaScript, pdf-lib, and pdf.js. It lets you upload one or more PDFs, merge them into a single working document, reorder pages, rotate individual pages, delete pages, and export the edited result as a fresh PDF without any server upload.

## Privacy model

This application is intentionally privacy-first:

- PDF parsing, thumbnail rendering, editing, and export happen entirely in the browser.
- No PDF bytes are sent to a backend server or persisted in a database.
- No auth, analytics, telemetry, or cloud storage is used.
- Document state exists only in memory while the page is open.

## Stack

- Vite
- Vanilla JavaScript ES modules
- HTML/CSS
- pdf-lib for PDF assembly and export
- pdf.js for page rendering and thumbnails

## Features

- Merge multiple PDFs in a single document
- Drag-and-drop reordering
- Up/down move buttons for accessibility
- Delete individual pages
- Rotate pages in 90-degree increments
- Undo/redo for structural edits
- Download final PDF with current order and rotations
- Empty-state and reset workflow

## Known limitations

- PDF processing is limited to browser memory and the capabilities of pdf-lib/pdf.js.
- Password-protected or corrupted PDFs may fail gracefully with a status message.
- Large documents may take longer to render previews.

## Install and run locally

```bash
npm install
npm run dev -- --host 0.0.0.0
```

Then open the local Vite URL shown in the terminal, typically http://localhost:5173/.

## Build for production

```bash
npm run build
```

The production bundle is generated in the `dist/` folder.

## Run tests

```bash
npm test
```

## GitHub Codespaces

In a Codespace, run:

```bash
npm install
npm run dev -- --host 0.0.0.0
```

Then use the forwarded port 5173 in the browser preview or the VS Code ports panel.
