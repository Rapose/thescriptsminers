import { expeditionCtx, resolveEssMint, ensureRewardsVaultLiquidity, pdas, fetchers, waitForExpeditionUnlock, TOKEN_PROGRAM_ID, assertEq, assertExists, assertTrue, printJson, printSuccess, printTx } from "./_common";
import { PublicKey } from "@solana/web3.js";

async function main() {
  const { env, args } = expeditionCtx("62-expedition-resolve");
  const owner = env.wallet.publicKey;
  const essMint = resolveEssMint(args);

  let minerPk: PublicKey;
  if (args.miner) {
    minerPk = new PublicKey(args.miner);
  } else {
    const client = env.program.account?.minerState;
    if (!client) throw new Error("IDL sem account minerState");
    const miners = await client.all();
    const mine = miners.filter((row: any) => row.account.owner.equals(owner));
    const withSession = [];
    for (const row of mine) {
      const sessionPk = pdas.expeditionSession(env.programId, row.publicKey);
      const session: any = await fetchers.fetchExpeditionSession(env.program, sessionPk);
      if (session && Number(session.resolvedAt) === 0) withSession.push(row.publicKey);
    }
    if (!withSession.length) throw new Error("Nenhuma sessão pendente encontrada. Passe --miner=...");
    minerPk = withSession[0];
  }
  const minerProgress = pdas.minerProgress(env.programId, minerPk);
  const expeditionConfig = pdas.expeditionConfig(env.programId);
  const economy = pdas.economy(env.programId);
  const sessionPk = pdas.expeditionSession(env.programId, minerPk);

  const topUp = await ensureRewardsVaultLiquidity(env, essMint, 1_000_000_000n);
  const sessionBefore: any = assertExists("sessionBefore", await fetchers.fetchExpeditionSession(env.program, sessionPk));

  await waitForExpeditionUnlock(env.connection, Number(sessionBefore.endsAt));

  const tx = await env.program.methods.expeditionResolve().accounts({
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

  const sessionAfter: any = assertExists("sessionAfter", await fetchers.fetchExpeditionSession(env.program, sessionPk));
  const minerAfter: any = assertExists("minerAfter", await fetchers.fetchMinerState(env.program, minerPk));

  assertTrue("session resolvida", Number(sessionAfter.resolvedAt) > 0);
  assertTrue("reward_kind válido", [1, 2].includes(Number(sessionAfter.rewardKind)));
  assertTrue("reward_slot válido", [0, 1, 255].includes(Number(sessionAfter.rewardSlot)));
  assertTrue("reward_level válido", Number(sessionAfter.rewardLevel) >= 0);
  assertTrue("reward_broken bool", typeof sessionAfter.rewardBroken === "boolean");
  assertTrue("reward_remelted bool", typeof sessionAfter.rewardRemelted === "boolean");
  assertTrue("refund_amount >= 0", Number(sessionAfter.refundAmount) >= 0);
  assertEq("miner.expedition_ends_at reset", Number(minerAfter.expeditionEndsAt), 0);

  printTx("expeditionResolve", tx);
  printJson("accounts", {
    owner: owner.toBase58(),
    miner: minerPk.toBase58(),
    minerProgress: minerProgress.toBase58(),
    session: sessionPk.toBase58(),
  });
  printJson("before", {
    tier: Number(sessionBefore.tier),
    endsAt: Number(sessionBefore.endsAt),
    resolvedAt: Number(sessionBefore.resolvedAt),
  });
  printJson("after", {
    rewardKind: Number(sessionAfter.rewardKind),
    rewardSlot: Number(sessionAfter.rewardSlot),
    rewardLevel: Number(sessionAfter.rewardLevel),
    rewardBroken: sessionAfter.rewardBroken,
    rewardRemelted: sessionAfter.rewardRemelted,
    rewardClaimed: sessionAfter.rewardClaimed,
    refundAmount: Number(sessionAfter.refundAmount),
    resolvedAt: Number(sessionAfter.resolvedAt),
  });
  printSuccess("expedition_resolve validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
