// ── Praxis Protocol Simulation Engine ──────────────────────────
// Implements the same logic as the 6 Solidity contracts in TypeScript.
// Replace with actual contract calls when deployed on Atlantic Testnet.

export interface Agent {
  id: number;
  address: string;
  name: string;
  description: string;
  skills: string[];
  pricePerMilestone: string; // wei
  stakeAmount: string; // wei
  isActive: boolean;
  registeredAt: number;
  totalJobsCompleted: number;
  totalJobsDisputed: number;
  metadataURI: string;
}

export interface Milestone {
  description: string;
  payment: string; // wei
  deadline: number;
  proofHash: string;
  completed: boolean;
  confirmed: boolean;
  disputed: boolean;
  completedAt: number;
}

export interface Job {
  address: string;
  title: string;
  description: string;
  employer: string;
  agent: string;
  status: "Created" | "Accepted" | "InProgress" | "Completed" | "Disputed" | "Cancelled" | "Resolved";
  totalPayment: string;
  releasedPayment: string;
  milestones: Milestone[];
  acceptedAt: number;
  completedAt: number;
}

export interface ReputationData {
  totalJobsCompleted: number;
  totalJobsDisputed: number;
  totalValueCompleted: string; // wei
  averageRating: number; // 100-500 scale
  ratingCount: number;
  lastUpdatedAt: number;
  creditScore: number;
}

export interface Dispute {
  id: number;
  job: string;
  milestoneIndex: number;
  employer: string;
  agent: string;
  evidenceHash: string;
  openedAt: number;
  resolved: boolean;
  agentAtFault: boolean;
}

// ── In-Memory Store ──────────────────────────────────────────────

const agents: Map<string, Agent> = new Map();
const jobs: Map<string, Job> = new Map();
const reputations: Map<string, ReputationData> = new Map();
const disputes: Dispute[] = [];
const stakes: Map<string, bigint> = new Map();

let nextAgentId = 1;
let nextJobId = 1;
const MIN_STAKE = BigInt("1000000000000000000"); // 1 PHRS
const MAX_SCORE = 1000;
const RATING_SCALE = 500;
const DECAY_PERIOD = 30 * 24 * 60 * 60; // 30 days
const COMPLETION_WEIGHT = 350;
const RATING_WEIGHT = 250;
const VOLUME_WEIGHT = 200;
const STAKE_WEIGHT = 200;
const MAX_VOLUME = BigInt("1000000000000000000000"); // 1000 PHRS
const MAX_STAKE = BigInt("100000000000000000000"); // 100 PHRS

// ── Agent Registry ────────────────────────────────────────────────

export function registerAgent(
  address: string,
  name: string,
  description: string,
  skills: string[],
  pricePerMilestone: string,
  metadataURI: string,
  stakeWei: string
): Agent {
  if (agents.has(address)) throw new Error("AlreadyRegistered");
  if (skills.length === 0) throw new Error("InvalidSkills");
  if (BigInt(stakeWei) < MIN_STAKE) throw new Error("StakeTooLow");

  const agent: Agent = {
    id: nextAgentId++,
    address,
    name,
    description,
    skills,
    pricePerMilestone,
    stakeAmount: stakeWei,
    isActive: true,
    registeredAt: Math.floor(Date.now() / 1000),
    totalJobsCompleted: 0,
    totalJobsDisputed: 0,
    metadataURI,
  };

  agents.set(address, agent);
  stakes.set(address, (stakes.get(address) || BigInt(0)) + BigInt(stakeWei));

  return agent;
}

export function getAgent(address: string): Agent | null {
  return agents.get(address) || null;
}

export function getActiveAgents(): Agent[] {
  return [...agents.values()].filter(a => a.isActive);
}

export function findBestAgent(
  skill: string,
  maxPrice?: string,
  minReputation?: number,
  minStake?: string
): { agent: Agent; score: number } | null {
  let best: Agent | null = null;
  let bestScore = 0;

  for (const agent of agents.values()) {
    if (!agent.isActive) continue;
    if (!agent.skills.includes(skill)) continue;
    if (maxPrice && BigInt(agent.pricePerMilestone) > BigInt(maxPrice)) continue;
    if (minReputation && getCreditScore(agent.address) < minReputation) continue;
    if (minStake && stakes.get(agent.address) && BigInt(stakes.get(agent.address)!.toString()) < BigInt(minStake)) continue;

    const score = getCreditScore(agent.address);
    if (score > bestScore) {
      bestScore = score;
      best = agent;
    }
  }

  return best ? { agent: best, score: bestScore } : null;
}

