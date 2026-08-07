const express = require("express");
const cors = require("cors");
const session = require("express-session");
const SQLiteStoreFactory = require("connect-sqlite3");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const SQLiteStore = SQLiteStoreFactory(session);
const app = express();

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "zonetalk.db");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(
    `
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room TEXT NOT NULL,
      username TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
    `
  );
});

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(
  session({
    store: new SQLiteStore({ db: "sessions.sqlite", dir: DATA_DIR }),
    secret: process.env.SESSION_SECRET || "zonetalk-dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "zonetalk-api" });
});

app.get("/api/session", (req, res) => {
  if (req.session.user) {
    return res.json({ authenticated: true, user: req.session.user });
  }
  return res.json({ authenticated: false });
});

app.post("/api/session/login", (req, res) => {
  const username = String(req.body.username || "").trim();
  if (!username) {
    return res.status(400).json({ error: "Username is required." });
  }
  if (username.length > 40) {
    return res.status(400).json({ error: "Username must be 40 chars or less." });
  }

  req.session.user = { username };
  return res.json({ authenticated: true, user: req.session.user });
});

app.post("/api/session/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ error: "Failed to logout." });
    }
    return res.json({ ok: true });
  });
});

app.get("/api/messages", (req, res) => {
  const room = String(req.query.room || "general");
  const query = `
    SELECT id, room, username, text, created_at
    FROM messages
    WHERE room = ?
    ORDER BY created_at ASC
    LIMIT 200
  `;

  db.all(query, [room], (error, rows) => {
    if (error) {
      return res.status(500).json({ error: "Failed to fetch messages." });
    }

    const messages = rows.map((row) => ({
      id: row.id,
      room: row.room,
      username: row.username,
      text: row.text,
      createdAt: row.created_at,
    }));

    return res.json({ room, messages });
  });
});

app.post("/api/messages", (req, res) => {
  if (!req.session.user || !req.session.user.username) {
    return res.status(401).json({ error: "Login required." });
  }

  const room = String(req.body.room || "general").trim();
  const text = String(req.body.text || "").trim();
  if (!room) {
    return res.status(400).json({ error: "Room is required." });
  }
  if (!text) {
    return res.status(400).json({ error: "Message text is required." });
  }
  if (text.length > 500) {
    return res.status(400).json({ error: "Message text is too long." });
  }

  const createdAt = Date.now();
  const username = req.session.user.username;

  const insertQuery = `
    INSERT INTO messages (room, username, text, created_at)
    VALUES (?, ?, ?, ?)
  `;

  db.run(insertQuery, [room, username, text, createdAt], function onInserted(error) {
    if (error) {
      return res.status(500).json({ error: "Failed to save message." });
    }

    return res.status(201).json({
      id: this.lastID,
      room,
      username,
      text,
      createdAt,
    });
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`ZoneTalk API running on http://localhost:${PORT}`);
});
