# Deploy ZoneTalk Frontend on Vercel (Production)

This project uses a React frontend and an Express + SQLite backend.

Vercel is perfect for the frontend. For the backend, use a persistent host
(Render, Railway, Fly.io, VPS) because SQLite/session files are not durable
in Vercel serverless functions.

## 1) Deploy frontend to Vercel

1. Push this repository to GitHub.
2. In Vercel, import the repository.
3. Framework preset: Create React App.
4. Build command: npm run build.
5. Output directory: build.
6. Add environment variable:
   - Name: REACT_APP_API_URL
   - Value: your backend URL (example: https://api-yourapp.onrender.com)
7. Deploy.

The included vercel.json already handles SPA rewrites.

## 2) Deploy backend elsewhere

Use server.js with environment variables from .env.server.example.

Required vars:
- PORT
- CLIENT_ORIGIN (your Vercel site URL)
- SESSION_SECRET

## 3) Verify production

- Open your Vercel app URL.
- Login with a username.
- Send a message in #general.
- Refresh page and confirm the message still exists.
