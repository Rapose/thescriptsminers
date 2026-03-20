import { PublicKey } from "@solana/web3.js";
import { equipmentCtx, resolveMiner, findFreeEquipment, fetchers, assertEq, assertExists, assertPubkeyEq, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = equipmentCtx("72-equipment-equip-hand");
  const { owner, minerPk, equipment } = await resolveMiner(env, args);
  const newEquipment = args.newEquipment
    ? new PublicKey(args.newEquipment)
    : (await findFreeEquipment(env, owner, 0, 1))[0]?.pubkey;

  if (!newEquipment) throw new Error("Sem equipment de mão livre. Gere via expedition_claim_equipment.");

  const before: any = assertExists("equipment before", await fetchers.fetchEquipmentState(env.program, equipment));
  const instanceBefore: any = assertExists("instance before", await fetchers.fetchEquipmentInstance(env.program, newEquipment));

  const tx = await env.program.methods.equipmentEquipHand().accounts({
    owner,
    minerState: minerPk,
    equipment,
    newEquipment,
  }).rpc();

  const after: any = assertExists("equipment after", await fetchers.fetchEquipmentState(env.program, equipment));
  const instanceAfter: any = assertExists("instance after", await fetchers.fetchEquipmentInstance(env.program, newEquipment));

  assertPubkeyEq("hand_equipment", after.handEquipment, newEquipment);
  assertEq("hand_level", Number(after.handLevel), Number(instanceAfter.level));
  assertEq("hand_power_bps", Number(after.handPowerBps), Number(instanceAfter.powerBps));
  assertPubkeyEq("instance.equipped_to_miner", instanceAfter.equippedToMiner, minerPk);

  printTx("equipmentEquipHand", tx);
  printJson("before", {
    handEquipment: before.handEquipment.toBase58(),
    handLevel: Number(before.handLevel),
    handPowerBps: Number(before.handPowerBps),
    instanceEquippedToMiner: instanceBefore.equippedToMiner.toBase58(),
  });
  printJson("after", {
    handEquipment: after.handEquipment.toBase58(),
    handLevel: Number(after.handLevel),
    handPowerBps: Number(after.handPowerBps),
    instanceEquippedToMiner: instanceAfter.equippedToMiner.toBase58(),
  });
  printSuccess("equipment_equip_hand validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
