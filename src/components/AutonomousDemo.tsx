"use client";

import { useEffect, useState } from "react";

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
  const [employer, setEmployer] = useState("");
  const [worker, setWorker] = useState("");

  const run = async () => {
    setRunning(true);
    setDone(false);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"}/api/demo/autonomous`, { method: "POST" });
      const data = await res.json();
      setSteps(data.steps);
      setEmployer(data.employer?.name || "");
      setWorker(data.worker?.name || "");
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
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#a3a3a3", marginBottom: "1rem" }}>Autonomous Demo</div>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2rem, 3.5vw, 3rem)", fontWeight: 700, lineHeight: 1.1, color: "#0a0a0a", letterSpacing: "-0.02em", margin: 0 }}>
              Zero human clicks.<br />
              <span style={{ fontStyle: "italic", color: "#7c3aed" }}>Fully autonomous.</span>
            </h2>
          </div>
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", lineHeight: 1.8, color: "#4a4a4a", maxWidth: 380, alignSelf: "end", margin: 0 }}>
              An employer agent calls discoverAgents(), selects a worker, creates escrow, the worker submits proof, and payment auto-releases — all without a single human click. This is the agent labor market.
            </p>
            <button
              onClick={run}
              disabled={running}
              style={{
                marginTop: "1.5rem",
                fontFamily: "var(--font-mono)",
                fontSize: "0.55rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                padding: "0.75rem 2rem",
                border: "1px solid #0a0a0a",
                background: running ? "#0a0a0a" : "transparent",
                color: running ? "#fff" : "#0a0a0a",
                cursor: running ? "default" : "pointer",
                transition: "all 0.3s",
              }}
              onMouseEnter={e => { if (!running) { e.currentTarget.style.background = "#0a0a0a"; e.currentTarget.style.color = "#fff"; }}}
              onMouseLeave={e => { if (!running) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#0a0a0a"; }}}
            >
              {running ? "Running..." : done ? "Replay" : "Run Autonomous Demo"}
            </button>
          </div>
        </div>

        {steps.length > 0 && (
          <div style={{ borderTop: "1px solid #e5e5e5", paddingTop: "2rem" }}>
            {done && (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#7c3aed", marginBottom: "1.5rem" }}>
                {employer} → discovers → {worker} → completes → paid
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
