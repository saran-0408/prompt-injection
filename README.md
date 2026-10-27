# Sentinel: Prompt Injection Security Demo

A responsive React interface for demonstrating basic prompt-injection phrase matching. The scanner runs entirely in the browser; it is an educational heuristic demo, not a real security product or backend analysis service.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

## Production build

```bash
npm run build
npm run preview
```

## Project files

- `src/App.jsx`: routes, reusable UI, sample data, local demo scanner, and scan history.
- `src/index.css`: responsive dashboard styling, animations, and accessibility preferences.
- `src/main.jsx`: React entry point and router setup.
- `index.html`: document shell and page metadata.
- `vite.config.js`: Vite, React, and Tailwind CSS integration.

Scan history is stored in browser `localStorage`. No prompt is sent to a server.

team:sanjay payaluga