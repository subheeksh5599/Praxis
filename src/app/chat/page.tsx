"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Session {
  id: string;
  title: string;
  messages: Message[];
}

const SUGGESTIONS = [
  { label: "Deploy Contracts", q: "How do I deploy all 6 Praxis contracts to Pharos Atlantic Testnet?" },
  { label: "Register Agent", q: "Register a ResearchAgent with 2 PHRS stake and market analysis skills" },
  { label: "Create Job", q: "Create a job for an audit agent with 2 milestones, 0.1 PHRS each" },
  { label: "Credit Score", q: "How is the Praxis credit score calculated? Show me the formula and tiers" },
  { label: "Submit Proof", q: "How do I submit a milestone proof hash on-chain?" },
  { label: "Dispute + Slash", q: "What happens when a job is disputed? Walk me through the slashing flow" },
  { label: "Leaderboard", q: "Show me how to query the reputation leaderboard" },
  { label: "Multi-Agent", q: "How do I create a multi-agent workflow hiring 3 agents at once?" },
];

export default function ChatPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const raw = localStorage.getItem("praxis-sessions");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setSessions(parsed);
        if (parsed.length) setActiveId(parsed[0].id);
      } catch {}
    }
  }, []);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeId, loading]);

  useEffect(() => {
    if (sessions.length) localStorage.setItem("praxis-sessions", JSON.stringify(sessions));
  }, [sessions]);

  const active = sessions.find((s) => s.id === activeId);

  const newChat = () => {
    const s: Session = { id: Date.now().toString(36), title: "New chat", messages: [] };
    setSessions((p) => [s, ...p]);
    setActiveId(s.id);
    setShowSidebar(false);
    setTimeout(() => inputRef.current?.focus(), 200);
  };

  const handleSend = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim() || loading) return;

    let sid = activeId;
    if (!sid) {
      const s: Session = { id: Date.now().toString(36), title: msg.slice(0, 40), messages: [] };
      setSessions((p) => [s, ...p]);
      sid = s.id;
      setActiveId(s.id);
    }

    const userMsg: Message = { role: "user", content: msg };
    setSessions((p) =>
      p.map((s) =>
        s.id === sid
          ? { ...s, messages: [...s.messages, userMsg], title: s.messages.length === 0 ? msg.slice(0, 50) : s.title }
          : s
      )
    );
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...(active?.messages || []), userMsg] }),
      });
      const data = await res.json();
      const aiMsg: Message = {
        role: "assistant",
        content: data.error ? `Error: ${data.error}` : data.choices?.[0]?.message?.content || "",
      };
      setSessions((p) => p.map((s) => (s.id === sid ? { ...s, messages: [...s.messages, aiMsg] } : s)));
    } catch {
      setSessions((p) =>
        p.map((s) =>
          s.id === sid
            ? { ...s, messages: [...s.messages, { role: "assistant", content: "Could not reach the AI service." }] }
            : s
        )
      );
    }
    setLoading(false);
  };

  const deleteSession = (id: string) => {
    const next = sessions.filter((s) => s.id !== id);
    setSessions(next);
    if (activeId === id) setActiveId(next[0]?.id || null);
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#fff", overflow: "hidden" }}>
      {/* ── Sidebar ── */}
      <aside
        style={{
          display: "none",
          width: 260,
          minWidth: 260,
          maxWidth: 260,
          flexDirection: "column",
          background: "#f9f9f9",
          borderRight: "1px solid #f3f4f6",
        }}
        className="sidebar"
      >
        <div style={{ padding: "14px 14px 8px" }}>
          <a href="/" style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: "0.65rem", letterSpacing: "0.3em",
            textTransform: "uppercase", fontWeight: 500,
            color: "#7c3aed", textDecoration: "none",
            display: "block", marginBottom: 14
          }}>PRAXIS</a>
          <button
            onClick={newChat}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              fontSize: 15,
              color: "#111827",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "transparent",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#ececec")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New chat
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 4px" }}>
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => setActiveId(s.id)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                margin: "0 2px 2px",
                borderRadius: 12,
                cursor: "pointer",
                fontSize: 15,
                background: activeId === s.id ? "#ececec" : "transparent",
              }}
              onMouseEnter={(e) => { if (activeId !== s.id) e.currentTarget.style.background = "#ececec"; }}
              onMouseLeave={(e) => { if (activeId !== s.id) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#111827" }}>
                {s.title}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                style={{ opacity: 0, fontSize: 18, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#111827")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div style={{ padding: 12, borderTop: "1px solid #f3f4f6", fontSize: 12, color: "#9ca3af" }}>
          Praxis AI · Groq · Llama 3.3 70B
        </div>
      </aside>

      {/* ── Mobile sidebar overlay ── */}
      {showSidebar && (
        <>
          <div
            onClick={() => setShowSidebar(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.2)", zIndex: 40 }}
          />
          <aside
            style={{
              position: "fixed",
              left: 0, top: 0, bottom: 0,
              width: 260,
              zIndex: 50,
              display: "flex",
              flexDirection: "column",
              background: "#f9f9f9",
            }}
          >
            <div style={{ padding: "14px 14px 8px" }}>
              <a href="/" style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: "0.65rem", letterSpacing: "0.3em",
                textTransform: "uppercase", fontWeight: 500,
                color: "#7c3aed", textDecoration: "none",
                display: "block", marginBottom: 14
              }}>PRAXIS</a>
              <button
                onClick={newChat}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  fontSize: 15,
                  color: "#111827",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                + New chat
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "0 4px" }}>
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => { setActiveId(s.id); setShowSidebar(false); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    margin: "0 2px 2px",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontSize: 15,
                    background: activeId === s.id ? "#ececec" : "transparent",
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#111827" }}>
                    {s.title}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </>
      )}

      {/* ── Main ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "12px 16px 8px",
            borderBottom: "1px solid #f3f4f6",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={newChat}
              style={{ padding: 8, borderRadius: 12, background: "none", border: "none", cursor: "pointer", color: "#111827" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v18M3 12h18" />
              </svg>
            </button>
            <span style={{ fontSize: 15, fontWeight: 500, color: "#111827", marginLeft: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
              {active?.title || "Praxis AI"}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ maxWidth: 900, margin: "0 auto", minHeight: "100%", display: "flex", flexDirection: "column" }}>
            {!active || active.messages.length === 0 ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px" }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "#111827", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                  </svg>
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 600, color: "#111827", marginBottom: 40, letterSpacing: "-0.02em", textAlign: "center" }}>
                  How can I help with Praxis?
                </h1>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, maxWidth: 640, width: "100%" }}>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => handleSend(s.q)}
                      style={{
                        textAlign: "left",
                        padding: "16px 20px",
                        border: "1px solid #e5e7eb",
                        borderRadius: 16,
                        background: "#fff",
                        cursor: "pointer",
                        transition: "background 0.15s, border-color 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#f9fafb"; e.currentTarget.style.borderColor = "#d1d5db"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#e5e7eb"; }}
                    >
                      <div style={{ fontSize: 15, fontWeight: 500, color: "#111827", marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 13, color: "#6b7280" }}>{s.q}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {active.messages.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "20px 24px",
                      display: "flex",
                      gap: 20,
                      background: m.role === "assistant" ? "#f9fafb" : "transparent",
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: m.role === "assistant" ? "#19c37d" : "#111827",
                      }}
                    >
                      {m.role === "assistant" ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                          <circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                        </svg>
                      ) : (
                        <span style={{ color: "#fff", fontSize: 14, fontWeight: 500 }}>Y</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                      <div style={{ fontSize: 15, lineHeight: 1.75, color: "#111827", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {m.content}
                      </div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div style={{ padding: "20px 24px", display: "flex", gap: 20, background: "#f9fafb" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#19c37d" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                      </svg>
                    </div>
                    <div style={{ display: "flex", gap: 6, paddingTop: 4 }}>
                      <div style={{ width: 10, height: 10, background: "#d1d5db", borderRadius: "50%", animation: "bounce 1.4s infinite" }} />
                      <div style={{ width: 10, height: 10, background: "#d1d5db", borderRadius: "50%", animation: "bounce 1.4s infinite", animationDelay: "0.2s" }} />
                      <div style={{ width: 10, height: 10, background: "#d1d5db", borderRadius: "50%", animation: "bounce 1.4s infinite", animationDelay: "0.4s" }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEnd} />
              </>
            )}
          </div>
        </div>

        {/* Composer */}
        <div style={{ padding: "0 16px 16px", flexShrink: 0 }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 8,
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: "8px 16px",
                background: "#fff",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.currentTarget.style.height = "auto";
                  e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 200) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Message Praxis AI..."
                rows={1}
                style={{
                  flex: 1,
                  resize: "none",
                  fontSize: 15,
                  padding: "10px 0",
                  color: "#111827",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  minHeight: 28,
                  lineHeight: 1.5,
                  fontFamily: "inherit",
                }}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                style={{
                  padding: 8,
                  borderRadius: 12,
                  border: "none",
                  cursor: !input.trim() || loading ? "default" : "pointer",
                  background: input.trim() && !loading ? "#111827" : "#f3f4f6",
                  color: input.trim() && !loading ? "#fff" : "#9ca3af",
                  display: "flex",
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            </div>
            <div style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", marginTop: 10 }}>
              Praxis AI · Groq · Llama 3.3 70B · on-chain agent commerce on Pharos
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (min-width: 768px) {
          .sidebar { display: flex !important; }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
