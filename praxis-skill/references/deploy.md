# Deploy Praxis Protocol

Deploys all 6 Praxis contracts to Pharos Atlantic Testnet in one transaction sequence.

> **Network Configuration**: Read from `assets/networks.json`
> **Private Key**: `--private-key $PRIVATE_KEY`

---

## Deploy All Contracts

### Overview

Deploys StakeVault → ReputationLedger → AgentRegistry → SlashingEngine → JobFactory in sequence. Each contract receives the address of its dependency. The deployer becomes admin of all contracts.

### Step 1: Verify Prerequisites

```bash
cast balance $DEPLOYER --rpc-url $RPC --ether
```

Confirm balance ≥ 0.5 PHRS for gas.

### Step 2: Execute Deployment

```bash
forge script script/DeployAll.s.sol:DeployAll \
  --rpc-url $RPC \
  --private-key $PRIVATE_KEY \
  --broadcast
```

### Output Parsing

| Field | Description |
|-------|-------------|
| `StakeVault:` | StakeVault contract address |
| `ReputationLedger:` | ReputationLedger contract address |
| `AgentRegistry:` | AgentRegistry contract address |
| `SlashingEngine:` | SlashingEngine contract address |
| `JobFactory:` | JobFactory contract address |
| `Deployer:` | Deployer wallet address |

### Step 3: Verify Each Contract

```bash
sleep 10

# Verify StakeVault
forge verify-contract <stakevault_addr> src/StakeVault.sol:StakeVault \
  --chain-id $CHAIN_ID --verifier-url $VERIFIER_URL --verifier blockscout

# Verify ReputationLedger
forge verify-contract <reputation_addr> src/ReputationLedger.sol:ReputationLedger \
  --chain-id $CHAIN_ID --verifier-url $VERIFIER_URL --verifier blockscout \
  --constructor-args $(cast abi-encode "constructor(address)" <stakevault_addr>)

# Verify AgentRegistry
forge verify-contract <registry_addr> src/AgentRegistry.sol:AgentRegistry \
  --chain-id $CHAIN_ID --verifier-url $VERIFIER_URL --verifier blockscout \
  --constructor-args $(cast abi-encode "constructor(address,address)" <stakevault_addr> <reputation_addr>)

# Verify SlashingEngine
forge verify-contract <slashing_addr> src/SlashingEngine.sol:SlashingEngine \
  --chain-id $CHAIN_ID --verifier-url $VERIFIER_URL --verifier blockscout \
  --constructor-args $(cast abi-encode "constructor(address,address)" <stakevault_addr> <reputation_addr>)

# Verify JobFactory
forge verify-contract <factory_addr> src/JobFactory.sol:JobFactory \
  --chain-id $CHAIN_ID --verifier-url $VERIFIER_URL --verifier blockscout \
  --constructor-args $(cast abi-encode "constructor(address,address,address)" <registry_addr> <slashing_addr> <reputation_addr>)
```

### Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `insufficient funds` | Deployer balance too low | Check `cast balance --ether` |
| `connection refused` | Missing `--rpc-url` | Always pass `--rpc-url $RPC` |
| `compiler error` | Foundry version mismatch | Run `foundryup` |
| `contract not found` during verify | Indexer not synced | Wait 15s and retry |
| `already verified` | Contract verified previously | Skip verification |

> **Agent Guidelines**:
> 1. Run all four Write Operation Pre-checks (see SKILL.md)
> 2. Copy `assets/praxis/*.sol` to user's project `src/` directory
> 3. Copy `script/DeployAll.s.sol` to user's project `script/` directory
> 4. Ask user to confirm network (Atlantic Testnet, Chain ID 688689)
> 5. Run `forge build` first to confirm compilation
> 6. Execute `forge script DeployAll`
> 7. Save all 6 contract addresses
> 8. Show block explorer links for each: `<explorerUrl>/address/<contract>`
> 9. Ask user if they want to verify contracts
