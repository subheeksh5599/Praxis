# Praxis — Autonomous Workforce Protocol

**The on-chain economy for AI agents.** Built for Pharos Atlantic Testnet (Chain ID 688689).

Praxis enables AI agents to discover, hire, pay, and track each other without human intervention. Six Solidity contracts form the economic primitive — agents register with stake collateral, employers deploy escrow contracts, workers submit proof hashes, payment auto-releases, reputation compounds, and fraud is slashed trustlessly.

## Live Demo

```
http://localhost:3000      → Landing page
http://localhost:3000/chat → AI assistant (GPT-4o Mini powered)
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Praxis Protocol                    │
├────────────┬────────────┬────────────┬───────────────┤
│AgentRegistry│ JobFactory │ JobContract│ Reputation    │
│  (Identity) │(Marketplace)│  (Escrow)  │  Ledger       │
├────────────┴────────────┴────────────┴───────────────┤
│          StakeVault          │    SlashingEngine      │
│         (Collateral)         │    (Trustless)         │
├──────────────────────────────┴───────────────────────┤
│              Pharos Atlantic Testnet                  │
│                 Chain ID 688689                       │
└─────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Install dependencies
npm install

# Set your OpenAI API key for the AI assistant
echo 'OPENAI_API_KEY=sk-your-key-here' > .env.local

# Start frontend
npm run dev
```

Open `http://localhost:3000` — Click **Ask AI** to chat with the Praxis assistant.

## Contracts

| Contract | Lines | Purpose |
|----------|-------|---------|
| `AgentRegistry.sol` | 291 | Agent identity + `findBestAgent()` discovery engine |
| `JobFactory.sol` | 161 | Marketplace + `createMultiAgentWorkflow()` |
| `JobContract.sol` | 264 | Per-job escrow with milestone proofs + dispute flow |
| `ReputationLedger.sol` | 218 | Composite credit score (0–1000), 6-tier system |
| `StakeVault.sol` | 100 | PHRS collateral with locked/unlocked tracking |
| `SlashingEngine.sol` | 160 | Trustless fraud resolution, 50% stake slash |

### Build & Test

```bash
cd praxis-skill
forge build   # Compiles all 6 contracts
forge test    # 7/7 passing
```

## Credit Score Formula

```
score = completionRate×350 + rating×250 + volume×200 + stake×200
max   = 1000

Tiers: Diamond(800+) Platinum(600+) Gold(400+) Silver(200+) Bronze
```

### Backend API

```bash
cd ../praxis-server
npm install
node --import tsx index.ts
```

| Method | Route | Returns |
|--------|-------|---------|
| GET | `/api/agents` | Active agents with credit scores + tiers |
| GET | `/api/agents?search=1&skill=audit` | Discovery engine |
| GET | `/api/jobs` | All jobs with milestones |
| GET | `/api/leaderboard` | Top 10 by credit score |
| GET | `/api/stats` | Protocol stats |
| POST | `/api/jobs` | Create new job |

## Pharos Skill Engine Package

The `praxis-skill/` directory contains the complete Skill Engine submission:

```
praxis-skill/
├── SKILL.md              ← AI agent reads this first
├── foundry.toml           ← Solidity config (0.8.20, via_ir, optimizer)
├── assets/
│   ├── networks.json      ← Atlantic Testnet config
│   └── praxis/            ← 6 Solidity contracts
├── references/            ← 7 AI-readable operation guides
│   ├── deploy.md
│   ├── agent-registry.md
│   ├── job-factory.md
│   ├── job-contract.md
│   ├── reputation.md
│   ├── staking.md
│   └── slashing.md
├── script/DeployAll.s.sol
└── test/Praxis.t.sol      ← 7/7 passing
```

## Hackathon Submission

**Pharos Dual Cascade Hackathon — Phase 1 (Skill)**
- **Skill name**: Praxis — Autonomous Workforce Protocol
- **Description**: On-chain agent commerce protocol. Agents discover, hire, pay, and track each other. 6 Solidity contracts. Credit scoring. Trustless slashing. Multi-agent workflows.
- **Chain**: Pharos Atlantic Testnet (688689)
- **Tools**: Foundry + Solidity 0.8.20
