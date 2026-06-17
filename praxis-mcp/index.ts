#!/usr/bin/env node
// Praxis Skill — MCP Server
// Exposes 8 tools: discover/register/create_job/agents/leaderboard/jobs/stats/demo
// Any MCP-compatible AI agent (Claude, Codex, OpenAI) can load this skill.

import { createInterface } from "readline";

const BACKEND = process.env.PRAXIS_BACKEND || "http://localhost:4000";

type JSONID = string | number;

interface Req {
  jsonrpc: "2.0";
  method: string;
  id: JSONID;
  params?: Record<string, unknown>;
}

function respond(id: JSONID, result?: unknown, error?: { code: number; message: string }) {
  const r: Record<string, unknown> = { jsonrpc: "2.0", id };
  if (error) r.error = error;
  else r.result = result;
  process.stdout.write(JSON.stringify(r) + "\n");
}

const TOOLS = [
  {
    name: "discover_agents",
    description:
      "Search for AI worker agents by skill, minimum reputation tier, minimum stake collateral, and maximum price per milestone. Returns agents ranked by credit score.",
    inputSchema: {
      type: "object",
      properties: {
        skill: { type: "string", description: "Skill to search, e.g. 'audit', 'trading', 'market analysis'" },
        min_reputation: { type: "number", description: "Min credit score (400=Gold, 600=Platinum, 800=Diamond)" },
        min_stake: { type: "string", description: "Min stake in wei, e.g. '1000000000000000000' for 1 PHRS" },
        max_price: { type: "string", description: "Max price per milestone in wei, e.g. '100000000000000000' for 0.1 PHRS" },
      },
      required: ["skill"],
    },
  },
  {
    name: "register_agent",
    description:
      "Register a new AI agent on Praxis with skills, description, pricing, and PHRS stake collateral. The agent becomes discoverable immediately.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        skills: { type: "string", description: "Comma-separated skills, e.g. 'audit,security,solidity'" },
        price_per_milestone: { type: "string", description: "Price per milestone in wei (e.g. '50000000000000000' = 0.05 PHRS)" },
        stake: { type: "string", description: "PHRS stake in wei (e.g. '2000000000000000000' = 2 PHRS). Must be >= 1 PHRS." },
      },
      required: ["name", "skills", "price_per_milestone"],
    },
  },
  {
    name: "create_job",
    description:
      "Create an escrow job on Praxis. Deploys a per-job contract with milestones, deadlines, and locked PHRS payment. Workers accept and submit proof to earn.",
    inputSchema: {
      type: "object",
      properties: {
        employer: { type: "string", description: "Employer agent address" },
        agent: { type: "string", description: "Worker agent address to hire" },
        title: { type: "string" },
        description: { type: "string" },
        milestones: { type: "string", description: "JSON array of {description, payment (wei), deadline (unix)}" },
      },
      required: ["employer", "agent", "title", "milestones"],
    },
  },
  {
    name: "get_agents",
    description: "List all AI agents registered on Praxis with their skills, pricing, credit tier, and stake.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_leaderboard",
    description: "Get the top 10 agents ranked by credit score (0-1000) with their tier (Diamond/Platinum/Gold/Silver/Bronze).",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_jobs",
    description: "List all active jobs in the Praxis marketplace with status, payment, and milestone progress.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_stats",
    description: "Get Praxis protocol statistics: active agents, total jobs, completed jobs, total volume, disputes.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "run_autonomous_demo",
    description:
      "Run a zero-human-click autonomous demo: employer discovers worker → creates escrow → worker submits proof → payment auto-releases → reputation updates.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "run_multi_agent_demo",
    description:
      "Run a 3-agent workflow demo: TradingAgent hires ResearchAgent → ResearchAgent hires AuditAgent → proofs submitted → payments cascade across all three agents. Shows the AI agent economy in action.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];

async function callBackend(method: string, endpoint: string, body?: Record<string, unknown>) {
  const url = `${BACKEND}${endpoint}`;
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error((data.error as string) || `HTTP ${res.status}`);
  return data;
}

async function handleToolCall(name: string, args: Record<string, unknown>) {
  try {
    switch (name) {
      case "discover_agents": {
        const skill = args.skill as string;
        const params = new URLSearchParams({ search: "1", skill });
        if (args.min_reputation) params.set("minReputation", String(args.min_reputation));
        if (args.min_stake) params.set("minStake", args.min_stake as string);
        if (args.max_price) params.set("maxPrice", args.max_price as string);
        const data = await callBackend("GET", `/api/agents?${params}`);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "register_agent": {
        const addr = `0x${Date.now().toString(16).padStart(40, "0")}`;
        const data = await callBackend("POST", "/api/agents", {
          address: addr,
          name: args.name,
          description: args.description || "",
          skills: (args.skills as string).split(",").map((s) => s.trim()),
          pricePerMilestone: args.price_per_milestone || "50000000000000000",
          stakeWei: args.stake || "1000000000000000000",
          metadataURI: "ipfs://",
        });
        return { content: [{ type: "text", text: `Agent registered: ${(data as any).name} at ${(data as any).address}\nTier: ${(data as any).tier}\nSkills: ${(data as any).skills?.join(", ")}` }] };
      }

      case "create_job": {
        let milestones: { description: string; payment: string; deadline: number }[];
        try { milestones = JSON.parse(args.milestones as string); } catch { throw new Error("milestones must be valid JSON array"); }
        const data = await callBackend("POST", "/api/jobs", {
          employer: args.employer,
          agent: args.agent,
          title: args.title,
          description: args.description || "",
          milestones,
        });
        return { content: [{ type: "text", text: `Job created: ${(data as any).title}\nAddress: ${(data as any).address}\nStatus: ${(data as any).status}\nPayment locked: ${(data as any).totalPayment} wei` }] };
      }

      case "get_agents": {
        const data = await callBackend("GET", "/api/agents");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "get_leaderboard": {
        const data = await callBackend("GET", "/api/leaderboard");
        const lines = (data as any[]).map((a: any) => `${a.name} — ${a.score} pts (${a.tier})`);
        return { content: [{ type: "text", text: lines.join("\n") }] };
      }

      case "get_jobs": {
        const data = await callBackend("GET", "/api/jobs/active");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "get_stats": {
        const d = await callBackend("GET", "/api/stats") as any;
        const text = `Active Agents: ${d.activeAgents}\nTotal Jobs: ${d.totalJobs}\nCompleted: ${d.completedJobs}\nTotal Volume: ${d.totalVolume} wei\nDisputes: ${d.totalDisputes}`;
        return { content: [{ type: "text", text }] };
      }

      case "run_autonomous_demo": {
        const data = await callBackend("POST", "/api/demo/autonomous") as any;
        const steps = data.steps?.map((s: any) => `${String(s.step).padStart(2, "0")}. ${s.action}: ${s.detail}`).join("\n");
        return { content: [{ type: "text", text: `Autonomous Demo — Complete\n\n${steps}` }] };
      }

      case "run_multi_agent_demo": {
        const data = await callBackend("POST", "/api/demo/multi-agent") as any;
        const steps = data.steps?.map((s: any) => `${String(s.step).padStart(2, "0")}. ${s.action}: ${s.detail}`).join("\n");
        return { content: [{ type: "text", text: `Multi-Agent Workflow Demo — Complete\n\n${steps}` }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (e: any) {
    return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
  }
}

// ── MCP stdio transport ─────────────────────────────────────────

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });

let initialized = false;

rl.on("line", async (line: string) => {
  if (!line.trim()) return;
  let req: Req;
  try { req = JSON.parse(line); } catch { return; }

  if (req.method === "initialize") {
    initialized = true;
    respond(req.id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "praxis-skill", version: "0.1.0" },
    });
    return;
  }

  if (req.method === "notifications/initialized") return;

  if (!initialized) {
    respond(req.id, undefined, { code: -32002, message: "Not initialized" });
    return;
  }

  if (req.method === "tools/list") {
    respond(req.id, { tools: TOOLS });
    return;
  }

  if (req.method === "tools/call") {
    const { name, arguments: args = {} } = (req.params || {}) as { name?: string; arguments?: Record<string, unknown> };
    if (!name) { respond(req.id, undefined, { code: -32602, message: "Missing tool name" }); return; }
    const result = await handleToolCall(name, args);
    respond(req.id, result);
    return;
  }

  respond(req.id, undefined, { code: -32601, message: `Unknown method: ${req.method}` });
});

rl.on("close", () => process.exit(0));
