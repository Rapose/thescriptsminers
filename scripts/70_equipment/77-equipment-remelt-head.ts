import { equipmentCtx, resolveMiner, resolveEssMint, findFreeFourSameLevel, pdas, fetchers, TOKEN_PROGRAM_ID, SystemProgram, getAccount, getOrCreateAssociatedTokenAccount, assertDefaultPubkey, assertEq, assertExists, assertFalse, assertPubkeyEq, assertTrue, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = equipmentCtx("77-equipment-remelt-head");
  const { owner } = await resolveMiner(env, args);
  const essMint = resolveEssMint(args);
  const equipmentCounter = pdas.equipmentCounter(env.programId);

  const set = await findFreeFourSameLevel(env, owner, 1);
  const counterBefore: any = assertExists("counter before", await fetchers.fetchEquipmentCounter(env.program, equipmentCounter));
  const outputEquipment = pdas.equipmentInstance(env.programId, BigInt(counterBefore.nextId.toString()));

  const payer = (env.wallet as any).payer;
  const userAta = (await getOrCreateAssociatedTokenAccount(env.connection, payer, essMint, owner)).address;
  const rewardsVault = pdas.rewardsVault(essMint, pdas.rewardsAuthority(env.programId));
  const userBefore = await getAccount(env.connection, userAta);

  const tx = await env.program.methods.equipmentRemeltHead().accounts({
    owner,
    equipmentCounter,
    outputEquipment,
    itemA: set.items[0].pubkey,
    itemB: set.items[1].pubkey,
    itemC: set.items[2].pubkey,
    itemD: set.items[3].pubkey,
    userAta,
    rewardsVault,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  }).rpc();

  const userAfter = await getAccount(env.connection, userAta);
  const counterAfter: any = assertExists("counter after", await fetchers.fetchEquipmentCounter(env.program, equipmentCounter));
  const output: any = assertExists("output equipment", await fetchers.fetchEquipmentInstance(env.program, outputEquipment));

  for (const item of set.items) {
    const after: any = assertExists("input item after", await fetchers.fetchEquipmentInstance(env.program, item.pubkey));
    assertFalse("input inactive", !!after.active);
    assertFalse("input listed false", !!after.listed);
  }

  assertEq("counter +1", Number(counterAfter.nextId), Number(counterBefore.nextId) + 1);
  assertEq("output slot head", Number(output.slot), 1);
  assertPubkeyEq("output owner", output.owner, owner);
  assertFalse("output listed = false", !!output.listed);
  assertTrue("output active = true", !!output.active);
  assertTrue("output remelted = true", !!output.remelted);
  assertDefaultPubkey("output equipped_to_miner", output.equippedToMiner);
  assertTrue("ESS debit > 0", userBefore.amount > userAfter.amount);

  printTx("equipmentRemeltHead", tx);
  printJson("input", { level: set.level, items: set.items.map((x) => x.pubkey.toBase58()) });
  printJson("output", {
    outputEquipment: outputEquipment.toBase58(),
    slot: Number(output.slot),
    level: Number(output.level),
    owner: output.owner.toBase58(),
    listed: output.listed,
    active: output.active,
    remelted: output.remelted,
    userAtaBefore: userBefore.amount.toString(),
    userAtaAfter: userAfter.amount.toString(),
  });
  printSuccess("equipment_remelt_head validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
