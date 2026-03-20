import { rebirthCtx, resolveParents, pdas, fetchers, getOrCreateAssociatedTokenAccount, getAccount, getMint, TOKEN_PROGRAM_ID, SystemProgram, rarityHashRange, assertEq, assertFalse, assertPubkeyEq, assertTrue, printJson, printSuccess, printTx, toNum } from "./_common";

async function main() {
  const { env, args } = rebirthCtx("51-rebirth-success");
  const rebirthConfig = pdas.rebirthConfig(env.programId);
  const data = await resolveParents(env, args);
  const rCfg: any = await fetchers.fetchRebirthConfig(env.program, rebirthConfig);
  const parentA: any = await fetchers.fetchMinerState(env.program, data.parentA);
  const parentB: any = await fetchers.fetchMinerState(env.program, data.parentB);
  const progressA: any = await fetchers.fetchMinerProgress(env.program, data.parentAProgress);
  const progressB: any = await fetchers.fetchMinerProgress(env.program, data.parentBProgress);

  const payer = (env.wallet as any).payer;
  const ownerAta = (await getOrCreateAssociatedTokenAccount(env.connection, payer, rCfg.essMint, data.owner)).address;
  const recipientAta = (await getOrCreateAssociatedTokenAccount(env.connection, payer, rCfg.essMint, rCfg.recipientWallet)).address;

  const ownerBefore = await getAccount(env.connection, ownerAta);
  const recipientBefore = await getAccount(env.connection, recipientAta);
  const mintBefore = await getMint(env.connection, rCfg.essMint);
  const cfgBefore: any = await fetchers.fetchConfig(env.program, data.config);

  const tx = await env.program.methods.rebirthMiner().accounts({
    owner: data.owner,
    config: data.config,
    rebirthConfig,
    parentAState: data.parentA,
    parentBState: data.parentB,
    parentAProgress: data.parentAProgress,
    parentBProgress: data.parentBProgress,
    childState: data.child,
    childProgress: data.childProgress,
    essMint: rCfg.essMint,
    ownerAta,
    recipientAta,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  }).rpc();

  const child: any = await fetchers.fetchMinerState(env.program, data.child);
  const childProgress: any = await fetchers.fetchMinerProgress(env.program, data.childProgress);
  const cfgAfter: any = await fetchers.fetchConfig(env.program, data.config);
  const ownerAfter = await getAccount(env.connection, ownerAta);
  const recipientAfter = await getAccount(env.connection, recipientAta);
  const mintAfter = await getMint(env.connection, rCfg.essMint);

  const parentRarity = toNum(parentA.rarity);
  const nextRarity = parentRarity + 1;
  const cost = Number(rCfg.essCostByRarity[parentRarity]);
  const burn = Math.floor((cost * Number(rCfg.burnBps)) / 10000);
  const treasury = cost - burn;
  const [minHash, maxHash] = rarityHashRange(nextRarity);

  assertEq("child rarity", toNum(child.rarity), nextRarity);
  assertTrue("child hash_base range", toNum(child.hashBase) >= minHash && toNum(child.hashBase) <= maxHash);
  assertFalse("child listed", child.listed);
  assertEq("nextMinerId +1", toNum(cfgAfter.nextMinerId), toNum(cfgBefore.nextMinerId) + 1);
  assertEq("owner cost debit", Number(ownerBefore.amount - ownerAfter.amount), cost);
  assertEq("recipient treasury receive", Number(recipientAfter.amount - recipientBefore.amount), treasury);
  assertEq("mint supply burn", Number(mintBefore.supply - mintAfter.supply), burn);
  assertPubkeyEq("child owner", child.owner, data.owner);
  assertTrue("parents closed", !(await env.connection.getAccountInfo(data.parentA)) && !(await env.connection.getAccountInfo(data.parentB)));

  printJson("accounts", { owner: data.owner.toBase58(), parentA: data.parentA.toBase58(), parentB: data.parentB.toBase58(), child: data.child.toBase58(), rebirthConfig: rebirthConfig.toBase58() });
  printTx("rebirthMiner", tx);
  printJson("before", { nextMinerId: toNum(cfgBefore.nextMinerId), ownerAta: ownerBefore.amount.toString(), recipientAta: recipientBefore.amount.toString(), mintSupply: mintBefore.supply.toString(), parentRarity });
  printJson("after", { nextMinerId: toNum(cfgAfter.nextMinerId), childRarity: toNum(child.rarity), childHashBase: toNum(child.hashBase), ownerAta: ownerAfter.amount.toString(), recipientAta: recipientAfter.amount.toString(), mintSupply: mintAfter.supply.toString(), inheritedLevel: toNum(childProgress.level) });
  printSuccess("rebirth sucesso validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
