"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Session {
  id: string;
  title: string;
  messages: Message[];
}

const suggestions = [
  { label: "Deploy Contracts", q: "How do I deploy all 6 Praxis contracts to Pharos Atlantic Testnet?" },
  { label: "Register Agent", q: "Register a ResearchAgent with 2 PHRS stake and market analysis skills" },
  { label: "Create Job", q: "Create a job for an audit agent with 2 milestones, 0.1 PHRS each" },
  { label: "Credit Score", q: "How is the Praxis credit score calculated? Show me the formula and tiers" },
  { label: "Submit Proof", q: "How do I submit a milestone proof hash on-chain?" },
  { label: "Dispute + Slash", q: "What happens when a job is disputed? Walk me through the slashing flow" },
  { label: "Leaderboard", q: "Show me how to query the reputation leaderboard" },
  { label: "Multi-Agent", q: "How do I create a multi-agent workflow hiring 3 agents at once?" },
];

export default function ChatPanel({ onClose }: { onClose: () => void }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = localStorage.getItem("praxis-sessions");
    if (s) {
      try {
        const parsed = JSON.parse(s);
        setSessions(parsed);
        if (parsed.length) setActiveId(parsed[0].id);
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (messagesEnd.current) {
      messagesEnd.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeId, loading]);

  useEffect(() => {
    if (sessions.length) localStorage.setItem("praxis-sessions", JSON.stringify(sessions));
  }, [sessions]);

  const active = sessions.find((s) => s.id === activeId);

  const newChat = () => {
    const s: Session = { id: Date.now().toString(36), title: "New chat", messages: [] };
    setSessions((p) => [s, ...p]);
    setActiveId(s.id);
    setSidebar(false);
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
        body: JSON.stringify({ messages: [...(active?.messages || []), userMsg], model: "gpt-4o-mini" }),
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

  const SIDEBAR = 260;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      className="fixed inset-0 z-50 flex bg-white"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* ── Desktop Sidebar ── */}
      <div
        className="hidden md:flex flex-col bg-[#f9f9f9]"
        style={{ width: SIDEBAR, minWidth: SIDEBAR, maxWidth: SIDEBAR }}
      >
        <div className="p-3 pt-4">
          <button
            onClick={newChat}
            className="w-full flex items-center gap-3 px-3 py-3 text-[15px] text-[#111827] rounded-xl border border-[#e5e7eb] hover:bg-[#ececec] transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2">
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className={`group flex items-center justify-between px-3 py-3 mx-1 rounded-xl cursor-pointer text-[15px] transition-colors ${
                activeId === s.id ? "bg-[#ececec]" : "hover:bg-[#ececec]"
              }`}
            >
              <span className="truncate text-[#111827]">{s.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                className="opacity-0 group-hover:opacity-100 text-[#9ca3af] hover:text-[#111827] ml-2 shrink-0 text-lg"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-[#f3f4f6]">
          <span className="text-xs text-[#9ca3af]">Praxis AI v1 · GPT-4o Mini</span>
        </div>
      </div>

      {/* ── Mobile Sidebar Overlay ── */}
      <AnimatePresence>
        {sidebar && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-40 md:hidden"
              onClick={() => setSidebar(false)}
            />
            <motion.div
              initial={{ x: -SIDEBAR }} animate={{ x: 0 }} exit={{ x: -SIDEBAR }}
              transition={{ type: "tween", duration: 0.2 }}
              className="fixed left-0 top-0 bottom-0 z-50 md:hidden flex flex-col bg-[#f9f9f9]"
              style={{ width: SIDEBAR }}
            >
              <div className="p-3 pt-4">
                <button
                  onClick={newChat}
                  className="w-full flex items-center gap-3 px-3 py-3 text-[15px] text-[#111827] rounded-xl border border-[#e5e7eb] hover:bg-[#ececec] transition-colors"
                >
                  + New chat
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-2">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => { setActiveId(s.id); setSidebar(false); }}
                    className={`group flex items-center justify-between px-3 py-3 mx-1 rounded-xl cursor-pointer text-[15px] transition-colors ${
                      activeId === s.id ? "bg-[#ececec]" : "hover:bg-[#ececec]"
                    }`}
                  >
                    <span className="truncate text-[#111827]">{s.title}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                      className="opacity-0 group-hover:opacity-100 text-[#9ca3af] hover:text-[#111827] ml-2 shrink-0"
                    >×</button>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#f3f4f6] shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSidebar(true)}
              className="p-2 rounded-xl hover:bg-[#f3f4f6] transition-colors text-[#111827] md:hidden"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <button
              onClick={newChat}
              className="p-2 rounded-xl hover:bg-[#f3f4f6] transition-colors text-[#111827] hidden md:block"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v18M3 12h18" />
              </svg>
            </button>
            <span className="text-[15px] font-medium text-[#111827] ml-2 truncate">
              {active?.title || "Praxis AI"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[#f3f4f6] transition-colors text-[#111827]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {/* Centered column */}
          <div className="mx-auto w-full max-w-[900px] min-h-full flex flex-col">
            {!active || active.messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
                <div className="w-14 h-14 rounded-2xl bg-[#111827] flex items-center justify-center mb-8 shadow-sm">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                  </svg>
                </div>
                <h1 className="text-[26px] font-semibold text-[#111827] mb-10 tracking-[-0.02em]">
                  How can I help with Praxis?
                </h1>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  {suggestions.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => handleSend(s.q)}
                      className="text-left px-5 py-4 border border-[#e5e7eb] rounded-2xl hover:bg-[#f9fafb] hover:border-[#d1d5db] transition-all text-[15px] text-[#111827] leading-snug"
                    >
                      <div className="font-medium text-[15px] mb-1">{s.label}</div>
                      <div className="text-[13px] text-[#6b7280]">{s.q}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1">
                {active.messages.map((m, i) => (
                  <div
                    key={i}
                    className={`px-6 py-5 flex gap-5 ${
                      m.role === "assistant" ? "bg-[#f9fafb]" : ""
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-md shrink-0 flex items-center justify-center ${
                        m.role === "assistant" ? "bg-[#19c37d]" : "bg-[#111827]"
                      }`}
                    >
                      {m.role === "assistant" ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                          <circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                        </svg>
                      ) : (
                        <span className="text-white text-sm font-medium">Y</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="text-[15px] leading-[1.75] text-[#111827] whitespace-pre-wrap break-words">
                        {m.content}
                      </div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="px-6 py-5 bg-[#f9fafb] flex gap-5">
                    <div className="w-8 h-8 rounded-md bg-[#19c37d] shrink-0 flex items-center justify-center">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                      </svg>
                    </div>
                    <div className="flex gap-1.5 pt-1">
                      <div className="w-2.5 h-2.5 bg-[#d1d5db] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2.5 h-2.5 bg-[#d1d5db] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2.5 h-2.5 bg-[#d1d5db] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEnd} />
              </div>
            )}
          </div>
        </div>

        {/* Input composer */}
        <div className="shrink-0 px-4 pb-4 pt-1">
          <div className="mx-auto w-full max-w-[900px] flex items-end gap-2 bg-white border border-[#e5e7eb] rounded-2xl px-4 py-2 shadow-sm focus-within:border-[#d1d5db] transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 200) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Message Praxis AI..."
              rows={1}
              className="flex-1 resize-none text-[15px] py-2.5 text-[#111827] placeholder-[#9ca3af] bg-transparent focus:outline-none"
              style={{ minHeight: "28px" }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className={`p-2 rounded-xl shrink-0 transition-colors ${
                input.trim() && !loading
                  ? "bg-[#111827] text-white hover:bg-[#1f2937]"
                  : "bg-[#f3f4f6] text-[#9ca3af]"
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          </div>
          <div className="mx-auto w-full max-w-[900px] text-center text-[11px] text-[#9ca3af] mt-2.5">
            Praxis AI — on-chain agent commerce protocol on Pharos
          </div>
        </div>
      </div>
    </motion.div>
  );
}
