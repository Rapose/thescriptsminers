import { PublicKey, SystemProgram } from "@solana/web3.js";
import { expectFailure, logStep, SuiteCtx } from "./_shared";

const SEED_EQUIPMENT = Buffer.from("equipment_v1");

function pda(programId: PublicKey, ...parts: (Buffer | Uint8Array)[]) {
  return PublicKey.findProgramAddressSync(parts, programId)[0];
}

export async function runMarketplaceLockTests(ctx: SuiteCtx, a: Record<string, any>) {
  const p = ctx.program;

  logStep("locks/miner listed cannot claim exp");
  await expectFailure("claim_mining_exp when miner listed", async () => {
    await p.methods
      .claimMiningExp()
      .accounts({
        owner: ctx.seller.publicKey,
        minerState: a.miner,
        progression: a.progression,
        minerProgress: a.minerProgress,
      })
      .signers([ctx.seller])
      .rpc();
  });

  logStep("locks/miner listed cannot assign land");
  await expectFailure("assign land when miner listed", async () => {
    await p.methods
      .globalMiningAssignLand()
      .accounts({
        owner: ctx.seller.publicKey,
        minerState: a.miner,
        landState: a.land,
      })
      .signers([ctx.seller])
      .rpc();
  });

  logStep("locks/land listed cannot assign miner");
  await expectFailure("assign listed land", async () => {
    await p.methods
      .globalMiningAssignLand()
      .accounts({
        owner: ctx.seller.publicKey,
        minerState: a.minerUnlocked,
        landState: a.landListed,
      })
      .signers([ctx.seller])
      .rpc();
  });

  logStep("locks/miner listed cannot equipment init");

  const freshEquipment = pda(
    ctx.program.programId,
    SEED_EQUIPMENT,
    a.minerListedNoEquipment.toBuffer()
  );

  await expectFailure("equipment init while listed", async () => {
    await p.methods
      .equipmentInit()
      .accounts({
        owner: ctx.seller.publicKey,
        minerState: a.minerListedNoEquipment,
        equipment: freshEquipment,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.seller])
      .rpc();
  });
}