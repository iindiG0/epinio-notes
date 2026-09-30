// Tiny notes app for testing Epinio deployments from plain source code.
// No Dockerfile, no CI: Epinio's buildpacks detect Node.js from package.json,
// run `npm install`, and start the app with `npm start`.
//
// Notes are kept in memory, so they disappear when the app restarts.
// (A database comes later, bound through Epinio services.)

const express = require("express");
const os = require("os");

const app = express();
const PORT = process.env.PORT || 8080; // Epinio tells the app which port to use
const APP_TITLE = process.env.APP_TITLE || "Epinio Notes";

app.use(express.urlencoded({ extended: false }));

let notes = [];
let nextId = 1;

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function page(body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(APP_TITLE)}</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #111827; color: #e5e7eb; margin: 0; }
    .wrap { max-width: 640px; margin: 0 auto; padding: 24px 16px; }
    h1 { font-size: 1.6rem; margin: 0 0 4px; }
    .meta { color: #9ca3af; font-size: .85rem; margin-bottom: 20px; }
    form.new { display: grid; gap: 8px; margin-bottom: 24px; }
    input, textarea { background: #1f2937; color: inherit; border: 1px solid #374151; border-radius: 8px; padding: 10px; font: inherit; }
    button { background: #3b82f6; color: white; border: 0; border-radius: 8px; padding: 10px 14px; font: inherit; cursor: pointer; }
    button.del { background: transparent; color: #f87171; border: 1px solid #7f1d1d; padding: 4px 10px; }
    .note { background: #1f2937; border: 1px solid #374151; border-radius: 10px; padding: 14px; margin-bottom: 12px; }
    .note h2 { font-size: 1.05rem; margin: 0 0 6px; }
    .note p { margin: 0 0 10px; white-space: pre-wrap; }
    .empty { color: #9ca3af; }
  </style>
</head>
<body><div class="wrap">${body}</div></body>
</html>`;
}

app.get("/", (req, res) => {
  const list = notes.length
    ? notes
        .map(
          (n) => `<div class="note">
            <h2>${escapeHtml(n.title)}</h2>
            <p>${escapeHtml(n.body)}</p>
            <form method="post" action="/notes/${n.id}/delete"><button class="del">Delete</button></form>
          </div>`
        )
        .join("")
    : `<p class="empty">No notes yet. Write the first one above.</p>`;

  res.send(
    page(`
    <h1>📝 ${escapeHtml(APP_TITLE)}</h1>
    <div class="meta">Served by pod <b>${escapeHtml(os.hostname())}</b> · deployed on Epinio from plain source code</div>
    <form class="new" method="post" action="/notes">
      <input name="title" placeholder="Title" required maxlength="100">
      <textarea name="body" placeholder="Write something..." rows="3" maxlength="2000"></textarea>
      <button>Add note</button>
    </form>
    ${list}
  `)
  );
});

app.post("/notes", (req, res) => {
  const title = (req.body.title || "").trim();
  const body = (req.body.body || "").trim();
  if (title) notes.unshift({ id: nextId++, title, body });
  res.redirect("/");
});

app.post("/notes/:id/delete", (req, res) => {
  notes = notes.filter((n) => n.id !== Number(req.params.id));
  res.redirect("/");
});

// Health check URL
app.get("/healthz", (req, res) => res.send("ok"));

app.listen(PORT, () => console.log(`${APP_TITLE} listening on port ${PORT}`));
