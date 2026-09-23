# AdaptVision Module 1: Meet Matty

A lesson for 11 to 14 year olds about shortcut learning (spurious correlations).
Pairs show Matty photos of pens. A vision-capable Claude model, called only from
our server, finds a feature the photos happen to share, and Matty states it as a
confident but wrong rule. Students catch the mistake, fix the data, retrain, fall
into the leakage trap, and finish with a fair test on a held-out photo.

## Run it

Needs Node 20.19 or newer.

```bash
npm install
cp .env.example .env        # then put your key in ANTHROPIC_API_KEY
npm run prep                # once: prepares photos + pre-analyzes the Tier 2 set (about 30 short calls)
npm start                   # builds, starts the server, opens the browser
```

The terminal prints a `Participants join at http://<laptop-ip>:8787` link. Any
laptop or tablet on the same Wi-Fi opens that link. No accounts, no installs.

No key yet? `npm run prep:mock` then `MOCK=1 npm start` lets you rehearse the whole
flow with simulated answers. The app shows a yellow "Rehearsal mode" banner
whenever anything is simulated. Never run a session in mock mode.

## How it maps to the lab setup

| Paper says | Where |
|---|---|
| React/Vite client + small Express server | `client/`, `server/index.js` |
| Vision model finds the shared feature, states Matty's rule | `server/lib/lessonApi.js` `analyzeSet`, prompt in `server/lib/prompts.js` |
| Tests the rule on a held-out image | `testPhoto`, held-out photos never appear before the fair-test step |
| API key stays server-side | Browser sends photo ids only (`/api/analyze`, `/api/test`); server reads the files and calls the API |
| No camera, provided photos | `photos-source/` → `npm run prep` → `client/public/photos/` |
| Tier 1 in pairs | "Live" mode: pairs pick photos together |
| Tier 2 Wi-Fi fallback, pre-analyzed pool | "Classroom set" mode reads `client/public/photos/analysis.json`, zero API calls |
| Tier 3 unplugged | `docs/tier3-unplugged/` |
| ~20 concurrent light calls | Photos resized to 768px; server queues at `MAX_CONCURRENT_CALLS` |
| API cost | Terminal logs tokens per call and a running total; set prices in `.env` for a $ estimate. `GET /api/usage` for totals |

## Lesson flow

Collect → Analyze → Declare → Discuss → Reveal → Fix → Retrain → Test (leakage trap) → Fair test.

The fix depends on what Matty latched onto. A background-type shortcut gets
**preprocessing** (background erased). A property of the pen itself, like a cap,
gets **more variety** (pairs add different pens). If Matty still relies on a
shortcut after retraining, round 2 runs. With the pilot photos that is
background first, then the cap.

"Relies on a shortcut" is decided from the model's per-photo yes/no answers
(feature present in at least 75% of training photos, `client/src/shared/lesson.js`),
not from a self-reported confidence number.

## Photos

```
photos-source/
  train/      pens that share incidental features (same paper, caps on). Pairs choose from these.
  diverse/    pens that break those patterns (other surfaces, caps off). Used in the variety fix.
  heldout/    pens kept back for the fair test. Never shown earlier.
```

The shipped images are drawn placeholders. Replace them with real photos (JPG/PNG,
any size, phone photos fine; convert HEIC first) and run `npm run prep` again.

Background erasing runs once at prep time: it flood-fills from the photo edges and
paints the paper flat grey, so it works best with one pen on plain paper. Prep warns
if a photo looks wrong; check `client/public/photos/clean/`. To fix one by hand, put
`<name>.clean.png` next to the original.

Tier 2 uses the first 5 train, 4 diverse and 2 held-out photos. Override with
`photos-source/tier2.json`: `{"train": [ids], "diverse": [ids], "heldout": [ids]}`
(ids are listed in `client/public/photos/manifest.json`). Re-run `npm run prep`
after changing photos, or the classroom set will be stale.

## Development

`npm run dev` runs the API with auto-restart and Vite with hot reload on :5173.

Adding "eraser": new photos in `photos-source/`, set `OBJECT_TYPE` in
`server/prep.js`, mark it `ready` in `client/src/shared/lesson.js`.

## License

MIT
