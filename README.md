# Cutline 🎞

> A local-first browser video editor for technically confident editors.

Cutline provides an end-to-end non-destructive editing workflow entirely inside the browser: import local video, arrange and edit on a frame-quantized timeline, preview fragment-shader visual filters in real time, and export the composed result using WebAssembly.

---

## Features

- **Local-First & Private:** Source media files never leave your computer. All processing, timeline edits, preview compositing, and video encoding run locally inside your browser.
- **Frame-Accurate Timeline:** All edit coordinates and operations are calculated as integer frame ticks at the project's frame rate (default 30 fps).
- **Non-Destructive Editing:** Source files are never modified. Split and trim operations adjust virtual in/out points and can be undone or redone.
- **Real-Time WebGL Filters:** Preview filter effects (None, Monochrome, Warm Contrast) and opacity compositing using WebGL fragment shaders.
- **Keyboard-First Controls:**
  - `Space`: Play or Pause
  - `S`: Split active/selected clip at current playhead
  - `Delete` / `Backspace`: Delete selected clip
  - `←` / `→` (Left/Right Arrows): Step exactly 1 frame backward or forward
  - `Cmd/Ctrl + Z`: Undo
  - `Cmd/Ctrl + Shift + Z` / `Ctrl + Y`: Redo
  - `Mouse Wheel`: Zoom timeline horizontally
- **Contextual Inspector:** Revealed only when a clip is selected to adjust opacity, audio volume, mute, and visual filter effects.
- **Offline Recovery & IndexedDB Persistence:** Project metadata automatically persists to IndexedDB. If an asset is not loaded in the current session, clips are clearly marked offline with instructions to re-import without data loss.
- **Client-Side Export:** Renders the resolved timeline through an in-browser FFmpeg WebAssembly pipeline with real-time encoding progress.

---

## Supported Formats & Browser Requirements

- **Supported Formats:** MP4 (H.264/AAC) and WebM (VP8/VP9/Opus).
- **Supported Browsers:** Modern Chromium-based browsers (Chrome, Edge, Brave) and Firefox with WebGL and SharedArrayBuffer support.
- **Local-First Limitation:** Browser object URLs exist only for the open session. Re-opening a saved project requires re-selecting the source files to reconnect media.

---

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Running Tests

```bash
# Unit & Component tests (Vitest)
npm run test

# End-to-end acceptance tests (Playwright)
npm run test:e2e

# TypeScript typechecking
npm run typecheck

# Production build
npm run build
```
