import { PublicKey } from "@solana/web3.js";
import { equipmentCtx, resolveMiner, findFreeEquipment, fetchers, toNum, assertEq, assertExists, assertFalse, assertPubkeyEq, assertTrue, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = equipmentCtx("74-equipment-replace-hand");
  const { owner, minerPk, equipment } = await resolveMiner(env, args);
  const stateBefore: any = assertExists("equipment before", await fetchers.fetchEquipmentState(env.program, equipment));

  const oldEquipment = args.oldEquipment ? new PublicKey(args.oldEquipment) : stateBefore.handEquipment;
  const minLevel = toNum(stateBefore.handLevel) + 1;
  const newEquipment = args.newEquipment
    ? new PublicKey(args.newEquipment)
    : (await findFreeEquipment(env, owner, 0, minLevel))[0]?.pubkey;

  if (!newEquipment) throw new Error(`Sem hand equipment livre com level >= ${minLevel}.`);

  const oldBefore: any = assertExists("old before", await fetchers.fetchEquipmentInstance(env.program, oldEquipment));
  const newBefore: any = assertExists("new before", await fetchers.fetchEquipmentInstance(env.program, newEquipment));

  const tx = await env.program.methods.equipmentReplaceHand().accounts({
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

  assertPubkeyEq("item novo entra no slot", stateAfter.handEquipment, newEquipment);
  assertEq("hand_level atualizado", Number(stateAfter.handLevel), Number(newAfter.level));
  assertEq("hand_power_bps atualizado", Number(stateAfter.handPowerBps), Number(newAfter.powerBps));
  assertEq("hand_is_remelted atualizado", !!stateAfter.handIsRemelted, !!newAfter.remelted);
  assertPubkeyEq("item novo aponta miner", newAfter.equippedToMiner, minerPk);

  printTx("equipmentReplaceHand", tx);
  printJson("before", {
    handEquipment: stateBefore.handEquipment.toBase58(),
    handLevel: Number(stateBefore.handLevel),
    old: { broken: oldBefore.broken, listed: oldBefore.listed, equippedToMiner: oldBefore.equippedToMiner.toBase58() },
    new: { level: Number(newBefore.level), equippedToMiner: newBefore.equippedToMiner.toBase58() },
  });
  printJson("after", {
    handEquipment: stateAfter.handEquipment.toBase58(),
    handLevel: Number(stateAfter.handLevel),
    handPowerBps: Number(stateAfter.handPowerBps),
    handIsRemelted: stateAfter.handIsRemelted,
    old: { broken: oldAfter.broken, listed: oldAfter.listed, equippedToMiner: oldAfter.equippedToMiner.toBase58() },
    new: { level: Number(newAfter.level), equippedToMiner: newAfter.equippedToMiner.toBase58() },
  });
  printSuccess("equipment_replace_hand validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
