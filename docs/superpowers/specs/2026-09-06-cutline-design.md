# Cutline v1 Design

## Product intent

Cutline is a local-first browser video editor for technically confident editors. Its first release proves an end-to-end editing workflow: import local video, arrange and make non-destructive edits on a frame-quantized timeline, preview one visual filter, and export the composed result.

The v1 interface is a progressive hybrid: an uncluttered preview-and-timeline workspace at rest, with detailed controls revealed only for the selected clip. It prioritizes keyboard operation and predictable editing semantics over social-template features.

## Scope

### Included

- Import local MP4 and WebM video assets supported by the current browser.
- Create video and audio tracks, place clips, move them, change clip order, and delete them.
- Trim either edge of a clip, split at the playhead, and snap actions to project frame ticks.
- Use Space to play or pause, S to split, Delete to delete, arrow keys to frame step, Cmd/Ctrl-Z to undo, and mouse wheel to zoom the timeline.
- Inspect a selected clip and change opacity, mute/volume, and its filter: none, monochrome, or warm contrast.
- Preview with browser media elements and a WebGL compositing layer.
- Persist project metadata in IndexedDB and export through a browser FFmpeg/WebAssembly adapter, with visible progress.

### Excluded

- Transitions, titles, text, keyframes, cloud projects, collaboration, proxy media, advanced color grading, and source-codec passthrough.
- Overlapping clips on a single track and multi-layer compositing. The data model permits multiple tracks, but v1 preview/export resolves one active video clip.
- Permanent browser-managed copies or cross-session relinking of source media.

## Workspace

The top bar provides import, project settings, undo/redo, and export. The left rail switches between media and basic tools. The center contains the video preview and transport controls. A contextual inspector appears when a clip is selected; otherwise it stays hidden. The lower third is a horizontally zoomable, multi-track timeline with ruler, playhead, clip blocks, trim handles, and track headers.

The default project rate is 30 fps. A user chooses the frame rate when creating a project; the rate is immutable afterward. All edit coordinates are stored as integer frame ticks, not fractional seconds.

## Architecture

The app is React and TypeScript, divided into independent layers.

### Project model

The serializable project contains `Project`, `Asset`, `Track`, `Clip`, and `ClipEffect` records. An asset describes a local source file and its discovered metadata. A clip refers to an asset and stores `timelineStartFrame`, `sourceInFrame`, `sourceOutFrame`, plus audio and visual properties. Editing a clip never changes source bytes.

### Timeline engine

Pure TypeScript functions own frame conversion, clip lookup, splitting, trim constraints, snapping, overlap validation, selection, viewport calculations, and command-based undo/redo. This layer takes project data and commands as input and returns a new project state. It must not depend on React, DOM APIs, or browser media APIs.

### Preview engine

The preview engine maps the current playhead frame to an active clip. It seeks the referenced HTML video element to the corresponding source time and draws the frame through a WebGL canvas, applying the selected fragment-shader filter. Playback advances the playhead from the project frame rate; scrubbing and arrow stepping seek exactly to the target frame tick. The preview layer reads project state but does not mutate it.

### Export adapter

An `ExportAdapter` interface receives a resolved render sequence, output settings, and progress callback. The v1 adapter uses FFmpeg/WebAssembly in a worker. A later server or native adapter may implement the same interface without changing project records or timeline operations.

## Editing semantics

A source clip has a fixed original duration. A timeline clip exposes an inclusive start and exclusive end interval in both timeline and source frame units. Splitting at frame `f` replaces a clip with two clips: `[timelineStart, f)` and `[f, timelineEnd)`; the right clip source-in advances by `f - timelineStart`. Trimming adjusts only the corresponding interval boundary. A trim cannot invert or empty a clip, exceed the source duration, or overlap another clip on that track.

Drag interactions maintain an ephemeral draft. The project changes only when the pointer is released and validation succeeds; that change becomes a single undoable command. Escape discards the draft. The playhead is also quantized to the project frame grid.

## Data flow

1. Import reads browser-supported file metadata and creates an asset record plus a temporary object URL.
2. Dropping an asset onto a track creates a clip record referring to that asset.
3. Every committed editing action runs through the timeline engine and is appended to command history.
4. A playhead update resolves the active clip, source offset, and effects; the preview engine renders that resolved state.
5. Export resolves the same project timeline into a render sequence and passes it to the adapter. It reports progress but does not modify the project.

## Persistence and recovery

Project metadata autosaves to IndexedDB. Asset object URLs exist only for the open-browser session. When a project is opened without its assets, Cutline marks the affected clips as offline and asks the user to re-import the matching files. It never silently substitutes a source.

Unsupported input, an offline asset, an invalid drop, a clip overlap, and an encoder memory or codec failure display a precise recoverable notice. An export error leaves the project and source media unchanged.

## Verification

Unit tests cover integer frame conversion, active-clip resolution, split behavior, trim bounds, snapping, overlap rejection, and undo/redo. Component tests verify trim dragging, selection/inspector updates, keyboard splitting, and shortcut behavior. Browser integration tests import a small fixture, scrub the preview, set a filter, and complete an export using a mocked encoder. Manual acceptance requires importing a real clip, making two cuts, applying a filter, and downloading a playable export.

## Acceptance criteria

- A user can import a browser-supported local MP4 or WebM and place it on a timeline track.
- Trims and splits remain non-destructive and undoable; their boundaries remain aligned to the selected frame rate.
- Scrubbing and single-frame stepping update both timecode and preview to the resolved timeline frame.
- Selecting a clip exposes its opacity, audio, and filter controls; filter changes appear in preview without altering the original media.
- A valid project exports with progress and yields a playable MP4 or WebM; an unsupported export fails with a recoverable explanation.
