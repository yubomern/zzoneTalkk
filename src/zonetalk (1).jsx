import React, { useState, useEffect, useRef } from "react";

/* ============================================================
   ZoneTalk — chat app: DMs, groups, and two live "zone" modes
   - Coffee shop mode: radar of people nearby on the same Wi-Fi
   - Ride / car mode: seat map of people in the same trip
   - Tap anyone in a zone to open a 1:1 chat, or start a group
     broadcast with everyone currently in the zone
   - Messages persist in localStorage, auto-purge after 24h
   - Emoji picker, text-to-speech playback, voice notes
   ============================================================ */

const TOKENS = {
  bg: "#0B1220",
  panel: "#121B2B",
  panelAlt: "#182437",
  border: "#223046",
  mint: "#33D6A6",
  mintDim: "#1F8F6D",
  lavender: "#9B8CFF",
  coral: "#FF7A59",
  amber: "#F2C14E",
  text: "#EAF0F6",
  muted: "#7E93A7",
};

const DM_CONTACTS = [
  { id: "alice", name: "Alice Kponou", type: "dm", color: "#33D6A6" },
  { id: "bob", name: "Bob Rahmani", type: "dm", color: "#9B8CFF" },
  { id: "sara", name: "Sara Ouedraogo", type: "dm", color: "#FF7A59" },
];

const GROUPS = [
  { id: "grp-coffee", name: "Coffee Crew ☕", type: "group", color: "#F2C14E",
    members: ["Alice", "Bob", "Sara", "You"] },
  { id: "grp-uni", name: "Campus Squad 🎓", type: "group", color: "#5FB0FF",
    members: ["Bob", "Sara", "Malik", "You"] },
];

/* ---------- Zone modes: coffee shop radar vs. ride/car seat map ---------- */
const ZONE_MODES = {
  coffee: {
    key: "coffee",
    label: "☕ Coffee shop",
    network: "Café_Aroma_5G",
    hint: "Simulated proximity · same Wi-Fi network",
    namePool: ["Yassine", "Nour", "Leila", "Karim", "Fatima", "Omar", "Ines", "Rayan", "Mariem", "Hamza", "Salma", "Adem"],
    colors: ["#33D6A6", "#9B8CFF", "#FF7A59", "#F2C14E", "#5FB0FF"],
  },
  ride: {
    key: "ride",
    label: "🚗 Ride / car",
    network: "Trip #4482 · Sedan",
    hint: "Simulated proximity · same trip",
    namePool: ["Driver Ali", "Mona", "Sami", "Yosr"],
    colors: ["#5FB0FF", "#F2C14E", "#9B8CFF"],
    seats: [
      { id: "driver", label: "Driver", x: 0.28, y: 0.18 },
      { id: "front", label: "Front", x: 0.72, y: 0.18 },
      { id: "back-l", label: "Back left", x: 0.28, y: 0.78 },
      { id: "back-r", label: "Back right", x: 0.72, y: 0.78 },
    ],
  },
};

const EMOJIS = [
  "😀","😂","😍","🥰","😎","🤔","😴","😭","😡","👍","👎","🙏",
  "🎉","🔥","❤️","💯","☕","🍕","⚽","🎵","😉","🙌","👏","😅",
  "🤗","😇","🥳","😜","🤝","✨","💡","📍",
];

const DAY_MS = 24 * 60 * 60 * 1000;
const STORAGE_PREFIX = "zonetalk_msgs_";

function loadMessages(convId) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + convId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMessages(convId, msgs) {
  try {
    localStorage.setItem(STORAGE_PREFIX + convId, JSON.stringify(msgs));
  } catch {
    /* storage full or blocked — fail silently, app still works in-memory */
  }
}

function purgeExpired(msgs) {
  const now = Date.now();
  return msgs.filter((m) => now - m.time < DAY_MS);
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return "expiring";
}

function hoursLeft(ts) {
  const remain = DAY_MS - (Date.now() - ts);
  return Math.max(0, remain / (60 * 60 * 1000));
}

