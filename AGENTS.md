# DragonCard — Guide for AI Agents

Local-first flashcard app: **Flask + SQLite + vanilla JS SPA**. It is not
Anki — no spaced-repetition algorithm; it uses a simple ordered-list study
engine (mark unknown → reshuffle → rounds).

This file tells you (an AI coding agent) how to run, understand and extend
DragonCard. For humans, see `README.md`.

## Quick Start

```bash
./start.sh          # macOS / Linux: creates venv, installs deps, starts on :5001
start.bat           # Windows equivalent
```

Or manually:

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python app.py
# open http://localhost:5001
```

First launch automatically creates the SQLite DB (`instance/dragon_card.db`),
tables, and a default user `default`. The app is empty until decks are added
(see below).

## Seeding bundled free decks

The repo ships free decks under `default_cards/` (each folder = one deck:
`tool.zip` + `cards.json` + `meta.json`, most also ship `readme.txt` and a
`LICENSE`). They are **not** auto-imported. To import them (idempotent —
existing decks are skipped by name):

```bash
python seed_decks.py                  # import all missing bundled free decks
python seed_decks.py laozi chinese_hsk  # only the named folders (or deck names)
python seed_decks.py --force          # replace existing decks in place
python seed_decks.py --force laozi    # replace one deck in place
```

`--force` replaces in place (no duplicate rows): deck row is reused, bound
tool is re-imported keeping its id, items are upserted by `item_order`
(absent cards removed, study progress kept). Unknown deck names exit 1.

A user can also import any deck manually in the UI: Manage deck → upload
tool (`tool.zip`) → upload data (`cards.json`).

## Dependencies

- `requirements.txt`: `flask`, `flask-sqlalchemy` (SQLite by default; the
  app also configures `DATABASE_URL`/`SECRET_KEY` env vars, and `pymysql`
  is present only for optional MySQL).
- Frontend is static (`static/`), no build step. Vendored libs under
  `static/vendor/` (Tailwind, Font Awesome, ECharts, Three.js).

## Architecture

```
app.py            Flask routes + schema bootstrap/migration
models.py         SQLAlchemy models (User, Deck, Tool, DeckItem, Progress, ...)
config.py         Config (env overridable)
seed_decks.py     CLI to import default_cards/ free decks
default_cards/    bundled deck packs (tool.zip + cards.json + meta)
static/           SPA: app.js (home/manage/i18n/skins), styles.css, vendor/
templates/index.html  single-page shell
playground.html   standalone demo page (served at /playground)
minitools/        extracted tool zips at runtime (gitignored)
instance/         SQLite DB (created at runtime, not committed)
```

Key concepts:

- **Deck** = a study list (`cards.json` data). **Tool** = how a card renders
  — a self-contained zip (`index.html` + `manifest.json` + `assets/`) bound
  to a deck via `Deck.tool_id`; entering the deck opens the tool full-screen
  in a new tab, and the tool talks to the app through the injected
  `window.cardAPI`. **DeckItem** = one card's data (JSON), ordered by
  `item_order`.
- `Deck.to_dict()` returns per-deck stats used by the home grid
  (item_count / unknown / mastered / round_count / year_study_days /
  last_studied_at). `_study_activity_map` computes study activity in one query.
- The UI is a vanilla-JS SPA; all state lives in `static/app.js`
  (including `_deckKindFilter`, skin system, i18n, single-card study mode).

## API overview (all JSON)

| Module | Endpoint |
|--------|----------|
| User | `POST /v1/users/login`, `GET /v1/users` |
| Decks | `GET/POST /v1/decks`, `GET/PUT/DEL /v1/decks/:id` |
| Deck tool | `POST /v1/decks/:id/tool` (bind), `DELETE /v1/decks/:id/tool` (unbind) |
| Deck data | `POST /v1/decks/:id/import`, `GET /v1/decks/:id/items`, export |
| Tools | `GET /v1/tools/:id/run`, `GET /v1/tools/:id/assets/*`, `POST /v1/tools/:id/validate`, `POST /v1/tools/:id/replace`, `GET /v1/tools/:id/export` |
| Learning | `GET /v1/learn/info`, `GET /v1/learn/page`, `POST /v1/learn/mark`, `/v1/learn/favorite`, `POST /v1/reorder` |
| Observability | `POST /v1/observability/events` (batched), `GET /v1/observability/actions`, `/data` |
| Achievements | `GET /v1/achievements` |

## Common tasks

- **Add a bundled free deck**: build the tool in the separate
  `dragoncard_tools` repo (`tools/<name>/`, spec in its `TOOL_PACK.md`,
  packaged by its `build.py`), then create `default_cards/<name>/` with
  `tool.zip` + `cards.json` (`item_order` 1-based) + `meta.json`, and run
  `python seed_decks.py`.
- **Change how cards look**: edit the tool source in `dragoncard_tools`,
  re-run its `build.py`, then replace the zip in the UI (Manage deck →
  替换工具) or `python seed_decks.py --force <name>`.
- **Add a tracked action**: call `api.track('action')` in the tool JS and
  declare it in `manifest.json` `trackedActions`. Keep ≤5 actions.

## Gotchas

- **Never commit `instance/*.db`** (ignored).
- `item_order` in `cards.json` **must be 1-based** — it is the import
  overwrite key; missing/inconsistent orders cause append-only imports.
- The app listens on `0.0.0.0:5001`; port is at the end of `app.py`
  (`app.run(host='0.0.0.0', port=5001)`).
- TTS uses the browser's Web Speech API (no server dependency).
- Skins are front-end only (CSS variable overrides + a `pointer-events:none`
  decoration layer). Skin CSS must **not** change layout widths or
  card-content variables.
- The built-in themed skins live in `static/app.js` `SKINS`; card
  content variables are intentionally untouched so tool cards keep their
  user-defined look.
- `minitools/<id>.retired-<hex>/` dirs are **intentional** recovery backups
  from the atomic tool replace (old dir renamed aside, staging swapped in);
  `minitools/` is gitignored, and stale `.retired-*`/`.staging-*` dirs can
  be deleted once a replace is confirmed working.