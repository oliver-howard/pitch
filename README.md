# Pitch

A minimal guitar tuner for the web, inspired by iOS design.

## Features

- Standard tuning (EADGBE) with auto-detection — just play a string
- Animated accuracy ring that fills as you approach the target note
- Live oscilloscope waveform drawn from the microphone signal
- Smooth needle meter showing cents deviation (flat/sharp)
- All UI elements turn green when in tune (within ±2.5 cents)

## Tech

- [React](https://react.dev) + [Vite](https://vite.dev)
- [Pitchy](https://github.com/ianprime0509/pitchy) for pitch detection (McLeod pitch method)
- Web Audio API for microphone access and signal analysis
- EMA smoothing + clarity threshold filtering to reduce jitter

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:5173, click **Tune**, and allow microphone access.

## How it works

The app captures microphone input via the Web Audio API and runs Pitchy's pitch detector on each animation frame. Detected frequencies are matched to the six standard tuning strings (E2 A2 D3 G3 B3 E4) by finding the closest frequency in cents. An exponential moving average (α = 0.25) smooths the cents reading, and a 150ms hold prevents the display from flickering when the signal briefly drops.
