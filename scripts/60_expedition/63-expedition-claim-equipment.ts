import { expeditionCtx, pdas, fetchers, equipmentInstancePda, assertDefaultPubkey, assertEq, assertExists, assertFalse, assertPubkeyEq, assertTrue, printJson, printSuccess, printTx } from "./_common";
import { PublicKey } from "@solana/web3.js";

async function main() {
  const { env, args } = expeditionCtx("63-expedition-claim-equipment");
  const owner = env.wallet.publicKey;

  if (!args.miner) throw new Error("Passe --miner=<miner_pda> com sessão resolvida de reward equipment");
  const minerPk = new PublicKey(args.miner);
  const sessionPk = pdas.expeditionSession(env.programId, minerPk);
  const equipmentCounter = pdas.equipmentCounter(env.programId);

  const sessionBefore: any = assertExists("sessionBefore", await fetchers.fetchExpeditionSession(env.program, sessionPk));
  const counterBefore: any = assertExists("counterBefore", await fetchers.fetchEquipmentCounter(env.program, equipmentCounter));

  assertEq("reward_kind equipment", Number(sessionBefore.rewardKind), 2);
  assertFalse("reward_claimed false", !!sessionBefore.rewardClaimed);

  const equipmentInstance = equipmentInstancePda(env.programId, BigInt(counterBefore.nextId.toString()));

  const tx = await env.program.methods.expeditionClaimEquipment().accounts({
    owner,
    minerState: minerPk,
    expeditionSession: sessionPk,
    equipmentCounter,
    equipmentInstance,
  }).rpc();

  const sessionAfter: any = assertExists("sessionAfter", await fetchers.fetchExpeditionSession(env.program, sessionPk));
  const counterAfter: any = assertExists("counterAfter", await fetchers.fetchEquipmentCounter(env.program, equipmentCounter));
  const eq: any = assertExists("equipmentInstance", await fetchers.fetchEquipmentInstance(env.program, equipmentInstance));

  assertTrue("reward_claimed = true", !!sessionAfter.rewardClaimed);
  assertPubkeyEq("equipment.owner", eq.owner, owner);
  assertEq("equipment.slot", Number(eq.slot), Number(sessionBefore.rewardSlot));
  assertEq("equipment.level", Number(eq.level), Number(sessionBefore.rewardLevel));
  assertDefaultPubkey("equipment.equipped_to_miner", eq.equippedToMiner);
  assertFalse("equipment.listed", !!eq.listed);
  assertTrue("equipment.active", !!eq.active);
  assertEq("counter +1", Number(counterAfter.nextId), Number(counterBefore.nextId) + 1);

  printTx("expeditionClaimEquipment", tx);
  printJson("accounts", {
    owner: owner.toBase58(),
    miner: minerPk.toBase58(),
    session: sessionPk.toBase58(),
    equipmentCounter: equipmentCounter.toBase58(),
    equipmentInstance: equipmentInstance.toBase58(),
  });
  printJson("after", {
    rewardClaimed: sessionAfter.rewardClaimed,
    equipment: {
      owner: eq.owner.toBase58(),
      slot: Number(eq.slot),
      level: Number(eq.level),
      equippedToMiner: eq.equippedToMiner.toBase58(),
      listed: eq.listed,
      active: eq.active,
      broken: eq.broken,
      remelted: eq.remelted,
    },
  });
  printSuccess("expedition_claim_equipment validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
