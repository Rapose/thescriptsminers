import { PublicKey } from "@solana/web3.js";
import { progressionCtx, resolveMinerAndProgress, pdas, fetchers, expRequired, essCostForLevelUp, getOrCreateAssociatedTokenAccount, getAccount, TOKEN_PROGRAM_ID, SystemProgram, expectFailure, assertEq, assertTrue, printJson, printSuccess, printTx, printWarn, toNum, pick, bn } from "./_common";

async function main() {
  const { env, args } = progressionCtx("32-miner-level-up");
  const { owner, config, minerPk, progressPk } = await resolveMinerAndProgress(env, args);
  const progression = pdas.progression(env.programId);
  const economy = pdas.economy(env.programId);

  const cfg: any = await fetchers.fetchProgression(env.program, progression);
  const eco: any = await fetchers.fetchEconomy(env.program, economy);
  const miner: any = await fetchers.fetchMinerState(env.program, minerPk);
  const before: any = await fetchers.fetchMinerProgress(env.program, progressPk);

  const rarity = toNum(miner.rarity);
  const levelBefore = toNum(before.level);
  const expBefore = toNum(before.exp);
  const maxLevel = Number(pick(cfg, "maxLevelByRarity", "max_level_by_rarity")[rarity]);
  const needExp = expRequired(cfg, rarity, levelBefore);
  const cost = essCostForLevelUp(cfg, rarity, levelBefore);

  const essMint = eco.essMint as PublicKey;
  const recipientWallet = eco.recipientWallet as PublicKey;
  const payer = (env.wallet as any).payer;
  const userAta = (await getOrCreateAssociatedTokenAccount(env.connection, payer, essMint, owner)).address;
  const recipientAta = (await getOrCreateAssociatedTokenAccount(env.connection, payer, essMint, recipientWallet)).address;

  if (levelBefore >= maxLevel) {
    await expectFailure("max level failure", async () => {
      await env.program.methods.minerLevelUp().accounts({ owner, minerState: minerPk, progression, minerProgress: progressPk, economy, essMint, userAta, recipientWallet, recipientAta, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).rpc();
    });
    printWarn("Miner já está no max level; validado erro esperado.");
    return;
  }

  if (expBefore < needExp) {
    await expectFailure("not enough exp failure", async () => {
      await env.program.methods.minerLevelUp().accounts({ owner, minerState: minerPk, progression, minerProgress: progressPk, economy, essMint, userAta, recipientWallet, recipientAta, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).rpc();
    });

    const missing = needExp - expBefore;
    const grantTx = await env.program.methods.adminGrantExp(bn(missing)).accounts({ admin: owner, config, progression, minerState: minerPk, minerProgress: progressPk, systemProgram: SystemProgram.programId }).rpc();
    printTx("adminGrantExp(auto)", grantTx);
  }

  const userBefore = await getAccount(env.connection, userAta);
  const tx = await env.program.methods.minerLevelUp().accounts({
    owner,
    minerState: minerPk,
    progression,
    minerProgress: progressPk,
    economy,
    essMint,
    userAta,
    recipientWallet,
    recipientAta,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  }).rpc();

  const after: any = await fetchers.fetchMinerProgress(env.program, progressPk);
  const userAfter = await getAccount(env.connection, userAta);

  assertEq("level +1", toNum(after.level), levelBefore + 1);
  assertEq("exp consumed", toNum(after.exp), 0);
  assertEq("ESS cost respected", Number(userBefore.amount - userAfter.amount), cost);

  printJson("accounts", { owner: owner.toBase58(), miner: minerPk.toBase58(), progression: progression.toBase58(), economy: economy.toBase58() });
  printTx("minerLevelUp", tx);
  printJson("before", { level: levelBefore, exp: expBefore, needExp, cost, userAta: userBefore.amount.toString() });
  printJson("after", { level: toNum(after.level), exp: toNum(after.exp), userAta: userAfter.amount.toString() });
  printSuccess("miner_level_up validado com custos e falhas esperadas");
}

main().catch((e) => { console.error(e); process.exit(1); });
