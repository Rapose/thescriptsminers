import { expeditionCtx, resolveEssMint, resolveTier, findOwnedMinerForExpedition, ensureRewardsVaultLiquidity, pdas, fetchers, waitForExpeditionUnlock, equipmentInstancePda, TOKEN_PROGRAM_ID, getAccount, assertDefaultPubkey, assertEq, assertExists, assertFalse, assertPubkeyEq, assertTrue, printJson, printSuccess, printTx, printWarn } from "./_common";

async function main() {
  const { env, args } = expeditionCtx("64-expedition-full-cycle");
  const owner = env.wallet.publicKey;
  const tier = resolveTier(args);
  const essMint = resolveEssMint(args);
  const expeditionConfig = pdas.expeditionConfig(env.programId);
  const economy = pdas.economy(env.programId);

  const { minerPk, minerProgress } = await findOwnedMinerForExpedition(env, args);
  const sessionPk = pdas.expeditionSession(env.programId, minerPk);
  const equipmentCounter = pdas.equipmentCounter(env.programId);

  const topUp = await ensureRewardsVaultLiquidity(env, essMint, 1_000_000_000n);
  const ownerBefore = await getAccount(env.connection, topUp.ownerAta);

  const startTx = await env.program.methods.expeditionStart(tier).accounts({
    owner,
    expeditionConfig,
    economy,
    minerState: minerPk,
    minerProgress,
    expeditionSession: sessionPk,
    essMint,
    ownerAta: topUp.ownerAta,
    rewardsVault: topUp.rewardsVault,
  }).rpc();
  printTx("expeditionStart", startTx);

  const started: any = assertExists("session started", await fetchers.fetchExpeditionSession(env.program, sessionPk));
  await waitForExpeditionUnlock(env.connection, Number(started.endsAt));

  const resolveTx = await env.program.methods.expeditionResolve().accounts({
    owner,
    minerState: minerPk,
    minerProgress,
    expeditionSession: sessionPk,
    economy,
    expeditionConfig,
    tokenProgram: TOKEN_PROGRAM_ID,
    rewardsVault: topUp.rewardsVault,
    rewardsAuthority: topUp.rewardsAuthority,
    ownerAta: topUp.ownerAta,
  }).rpc();
  printTx("expeditionResolve", resolveTx);

  const resolved: any = assertExists("session resolved", await fetchers.fetchExpeditionSession(env.program, sessionPk));
  assertTrue("session resolvida", Number(resolved.resolvedAt) > 0);

  let claimTx: string | null = null;
  if (Number(resolved.rewardKind) === 2) {
    const counterBefore: any = assertExists("counter", await fetchers.fetchEquipmentCounter(env.program, equipmentCounter));
    const equipmentInstance = equipmentInstancePda(env.programId, BigInt(counterBefore.nextId.toString()));
    claimTx = await env.program.methods.expeditionClaimEquipment().accounts({
      owner,
      minerState: minerPk,
      expeditionSession: sessionPk,
      equipmentCounter,
      equipmentInstance,
    }).rpc();

    const eq: any = assertExists("equipmentInstance", await fetchers.fetchEquipmentInstance(env.program, equipmentInstance));
    const sessionAfterClaim: any = assertExists("sessionAfterClaim", await fetchers.fetchExpeditionSession(env.program, sessionPk));
    assertTrue("reward_claimed true", !!sessionAfterClaim.rewardClaimed);
    assertPubkeyEq("equipment.owner", eq.owner, owner);
    assertEq("equipment.slot", Number(eq.slot), Number(resolved.rewardSlot));
    assertEq("equipment.level", Number(eq.level), Number(resolved.rewardLevel));
    assertDefaultPubkey("equipment.equipped_to_miner", eq.equippedToMiner);
    assertFalse("equipment.listed", !!eq.listed);
    assertTrue("equipment.active", !!eq.active);
  } else {
    printWarn("resolve retornou refund; sem claim de equipment neste ciclo.");
  }

  const ownerAfter = await getAccount(env.connection, topUp.ownerAta);
  const minerAfter: any = assertExists("minerAfter", await fetchers.fetchMinerState(env.program, minerPk));
  assertTrue("débito ESS > 0", ownerBefore.amount > ownerAfter.amount);
  assertEq("miner.expedition_ends_at reset", Number(minerAfter.expeditionEndsAt), 0);

  printJson("result", {
    owner: owner.toBase58(),
    miner: minerPk.toBase58(),
    tier,
    session: sessionPk.toBase58(),
    rewardKind: Number(resolved.rewardKind),
    rewardSlot: Number(resolved.rewardSlot),
    rewardLevel: Number(resolved.rewardLevel),
    rewardBroken: resolved.rewardBroken,
    rewardRemelted: resolved.rewardRemelted,
    refundAmount: Number(resolved.refundAmount),
    claimTx,
  });
  printSuccess("expedition full cycle executado");
}

main().catch((e) => { console.error(e); process.exit(1); });
