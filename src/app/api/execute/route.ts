import { NextRequest, NextResponse } from "next/server";

const BACKEND = "http://localhost:4000";

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

    return NextResponse.json({ action: config.label, result: data, ok: response.ok });
  } catch (e: any) {
    return NextResponse.json({ error: `Backend not running on ${BACKEND}. Start: cd praxis-server && node --import tsx index.ts` }, { status: 500 });
  }
}
