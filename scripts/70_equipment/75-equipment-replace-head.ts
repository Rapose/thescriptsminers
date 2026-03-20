import { PublicKey } from "@solana/web3.js";
import { equipmentCtx, resolveMiner, findFreeEquipment, fetchers, toNum, assertEq, assertExists, assertFalse, assertPubkeyEq, assertTrue, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = equipmentCtx("75-equipment-replace-head");
  const { owner, minerPk, equipment } = await resolveMiner(env, args);
  const stateBefore: any = assertExists("equipment before", await fetchers.fetchEquipmentState(env.program, equipment));

  const oldEquipment = args.oldEquipment ? new PublicKey(args.oldEquipment) : stateBefore.headEquipment;
  const minLevel = toNum(stateBefore.headLevel) + 1;
  const newEquipment = args.newEquipment
    ? new PublicKey(args.newEquipment)
    : (await findFreeEquipment(env, owner, 1, minLevel))[0]?.pubkey;

  if (!newEquipment) throw new Error(`Sem head equipment livre com level >= ${minLevel}.`);

  const oldBefore: any = assertExists("old before", await fetchers.fetchEquipmentInstance(env.program, oldEquipment));
  const newBefore: any = assertExists("new before", await fetchers.fetchEquipmentInstance(env.program, newEquipment));

  const tx = await env.program.methods.equipmentReplaceHead().accounts({
    owner,
    minerState: minerPk,
    equipment,
    oldEquipment,
    newEquipment,
  }).rpc();

  const stateAfter: any = assertExists("equipment after", await fetchers.fetchEquipmentState(env.program, equipment));
  const oldAfter: any = assertExists("old after", await fetchers.fetchEquipmentInstance(env.program, oldEquipment));
  const newAfter: any = assertExists("new after", await fetchers.fetchEquipmentInstance(env.program, newEquipment));

  assertPubkeyEq("item antigo sai do slot", oldAfter.equippedToMiner, PublicKey.default);
  assertTrue("item antigo vira broken", !!oldAfter.broken);
  assertFalse("item antigo listed false", !!oldAfter.listed);

  assertPubkeyEq("item novo entra no slot", stateAfter.headEquipment, newEquipment);
  assertEq("head_level atualizado", Number(stateAfter.headLevel), Number(newAfter.level));
  assertEq("head_recharge_discount_bps atualizado", Number(stateAfter.headRechargeDiscountBps), Number(newAfter.rechargeDiscountBps));
  assertEq("head_is_remelted atualizado", !!stateAfter.headIsRemelted, !!newAfter.remelted);
  assertPubkeyEq("item novo aponta miner", newAfter.equippedToMiner, minerPk);

  printTx("equipmentReplaceHead", tx);
  printJson("before", {
    headEquipment: stateBefore.headEquipment.toBase58(),
    headLevel: Number(stateBefore.headLevel),
    old: { broken: oldBefore.broken, listed: oldBefore.listed, equippedToMiner: oldBefore.equippedToMiner.toBase58() },
    new: { level: Number(newBefore.level), equippedToMiner: newBefore.equippedToMiner.toBase58() },
  });
  printJson("after", {
    headEquipment: stateAfter.headEquipment.toBase58(),
    headLevel: Number(stateAfter.headLevel),
    headRechargeDiscountBps: Number(stateAfter.headRechargeDiscountBps),
    headIsRemelted: stateAfter.headIsRemelted,
    old: { broken: oldAfter.broken, listed: oldAfter.listed, equippedToMiner: oldAfter.equippedToMiner.toBase58() },
    new: { level: Number(newAfter.level), equippedToMiner: newAfter.equippedToMiner.toBase58() },
  });
  printSuccess("equipment_replace_head validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
