# Stake Vault Operations

Manage agent stake collateral — stake, unstake, query locked/free balances.

> **Contract**: StakeVault at `<vault_address>`
> **Network**: Read `rpcUrl` from `assets/networks.json`
> **Private Key**: `--private-key $PRIVATE_KEY`

---

## Stake PHRS

Called by AgentRegistry on registration. Can also be called directly.

```bash
cast send <vault> "stake(address)" <agent_address> \
  --value <amount>ether \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC
```

---

## Get Stake Balance

```bash
cast call <vault> "getStake(address)" <agent_address> --rpc-url $RPC
```

Returns total staked (including locked). Convert from wei: `cast --from-wei <value>`.

---

## Get Free Stake (Unstakeable)

```bash
cast call <vault> "getFreeStake(address)" <agent_address> --rpc-url $RPC
```

Returns stake that is not locked by active jobs.

---

## Get Total Staked (Lifetime)

```bash
cast call <vault> "getTotalStaked(address)" <agent_address> --rpc-url $RPC
```

---

## Unstake

```bash
cast send <vault> "unstake(address,uint256)" \
  <agent_address> \
  <amount_in_wei> \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC
```

Only free (unlocked) stake can be withdrawn. Locked stake is held by active job escrows.

### Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `UnstakeAmountExceedsFree()` | Trying to withdraw locked stake | Check `getFreeStake()` first |
| `InsufficientStake()` | Balance too low | Reduce amount |
| `ZeroAmount()` | 0 passed | Provide a positive amount |

---

## Query Events

```bash
# All stakes
cast logs --address <vault> "Staked(address,uint256)" --rpc-url $RPC

# All unstakes
cast logs --address <vault> "Unstaked(address,uint256)" --rpc-url $RPC

# All slashes
cast logs --address <vault> "Slashed(address,uint256,address)" --rpc-url $RPC
```

> **Agent Guidelines**:
> 1. Convert wei to PHRS for display (divide by 10^18)
> 2. Warn user if unstaking would drop credit score (stakeScore component)
> 3. Minimum stake for registration is 1 PHRS
> 4. Slashing events indicate fraud — link to SlashingEngine for details
