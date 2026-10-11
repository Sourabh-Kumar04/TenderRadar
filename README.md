# 🌿 TrailWhistle

> **Offline-first, on-device Area Biodiversity Survey Tool & Avian Census PWA.**  
> Built for the **Hacktoberfest Open-Source AI Challenge: Week 1** (*Theme: "Touch Grass"*).  
> Zero cloud servers. Zero API keys. Zero cellular data required.

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Built with BirdNET](https://img.shields.io/badge/Model-BirdNET%20v2.4%20(6%2C522%20Species)-emerald.svg)](https://huggingface.co/tphakala/BirdNET-v2.4)
[![PWA Ready](https://img.shields.io/badge/PWA-Offline%20First-green.svg)](https://web.dev/progressive-web-apps/)
[![Deployed on Render](https://img.shields.io/badge/Render-Static%20Service-46e3b7.svg)](https://render.com)

---

## 📖 Overview

TrailWhistle gets people off the screen and into the natural world. In remote wilderness, mountain canyons, and deep forests, cellular reception drops to zero. That's usually where traditional AI applications fail.

TrailWhistle is architected as an **Area Biodiversity Survey Tool** running **100% on-device** using the open-weight **BirdNET v2.4 ONNX** model (6,522 global avian species) compiled to WebAssembly via **ONNX Runtime Web (`onnxruntime-web`)**. 

Rather than isolated single-bird identification, TrailWhistle supports the core ecological field workflow:
1. **Arrive at a location**: Set your survey site (e.g. Pine Ridge Trailhead, Redwood Creek Basin) and habitat transect.
2. **Sample continuously**: Tap once to capture 3 seconds of birdsong across the area as calls sound.
3. **Build live checklist**: Watch the running species checklist tally distinct species, frequency of detection, and peak confidence ratings.
4. **Inspect recording timeline & survey stats**: Track survey duration, detections count, species richness, and hardware GPS coverage.
5. **Export CSV survey**: Single-click export of complete area biodiversity survey reports ready for conservation databases.

---

## ✨ Features

- 🌲 **Area Biodiversity Survey Mode:** Side-by-side field dashboard with active survey site management, live species checklist, and survey stats strip.
- 🎙️ **3-Second Avian Audio Capture:** Tactile, glove-friendly touch button with AudioWorklet processing, real-time volume meter, and countdown timer.
- 🌈 **4-Band Bioacoustic Spectrum:** Live frequency visualizer tracking energy across 4 vocalization bands (0.5-1.5kHz, 1.5-3.0kHz, 3.0-6.0kHz, 6.0kHz+).
- 🧠 **BirdNET v2.4 On-Device Neural Inference:** Powered by open weights (`BirdNET_v2.4_int8_arm.onnx`, ~47MB INT8 quantized) via `onnxruntime-web` in WebAssembly across 6,522 real species.
- 🛡️ **IUCN Conservation Status & Family Taxa:** Live IUCN Red List status pill and avian family badges on every prediction card.
- 🎯 **Honest Acoustic Calibration:** Displays honest Unknown state when confidence is below 25%—zero fake confidence padding or invented species.
- 📊 **Top-3 Species Confidence Bars:** Clear probability ranking with acoustic signature details and habitat bio.
- 📋 **Live Area Species Checklist:** Real-time running checklist tracking species detection counts, peak confidence percentages, and timestamps.
- ⏱️ **Recording History Timeline:** Chronological feed of acoustic captures with confidence indicators and audio sources.
- 📓 **Field Survey Log with Location Grouping (Journal):** Observations grouped by survey site with site-level checklist chips, overview biodiversity metrics, and location-specific CSV exports.
- 🔍 **Backcountry Offline Diagnostics:** Interactive modal verifying PWA offline connectivity, BirdNET ONNX cache (~47MB), species taxonomy cache, WASM SIMD, and storage quota.
- 📍 **Hardware Satellite GPS:** Captures precise latitude, longitude, and accuracy offline without requiring cellular cell-tower triangulation.
- 💾 **RFC 4180 CSV Export & JSON Backup/Restore:** Instant one-click CSV export plus complete offline JSON backup and archive restoration.
- ☀️ **Sunlight Outdoor Mode:** High-contrast monochrome mode built specifically for direct midday sunlight glare.
- 📦 **Installable PWA:** Full Service Worker caching via `vite-plugin-pwa` with 90-day offline cache retention for model weights.
- 🎶 **Pre-Bundled Demo Audio:** Includes built-in 48kHz birdsong clips (American Robin, Song Sparrow, Mourning Dove, Barn Owl) for immediate testing without a live microphone.

---

## 🛠️ Tech Stack

- **Runtime & Bundler:** Vite 8, TypeScript 5.8
- **UI Framework:** React 19, Tailwind CSS 3.4, Lucide React
- **ML Runtime:** `onnxruntime-web` (BirdNET v2.4 INT8 ONNX WebAssembly)
- **Audio Processing:** Web Audio API with `AudioWorkletNode` (and `createScriptProcessor` fallback), 48kHz linear resampling, Float32-to-WAV encoding
- **PWA / Service Worker:** `vite-plugin-pwa` (Workbox `CacheFirst` strategies)
- **Testing:** Vitest 5, `@testing-library/react`, `jsdom`
- **Hosting:** Render (`render.yaml` static web service blueprint)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (tested on Node.js 24)
- npm 9+

### Installation & Development

```bash
# Clone the repository
git clone https://github.com/<your-username>/trailwhistle.git
cd trailwhistle

# Install dependencies
npm install

# Start local development server
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Running Tests

TrailWhistle includes comprehensive automated unit tests covering audio resampling, normalization, WAV generation, journal filtering, CSV escaping, stubbed classifier mapping, and UI components:

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch
```

### Building for Production

```bash
npm run build
```

The production output will be generated in `./dist`, including the application bundle, offline service worker (`sw.js`), and Web Manifest.

To preview the production build locally:
```bash
npm run preview
```

---

## ☁️ Deploying to Render

TrailWhistle is pre-configured for **Render** static site hosting:

1. Connect your repository to Render.
2. Render will automatically detect [`render.yaml`](./render.yaml).
3. The build configuration:
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `./dist`
   - **Headers:** COOP / COEP enabled for optimal WebAssembly execution.

---

## 📝 Challenge Submission

See [`DEVPOST.md`](./DEVPOST.md) for the complete submission post draft, build story, and theme reflections for the **Hacktoberfest Open-Source AI Challenge: Week 1**.

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE).
