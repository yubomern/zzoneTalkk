import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./zonetalk.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:4000";
const ROOM_OPTIONS = ["general", "random", "support", "ideas"];

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data && data.error ? data.error : "Request failed";
    throw new Error(message);
  }

  return data;
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ZoneTalk() {
  const [sessionUser, setSessionUser] = useState(null);
  const [username, setUsername] = useState(() => sessionStorage.getItem("zonetalk_username") || "");
  const [activeRoom, setActiveRoom] = useState(() => sessionStorage.getItem("zonetalk_room") || "general");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const activeRoomLabel = useMemo(() => `#${activeRoom}`, [activeRoom]);

  useEffect(() => {
    const cachedDraft = sessionStorage.getItem(`zonetalk_draft_${activeRoom}`) || "";
    setDraft(cachedDraft);
  }, [activeRoom]);

  const fetchMessages = useCallback(async () => {
    if (!sessionUser) {
      return;
    }

    setLoadingMessages(true);
    setError("");
    try {
      const payload = await apiRequest(`/api/messages?room=${encodeURIComponent(activeRoom)}`);
      setMessages(payload.messages || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingMessages(false);
    }
  }, [activeRoom, sessionUser]);

  useEffect(() => {
    let mounted = true;

    async function bootstrapSession() {
      if (typeof fetch !== "function") {
        setError("Browser fetch API is not available.");
        return;
      }

      try {
        const payload = await apiRequest("/api/session");
        if (!mounted) {
          return;
        }
        if (payload.authenticated && payload.user) {
          setSessionUser(payload.user);
          sessionStorage.setItem("zonetalk_username", payload.user.username);
        }
      } catch {
        if (mounted) {
          setError("Cannot connect to chat server. Start backend with npm run server.");
        }
      }
    }

    bootstrapSession();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    sessionStorage.setItem("zonetalk_room", activeRoom);
  }, [activeRoom]);

  useEffect(() => {
    sessionStorage.setItem(`zonetalk_draft_${activeRoom}`, draft);
  }, [activeRoom, draft]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!sessionUser) {
      return undefined;
    }

    const pollId = window.setInterval(() => {
      fetchMessages();
    }, 2500);

    return () => {
      window.clearInterval(pollId);
    };
  }, [fetchMessages, sessionUser]);

  async function handleLogin(event) {
    event.preventDefault();
    const trimmedName = username.trim();
    if (!trimmedName) {
      setError("Please enter a username.");
      return;
    }

    setError("");
    try {
      const payload = await apiRequest("/api/session/login", {
        method: "POST",
        body: JSON.stringify({ username: trimmedName }),
      });
      setSessionUser(payload.user);
      sessionStorage.setItem("zonetalk_username", payload.user.username);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleLogout() {
    try {
      await apiRequest("/api/session/logout", { method: "POST" });
    } catch {
      // Try to clear local state even if logout request fails.
    }
    setSessionUser(null);
    setMessages([]);
  }

  async function handleSend(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) {
      return;
    }

    setSending(true);
    setError("");
    try {
      await apiRequest("/api/messages", {
        method: "POST",
        body: JSON.stringify({ room: activeRoom, text }),
      });
      setDraft("");
      await fetchMessages();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="zt-page">
      <div className="zt-glow zt-glow-one" />
      <div className="zt-glow zt-glow-two" />
      <main className="zt-card" aria-label="ZoneTalk app">
        {!sessionUser ? (
          <section className="zt-auth" aria-label="ZoneTalk login">
            <h1>ZoneTalk</h1>
            <p>Realtime room chat with session login and SQLite storage.</p>
            <form onSubmit={handleLogin} className="zt-auth-form">
              <label htmlFor="zt-username">Choose username</label>
              <input
                id="zt-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                maxLength={40}
                placeholder="e.g. nour"
              />
              <button type="submit">Enter Chat</button>
            </form>
            {error ? <div className="zt-error">{error}</div> : null}
          </section>
        ) : (
          <section className="zt-chat">
            <aside className="zt-sidebar">
              <div className="zt-brand">
                <h1>ZoneTalk</h1>
                <span>{sessionUser.username}</span>
              </div>
              <p className="zt-side-title">Rooms</p>
              <nav>
                {ROOM_OPTIONS.map((room) => (
                  <button
                    key={room}
                    className={room === activeRoom ? "zt-room active" : "zt-room"}
                    onClick={() => setActiveRoom(room)}
                    type="button"
                  >
                    #{room}
                  </button>
                ))}
              </nav>
              <button type="button" className="zt-logout" onClick={handleLogout}>
                Logout
              </button>
            </aside>

            <section className="zt-thread">
              <header className="zt-thread-head">
                <h2>{activeRoomLabel}</h2>
                <button type="button" onClick={fetchMessages}>Refresh</button>
              </header>

              <div className="zt-messages" role="log" aria-live="polite">
                {loadingMessages ? <p className="zt-meta">Loading messages...</p> : null}
                {!loadingMessages && messages.length === 0 ? (
                  <p className="zt-meta">No messages yet. Send the first one.</p>
                ) : null}
                {messages.map((message) => {
                  const isMe = message.username === sessionUser.username;
                  return (
                    <article key={message.id} className={isMe ? "zt-bubble me" : "zt-bubble"}>
                      <div className="zt-bubble-top">
                        <strong>{message.username}</strong>
                        <time>{formatTime(message.createdAt)}</time>
                      </div>
                      <p>{message.text}</p>
                    </article>
                  );
                })}
              </div>

              <form className="zt-compose" onSubmit={handleSend}>
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={`Message ${activeRoomLabel}`}
                  maxLength={500}
                />
                <button type="submit" disabled={sending}>
                  {sending ? "Sending..." : "Send"}
                </button>
              </form>
              {error ? <div className="zt-error">{error}</div> : null}
            </section>
          </section>
        )}
      </main>
    </div>
  );
}
