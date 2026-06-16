import { NextRequest, NextResponse } from "next/server";

const BACKEND = "http://localhost:4000";

const AGENT_NAMES: Record<string, string> = {
  "0x1111000000000000000000000000000000000001": "ResearchAgent",
  "0x1111000000000000000000000000000000000002": "TradingAgent",
  "0x1111000000000000000000000000000000000003": "AuditAgent",
  "0x1111000000000000000000000000000000000004": "MarketingAgent",
};

function fmtWei(w: string): string {
  try { return (Number(BigInt(w)) / 1e18).toFixed(4) + " PHRS"; } catch { return w; }
}

function fmtDate(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString();
}

function fmtAddr(a: string): string {
  return AGENT_NAMES[a] || a.slice(0, 14) + "...";
}

function formatResult(action: string, data: any): string {
  if (data.error) return `Error: ${data.error}`;
  if (!data.result) data = { result: data };

  const r = data.result || data;

  switch (action) {
    case "deploy":
      if (r.steps) {
        let out = `**Autonomous Demo — Complete**\n\n`;
        for (const s of r.steps) {
          out += `**${String(s.step).padStart(2, "0")}.** ${s.action}\n> ${s.detail}\n\n`;
        }
        return out;
      }
      break;

    case "leaderboard":
      if (Array.isArray(r)) {
        let out = `**Credit Score Leaderboard**\n\n`;
        for (const a of r.slice(0, 10)) {
          out += `${a.name} → **${a.score} pts** (${a.tier})\n`;
        }
        return out;
      }
      break;

    case "agents":
      if (Array.isArray(r)) {
        let out = `**Registered Agents**\n\n`;
        for (const a of r) {
          out += `**${a.name}** · ${a.tier} (${a.creditScore} pts) · ${fmtWei(a.pricePerMilestone)}/milestone · stake: ${fmtWei(a.stakeAmount)}\n> ${a.description}\n\n`;
        }
        return out;
      }
      break;

    case "jobs":
      if (Array.isArray(r)) {
        let out = `**Active Jobs**\n\n`;
        for (const j of r) {
          const statusColor = j.status === "InProgress" ? "🟡" : j.status === "Completed" ? "🟢" : "⚪";
          out += `${statusColor} **${j.title}** · ${j.status}\n`;
          out += `> Employer: ${fmtAddr(j.employer)} · Worker: ${fmtAddr(j.agent)}\n`;
          out += `> Payment: ${fmtWei(j.releasedPayment)} / ${fmtWei(j.totalPayment)}\n`;
          if (j.milestones) {
            for (const m of j.milestones) {
              const mStatus = m.confirmed ? "✓" : m.completed ? "⏳" : "○";
              out += `> ${mStatus} ${m.description} · ${fmtWei(m.payment)} · ${fmtDate(m.deadline)}\n`;
            }
          }
          out += `\n`;
        }
        return out;
      }
      break;

    case "stats":
      if (r.activeAgents !== undefined) {
        return `**Protocol Stats**\n\n` +
          `Active Agents: **${r.activeAgents}**\n` +
          `Total Jobs: **${r.totalJobs}**\n` +
          `Completed: **${r.completedJobs}**\n` +
          `Total Volume: **${fmtWei(r.totalVolume)}**\n` +
          `Disputes: **${r.totalDisputes}**`;
      }
      break;
  }

  return JSON.stringify(r, null, 2);
}

const ACTIONS: Record<string, { endpoint: string; method: string; body?: any; label: string }> = {
  deploy: {
    endpoint: "/api/demo/autonomous",
    method: "POST",
    label: "Deploy & Run Autonomous Demo",
  },
  leaderboard: {
    endpoint: "/api/leaderboard",
    method: "GET",
    label: "Credit Score Leaderboard",
  },
  agents: {
    endpoint: "/api/agents",
    method: "GET",
    label: "All Registered Agents",
  },
  jobs: {
    endpoint: "/api/jobs/active",
    method: "GET",
    label: "Active Jobs",
  },
  stats: {
    endpoint: "/api/stats",
    method: "GET",
    label: "Protocol Stats",
  },
};

export async function POST(req: NextRequest) {
  try {
    const { action, skill } = await req.json();
    const config = ACTIONS[action];
    if (!config) {
      return NextResponse.json({ error: `Unknown action: ${action}. Available: ${Object.keys(ACTIONS).join(", ")}` });
    }

    let url = `${BACKEND}${config.endpoint}`;
    if (skill) url += `?search=1&skill=${encodeURIComponent(skill)}`;

    const options: RequestInit = { method: config.method, headers: { "Content-Type": "application/json" } };
    if (config.body) options.body = JSON.stringify(config.body);

    const response = await fetch(url, options);
    const data = await response.json();

    return NextResponse.json({
      action: config.label,
      formatted: formatResult(action, data),
      ok: response.ok,
    });
  } catch (e: any) {
    return NextResponse.json({ error: `Backend not running on ${BACKEND}. Start: cd praxis-server && node --import tsx index.ts` }, { status: 500 });
  }
}
