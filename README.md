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
