import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import fs from "node:fs";

const SEED_CONFIG = Buffer.from("config");
const SEED_ECONOMY = Buffer.from("economy_v4");
const SEED_REWARDS_AUTH = Buffer.from("rewards_auth");
const SEED_MINER = Buffer.from("miner");
const SEED_MINER_PROGRESS = Buffer.from("miner_progress_v1");
const SEED_EQUIPMENT = Buffer.from("equipment_v1");
const SEED_EQUIPMENT_INVENTORY = Buffer.from("equipment_inventory_v1");

function u64Le(n: bigint) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

function resolveIdlPath(): string {
  const candidates = [
    "target/idl/moe_anchor_v1.json",
    "target/idl/miners.json",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("IDL not found. Run `anchor build` first.");
}

function loadProgram(provider: anchor.AnchorProvider) {
  const idlPath = resolveIdlPath();
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
  return new anchor.Program(idl, provider) as anchor.Program;
}

function getAccountClient(program: any, names: string[]) {
  for (const n of names) {
    if (program.account?.[n]) return program.account[n];
  }
  throw new Error(`Account client not found. Tried: ${names.join(", ")}`);
}

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = loadProgram(provider);

  const owner = provider.wallet.publicKey;

  const [configPda] = PublicKey.findProgramAddressSync(
    [SEED_CONFIG],
    program.programId
  );
  const [economyPda] = PublicKey.findProgramAddressSync(
    [SEED_ECONOMY],
    program.programId
  );
  const [rewardsAuthority] = PublicKey.findProgramAddressSync(
    [SEED_REWARDS_AUTH],
    program.programId
  );

  const configAccount = getAccountClient(program, ["config"]);
  const minerStateAccount = getAccountClient(program, ["minerState"]);
  const equipmentAccount = getAccountClient(program, ["equipmentState", "equipment"]);
  const inventoryAccount = getAccountClient(program, ["equipmentInventoryState", "equipmentInventory"]);
  const economyAccount = getAccountClient(program, ["economyConfig", "economy"]);

  const cfg: any = await configAccount.fetch(configPda);
  const nextMinerId = BigInt(cfg.nextMinerId.toString());
  if (nextMinerId === 0n) {
    throw new Error("No miner exists yet. Run lootbox_miner_flow.ts first.");
  }

  const latestMinerId = nextMinerId - 1n;

  const [minerStatePda] = PublicKey.findProgramAddressSync(
    [SEED_MINER, owner.toBuffer(), u64Le(latestMinerId)],
    program.programId
  );
  const [minerProgressPda] = PublicKey.findProgramAddressSync(
    [SEED_MINER_PROGRESS, minerStatePda.toBuffer()],
    program.programId
  );
  const [equipmentPda] = PublicKey.findProgramAddressSync(
    [SEED_EQUIPMENT, minerStatePda.toBuffer()],
    program.programId
  );
  const [inventoryPda] = PublicKey.findProgramAddressSync(
    [SEED_EQUIPMENT_INVENTORY, owner.toBuffer()],
    program.programId
  );

  const economy: any = await economyAccount.fetch(economyPda);
  const essMint = new PublicKey(
    fs.readFileSync(".ess_mint.tmp", "utf8").trim()
  );
  const rewardsVault = getAssociatedTokenAddressSync(essMint, rewardsAuthority, true);
  const userAta = getAssociatedTokenAddressSync(essMint, owner);

  try {
    await inventoryAccount.fetch(inventoryPda);
  } catch {
    await program.methods
      .equipmentInventoryInit()
      .accounts({
        owner,
        inventory: inventoryPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  try {
    await equipmentAccount.fetch(equipmentPda);
  } catch {
    await program.methods
      .equipmentInit()
      .accounts({
        owner,
        minerState: minerStatePda,
        equipment: equipmentPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  const beforeEq: any = await equipmentAccount.fetch(equipmentPda);
  const beforeInv: any = await inventoryAccount.fetch(inventoryPda);

  console.log("\n=== BEFORE EQUIPMENT FLOW ===");
  console.log({
    minerState: minerStatePda.toBase58(),
    minerProgress: minerProgressPda.toBase58(),
    equipment: equipmentPda.toBase58(),
    inventory: inventoryPda.toBase58(),
    beforeEquipment: {
      handLevel: beforeEq.handLevel,
      handPowerBps: beforeEq.handPowerBps,
      handIsRemelted: beforeEq.handIsRemelted,
      headLevel: beforeEq.headLevel,
      headRechargeDiscountBps: beforeEq.headRechargeDiscountBps,
      headIsRemelted: beforeEq.headIsRemelted,
    },
    beforeInventory: {
      newHand1: beforeInv.newHand?.[1],
      newHand2: beforeInv.newHand?.[2],
      newHead1: beforeInv.newHead?.[1],
      newHead2: beforeInv.newHead?.[2],
      newHandRemelted2: beforeInv.newHandRemelted?.[2],
      newHeadRemelted2: beforeInv.newHeadRemelted?.[2],
    },
    economyMint: economy.essMint?.toBase58?.() ?? economy.essMint,
    rewardsVault: rewardsVault.toBase58(),
    userAta: userAta.toBase58(),
  });

  await program.methods
    .equipmentInventoryGrantItem({ hand: {} }, 1, 5, false, false)
    .accounts({
      admin: owner,
      config: configPda,
      inventory: inventoryPda,
      owner,
    })
    .rpc();

  await program.methods
    .equipmentInventoryGrantItem({ head: {} }, 1, 5, false, false)
    .accounts({
      admin: owner,
      config: configPda,
      inventory: inventoryPda,
      owner,
    })
    .rpc();

  await program.methods
    .equipmentReplaceHand(1)
    .accounts({
      owner,
      minerState: minerStatePda,
      equipment: equipmentPda,
      inventory: inventoryPda,
    })
    .rpc();

  await program.methods
    .equipmentReplaceHead(1)
    .accounts({
      owner,
      minerState: minerStatePda,
      equipment: equipmentPda,
      inventory: inventoryPda,
    })
    .rpc();

  await program.methods
    .equipmentRemeltHand(1)
    .accounts({
      owner,
      minerState: minerStatePda,
      equipment: equipmentPda,
      inventory: inventoryPda,
      userAta,
      rewardsVault,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  await program.methods
    .equipmentRemeltHead(1)
    .accounts({
      owner,
      minerState: minerStatePda,
      equipment: equipmentPda,
      inventory: inventoryPda,
      userAta,
      rewardsVault,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  await program.methods
    .equipmentReplaceHand(2)
    .accounts({
      owner,
      minerState: minerStatePda,
      equipment: equipmentPda,
      inventory: inventoryPda,
    })
    .rpc();

  await program.methods
    .equipmentReplaceHead(2)
    .accounts({
      owner,
      minerState: minerStatePda,
      equipment: equipmentPda,
      inventory: inventoryPda,
    })
    .rpc();

  const afterMiner: any = await minerStateAccount.fetch(minerStatePda);
  const afterEq: any = await equipmentAccount.fetch(equipmentPda);
  const afterInv: any = await inventoryAccount.fetch(inventoryPda);

  console.log("\n=== AFTER EQUIPMENT FLOW ===");
  console.log({
    minerListed: afterMiner.listed,
    equipment: {
      handLevel: afterEq.handLevel,
      handPowerBps: afterEq.handPowerBps,
      handIsRemelted: afterEq.handIsRemelted,
      headLevel: afterEq.headLevel,
      headRechargeDiscountBps: afterEq.headRechargeDiscountBps,
      headIsRemelted: afterEq.headIsRemelted,
    },
    inventory: {
      newHand1: afterInv.newHand?.[1],
      newHand2: afterInv.newHand?.[2],
      brokenHand1: afterInv.brokenHand?.[1],
      newHead1: afterInv.newHead?.[1],
      newHead2: afterInv.newHead?.[2],
      brokenHead1: afterInv.brokenHead?.[1],
      newHandRemelted2: afterInv.newHandRemelted?.[2],
      newHeadRemelted2: afterInv.newHeadRemelted?.[2],
    },
  });

  if (afterEq.handLevel !== 2) {
    throw new Error(`handLevel expected 2, got ${afterEq.handLevel}`);
  }
  if (afterEq.headLevel !== 2) {
    throw new Error(`headLevel expected 2, got ${afterEq.headLevel}`);
  }
  if (afterEq.handIsRemelted !== true) {
    throw new Error(`handIsRemelted expected true, got ${afterEq.handIsRemelted}`);
  }
  if (afterEq.headIsRemelted !== true) {
    throw new Error(`headIsRemelted expected true, got ${afterEq.headIsRemelted}`);
  }

  console.log("✅ equipment_flow completed");
}

main().catch((e) => {
  console.error("FATAL equipment_flow:", e);
  process.exit(1);
});