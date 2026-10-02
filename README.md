# Epinio Notes

A small CRUD notes web app (Node.js + Express + PostgreSQL) for testing deployment on **Epinio from plain source code**:
no Dockerfile, no CI pipeline.

## How Epinio deploys it

1. Epinio pulls this repo from Git.
2. Paketo buildpacks see `package.json` → "Node.js app" → run `npm install`.
3. The image is started with `npm start` (from `package.json`).
4. Epinio gives it a URL like `https://<app-name>.<epinio-domain>`.

The app listens on the port in the `PORT` environment variable (Epinio sets it, default 8080).

## Settings (optional environment variables)

| Name | Default | What it does |
|---|---|---|
| `APP_TITLE` | `Epinio Notes` | Title shown on the page |
| `DATABASE_URL` | *(empty)* | PostgreSQL connection string. Empty = notes kept in memory only |

## Notes

- Features: create, list, edit and delete notes (full CRUD).
- With `DATABASE_URL` set, notes are stored in PostgreSQL and survive restarts and rebuilds.
  The app creates its `notes` table by itself on first start.
- Without `DATABASE_URL`, notes are kept **in memory** (lost on restart). The page shows which
  storage is in use.
- `cnpg-db.yaml` creates the database with CloudNativePG (applied by the admin with kubectl).
- The page shows which pod served the request, handy for testing scaling.

## Run locally

```bash
npm install
npm start          # http://localhost:8080
```
