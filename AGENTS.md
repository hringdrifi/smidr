# AI Agent Guidelines for Smiðr

This document provides essential context and rules for AI agents working on the Smiðr project.

## Tech Stack & Architecture
- **Framework**: React 19 (SPA) powered by **Vite**.
- **State Management**: Zustand with `zundo` for history.
- **Styling**: Tailwind CSS v4.
- **Canvas**: `react-konva`.

## Key Development Rules
- **Source of Truth**: Always follow [SPECIFICATION.md](./SPECIFICATION.md) for technical logic and [GEMINI.md](./GEMINI.md) for development procedures.
- **Markdown Encoding**: Markdown files are saved as UTF-8. When reading them from PowerShell, use `Get-Content -Encoding UTF8 -LiteralPath <file>` to avoid mojibake.
- **State Updates**: Use the 'Preview Pattern' (`previewKeys`) for high-frequency interactions to optimize history performance.
- **User Approval**: Always explain your planned changes and obtain user approval BEFORE modifying any files.
- **Keyboard Shortcuts**: Centralize global shortcuts in `src/components/KeyboardCanvas.tsx`.
