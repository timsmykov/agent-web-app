# Aurora Agent

Aurora Agent is a voice-native, task-simulating AI workspace built with Next.js 14, TypeScript, and a glassmorphism aesthetic. It combines chat, voice capture, and live task progress powered by a local simulator.

## Getting Started

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) to explore the experience.

## Scripts

- `npm run dev` – start the development server
- `npm run build` – create a production build
- `npm run start` – run the production server
- `npm run lint` – lint the codebase with ESLint
- `npm run typecheck` – ensure strict TypeScript compliance

## Features

- **Unified chat timeline** with markdown rendering, code copy, and animated task cards.
- **Command palette** via `/plan`, `/summarize`, and `/run-flow` shortcuts inside the composer.
- **Voice mode** overlay featuring a reactive orb, Web Speech API recognition, microphone VAD, and a manual mic toggle.
- **Task drawer** for filtering, searching, and highlighting simulated tasks with live SSE updates.
- **Realtime task simulator** that mimics planning → execution → summarisation without external services.
- **Accessibility touches** including high-contrast theme, keyboard and hotkey hints, and responsive typography.
- **n8n integration** sends every prompt to the webhook and surfaces completion responses directly in the chat.

## Voice Hotkeys

- `Enter` – send the current message
- `Shift + Enter` – insert a newline
- `Esc` – exit voice overlay
- Microphone button – start/stop inline voice dictation

## n8n Webhook

The composer now mirrors every user message to an n8n webhook through the internal proxy at `/api/n8n/dispatch`.

1. Configure `.env.local` with `N8N_WEBHOOK_TEST_URL`, `N8N_WEBHOOK_PROD_URL`, and `N8N_MODE` (`test` or `prod`).
2. Run `npm run dev` and send a message; failures surface as in-chat toasts with a “failed” badge on the message bubble.
3. Smoke test via:

```bash
npm run curl:test
# or directly
curl -X POST http://localhost:3000/api/n8n/dispatch \
  -H 'Content-Type: application/json' \
  -d '{"message":{"id":"1","text":"ping","role":"user","ts":0},"meta":{"client":"web"}}'
```

## Notes

- All data lives in-memory; restarting the dev server resets tasks.
- Voice capture relies on the browser Web Speech API for recognition; use a Chromium-based browser for best results.
