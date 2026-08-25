# Morph — Image / GIF / Video Face Swap

A full-stack scaffold: React (Vite) frontend + Express backend, with a
pluggable face-swap "provider" layer so you can start on a mock provider
today and drop in a real one later without touching the frontend.

## Structure

```
faceswap-app/
  frontend/   React + Vite UI (upload, mode switcher, results)
  backend/    Express API (upload handling, job queue, provider abstraction)
```

## Quick start

```bash
# Terminal 1 — backend
cd backend
cp .env.example .env
npm install
npm run dev          # http://localhost:4000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev           # http://localhost:5173
```

With `FACE_SWAP_PROVIDER=mock` (the default in `.env.example`), the whole
app works end-to-end without any API key — it just hands the target file
back so you can test uploads, the job queue, and the UI.

## Wiring up a real face-swap provider

Everything routes through `backend/services/faceSwapProvider.js`. To go
live:

1. Pick a provider. Some options worth evaluating (compare pricing, latency,
   and — importantly — their content policy and consent requirements):
   - Segmind Face Swap API
   - PiAPI Face Swap
   - Akool
   - DeepSwap API
   - A Replicate-hosted face-swap model
   - A self-hosted GPU inference server, if you'd rather run your own model
2. Set `FACE_SWAP_PROVIDER=custom` and fill in `FACE_SWAP_API_KEY` /
   `FACE_SWAP_API_BASE_URL` in `backend/.env`.
3. Fill in the three methods in `customProvider` (`swapImage`, `swapGif`,
   `swapVideo`) to match that provider's actual request/response shape.
   Video is nearly always async on real providers (submit → poll → download),
   which is why `/api/swap/video` already returns a `jobId` and the frontend
   already polls `/api/jobs/:id`.
4. GIFs: most providers only swap still images. The common approach is to
   split the GIF into frames, swap each frame, then re-encode (e.g. with
   `gifencoder` or by shelling out to `ffmpeg`/`gifsicle`). That frame loop
   belongs inside `customProvider.swapGif`.

## Before you launch this publicly

This scaffold includes a basic consent checkbox on every request, but that's
a UI nudge, not real moderation. Face-swap tools are frequently misused for
non-consensual content, impersonation, and fraud. Before going live, seriously
consider:

- **Face/identity detection on uploads** to flag or block swaps involving
  faces the uploader doesn't have rights to (some provider APIs offer this;
  others don't — check).
- **A clear, enforced ToS** prohibiting non-consensual, explicit, or
  deceptive uses, with a real reporting/takedown path.
- **Visible watermarking or metadata** marking outputs as AI-generated
  (e.g. C2PA content credentials), so results can't easily pass as real.
- **Rate limiting and abuse monitoring**, especially for anonymous users.
- **Checking your provider's own acceptable-use policy** — most face-swap
  APIs already prohibit certain uses (celebrities, minors, explicit content)
  and will suspend accounts that violate them.

## API reference (backend)

| Method | Path                     | Notes                                  |
|--------|--------------------------|-----------------------------------------|
| POST   | `/api/swap/image`        | multipart: `sourceFace`, `target`, `consent=true` → returns image bytes |
| POST   | `/api/swap/gif`          | same shape → returns GIF bytes |
| POST   | `/api/swap/video`        | same shape → `202 { jobId }` |
| GET    | `/api/jobs/:id`           | poll status: `queued/processing/done/error`, `progress` |
| GET    | `/api/jobs/:id/download`  | download finished video |
| GET    | `/api/health`             | `{ ok, provider }` |
