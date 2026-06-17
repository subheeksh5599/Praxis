import express from "express";
import cors from "cors";
import {
  seedDemoData,
  getAgent,
  getActiveAgents,
  findBestAgent,
  getAgentsByScore,
  discoverAgents,
  calculateRequiredStake,
  getAllJobs,
  getActiveJobs,
  getLeaderboard,
  getCreditTier,
  getReputation,
  getStats,
  createJob,
  acceptJob,
  submitMilestone,
  confirmMilestone,
  registerAgent,
  runAutonomousDemo,
  runMultiAgentDemo,
  resetDemoState,
} from "./engine.js";

const app = express();
app.use(cors());
app.use(express.json());

// Seed demo data on startup
const seed = seedDemoData();
console.log(`Seeded ${seed.agents} agents, ${seed.jobs} jobs`);

// ── Agents ──────────────────────────────────────────────────────

app.get("/api/agents", (req, res) => {
  const { skill, maxPrice, minReputation, minStake, search } = req.query;
  if (search && skill) {
    return res.json(discoverAgents(
      skill as string,
      Number(minReputation) || 0,
      (minStake as string) || "0",
      (maxPrice as string) || "0",
    ));
  }
  const agents = getActiveAgents().map(a => {
    const { tier, score } = getCreditTier(a.address);
    return { ...a, tier, creditScore: score, requiredStake: calculateRequiredStake(a.address) };
  });
  res.json(agents);
});

app.get("/api/agents/:address", (req, res) => {
  const agent = getAgent(req.params.address);
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  const { tier, score } = getCreditTier(agent.address);
  const rep = getReputation(agent.address);
  res.json({ ...agent, tier, creditScore: score, reputation: rep });
});

app.post("/api/agents", (req, res) => {
  try {
    const { address, name, description, skills, pricePerMilestone, stakeWei, metadataURI } = req.body;
    if (!address || !name || !skills?.length) {
      return res.status(400).json({ error: "address, name, and skills are required" });
    }
    const agent = registerAgent(
      address,
      name,
      description || "",
      skills,
      pricePerMilestone || "50000000000000000",
      metadataURI || "ipfs://",
      stakeWei || "1000000000000000000"
    );
    const { tier, score } = getCreditTier(agent.address);
    res.status(201).json({ ...agent, tier, creditScore: score });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/agents/search", (req, res) => {
  const { skill, maxPrice } = req.query;
  if (!skill) return res.status(400).json({ error: "skill required" });
  const results = getAgentsByScore(skill as string, maxPrice as string);
  res.json(results);
});

// ── Jobs ────────────────────────────────────────────────────────

app.get("/api/jobs", (_req, res) => {
  res.json(getAllJobs());
});

app.get("/api/jobs/active", (_req, res) => {
  res.json(getActiveJobs());
});

app.post("/api/jobs", (req, res) => {
  try {
    const { employer, agent, title, description, milestones } = req.body;
    const job = createJob(employer, agent, title, description, milestones);
    res.status(201).json(job);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/jobs/:address/accept", (req, res) => {
  try {
    const job = acceptJob(req.params.address, req.body.agent);
    res.json(job);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/jobs/:address/submit", (req, res) => {
  try {
    const job = submitMilestone(
      req.params.address,
      req.body.milestoneIndex,
      req.body.proofHash,
      req.body.agent
    );
    res.json(job);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/jobs/:address/confirm", (req, res) => {
  try {
    const job = confirmMilestone(
      req.params.address,
      req.body.milestoneIndex,
      req.body.rating,
      req.body.employer
    );
    res.json(job);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ── Autonomous Demo ────────────────────────────────────────────

app.post("/api/demo/autonomous", (_req, res) => {
  try {
    resetDemoState();
    const result = runAutonomousDemo();
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/demo/multi-agent", (_req, res) => {
  try {
    resetDemoState();
    const result = runMultiAgentDemo();
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ── Reputation ──────────────────────────────────────────────────

app.get("/api/leaderboard", (_req, res) => {
  res.json(getLeaderboard(10));
});

app.get("/api/reputation/:address", (req, res) => {
  const rep = getReputation(req.params.address);
  if (!rep) return res.status(404).json({ error: "No reputation data" });
  const { tier, score } = getCreditTier(req.params.address);
  res.json({ ...rep, tier, creditScore: score });
});

// ── Stats ───────────────────────────────────────────────────────

app.get("/api/stats", (_req, res) => {
  res.json(getStats());
});

// ── Start ───────────────────────────────────────────────────────

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Praxis API running on http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  GET  /api/agents`);
  console.log(`  GET  /api/agents/:address`);
  console.log(`  GET  /api/agents/search?skill=audit`);
  console.log(`  GET  /api/jobs`);
  console.log(`  GET  /api/jobs/active`);
  console.log(`  POST /api/jobs`);
  console.log(`  GET  /api/leaderboard`);
  console.log(`  GET  /api/stats`);
});
