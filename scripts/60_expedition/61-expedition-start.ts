import { expeditionCtx, resolveEssMint, resolveTier, findOwnedMinerForExpedition, ensureRewardsVaultLiquidity, pdas, fetchers, getAccount, assertEq, assertExists, assertPubkeyEq, assertTrue, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = expeditionCtx("61-expedition-start");
  const tier = resolveTier(args);
  const essMint = resolveEssMint(args);
  const expeditionConfig = pdas.expeditionConfig(env.programId);
  const economy = pdas.economy(env.programId);

  const { owner, minerPk, minerProgress } = await findOwnedMinerForExpedition(env, args);
  const sessionPk = pdas.expeditionSession(env.programId, minerPk);

  const topUp = await ensureRewardsVaultLiquidity(env, essMint, 1_000_000_000n);
  const ownerBefore = await getAccount(env.connection, topUp.ownerAta);

  const tx = await env.program.methods.expeditionStart(tier).accounts({
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

  const ownerAfter = await getAccount(env.connection, topUp.ownerAta);
  const session: any = assertExists("session", await fetchers.fetchExpeditionSession(env.program, sessionPk));
  const miner: any = assertExists("miner", await fetchers.fetchMinerState(env.program, minerPk));
  const cfg: any = assertExists("expeditionConfig", await fetchers.fetchExpeditionConfig(env.program, expeditionConfig));

  const expectedSpent = BigInt(cfg.tierCostEss[tier - 1].toString()) * 100_000_000n;
  assertEq("débito ESS", ownerBefore.amount - ownerAfter.amount, expectedSpent);
  assertPubkeyEq("session.owner", session.owner, owner);
  assertPubkeyEq("session.miner", session.miner, minerPk);
  assertEq("session.tier", Number(session.tier), tier);
  assertEq("session.ess_spent", Number(session.essSpent), Number(expectedSpent));
  assertTrue("session.started_at > 0", Number(session.startedAt) > 0);
  assertTrue("session.ends_at > started_at", Number(session.endsAt) > Number(session.startedAt));
  assertEq("miner.expedition_ends_at", Number(miner.expeditionEndsAt), Number(session.endsAt));

  printTx("expeditionStart", tx);
  printJson("accounts", {
    owner: owner.toBase58(),
    miner: minerPk.toBase58(),
    minerProgress: minerProgress.toBase58(),
    session: sessionPk.toBase58(),
    expeditionConfig: expeditionConfig.toBase58(),
    economy: economy.toBase58(),
  });
  printJson("before", { ownerAta: ownerBefore.amount.toString() });
  printJson("after", {
    ownerAta: ownerAfter.amount.toString(),
    session: {
      startedAt: session.startedAt.toString(),
      endsAt: session.endsAt.toString(),
      tier: Number(session.tier),
      essSpent: session.essSpent.toString(),
    },
    minerExpeditionEndsAt: miner.expeditionEndsAt.toString(),
  });
  printSuccess("expedition_start validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
