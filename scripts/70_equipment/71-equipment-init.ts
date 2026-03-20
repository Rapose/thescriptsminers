import { equipmentCtx, resolveMiner, pdas, fetchers, SystemProgram, assertDefaultPubkey, assertEq, assertExists, assertFalse, assertPubkeyEq, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = equipmentCtx("71-equipment-init");
  const { owner, minerPk, equipment } = await resolveMiner(env, args);

  const before = await fetchers.fetchEquipmentState(env.program, equipment);
  const tx = await env.program.methods.equipmentInit().accounts({
    owner,
    minerState: minerPk,
    equipment,
    systemProgram: SystemProgram.programId,
  }).rpc();

  const after: any = assertExists("equipment", await fetchers.fetchEquipmentState(env.program, equipment));

  assertPubkeyEq("equipment.owner", after.owner, owner);
  assertPubkeyEq("equipment.miner", after.miner, minerPk);
  assertDefaultPubkey("hand_equipment", after.handEquipment);
  assertEq("hand_level", Number(after.handLevel), 0);
  assertEq("hand_power_bps", Number(after.handPowerBps), 0);
  assertFalse("hand_is_remelted", !!after.handIsRemelted);
  assertDefaultPubkey("head_equipment", after.headEquipment);
  assertEq("head_level", Number(after.headLevel), 0);
  assertEq("head_recharge_discount_bps", Number(after.headRechargeDiscountBps), 0);
  assertFalse("head_is_remelted", !!after.headIsRemelted);

  printTx("equipmentInit", tx);
  printJson("before", { exists: !!before });
  printJson("after", {
    owner: after.owner.toBase58(),
    miner: after.miner.toBase58(),
    handEquipment: after.handEquipment.toBase58(),
    handLevel: Number(after.handLevel),
    handPowerBps: Number(after.handPowerBps),
    handIsRemelted: after.handIsRemelted,
    headEquipment: after.headEquipment.toBase58(),
    headLevel: Number(after.headLevel),
    headRechargeDiscountBps: Number(after.headRechargeDiscountBps),
    headIsRemelted: after.headIsRemelted,
  });
  printSuccess("equipment_init validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
