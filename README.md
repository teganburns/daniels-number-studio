# Daniel's Number Studio

A static React app for helping Daniel practice saying large numbers and decimals.

## What It Does

- Converts typed numbers into US-style spoken chunks through the trillions.
- Pronounces decimals digit-by-digit after `point`.
- Uses browser text-to-speech, so the deployed GitHub Pages site does not expose an API key.
- Includes listening practice, speaking practice, parent-assisted fallback, progress tracking, and voice settings.

## Commands

```bash
npm install
npm run dev
npm test
npm run build
```

The Vite config uses `base: './'` so the built app works from a GitHub Pages project subpath.
