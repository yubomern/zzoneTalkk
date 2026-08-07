# ZoneTalk Chat App (React + Session + SQLite)

This project now includes:

- React frontend chat UI
- Node.js + Express backend API
- Session authentication with `express-session`
- SQLite database for both chat messages and session storage
- Browser `sessionStorage` for selected room, username draft, and message draft

## Install

```bash
npm install
```

## Run Backend API

```bash
npm run server
```

Runs on `http://localhost:4000`.

## Run Frontend

```bash
npm start
```

Runs on `http://localhost:3000`.

## Run Both (Two Processes)

```bash
npm run dev
```

This starts both backend and frontend together.

## Tests

```bash
npm test -- --watch=false
```

## Build

```bash
npm run build
```

## Production Deploy (Vercel)

Frontend deployment files included:

- `vercel.json`
- `.env.production.example`
- `DEPLOY_VERCEL.md`

Backend environment template included:

- `.env.server.example`

Quick deploy:

1. Deploy frontend on Vercel.
2. Set `REACT_APP_API_URL` in Vercel environment variables.
3. Deploy backend on a persistent host (Render/Railway/Fly/VPS).
4. Set `CLIENT_ORIGIN` to your Vercel URL and `SESSION_SECRET` on backend.

## API Endpoints

- `GET /api/health`
- `GET /api/session`
- `POST /api/session/login` with `{ "username": "name" }`
- `POST /api/session/logout`
- `GET /api/messages?room=general`
- `POST /api/messages` with `{ "room": "general", "text": "hello" }`

## Notes

- SQLite files are created automatically in `data/`.
- Default CORS origin is `http://localhost:3000`.
- You can change backend settings using environment variables:
	- `PORT`
	- `CLIENT_ORIGIN`
	- `SESSION_SECRET`
