# Epinio Notes

A tiny notes web app (Node.js + Express) for testing deployment on **Epinio from plain source code**:
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

## Notes

- Notes are stored **in memory**: they disappear when the app restarts or is rebuilt,
  and with more than 1 instance each pod has its own list. A database is the next step.
- The page shows which pod served the request, handy for testing scaling.

## Run locally

```bash
npm install
npm start          # http://localhost:8080
```
