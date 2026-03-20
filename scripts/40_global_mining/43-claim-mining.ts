import { gmCtx, resolveMinerLand, pdas, fetchers, resolveEssMint, TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount, getAccount, assertTrue, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = gmCtx("43-claim-mining");
  const { owner, minerPk, minerMining } = await resolveMinerLand(env, args);
  const global = pdas.globalMining(env.programId);
  const economy = pdas.economy(env.programId);
  const rewardsAuthority = pdas.rewardsAuthority(env.programId);
  const essMint = resolveEssMint(args);
  const rewardsVault = pdas.rewardsVault(essMint, rewardsAuthority);
  const payer = (env.wallet as any).payer;
  const userAta = (await getOrCreateAssociatedTokenAccount(env.connection, payer, essMint, owner)).address;

  const userBefore = await getAccount(env.connection, userAta);
  const before: any = await fetchers.fetchMinerMiningState(env.program, minerMining);

  const tx = await env.program.methods.globalMiningClaim().accounts({
    owner,
    global,
    minerMining,
    minerState: minerPk,
    essMint,
    economy,
    rewardsAuthority,
    rewardsVault,
    userAta,
    tokenProgram: TOKEN_PROGRAM_ID,
  }).rpc();

  const userAfter = await getAccount(env.connection, userAta);
  const after: any = await fetchers.fetchMinerMiningState(env.program, minerMining);

  assertTrue("claimed true", after.claimed);
  assertTrue("received ESS", userAfter.amount >= userBefore.amount);

  printJson("accounts", { owner: owner.toBase58(), global: global.toBase58(), minerMining: minerMining.toBase58(), userAta: userAta.toBase58() });
  printTx("globalMiningClaim", tx);
  printJson("before", { claimed: before.claimed, userAta: userBefore.amount.toString(), epTw: before.epTw.toString() });
  printJson("after", { claimed: after.claimed, userAta: userAfter.amount.toString(), epTw: after.epTw.toString() });
  printSuccess("claim mining validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