function fmtClock(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function seedIfEmpty(convId, seedFn) {
  const existing = loadMessages(convId);
  if (existing.length === 0) {
    const seeded = purgeExpired(seedFn());
    saveMessages(convId, seeded);
    return seeded;
  }
  return purgeExpired(existing);
}

function initials(name) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/* ---------- Zone people generators ---------- */
function generateCoffeePeople(count) {
  const cfg = ZONE_MODES.coffee;
  const shuffled = [...cfg.namePool].sort(() => Math.random() - 0.5);
  return Array.from({ length: count }).map((_, i) => {
    const angle = Math.random() * 2 * Math.PI;
    const distance = +(Math.random() * 2).toFixed(1); // 0 - 2 meters
    return {
      id: "zone-coffee-" + shuffled[i].toLowerCase(),
      name: shuffled[i],
      type: "zone",
      mode: "coffee",
      color: cfg.colors[i % cfg.colors.length],
      angle,
      distance,
    };
  });
}

function generateRidePeople() {
  const cfg = ZONE_MODES.ride;
  // driver is always present; 1-3 fellow riders fill the remaining seats
  const riderCount = 1 + Math.floor(Math.random() * 3);
  const seats = [cfg.seats[0], ...[...cfg.seats.slice(1)].sort(() => Math.random() - 0.5).slice(0, riderCount)];
  const names = [...cfg.namePool];
  return seats.map((seat, i) => ({
    id: "zone-ride-" + seat.id,
    name: seat.id === "driver" ? names[0] : names[1 + (i - 1)] || `Rider ${i}`,
    type: "zone",
    mode: "ride",
    color: cfg.colors[i % cfg.colors.length],
    seat: seat.id,
    seatLabel: seat.label,
    x: seat.x,
    y: seat.y,
  }));
}

function generateZonePeople(mode, count) {
  return mode === "ride" ? generateRidePeople() : generateCoffeePeople(count);
}

function broadcastConvFor(mode, people) {
  return {
    id: `zone-broadcast-${mode}`,
    name: mode === "ride" ? "This ride 🚗" : "This café 👥",
    type: "group",
    color: TOKENS.lavender,
    members: [...people.map((p) => p.name), "You"],
  };
}

export default function App() {
  const [zoneMode, setZoneMode] = useState("coffee");
  const [zonePeople, setZonePeople] = useState(() => generateZonePeople("coffee", 4));
  const [zoneJoined, setZoneJoined] = useState({}); // id -> true once you've opened a chat with them
  const [tab, setTab] = useState("chats"); // 'chats' | 'zone'
  const [activeConv, setActiveConv] = useState(DM_CONTACTS[0]);
  const [messages, setMessages] = useState(() =>
    seedIfEmpty(DM_CONTACTS[0].id, () => [
      { id: cryptoId(), senderId: "alice", text: "Hey! Made it to the café ☕", time: Date.now() - 25 * 60000 },
      { id: cryptoId(), senderId: "me", text: "On my way, 5 min!", time: Date.now() - 20 * 60000 },
    ])
  );
  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [micError, setMicError] = useState("");
  const [recording, setRecording] = useState(false);
  const [, forceTick] = useState(0);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const scrollRef = useRef(null);
  const replyTimerRef = useRef(null);

  /* purge-on-interval so countdown badges + auto-delete stay live */
  useEffect(() => {
    const t = setInterval(() => {
      forceTick((n) => n + 1);
      setMessages((prev) => {
        const fresh = purgeExpired(prev);
        if (fresh.length !== prev.length) saveMessages(activeConv.id, fresh);
        return fresh;
      });
    }, 30000);
    return () => clearInterval(t);
  }, [activeConv.id]);

  /* rotate the simulated zone every ~9s, only while on the Zone tab */
  useEffect(() => {
    const t = setInterval(() => {
      setZonePeople((prev) => {
        if (zoneMode === "ride") {
          const keep = prev.filter((p) => zoneJoined[p.id]);
          const next = generateRidePeople();
          const merged = [...keep];
          next.forEach((p) => {
            if (!merged.find((m) => m.id === p.id) && merged.length < 4) merged.push(p);
          });
          return merged;
        }
        const count = 3 + Math.floor(Math.random() * 3);
        const next = generateCoffeePeople(count);
        const keep = prev.filter((p) => zoneJoined[p.id]);
        const merged = [...keep];
        next.forEach((p) => {
          if (!merged.find((m) => m.id === p.id) && merged.length < 6) merged.push(p);
        });
        return merged;
      });
    }, 9000);
    return () => clearInterval(t);
  }, [zoneJoined, zoneMode]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeConv]);

  useEffect(() => () => clearTimeout(replyTimerRef.current), []);

  function switchZoneMode(mode) {
    if (mode === zoneMode) return;
    setZoneMode(mode);
    setZoneJoined({});
    setZonePeople(generateZonePeople(mode, 4));
  }

  function openConversation(conv) {
    clearTimeout(replyTimerRef.current);
    setActiveConv(conv);
    setShowEmoji(false);
    setMicError("");
    if (conv.type === "zone") {
      setZoneJoined((prev) => ({ ...prev, [conv.id]: true }));
      setMessages(seedIfEmpty(conv.id, () => []));
    } else if (conv.type === "group") {
      setMessages(
        seedIfEmpty(conv.id, () => [
          {
            id: cryptoId(),
            senderId: conv.id === "grp-coffee" ? "bob" : "sara",
            senderName: conv.id === "grp-coffee" ? "Bob" : "Sara",
            text: conv.id === "grp-coffee" ? "Who's ordering next round? 👀" : "Study room 2 is free now",
            time: Date.now() - 40 * 60000,
          },
        ])
      );
    } else {
      setMessages(
        seedIfEmpty(conv.id, () => [
          { id: cryptoId(), senderId: conv.id, text: "Hey there 👋", time: Date.now() - 30 * 60000 },
        ])
      );
    }
  }

  function openZoneBroadcast() {
    const conv = broadcastConvFor(zoneMode, zonePeople);
    openConversation(conv);
  }

  function pushMessage(msg) {
    setMessages((prev) => {
      const next = purgeExpired([...prev, msg]);
      saveMessages(activeConv.id, next);
      return next;
    });
  }

  function sendText() {
    const text = input.trim();
    if (!text) return;
    pushMessage({ id: cryptoId(), senderId: "me", text, time: Date.now() });
    setInput("");
    setShowEmoji(false);
    maybeAutoReply();
  }

  function maybeAutoReply() {
    clearTimeout(replyTimerRef.current);
    const conv = activeConv;
    replyTimerRef.current = setTimeout(() => {
      const replies = [
        "Sounds good 👍", "Haha true 😂", "On it!", "Let me check…",
        "😍 nice", "Be there soon", "👌", "Same here honestly",
      ];
      const text = replies[Math.floor(Math.random() * replies.length)];
      let senderId = conv.id;
      let senderName;
      if (conv.type === "group") {
        const pool = conv.members.filter((m) => m !== "You");
        senderName = pool[Math.floor(Math.random() * pool.length)];
        senderId = senderName.toLowerCase();
      } else if (conv.type === "zone") {
        senderName = conv.name;
      }
      setMessages((prev) => {
        const next = purgeExpired([
          ...prev,
          { id: cryptoId(), senderId, senderName, text, time: Date.now() },
        ]);
        saveMessages(conv.id, next);
        return next;
      });
    }, 1200 + Math.random() * 1500);
  }

  function addEmoji(e) {
    setInput((prev) => prev + e);
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    window.speechSynthesis.speak(utter);
  }

  async function toggleRecording() {
    setMicError("");
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          pushMessage({
            id: cryptoId(),
            senderId: "me",
            audioData: reader.result,
            time: Date.now(),
          });
          maybeAutoReply();
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      setMicError("Microphone isn't available in this preview environment. This works when the code runs in a normal browser with mic permission.");
    }
  }

  const zoneBroadcastPreview = broadcastConvFor(zoneMode, zonePeople);
  const dmAndGroups = [...DM_CONTACTS, ...GROUPS];

  return (
    <div style={{ background: TOKENS.bg, color: TOKENS.text, fontFamily: "'Inter', sans-serif" }}
      className="w-full h-full min-h-screen flex justify-center">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
        .zt-display { font-family: 'Space Grotesk', sans-serif; }
        .zt-scroll::-webkit-scrollbar { width: 6px; }
        .zt-scroll::-webkit-scrollbar-thumb { background: ${TOKENS.border}; border-radius: 4px; }
        @keyframes zt-sweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes zt-pulse { 0%,100% { opacity:.55; } 50% { opacity: 1; } }
        @keyframes zt-blink { 0%,100% { opacity: .3 } 50% { opacity: 1 } }
        .zt-radar-sweep { animation: zt-sweep 4s linear infinite; transform-origin: center; }
        .zt-dot-pulse { animation: zt-pulse 2s ease-in-out infinite; }
      `}</style>

      <div className="w-full max-w-5xl flex" style={{ height: "100vh", maxHeight: 900 }}>
        {/* Sidebar */}
        <div style={{ width: 300, background: TOKENS.panel, borderRight: `1px solid ${TOKENS.border}` }}
          className="flex flex-col shrink-0">
          <div className="px-5 pt-6 pb-4">
            <div className="flex items-center gap-2">
              <div style={{ width: 34, height: 34, borderRadius: 10, background: TOKENS.mint }}
                className="flex items-center justify-center zt-display font-bold text-black">Z</div>
              <span className="zt-display text-xl font-semibold">ZoneTalk</span>
            </div>
            <p style={{ color: TOKENS.muted }} className="text-xs mt-2">Messages auto-delete after 24h</p>
          </div>

          <div className="flex px-5 gap-1 pb-3">
            <button onClick={() => setTab("chats")}
              style={{
                background: tab === "chats" ? TOKENS.mint : "transparent",
                color: tab === "chats" ? "#04231a" : TOKENS.muted,
              }}
              className="flex-1 rounded-lg py-2 text-sm font-medium transition-colors">
              Chats
            </button>
            <button onClick={() => setTab("zone")}
              style={{
                background: tab === "zone" ? TOKENS.lavender : "transparent",
                color: tab === "zone" ? "#140f33" : TOKENS.muted,
              }}
              className="flex-1 rounded-lg py-2 text-sm font-medium transition-colors">
              Zone 📍
            </button>
          </div>

          <div className="flex-1 overflow-y-auto zt-scroll px-3 pb-4">
            {tab === "chats" ? (
              <div className="flex flex-col gap-1">
                {dmAndGroups.map((c) => (
                  <ConvRow key={c.id} conv={c} active={activeConv.id === c.id} onClick={() => openConversation(c)} />
                ))}
                <div style={{ color: TOKENS.muted, borderTop: `1px solid ${TOKENS.border}` }}
                  className="text-[11px] uppercase tracking-wide mt-3 pt-3 px-2">Zone groups</div>
                <ConvRow
                  conv={zoneBroadcastPreview}
                  active={activeConv.id === zoneBroadcastPreview.id}
                  onClick={openZoneBroadcast}
                />
              </div>
            ) : (
              <ZonePanel
                mode={zoneMode}
                onModeChange={switchZoneMode}
                people={zonePeople}
                activeId={activeConv.id}
                onSelect={openConversation}
                onBroadcast={openZoneBroadcast}
                onRefresh={() =>
                  setZonePeople(
                    zoneMode === "ride"
                      ? generateRidePeople()
                      : generateCoffeePeople(3 + Math.floor(Math.random() * 3))
                  )
                }
              />
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div style={{ borderBottom: `1px solid ${TOKENS.border}`, background: TOKENS.panelAlt }}
            className="px-6 py-4 flex items-center gap-3">
            <Avatar name={activeConv.name} color={activeConv.color || TOKENS.mint} />
            <div>
              <div className="zt-display font-semibold">{activeConv.name}</div>
              <div style={{ color: TOKENS.muted }} className="text-xs">
                {activeConv.type === "group" ? activeConv.members.join(", ") :
                 activeConv.type === "zone" && activeConv.mode === "ride" ? `${activeConv.seatLabel} · same trip` :
                 activeConv.type === "zone" ? `${activeConv.distance ?? "~"} m away · same Wi-Fi` :
                 "Direct message"}
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto zt-scroll px-6 py-5 flex flex-col gap-3">
            {messages.length === 0 && (
              <div style={{ color: TOKENS.muted }} className="text-sm text-center mt-10">
                No messages yet — say hi 👋 (messages vanish 24h after they're sent)
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} msg={m} conv={activeConv} onSpeak={speak} />
            ))}
          </div>

          {micError && (
            <div style={{ background: "#2A1A17", color: TOKENS.coral, borderTop: `1px solid ${TOKENS.border}` }}
              className="px-6 py-2 text-xs">{micError}</div>
          )}

          <div style={{ borderTop: `1px solid ${TOKENS.border}`, background: TOKENS.panelAlt }}
            className="relative px-4 py-3 flex items-end gap-2">
            {showEmoji && (
              <div style={{ background: TOKENS.panel, border: `1px solid ${TOKENS.border}` }}
                className="absolute bottom-16 left-4 rounded-xl p-3 grid grid-cols-8 gap-1 shadow-xl z-10">
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => addEmoji(e)}
                    className="text-xl hover:scale-125 transition-transform">{e}</button>
                ))}
              </div>
            )}

            <button onClick={() => setShowEmoji((s) => !s)}
              style={{ color: TOKENS.muted }}
              className="text-2xl px-1 pb-1 hover:opacity-80">🙂</button>

            <button onClick={toggleRecording}
              title={recording ? "Stop recording" : "Record voice note"}
              style={{
                color: recording ? "#fff" : TOKENS.muted,
                background: recording ? TOKENS.coral : "transparent",
              }}
              className="text-lg px-2 py-2 rounded-full hover:opacity-90">
              {recording ? "⏹" : "🎙️"}
            </button>

            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendText()}
              placeholder={recording ? "Recording voice note…" : "Type a message"}
              disabled={recording}
              style={{ background: TOKENS.panel, border: `1px solid ${TOKENS.border}`, color: TOKENS.text }}
              className="flex-1 rounded-full px-4 py-3 text-sm outline-none"
            />

            <button onClick={sendText}
              style={{ background: TOKENS.mint, color: "#04231a" }}
              className="rounded-full px-5 py-3 text-sm font-semibold hover:opacity-90 shrink-0">
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConvRow({ conv, active, onClick }) {
  return (
    <button onClick={onClick}
      style={{ background: active ? TOKENS.panelAlt : "transparent" }}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-opacity-60 transition-colors"
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#15202f"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <Avatar name={conv.name} color={conv.color} small />
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{conv.name}</div>
        <div style={{ color: TOKENS.muted }} className="text-xs truncate">
          {conv.type === "group" ? "Group" : "Direct message"}
        </div>
      </div>
    </button>
  );
}

function ZonePanel({ mode, onModeChange, people, activeId, onSelect, onBroadcast, onRefresh }) {
  const cfg = ZONE_MODES[mode];

  return (
    <div className="flex flex-col items-center px-2">
      <div className="flex w-full gap-1 mb-3">
        {Object.values(ZONE_MODES).map((m) => (
          <button key={m.key} onClick={() => onModeChange(m.key)}
            style={{
              background: mode === m.key ? TOKENS.panelAlt : "transparent",
              border: `1px solid ${mode === m.key ? TOKENS.lavender : TOKENS.border}`,
              color: mode === m.key ? TOKENS.text : TOKENS.muted,
            }}
            className="flex-1 rounded-lg py-1.5 text-[11px] font-medium">
            {m.label}
          </button>
        ))}
      </div>

      {mode === "ride" ? (
        <CarSeatMap people={people} activeId={activeId} onSelect={onSelect} />
      ) : (
        <RadarView people={people} activeId={activeId} onSelect={onSelect} />
      )}

      <div style={{ color: TOKENS.muted }} className="text-[11px] mt-2 text-center leading-snug">
        {cfg.hint}<br />"{cfg.network}"
      </div>

      <button onClick={onBroadcast}
        style={{ background: TOKENS.lavender, color: "#140f33" }}
        className="mt-3 text-xs rounded-full px-4 py-1.5 font-semibold hover:opacity-90 w-full">
        💬 Message everyone here ({people.length})
      </button>

      <button onClick={onRefresh}
        style={{ border: `1px solid ${TOKENS.border}`, color: TOKENS.text }}
        className="mt-2 mb-2 text-xs rounded-full px-4 py-1.5 hover:bg-white/5">
        ↻ Rescan nearby
      </button>

      <div className="w-full flex flex-col gap-1 mt-1">
        {people.map((p) => (
          <ConvRow key={p.id} conv={p} active={activeId === p.id} onClick={() => onSelect(p)} />
        ))}
      </div>
    </div>
  );
}

function RadarView({ people, activeId, onSelect }) {
  const size = 220;
  const center = size / 2;
  const maxR = center - 20;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {[0.33, 0.66, 1].map((f, i) => (
          <circle key={i} cx={center} cy={center} r={maxR * f}
            fill="none" stroke={TOKENS.border} strokeWidth="1" />
        ))}
        <circle cx={center} cy={center} r={4} fill={TOKENS.mint} />
      </svg>
      <div className="absolute inset-0 zt-radar-sweep"
        style={{
          background: `conic-gradient(from 0deg, ${TOKENS.lavender}55, transparent 40deg)`,
          borderRadius: "50%",
        }} />
      {people.map((p) => {
        const r = (p.distance / 2) * maxR;
        const x = center + r * Math.cos(p.angle) - 9;
        const y = center + r * Math.sin(p.angle) - 9;
        return (
          <button key={p.id} onClick={() => onSelect(p)}
            title={`${p.name} · ${p.distance}m`}
            className="absolute rounded-full zt-dot-pulse flex items-center justify-center text-[9px] font-bold"
            style={{
              left: x, top: y, width: 18, height: 18,
              background: p.color, color: "#0B1220",
              boxShadow: activeId === p.id ? `0 0 0 3px ${TOKENS.text}55` : "none",
            }}>
            {initials(p.name)}
          </button>
        );
      })}
    </div>
  );
}

function CarSeatMap({ people, activeId, onSelect }) {
  const size = 220;
  const carW = size * 0.6;
  const carH = size * 0.86;
  const carX = (size - carW) / 2;
  const carY = (size - carH) / 2;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <rect x={carX} y={carY} width={carW} height={carH} rx={28}
          fill={TOKENS.panelAlt} stroke={TOKENS.border} strokeWidth="1.5" />
        <rect x={carX + carW * 0.18} y={carY - 6} width={carW * 0.64} height={14} rx={6}
          fill={TOKENS.border} />
        <line x1={carX} y1={carY + carH / 2} x2={carX + carW} y2={carY + carH / 2}
          stroke={TOKENS.border} strokeWidth="1" strokeDasharray="3 4" />
      </svg>
      {people.map((p) => {
        const x = carX + p.x * carW - 16;
        const y = carY + p.y * carH - 16;
        return (
          <button key={p.id} onClick={() => onSelect(p)}
            title={`${p.name} · ${p.seatLabel}`}
            className="absolute rounded-full zt-dot-pulse flex flex-col items-center justify-center text-[9px] font-bold"
            style={{
              left: x, top: y, width: 32, height: 32,
              background: p.color, color: "#0B1220",
              boxShadow: activeId === p.id ? `0 0 0 3px ${TOKENS.text}55` : "none",
            }}>
            {initials(p.name)}
          </button>
        );
      })}
    </div>
  );
}

function Avatar({ name, color, small }) {
  const s = small ? 36 : 40;
  return (
    <div style={{ width: s, height: s, background: color || TOKENS.mint, color: "#0B1220" }}
      className="rounded-full flex items-center justify-center font-bold text-xs shrink-0 zt-display">
      {initials(name || "?")}
    </div>
  );
}

function MessageBubble({ msg, conv, onSpeak }) {
  const mine = msg.senderId === "me";
  const displayName = mine ? null : msg.senderName || conv.name;
  const left = hoursLeft(msg.time);

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div style={{ maxWidth: "72%" }} className="flex flex-col">
        {!mine && (conv.type === "group" || conv.type === "zone") && (
          <span style={{ color: TOKENS.muted }} className="text-[11px] mb-1 ml-1">{displayName}</span>
        )}
        <div style={{
          background: mine ? TOKENS.mint : TOKENS.panelAlt,
          color: mine ? "#04231a" : TOKENS.text,
          border: mine ? "none" : `1px solid ${TOKENS.border}`,
        }} className="rounded-2xl px-4 py-2.5 text-sm">
          {msg.audioData ? (
            <div className="flex items-center gap-2">
              <span>🎤 Voice note</span>
              <audio controls src={msg.audioData} style={{ height: 32, maxWidth: 180 }} />
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <span className="whitespace-pre-wrap break-words">{msg.text}</span>
              <button onClick={() => onSpeak(msg.text)}
                title="Play aloud"
                style={{ color: mine ? "#04231a" : TOKENS.muted }}
                className="text-xs opacity-70 hover:opacity-100 shrink-0">🔊</button>
            </div>
          )}
        </div>
        <div style={{ color: TOKENS.muted }} className={`text-[10px] mt-1 flex gap-2 ${mine ? "justify-end mr-1" : "ml-1"}`}>
          <span>{fmtClock(msg.time)}</span>
          <span>· {timeAgo(msg.time)}</span>
          {left < 2 && <span style={{ color: TOKENS.coral }}>· deletes in {Math.round(left * 60)}m</span>}
        </div>
      </div>
    </div>
  );
}

function cryptoId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
