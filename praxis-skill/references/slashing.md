# Slashing Engine Operations

Open disputes, resolve fraud claims, slash agent stakes, refund victims.

> **Contract**: SlashingEngine at `<slashing_address>`
> **Network**: Read `rpcUrl` from `assets/networks.json`
> **Private Key**: `--private-key $PRIVATE_KEY`

---

## Open a Dispute

Called by JobContract when employer disputes a milestone.

```bash
cast send <slashing> "openDispute(address,uint256,bytes32)" \
  <job_address> \
  <milestone_index> \
  <evidence_hash> \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC
```

**Events**: `DisputeOpened(disputeId, job, milestoneIndex, agent, evidenceHash)`

---

## Resolve a Dispute

Admin-only. If agent is at fault, their stake is slashed and sent to the victim.

```bash
cast send <slashing> "resolveDispute(uint256,address,bool)" \
  <dispute_id> \
  <agent_address> \
  <agent_at_fault_true_or_false> \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `<dispute_id>` | uint256 | Yes | Dispute ID from opening event |
| `<agent_address>` | address | Yes | Address of the agent being disputed |
| `<agent_at_fault>` | bool | Yes | `true` = agent slashed, victim refunded; `false` = agent exonerated |

### Slash Amount

```
slashAmount = MAX_SLASH (50 PHRS) × slashPercentage (50%) = 25 PHRS
```

If `agent_at_fault` is false, no slash occurs. Reputation is still updated with a dispute record.

### Events

`DisputeResolved(disputeId, agentAtFault, slashAmount, victim)`

---

## Get Dispute Details

```bash
cast call <slashing> "getDispute(uint256)" <dispute_id> --rpc-url $RPC
```

Returns `(job, milestoneIndex, employer, agent, evidenceHash, openedAt, resolved, agentAtFault, resolvedAt)`.

---

## Query All Disputes

```bash
# Get dispute count
DISPUTE_COUNT=$(cast call <slashing> "disputeCount()" --rpc-url $RPC)

# Loop through disputes
for i in $(seq 0 $((DISPUTE_COUNT - 1))); do
  cast call <slashing> "getDispute(uint256)" $i --rpc-url $RPC
done
```

---

### Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `DisputeNotFound()` | Invalid dispute ID | Check `disputeCount()` |
| `AlreadyResolved()` | Dispute already settled | Check `resolved` field |
| `AlreadyDisputed()` | Milestone already under dispute | Cannot double-dispute |
| `NotAdmin()` | Only admin can resolve | Use admin's private key |

> **Agent Guidelines**:
> 1. Only call `resolveDispute()` with admin's private key
> 2. Before resolving: review `getDispute()` for evidence hash and timestamps
> 3. After slash: verify victim balance and agent's new credit score
> 4. Show both parties' explorer links: `<explorerUrl>/address/<agent>` and `<explorerUrl>/tx/<settleTx>`
> 5. If `agent_at_fault = false`: clearly state "Agent exonerated — no slash. Dispute recorded on reputation."
> 6. Slashed agents drop in credit score — warn the user