export function getAgentsByScore(
  skill: string,
  maxPrice?: string,
  minReputation?: number,
  minStake?: string,
  limit = 10
): { agent: Agent; score: number }[] {
  const matched: { agent: Agent; score: number }[] = [];

  for (const agent of agents.values()) {
    if (!agent.isActive) continue;
    if (!agent.skills.includes(skill)) continue;
    if (maxPrice && BigInt(agent.pricePerMilestone) > BigInt(maxPrice)) continue;
    if (minReputation && getCreditScore(agent.address) < minReputation) continue;
    if (minStake && (stakes.get(agent.address) || BigInt(0)) < BigInt(minStake)) continue;

    matched.push({ agent, score: getCreditScore(agent.address) });
  }

  return matched.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function discoverAgents(
  skill: string,
  minReputation = 0,
  minStake = "0",
  maxPrice = "0",
  limit = 10
): { agent: Agent; score: number }[] {
  return getAgentsByScore(skill, maxPrice || undefined, minReputation || undefined, minStake || undefined, limit);
}

export function calculateRequiredStake(agentAddress: string): string {
  const score = getCreditScore(agentAddress);
  if (score >= 800) return (MIN_STAKE / BigInt(4)).toString();   // Diamond: 25%
  if (score >= 600) return (MIN_STAKE / BigInt(2)).toString();   // Platinum: 50%
  if (score >= 400) return MIN_STAKE.toString();                  // Gold: base
  if (score >= 200) return (MIN_STAKE * BigInt(2)).toString();    // Silver: 2x
  return (MIN_STAKE * BigInt(4)).toString();                      // Bronze: 4x
}

// ── Job Factory ───────────────────────────────────────────────────

export function createJob(
  employer: string,
  agentAddress: string,
  title: string,
  description: string,
  milestones: { description: string; payment: string; deadline: number }[]
): Job {
  if (!agents.has(agentAddress)) throw new Error("AgentNotRegistered");
  if (!agents.get(agentAddress)!.isActive) throw new Error("AgentNotActive");
  if (milestones.length === 0) throw new Error("InvalidMilestones");

  const jobAddr = `0x${(nextJobId++).toString(16).padStart(40, "0")}`;

  const job: Job = {
    address: jobAddr,
    title,
    description,
    employer,
    agent: agentAddress,
    status: "Created",
    totalPayment: milestones.reduce((sum, m) => (sum + BigInt(m.payment)).toString(), "0"),
    releasedPayment: "0",
    milestones: milestones.map(m => ({
      ...m,
      proofHash: "0x",
      completed: false,
      confirmed: false,
      disputed: false,
      completedAt: 0,
    })),
    acceptedAt: 0,
    completedAt: 0,
  };

  jobs.set(jobAddr, job);
  return job;
}

export function getJob(address: string): Job | null {
  return jobs.get(address) || null;
}

export function getAllJobs(): Job[] {
  return [...jobs.values()];
}

export function getJobsByAgent(agentAddress: string): Job[] {
  return [...jobs.values()].filter(j => j.agent === agentAddress);
}

export function getActiveJobs(): Job[] {
  return [...jobs.values()].filter(j => ["Created", "Accepted", "InProgress"].includes(j.status));
}

// ── Job Contract ──────────────────────────────────────────────────

export function acceptJob(jobAddr: string, agentAddress: string): Job {
  const job = jobs.get(jobAddr);
  if (!job) throw new Error("JobNotFound");
  if (job.agent !== agentAddress) throw new Error("OnlyAgent");
  if (job.status !== "Created") throw new Error("InvalidStatus");

  job.status = "InProgress";
  job.acceptedAt = Math.floor(Date.now() / 1000);
  return job;
}

export function submitMilestone(jobAddr: string, index: number, proofHash: string, agentAddress: string): Job {
  const job = jobs.get(jobAddr);
  if (!job) throw new Error("JobNotFound");
  if (job.agent !== agentAddress) throw new Error("OnlyAgent");
  if (index >= job.milestones.length) throw new Error("InvalidMilestoneIndex");
  if (job.milestones[index].completed) throw new Error("AlreadyCompleted");

  job.milestones[index].completed = true;
  job.milestones[index].proofHash = proofHash;
  job.milestones[index].completedAt = Math.floor(Date.now() / 1000);
  return job;
}

export function confirmMilestone(jobAddr: string, index: number, rating: number, employerAddress: string): Job {
  const job = jobs.get(jobAddr);
  if (!job) throw new Error("JobNotFound");
  if (job.employer !== employerAddress) throw new Error("OnlyEmployer");
  if (index >= job.milestones.length) throw new Error("InvalidMilestoneIndex");
  if (!job.milestones[index].completed) throw new Error("NotCompleted");
  if (job.milestones[index].confirmed) throw new Error("AlreadyConfirmed");

  job.milestones[index].confirmed = true;
  job.releasedPayment = (BigInt(job.releasedPayment) + BigInt(job.milestones[index].payment)).toString();

  // Record reputation
  recordJobCompletion(job.agent, job.milestones[index].payment, rating);

  // Check if all confirmed
  const allDone = job.milestones.every(m => m.confirmed);
  if (allDone) {
    job.status = "Completed";
    job.completedAt = Math.floor(Date.now() / 1000);
  }

  return job;
}

// ── Reputation Ledger ─────────────────────────────────────────────

export function recordJobCompletion(agentAddress: string, paymentAmount: string, rating: number) {
  let rep = reputations.get(agentAddress);
  if (!rep) {
    rep = {
      totalJobsCompleted: 0,
      totalJobsDisputed: 0,
      totalValueCompleted: "0",
      averageRating: 0,
      ratingCount: 0,
      lastUpdatedAt: 0,
      creditScore: 0,
    };
  }

  rep.totalJobsCompleted++;
  rep.totalValueCompleted = (BigInt(rep.totalValueCompleted) + BigInt(paymentAmount)).toString();
  rep.averageRating = ((rep.averageRating * rep.ratingCount + rating) / (rep.ratingCount + 1)) | 0;
  rep.ratingCount++;
  rep.lastUpdatedAt = Math.floor(Date.now() / 1000);
  rep.creditScore = calculateScore(agentAddress, rep);

  reputations.set(agentAddress, rep);

  // Update agent stats
  const agent = agents.get(agentAddress);
  if (agent) agent.totalJobsCompleted++;
}

function calculateScore(agentAddress: string, rep: ReputationData): number {
  const total = rep.totalJobsCompleted + rep.totalJobsDisputed;
  const completionRate = total > 0 ? rep.totalJobsCompleted / total : 0;
  const ratingScore = rep.averageRating > 0 ? rep.averageRating / RATING_SCALE : 0;

  const volume = Number(BigInt(rep.totalValueCompleted)) / Number(MAX_VOLUME);
  const volumeScore = volume > 1 ? 1 : volume;

  const stake = Number(stakes.get(agentAddress) || BigInt(0)) / Number(MAX_STAKE);
  const stakeScore = stake > 1 ? 1 : stake;

  const elapsed = Math.floor(Date.now() / 1000) - rep.lastUpdatedAt;
  let recencyFactor = 1;
  if (elapsed >= DECAY_PERIOD * 2) recencyFactor = 0.5;
  else if (elapsed >= DECAY_PERIOD) {
    recencyFactor = 1 - ((elapsed - DECAY_PERIOD) * 0.5) / DECAY_PERIOD;
  }

  const score = (
    completionRate * COMPLETION_WEIGHT +
    ratingScore * RATING_WEIGHT +
    volumeScore * VOLUME_WEIGHT +
    stakeScore * STAKE_WEIGHT
  );

  return Math.min(MAX_SCORE, Math.floor(score * recencyFactor));
}

export function getCreditScore(agentAddress: string): number {
  return reputations.get(agentAddress)?.creditScore ?? 0;
}

export function getReputation(agentAddress: string): ReputationData | null {
  return reputations.get(agentAddress) || null;
}

export function getCreditTier(agentAddress: string): { tier: string; score: number } {
  const score = getCreditScore(agentAddress);
  let tier = "Bronze";
  if (score >= 800) tier = "Diamond";
  else if (score >= 600) tier = "Platinum";
  else if (score >= 400) tier = "Gold";
  else if (score >= 200) tier = "Silver";
  return { tier, score };
}

export function getLeaderboard(limit = 10): { address: string; name: string; score: number; tier: string }[] {
  const board: { address: string; name: string; score: number; tier: string }[] = [];

  for (const [addr, agent] of agents) {
    if (!agent.isActive) continue;
    const { score, tier } = getCreditTier(addr);
    board.push({ address: addr, name: agent.name, score, tier });
  }

  return board.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ── Slashing Engine ───────────────────────────────────────────────

export function openDispute(jobAddr: string, milestoneIndex: number, evidenceHash: string, employerAddress: string): Dispute {
  const job = jobs.get(jobAddr);
  if (!job) throw new Error("JobNotFound");
  if (job.employer !== employerAddress) throw new Error("OnlyEmployer");

  const dispute: Dispute = {
    id: disputes.length,
    job: jobAddr,
    milestoneIndex,
    employer: employerAddress,
    agent: job.agent,
    evidenceHash,
    openedAt: Math.floor(Date.now() / 1000),
    resolved: false,
    agentAtFault: false,
  };

  disputes.push(dispute);

  job.status = "Disputed";
  job.milestones[milestoneIndex].disputed = true;

  return dispute;
}

export function resolveDispute(disputeId: number, agentAtFault: boolean): Dispute | null {
  const d = disputes[disputeId];
  if (!d) throw new Error("DisputeNotFound");
  if (d.resolved) throw new Error("AlreadyResolved");

  d.resolved = true;
  d.agentAtFault = agentAtFault;

  if (agentAtFault) {
    const agent = agents.get(d.agent);
    if (agent) agent.totalJobsDisputed++;
    const rep = reputations.get(d.agent);
    if (rep) {
      rep.totalJobsDisputed++;
      rep.creditScore = calculateScore(d.agent, rep);
    }
  }

  return d;
}

// ── Autonomous Demo ─────────────────────────────────────────────

export interface AutonomousStep {
  step: number;
  action: string;
  detail: string;
  address?: string;
  value?: string;
}

export function runAutonomousDemo(): { steps: AutonomousStep[]; job: Job; employer: Agent; worker: Agent } {
  const steps: AutonomousStep[] = [];

  const best = findBestAgent("trading");
  if (!best) throw new Error("No trading agent registered");
  const employer = best.agent;

  const found = findBestAgent("audit", undefined, 200);
  if (!found) throw new Error("No audit agent with 200+ reputation");
  const worker = found.agent;
  const wName = worker.name;

  steps.push({
    step: 1,
    action: "Employer discovers worker",
    detail: `${employer.name} calls discoverAgents("audit", minRep=200). Finds ${wName} at ${getCreditTier(worker.address).tier} tier (${getCreditScore(worker.address)} pts).`,
    address: worker.address,
  });

  steps.push({
    step: 2,
    action: "Automatic selection",
    detail: `${employer.name} selects ${wName} — highest-scored auditor. Zero human clicks.`,
  });

  const job = createJob(employer.address, worker.address, "Autonomous Smart Contract Audit", "Agent-initiated security audit. No human in the loop.", [
    { description: "Full security audit with fuzzing", payment: "100000000000000000", deadline: Math.floor(Date.now() / 1000) + 7 * 86400 },
  ]);

  steps.push({
    step: 3,
    action: "Escrow funded",
    detail: `${employer.name} deploys JobContract. 0.1 PHRS locked in escrow: ${job.address}.`,
    address: job.address,
    value: "0.1 PHRS",
  });

  acceptJob(job.address, worker.address);
  steps.push({
    step: 4,
    action: "Worker accepts",
    detail: `${wName} accepts the job. Status: InProgress.`,
  });

  submitMilestone(job.address, 0, "0x" + Date.now().toString(16), worker.address);
  steps.push({
    step: 5,
    action: "Proof submitted on-chain",
    detail: `${wName} submits cryptographic proof hash, anchoring the audit deliverable to the milestone.`,
  });

  confirmMilestone(job.address, 0, 460, employer.address);
  const afterScore = getCreditScore(worker.address);
  const afterTier = getCreditTier(worker.address).tier;

  steps.push({
    step: 6,
    action: "Payment auto-released",
    detail: `${employer.name} confirms (4.6/5). 0.1 PHRS released to ${wName}. Reputation: ${afterTier} (${afterScore} pts).`,
    value: "0.1 PHRS",
  });

  return { steps, job, employer, worker };
}

export function resetDemoState() {
  agents.clear();
  jobs.clear();
  reputations.clear();
  disputes.length = 0;
  stakes.clear();
  seedDemoData();
}

// ── Protocol Stats ────────────────────────────────────────────────

export function getStats() {
  const activeAgents = [...agents.values()].filter(a => a.isActive).length;
  const totalJobs = jobs.size;
  const completedJobs = [...jobs.values()].filter(j => j.status === "Completed").length;
  const totalVolume = [...jobs.values()]
    .filter(j => j.status === "Completed")
    .reduce((sum, j) => sum + BigInt(j.totalPayment), BigInt(0))
    .toString();

  return {
    activeAgents,
    totalJobs,
    completedJobs,
    totalVolume,
    totalDisputes: disputes.length,
  };
}

// ── Seed Demo Data ────────────────────────────────────────────────

export function seedDemoData() {
  const now = Math.floor(Date.now() / 1000);
  const day = 24 * 60 * 60;

  // ResearchAgent
  registerAgent(
    "0x1111000000000000000000000000000000000001",
    "ResearchAgent",
    "Real-time market analysis, sentiment scoring, and technical indicators for crypto assets.",
    ["market analysis", "sentiment", "technical analysis"],
    "50000000000000000", // 0.05 PHRS
    "ipfs://QmResearch",
    "2000000000000000000" // 2 PHRS stake
  );

  // TradingAgent
  registerAgent(
    "0x1111000000000000000000000000000000000002",
    "TradingAgent",
    "DeFi strategy execution with optimal routing across DEXs. Multi-chain rebalancing.",
    ["trading", "defi", "arbitrage"],
    "100000000000000000", // 0.1 PHRS
    "ipfs://QmTrading",
    "5000000000000000000" // 5 PHRS stake
  );

  // AuditAgent
  registerAgent(
    "0x1111000000000000000000000000000000000003",
    "AuditAgent",
    "Smart contract security auditing. Halmos symbolic execution + Foundry fuzz testing.",
    ["audit", "security", "solidity"],
    "75000000000000000", // 0.075 PHRS
    "ipfs://QmAudit",
    "3000000000000000000" // 3 PHRS stake
  );

  // MarketingAgent
  registerAgent(
    "0x1111000000000000000000000000000000000004",
    "MarketingAgent",
    "Content generation, social media strategy, and community management for Web3 projects.",
    ["marketing", "content", "social media"],
    "30000000000000000", // 0.03 PHRS
    "ipfs://QmMarketing",
    "1000000000000000000" // 1 PHRS stake
  );

  // Job 1: TradingAgent hires ResearchAgent
  const job1 = createJob(
    "0x1111000000000000000000000000000000000002", // TradingAgent
    "0x1111000000000000000000000000000000000001", // ResearchAgent
    "BTC Technical Analysis Report",
    "Comprehensive BTC analysis with support/resistance levels and trade recommendations.",
    [
      { description: "Submit initial analysis with key levels", payment: "50000000000000000", deadline: now + 7 * day },
    ]
  );
  acceptJob(job1.address, "0x1111000000000000000000000000000000000001");
  submitMilestone(job1.address, 0, "0xa1b2c3d4e5f6...", "0x1111000000000000000000000000000000000001");
  confirmMilestone(job1.address, 0, 450, "0x1111000000000000000000000000000000000002");

  // Job 2: TradingAgent hires AuditAgent
  const job2 = createJob(
    "0x1111000000000000000000000000000000000002",
    "0x1111000000000000000000000000000000000003",
    "Smart Contract Security Audit",
    "Full audit of ERC20 swap contract with Halmos verification and Foundry test suite.",
    [
      { description: "Static analysis + vulnerability scan", payment: "50000000000000000", deadline: now + 5 * day },
      { description: "Formal verification with Halmos", payment: "50000000000000000", deadline: now + 10 * day },
    ]
  );
  acceptJob(job2.address, "0x1111000000000000000000000000000000000003");
  submitMilestone(job2.address, 0, "0xf6e5d4c3b2a1...", "0x1111000000000000000000000000000000000003");
  confirmMilestone(job2.address, 0, 480, "0x1111000000000000000000000000000000000002");

  // Active job: TradingAgent hires MarketingAgent (not completed yet)
  createJob(
    "0x1111000000000000000000000000000000000002",
    "0x1111000000000000000000000000000000000004",
    "Web3 Content Campaign",
    "Generate social media content strategy for new DeFi protocol launch.",
    [
      { description: "Content calendar draft", payment: "20000000000000000", deadline: now + 14 * day },
    ]
  );

  return { agents: agents.size, jobs: jobs.size };
}
