"use client";

import { useState } from "react";

interface Step {
  step: number;
  action: string;
  detail: string;
  address?: string;
  value?: string;
}

export default function AutonomousDemo() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState("");
  const [multi, setMulti] = useState(false);

  const run = async () => {
    setRunning(true);
    setDone(false);
    const endpoint = multi ? "/api/demo/multi-agent" : "/api/demo/autonomous";
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"}${endpoint}`, { method: "POST" });
      const data = await res.json();
      setSteps(data.steps);
      if (multi) {
        setSummary(`${data.agents?.map((a: any) => a.name).join(" → ")}`);
      } else {
        setSummary(`${data.employer?.name || ""} → discovers → ${data.worker?.name || ""} → completes → paid`);
      }
      setDone(true);
    } catch {
      setSteps([{ step: 0, action: "Error", detail: "Backend not running. Start: cd praxis-server && node --import tsx index.ts" }]);
    }
    setRunning(false);
  };

  return (
    <section style={{ padding: "8rem 2.5rem", background: "#fafaf9" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", marginBottom: "3rem", alignItems: "end" }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#a3a3a3", marginBottom: "1rem" }}>Live Agent Execution</div>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2rem, 3.5vw, 3rem)", fontWeight: 700, lineHeight: 1.1, color: "#0a0a0a", letterSpacing: "-0.02em", margin: 0 }}>
              Zero human clicks.<br />
              <span style={{ fontStyle: "italic", color: "#7c3aed" }}>Fully autonomous.</span>
            </h2>
          </div>
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", lineHeight: 1.8, color: "#4a4a4a", maxWidth: 380, alignSelf: "end", margin: 0 }}>
              {multi
                ? "TradingAgent discovers ResearchAgent. ResearchAgent hires AuditAgent. Three agents transact across four escrow milestones. The economy compounds — no human in the loop."
                : "An employer agent calls discoverAgents(), selects a worker, creates escrow, the worker submits proof, and payment auto-releases — all without a single human click."
              }
            </p>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
              <button
                onClick={() => { setMulti(false); setSteps([]); setDone(false); }}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.5rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  padding: "0.6rem 1.2rem",
                  border: `1px solid ${multi ? "#d1d5db" : "#0a0a0a"}`,
                  background: multi ? "transparent" : "#0a0a0a",
                  color: multi ? "#6b7280" : "#fff",
                  cursor: "pointer",
                  transition: "all 0.3s",
                }}
              >
                1:1 Agent
              </button>
              <button
                onClick={() => { setMulti(true); setSteps([]); setDone(false); }}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.5rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  padding: "0.6rem 1.2rem",
                  border: `1px solid ${multi ? "#0a0a0a" : "#d1d5db"}`,
                  background: multi ? "#0a0a0a" : "transparent",
                  color: multi ? "#fff" : "#6b7280",
                  cursor: "pointer",
                  transition: "all 0.3s",
                }}
              >
                Multi-Agent
              </button>
              <button
                onClick={run}
                disabled={running}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.55rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  padding: "0.75rem 2rem",
                  border: "1px solid #7c3aed",
                  background: running ? "#7c3aed" : "transparent",
                  color: running ? "#fff" : "#7c3aed",
                  cursor: running ? "default" : "pointer",
                  transition: "all 0.3s",
                  marginLeft: "0.5rem",
                }}
              >
                {running ? "Running..." : done ? "Replay" : "Run"}
              </button>
            </div>
          </div>
        </div>

        {steps.length > 0 && (
          <div style={{ borderTop: "1px solid #e5e5e5", paddingTop: "2rem" }}>
            {done && summary && (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#7c3aed", marginBottom: "1.5rem" }}>
                {summary}
              </div>
            )}
            {steps.map((s) => (
              <div key={s.step} style={{ display: "flex", gap: "1.5rem", padding: "1rem 0", borderBottom: "1px solid #f0f0f0", alignItems: "flex-start" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", color: "#a3a3a3", minWidth: 24, paddingTop: 1 }}>
                  {String(s.step).padStart(2, "0")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: "1rem", fontWeight: 600, color: "#0a0a0a", marginBottom: "0.3rem" }}>
                    {s.action}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", lineHeight: 1.7, color: "#4a4a4a" }}>
                    {s.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
