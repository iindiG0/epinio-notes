// Epinio Notes: a small CRUD notes app for testing Epinio deployments
// from plain source code (no Dockerfile, no CI).
//
// Storage:
//   - If DATABASE_URL is set  -> PostgreSQL (e.g. a CloudNativePG cluster)
//   - If it is not set        -> in memory (notes vanish on restart)
//
// Epinio's buildpacks detect Node.js from package.json, run `npm install`,
// and start the app with `npm start`. Epinio sets PORT (default 8080).

const express = require("express");
const os = require("os");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 8080;
const APP_TITLE = process.env.APP_TITLE || "Epinio Notes";
const DATABASE_URL = process.env.DATABASE_URL || "";

app.use(express.urlencoded({ extended: false }));

// ---------------------------------------------------------------------------
// Storage layer: same functions for PostgreSQL and in-memory
// ---------------------------------------------------------------------------

let store;

if (DATABASE_URL) {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
  let ready = null;

  // Create the table on first use. Retries while the database is starting.
  function ensureTable() {
    if (!ready) {
      ready = (async () => {
        for (let attempt = 1; ; attempt++) {
          try {
            await pool.query(`
              CREATE TABLE IF NOT EXISTS notes (
                id         SERIAL PRIMARY KEY,
                title      TEXT NOT NULL,
                body       TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
              )`);
            console.log("Connected to PostgreSQL, table 'notes' is ready");
            return;
          } catch (err) {
            console.error(`Database not ready (attempt ${attempt}): ${err.message}`);
            if (attempt >= 10) { ready = null; throw err; }
            await new Promise((r) => setTimeout(r, 3000));
          }
        }
      })();
    }
    return ready;
  }

  store = {
    kind: "PostgreSQL",
    async list() {
      await ensureTable();
      const { rows } = await pool.query(
        "SELECT id, title, body, created_at, updated_at FROM notes ORDER BY updated_at DESC"
      );
      return rows;
    },
    async get(id) {
      await ensureTable();
      const { rows } = await pool.query("SELECT id, title, body FROM notes WHERE id = $1", [id]);
      return rows[0];
    },
    async create(title, body) {
      await ensureTable();
      await pool.query("INSERT INTO notes (title, body) VALUES ($1, $2)", [title, body]);
    },
    async update(id, title, body) {
      await ensureTable();
      await pool.query(
        "UPDATE notes SET title = $2, body = $3, updated_at = now() WHERE id = $1",
        [id, title, body]
      );
    },
    async remove(id) {
      await ensureTable();
      await pool.query("DELETE FROM notes WHERE id = $1", [id]);
    },
  };

  ensureTable().catch(() => {}); // start connecting right away
} else {
  let notes = [];
  let nextId = 1;
  store = {
    kind: "memory (not saved)",
    async list() { return [...notes].sort((a, b) => b.updated_at - a.updated_at); },
    async get(id) { return notes.find((n) => n.id === id); },
    async create(title, body) {
      const now = new Date();
      notes.push({ id: nextId++, title, body, created_at: now, updated_at: now });
    },
    async update(id, title, body) {
      const n = notes.find((x) => x.id === id);
      if (n) Object.assign(n, { title, body, updated_at: new Date() });
    },
    async remove(id) { notes = notes.filter((n) => n.id !== id); },
  };
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function esc(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function when(date) {
  return new Date(date).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function page(body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(APP_TITLE)}</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #111827; color: #e5e7eb; margin: 0; }
    .wrap { max-width: 640px; margin: 0 auto; padding: 24px 16px; }
    h1 { font-size: 1.6rem; margin: 0 0 4px; }
    a { color: #93c5fd; }
    .meta { color: #9ca3af; font-size: .85rem; margin-bottom: 20px; }
    .badge { display: inline-block; padding: 1px 8px; border-radius: 999px; background: #1e3a8a; color: #bfdbfe; }
    .badge.warn { background: #78350f; color: #fde68a; }
    form.note-form { display: grid; gap: 8px; margin-bottom: 24px; }
    input, textarea { background: #1f2937; color: inherit; border: 1px solid #374151; border-radius: 8px; padding: 10px; font: inherit; }
    button, .btn { background: #3b82f6; color: white; border: 0; border-radius: 8px; padding: 10px 14px; font: inherit; cursor: pointer; text-decoration: none; display: inline-block; }
    .actions { display: flex; gap: 8px; align-items: center; }
    .actions form { margin: 0; }
    .small { padding: 4px 10px; font-size: .9rem; }
    .ghost { background: transparent; color: #93c5fd; border: 1px solid #1e3a8a; }
    .danger { background: transparent; color: #f87171; border: 1px solid #7f1d1d; }
    .note { background: #1f2937; border: 1px solid #374151; border-radius: 10px; padding: 14px; margin-bottom: 12px; }
    .note h2 { font-size: 1.05rem; margin: 0 0 6px; }
    .note p { margin: 0 0 10px; white-space: pre-wrap; }
    .note .time { color: #9ca3af; font-size: .8rem; margin-bottom: 10px; }
    .empty, .error { color: #9ca3af; }
    .error { color: #fca5a5; }
  </style>
</head>
<body><div class="wrap">${body}</div></body>
</html>`;
}

function header() {
  const cls = store.kind === "PostgreSQL" ? "badge" : "badge warn";
  return `
    <h1>📝 <a href="/" style="color:inherit;text-decoration:none">${esc(APP_TITLE)}</a></h1>
    <div class="meta">
      Served by pod <b>${esc(os.hostname())}</b> · storage: <span class="${cls}">${esc(store.kind)}</span>
    </div>`;
}

// Wrap async route handlers so database errors show a friendly page
const handle = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).send(page(`${header()}<p class="error">Something went wrong: ${esc(err.message)}</p><p><a href="/">Back</a></p>`));
  });

// ---------------------------------------------------------------------------
// Routes: Create, Read, Update, Delete
// ---------------------------------------------------------------------------

// READ: list all notes + form to create a new one
app.get("/", handle(async (req, res) => {
  const notes = await store.list();
  const list = notes.length
    ? notes.map((n) => `
        <div class="note">
          <h2>${esc(n.title)}</h2>
          <div class="time">updated ${when(n.updated_at)}</div>
          <p>${esc(n.body)}</p>
          <div class="actions">
            <a class="btn small ghost" href="/notes/${n.id}/edit">Edit</a>
            <form method="post" action="/notes/${n.id}/delete"><button class="small danger">Delete</button></form>
          </div>
        </div>`).join("")
    : `<p class="empty">No notes yet. Write the first one above.</p>`;

  res.send(page(`
    ${header()}
    <form class="note-form" method="post" action="/notes">
      <input name="title" placeholder="Title" required maxlength="100">
      <textarea name="body" placeholder="Write something..." rows="3" maxlength="2000"></textarea>
      <button>Add note</button>
    </form>
    ${list}`));
}));

// CREATE
app.post("/notes", handle(async (req, res) => {
  const title = (req.body.title || "").trim();
  const body = (req.body.body || "").trim();
  if (title) await store.create(title, body);
  res.redirect("/");
}));

// UPDATE (form)
app.get("/notes/:id/edit", handle(async (req, res) => {
  const note = await store.get(Number(req.params.id));
  if (!note) return res.redirect("/");
  res.send(page(`
    ${header()}
    <form class="note-form" method="post" action="/notes/${note.id}">
      <input name="title" value="${esc(note.title)}" required maxlength="100">
      <textarea name="body" rows="5" maxlength="2000">${esc(note.body)}</textarea>
      <div class="actions">
        <button>Save changes</button>
        <a class="btn ghost" href="/">Cancel</a>
      </div>
    </form>`));
}));

// UPDATE (save)
app.post("/notes/:id", handle(async (req, res) => {
  const title = (req.body.title || "").trim();
  const body = (req.body.body || "").trim();
  if (title) await store.update(Number(req.params.id), title, body);
  res.redirect("/");
}));

// DELETE
app.post("/notes/:id/delete", handle(async (req, res) => {
  await store.remove(Number(req.params.id));
  res.redirect("/");
}));

// Health check
app.get("/healthz", (req, res) => res.send("ok"));

app.listen(PORT, () =>
  console.log(`${APP_TITLE} listening on port ${PORT} (storage: ${store.kind})`)
);
