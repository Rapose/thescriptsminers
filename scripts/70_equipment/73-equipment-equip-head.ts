import { PublicKey } from "@solana/web3.js";
import { equipmentCtx, resolveMiner, findFreeEquipment, fetchers, assertEq, assertExists, assertPubkeyEq, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = equipmentCtx("73-equipment-equip-head");
  const { owner, minerPk, equipment } = await resolveMiner(env, args);
  const newEquipment = args.newEquipment
    ? new PublicKey(args.newEquipment)
    : (await findFreeEquipment(env, owner, 1, 1))[0]?.pubkey;

  if (!newEquipment) throw new Error("Sem equipment de cabeça livre. Gere via expedition_claim_equipment.");

  const before: any = assertExists("equipment before", await fetchers.fetchEquipmentState(env.program, equipment));
  const instanceBefore: any = assertExists("instance before", await fetchers.fetchEquipmentInstance(env.program, newEquipment));

  const tx = await env.program.methods.equipmentEquipHead().accounts({
    owner,
    minerState: minerPk,
    equipment,
    newEquipment,
  }).rpc();

  const after: any = assertExists("equipment after", await fetchers.fetchEquipmentState(env.program, equipment));
  const instanceAfter: any = assertExists("instance after", await fetchers.fetchEquipmentInstance(env.program, newEquipment));

  assertPubkeyEq("head_equipment", after.headEquipment, newEquipment);
  assertEq("head_level", Number(after.headLevel), Number(instanceAfter.level));
  assertEq("head_recharge_discount_bps", Number(after.headRechargeDiscountBps), Number(instanceAfter.rechargeDiscountBps));
  assertPubkeyEq("instance.equipped_to_miner", instanceAfter.equippedToMiner, minerPk);

  printTx("equipmentEquipHead", tx);
  printJson("before", {
    headEquipment: before.headEquipment.toBase58(),
    headLevel: Number(before.headLevel),
    headRechargeDiscountBps: Number(before.headRechargeDiscountBps),
    instanceEquippedToMiner: instanceBefore.equippedToMiner.toBase58(),
  });
  printJson("after", {
    headEquipment: after.headEquipment.toBase58(),
    headLevel: Number(after.headLevel),
    headRechargeDiscountBps: Number(after.headRechargeDiscountBps),
    instanceEquippedToMiner: instanceAfter.equippedToMiner.toBase58(),
  });
  printSuccess("equipment_equip_head validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
