# Image2Minecraft

Turn any image into a **Minecraft-style render** in one click. Upload an image, let the app automatically compress and detect the closest aspect ratio, then generate a high-fidelity block-world version with Gemini image generation.

---

## Features

- **Drag-and-drop upload**: Upload a single image via drag-and-drop or file picker.
- **Automatic compression**: Client-side resizing/compression helps reduce request payload size.
- **Aspect ratio matching**: The app picks the closest supported generation ratio based on source dimensions.
- **Local API key management**: Gemini API key is stored in browser `localStorage`, and can be updated/cleared anytime.
- **Friendly error handling**: Common issues (large image, invalid API key) are shown with readable messages.
- **Download output**: Save the generated Minecraft-style image with one click.

---

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite 6
- **Styling & UI**: Tailwind CSS 4, Lucide React, Motion
- **AI SDK**: `@google/genai`
- **File handling**: `react-dropzone`

---

## Requirements

- Node.js 18+
- npm 9+
- A Gemini API key (from Google AI Studio)

---

## Quick Start

### 1) Install dependencies

```bash
npm install
```

### 2) Start development server

```bash
npm run dev
```

Default host/port: `http://0.0.0.0:3000`.

### 3) Configure API key in the app

1. Open the app and click **SET API KEY** in the top-right corner.
2. Paste your Gemini API key and save it.
3. Upload an image and generate the result.

> Current implementation reads the key from browser local storage and does not require `.env.local`.

---

## Available Scripts

```bash
npm run dev      # Start Vite dev server
npm run build    # Build for production (output: dist)
npm run preview  # Preview production build locally
npm run lint     # Type check (tsc --noEmit)
npm run clean    # Remove dist directory
```

---

## Recommended Usage Flow

1. Use a clear source image with a well-defined subject.
2. If you hit size-related errors, crop/resize locally and retry.
3. If key validation fails, re-enter a valid Gemini API key.
4. Re-run generation for stylistic variations.

---

## FAQ

### Why do I get a “413 / Too Large” error?

Very large files can exceed request limits. The app already compresses images, but extremely large images may still fail. Resize and retry.

### Is my API key sent to your backend?

This project currently calls Gemini directly from the frontend and stores the key in browser `localStorage`. Use only on trusted devices/environments.

### Why does image quality vary between runs?

Image generation is probabilistic. Results can vary by input content, selected ratio, and model/runtime conditions.

---

## Project Structure

```text
.
├── src/
│   ├── App.tsx        # Main UI and core logic
│   ├── index.css      # Global styles
│   ├── main.tsx       # App entry point
│   └── lib/utils.ts   # Utility helpers
├── index.html
├── package.json
└── vite.config.ts
```

---

## Deployment

This is a standard Vite frontend app and can be deployed to Vercel, Netlify, Cloudflare Pages, or any static hosting provider.

Before deployment:

- Run `npm run build` to verify production build passes.
- For enterprise/internal usage, review security strategy for frontend API access (proxying, rate limits, key management).

---

## Disclaimer

This project is intended for learning and creative use. Make sure you have legal rights to any uploaded image and comply with Gemini API terms and applicable laws/regulations.
