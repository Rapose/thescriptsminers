import { equipmentCtx, pdas, fetchers, SystemProgram, assertEq, assertExists, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env } = equipmentCtx("70-equipment-counter-init");
  const equipmentCounter = pdas.equipmentCounter(env.programId);

  const before = await fetchers.fetchEquipmentCounter(env.program, equipmentCounter);
  const tx = await env.program.methods.equipmentCounterInit().accounts({
    admin: env.wallet.publicKey,
    equipmentCounter,
    systemProgram: SystemProgram.programId,
  }).rpc();
  const after: any = assertExists("equipmentCounter", await fetchers.fetchEquipmentCounter(env.program, equipmentCounter));

  assertEq("counter.next_id", Number(after.nextId), 1);

  printTx("equipmentCounterInit", tx);
  printJson("before", { exists: !!before, nextId: before ? Number((before as any).nextId) : null });
  printJson("after", { nextId: Number(after.nextId) });
  printSuccess("equipment_counter_init validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
