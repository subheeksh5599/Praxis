# Job Contract Operations

Accept jobs, submit milestone proofs, confirm and release payments, dispute fraud.

> **Contract**: Individual JobContract at `<job_address>` (deployed by JobFactory)
> **Network**: Read `rpcUrl` from `assets/networks.json`
> **Private Key**: `--private-key $PRIVATE_KEY`

JobContract Status enum: `0=Created, 1=Accepted, 2=InProgress, 3=Completed, 4=Disputed, 5=Cancelled, 6=Resolved`

---

## Accept a Job

The hired agent must accept before work begins.

```bash
cast send <job> "acceptJob()" \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC
```

**Events**: `JobAccepted(agent, timestamp)`

---

## Submit Milestone Proof

Agent submits a bytes32 proof hash that cryptographically anchors the off-chain deliverable.

```bash
cast send <job> "submitMilestone(uint256,bytes32)" \
  <milestone_index> \
  <proof_hash> \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `<milestone_index>` | uint256 | Yes | 0-indexed milestone to submit |
| `<proof_hash>` | bytes32 | Yes | keccak256 hash of the deliverable, e.g. `0x$(echo -n "report.pdf" | keccak256)` |

### Example

```bash
PROOF=$(cast keccak "analysis_report_v1.pdf")
cast send 0xJobContract "submitMilestone(uint256,bytes32)" 0 $PROOF \
  --private-key $PRIVATE_KEY --rpc-url $RPC
```

**Events**: `MilestoneSubmitted(index, proofHash, timestamp)`

---

## Confirm Milestone & Release Payment

Employer verifies the off-chain work and releases payment to the agent.

```bash
cast send <job> "confirmMilestone(uint256,uint256)" \
  <milestone_index> \
  <rating> \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `<milestone_index>` | uint256 | Yes | 0-indexed milestone to confirm |
| `<rating>` | uint256 | Yes | Rating 100-500 (1–5 stars), e.g. 400 = 4/5 |

### Rating Scale

| Stars | Value | Description |
|-------|-------|-------------|
| 5 | 500 | Exceptional work |
| 4 | 400 | Good work |
| 3 | 300 | Acceptable |
| 2 | 200 | Below expectations |
| 1 | 100 | Poor |

**Events**: `MilestoneConfirmed(index, payment, rating)`, `PaymentReleased(agent, amount)`, `JobCompleted(agent, totalPayment)` (if last milestone)

---

## Dispute a Milestone

Employer disputes a submitted milestone before confirmation.

```bash
EVIDENCE=$(cast keccak "proof_of_fraudulent_work")
cast send <job> "disputeMilestone(uint256,bytes32)" \
  <milestone_index> \
  $EVIDENCE \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC
```

**Events**: `MilestoneDisputed(index, evidenceHash)`

---

## Extend Deadline

```bash
cast send <job> "extendDeadline(uint256,uint256)" \
  <milestone_index> \
  <new_deadline_unix> \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC
```

---

## Cancel Job

Only before acceptance:

```bash
cast send <job> "cancelJob()" \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC
```

---

## Query Job State

### Get Job Details

```bash
cast call <job> "getJobDetails()" --rpc-url $RPC
```

Returns: `(title, description, employer, agent, status, totalPayment, releasedPayment, acceptedAt, completedAt)`

### Get Milestone

```bash
cast call <job> "getMilestone(uint256)" <index> --rpc-url $RPC
```

### Get All Milestones

```bash
cast call <job> "getAllMilestones()" --rpc-url $RPC
```

### Get Milestone Count

```bash
cast call <job> "getMilestoneCount()" --rpc-url $RPC
```

### Query Events

```bash
# All milestones submitted
cast logs --address <job> "MilestoneSubmitted(uint256,bytes32,uint256)" --rpc-url $RPC

# All payments released
cast logs --address <job> "PaymentReleased(address,uint256)" --rpc-url $RPC

# Job completion
cast logs --address <job> "JobCompleted(address,uint256)" --rpc-url $RPC
```

### Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `OnlyAgent()` | Wrong private key for action | Use the agent's key for accept/submit |
| `OnlyEmployer()` | Wrong private key | Use the employer's key for confirm/dispute |
| `InvalidStatus()` | Job not in correct state | Check status with `getJobDetails()` |
| `MilestoneAlreadyCompleted()` | Already submitted | Submit a different milestone |
| `MilestoneAlreadyConfirmed()` | Already confirmed | Cannot confirm twice |
| `TransferFailed()` | Payment transfer failed | Check agent address is valid |

> **Agent Guidelines**:
> 1. Before `acceptJob()`: verify agent address matches `$PRIVATE_KEY`
> 2. Before `submitMilestone()`: generate proof hash from deliverable filename or content hash
> 3. Before `confirmMilestone()`: remind employer to verify off-chain work first
> 4. After `confirmMilestone()`: check `releasedPayment` vs `totalPayment` to know if job is complete
> 5. For disputes: collect cryptographic evidence before calling `disputeMilestone()`
> 6. Always show transaction links: `<explorerUrl>/tx/<txHash>`
