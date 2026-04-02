# StoryFrame — IG Story Photo Customizer

## Overview
A fully client-side React + Vite web app for creating beautiful Instagram Story frames. Supports Polaroid, Film Strip, Rounded, and No Frame styles. Photos never leave the user's device.

## Project Structure
- `index.html` — Entry HTML with Google Fonts (Inter) and meta tags
- `src/main.jsx` — React entry point
- `storyframe.jsx` — Main application component (all UI and logic)
- `vite.config.js` — Vite config with host `0.0.0.0`, port `5000`, `allowedHosts: true`
- `package.json` — npm project with React 18, lucide-react, Vite

## Tech Stack
- **Framework:** React 18
- **Bundler:** Vite 5
- **Icons:** lucide-react
- **Package manager:** npm

## Development
```bash
npm run dev   # Starts dev server on 0.0.0.0:5000
npm run build # Production build to dist/
```

## Deployment
- **Target:** Static site
- **Build command:** `npm run build`
- **Public directory:** `dist`

## Key Features
- Background photo upload with blur & B&W controls
- Main photo upload with frame style selection
- Frame styles: Polaroid, Rounded, Film Strip, No Frame
- Photo size and shadow sliders
- Camera metadata display (device model, focal length, aperture, ISO, exposure)
- 100% client-side — no data leaves the user's device
