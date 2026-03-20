import { progressionCtx, resolveMinerAndProgress, pdas, fetchers, SystemProgram, assertPubkeyEq, assertTrue, printJson, printSuccess, printTx, toNum, pick, ensureClaimWindowIfNeeded } from "./_common";

async function main() {
  const { env, args } = progressionCtx("30-claim-mining-exp");
  const { owner, minerPk, progressPk } = await resolveMinerAndProgress(env, args);
  const progression = pdas.progression(env.programId);

  const miner: any = await fetchers.fetchMinerState(env.program, minerPk);
  const before: any = await fetchers.fetchMinerProgress(env.program, progressPk);
  const cfg: any = await fetchers.fetchProgression(env.program, progression);

  if (!before) throw new Error("MinerProgress não existe para o miner informado");

  await ensureClaimWindowIfNeeded(toNum(pick(before, "lastExpClaimTs", "last_exp_claim_ts")), toNum(pick(cfg, "miningWindowSecs", "mining_window_secs")));

  const tx = await env.program.methods.claimMiningExp().accounts({
    owner,
    minerState: minerPk,
    progression,
    minerProgress: progressPk,
    systemProgram: SystemProgram.programId,
  }).rpc();

  const after: any = await fetchers.fetchMinerProgress(env.program, progressPk);
  assertPubkeyEq("progress.owner", after.owner, owner);
  assertTrue("exp increased", toNum(after.exp) > toNum(before.exp));
  assertTrue("last_exp_claim_ts updated", toNum(pick(after, "lastExpClaimTs", "last_exp_claim_ts")) >= toNum(pick(before, "lastExpClaimTs", "last_exp_claim_ts")));

  printJson("accounts", { owner: owner.toBase58(), miner: minerPk.toBase58(), progress: progressPk.toBase58(), progression: progression.toBase58() });
  printTx("claimMiningExp", tx);
  printJson("before", { exp: toNum(before.exp), lastExpClaimTs: toNum(pick(before, "lastExpClaimTs", "last_exp_claim_ts")) });
  printJson("after", { exp: toNum(after.exp), lastExpClaimTs: toNum(pick(after, "lastExpClaimTs", "last_exp_claim_ts")), rarity: toNum(miner.rarity) });
  printSuccess("claim_mining_exp validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
