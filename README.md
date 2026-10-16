# Pixel Editor

A full-featured **pixel art editor** built directly into VS Code — edit ICO, CUR, GIF, PNG, and WebP files without leaving your editor.

## Features

- 🎨 **Full pixel editor** — draw, erase, fill, pick colors, zoom in/out
- 🖼️ **ICO & CUR support** — open and save Windows icon and cursor files with multiple sizes (16, 32, 48, 256 px)
- 🎞️ **GIF animation** — create and edit animated GIFs frame by frame with preview playback
- 📐 **PNG & WebP** — edit raster images at pixel level
- 🔲 **Transparency** — full alpha channel support with checkerboard preview
- 📏 **Zoom** — zoom from 1× up to 32× for precise pixel editing
- 🎯 **Custom canvas** — create new files at any size
- 🔄 **Undo / Redo** — full history support
- 🌓 **Dark theme** — designed to fit VS Code's dark UI

## Usage

1. Open any `.ico`, `.cur`, `.gif`, `.png`, or `.webp` file in VS Code
2. The Pixel Editor opens automatically as the default editor
3. Use the toolbar to select tools (pencil, eraser, fill, eyedropper…)
4. Save with **Ctrl+S** — your file is updated directly

### Create a new file

Use the command palette (`Ctrl+Shift+P`) and run:
```
Pixel Editor: New File
```

## Supported Formats

| Format | Read | Write | Animation |
|--------|------|-------|-----------|
| ICO    | ✅   | ✅    | —         |
| CUR    | ✅   | ✅    | —         |
| GIF    | ✅   | ✅    | ✅        |
| PNG    | ✅   | ✅    | —         |
| WebP   | ✅   | ✅    | —         |

## Requirements

- VS Code **1.74.0** or later

## Release Notes

### 2.0.1
- TypeScript rewrite for improved stability and performance
- Full GIF animation support
- Improved ICO multi-size handling

---

Made with ❤️ by [Ferran Eloi](https://github.com/ferraneloi)
