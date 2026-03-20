import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import fs from "node:fs";

const SEED_CONFIG = Buffer.from("config");
const SEED_PROGRESSION = Buffer.from("progression_v1");
const SEED_ECONOMY = Buffer.from("economy_v4");
const SEED_REWARDS_AUTH = Buffer.from("rewards_auth");
const SEED_GLOBAL_MINING = Buffer.from("global_mining_v2");
const SEED_MINER = Buffer.from("miner");
const SEED_MINER_PROGRESS = Buffer.from("miner_progress_v1");
const SEED_MINER_MINING = Buffer.from("miner_mining_v1");
const SEED_LAND = Buffer.from("land");
const SEED_EQUIPMENT = Buffer.from("equipment_v1");


process.env.ANCHOR_PROVIDER_URL =
  process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com";

process.env.ANCHOR_WALLET =
  process.env.ANCHOR_WALLET ||
  "/mnt/c/Users/Rapose/miners-of-essence/miners/minha-wallet.json";
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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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
  const [progressionPda] = PublicKey.findProgramAddressSync(
    [SEED_PROGRESSION],
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
  const [globalMiningPda] = PublicKey.findProgramAddressSync(
    [SEED_GLOBAL_MINING],
    program.programId
  );

  const configAccount = getAccountClient(program, ["config"]);
  const minerStateAccount = getAccountClient(program, ["minerState"]);
  const minerProgressAccount = getAccountClient(program, ["minerProgress"]);
  const minerMiningAccount = getAccountClient(program, ["minerMiningState", "minerMining"]);
  const landStateAccount = getAccountClient(program, ["landState"]);
  const equipmentAccount = getAccountClient(program, ["equipmentState", "equipment"]);
  const globalMiningAccount = getAccountClient(program, ["globalMiningState", "globalMiningConfig", "globalMining"]);
  const economyAccount = getAccountClient(program, ["economyConfig", "economy"]);

  const cfg: any = await configAccount.fetch(configPda);

  const nextMinerId = BigInt(cfg.nextMinerId.toString());
  if (nextMinerId === 0n) {
    throw new Error("No miner exists yet. Run lootbox_miner_flow.ts first.");
  }

  const nextLandId = BigInt(cfg.nextLandId.toString());
  if (nextLandId === 0n) {
    throw new Error("No land exists yet. Run lootbox_land_flow.ts first.");
  }

  const latestMinerId = nextMinerId - 1n;
  const latestLandId = nextLandId - 1n;

  const [minerStatePda] = PublicKey.findProgramAddressSync(
    [SEED_MINER, owner.toBuffer(), u64Le(latestMinerId)],
    program.programId
  );
  const [minerProgressPda] = PublicKey.findProgramAddressSync(
    [SEED_MINER_PROGRESS, minerStatePda.toBuffer()],
    program.programId
  );
  const [minerMiningPda] = PublicKey.findProgramAddressSync(
    [SEED_MINER_MINING, minerStatePda.toBuffer()],
    program.programId
  );
  const [landStatePda] = PublicKey.findProgramAddressSync(
    [SEED_LAND, owner.toBuffer(), u64Le(latestLandId)],
    program.programId
  );
  const [equipmentPda] = PublicKey.findProgramAddressSync(
    [SEED_EQUIPMENT, minerStatePda.toBuffer()],
    program.programId
  );

  const essMint = new PublicKey(fs.readFileSync(".ess_mint.tmp", "utf8").trim());
  const rewardsVault = getAssociatedTokenAddressSync(essMint, rewardsAuthority, true);
  const userAta = getAssociatedTokenAddressSync(essMint, owner);

  const globalInfo = await provider.connection.getAccountInfo(globalMiningPda, "confirmed");
  if (!globalInfo) {
    console.log("Initializing global mining...");
    await program.methods
      .globalMiningInit(2, new anchor.BN(100_000))
      .accounts({
        admin: owner,
        global: globalMiningPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  const minerBefore: any = await minerStateAccount.fetch(minerStatePda);
  const landBefore: any = await landStateAccount.fetch(landStatePda);

  console.log("\n=== BEFORE GLOBAL MINING FLOW ===");
  console.log({
    globalMining: globalMiningPda.toBase58(),
    minerState: minerStatePda.toBase58(),
    minerProgress: minerProgressPda.toBase58(),
    minerMining: minerMiningPda.toBase58(),
    landState: landStatePda.toBase58(),
    equipment: equipmentPda.toBase58(),
    minerAllocatedLand:
      minerBefore.allocatedLand?.toBase58?.() ??
      minerBefore.allocated_land?.toBase58?.() ??
      null,
    minerListed: minerBefore.listed,
    landListed: landBefore.listed,
    landAllocatedMinersCount:
      landBefore.allocatedMinersCount ?? landBefore.allocated_miners_count ?? null,
  });

  const minerMiningInfo = await provider.connection.getAccountInfo(minerMiningPda, "confirmed");
  if (!minerMiningInfo) {
    console.log("Registering miner in global mining...");
    await program.methods
      .globalMiningRegisterMiner()
      .accounts({
        owner,
        global: globalMiningPda,
        minerState: minerStatePda,
        minerMining: minerMiningPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  const minerRefresh: any = await minerStateAccount.fetch(minerStatePda);
  const allocatedLand =
    minerRefresh.allocatedLand?.toBase58?.() ??
    minerRefresh.allocated_land?.toBase58?.() ??
    PublicKey.default.toBase58();

  if (allocatedLand === PublicKey.default.toBase58()) {
    console.log("Assigning land to miner...");
    await program.methods
      .globalMiningAssignLand()
      .accounts({
        owner,
        minerState: minerStatePda,
        landState: landStatePda,
      })
      .rpc();
  }

  console.log("Waiting a few ticks for mining update...");
  await sleep(4500);

  await program.methods
    .globalMiningUpdate()
    .accounts({
      owner,
      global: globalMiningPda,
      minerState: minerStatePda,
      minerProgress: minerProgressPda,
      equipment: equipmentPda,
      minerMining: minerMiningPda,
      landState: landStatePda,
    })
    .rpc();

  const globalAfterUpdate: any = await globalMiningAccount.fetch(globalMiningPda);
  const minerMiningAfterUpdate: any = await minerMiningAccount.fetch(minerMiningPda);

  console.log("\n=== AFTER UPDATE ===");
  console.log({
    globalWeekIndex: globalAfterUpdate.weekIndex?.toString?.() ?? globalAfterUpdate.weekIndex,
    globalTotalEpTw: globalAfterUpdate.totalEpTw?.toString?.() ?? globalAfterUpdate.total_ep_tw,
    minerWeekIndex: minerMiningAfterUpdate.weekIndex?.toString?.() ?? minerMiningAfterUpdate.weekIndex,
    minerLastTick: minerMiningAfterUpdate.lastTick?.toString?.() ?? minerMiningAfterUpdate.last_tick,
    minerEpTw: minerMiningAfterUpdate.epTw?.toString?.() ?? minerMiningAfterUpdate.ep_tw,
    minerClaimed: minerMiningAfterUpdate.claimed,
  });

  console.log("Freezing week...");
  await program.methods
    .globalMiningFreezeWeek()
    .accounts({
      admin: owner,
      global: globalMiningPda,
    })
    .rpc();

  const globalAfterFreeze: any = await globalMiningAccount.fetch(globalMiningPda);

  console.log("\n=== AFTER FREEZE ===");
  console.log({
    frozen: globalAfterFreeze.frozen,
    frozenWeekIndex:
      globalAfterFreeze.frozenWeekIndex?.toString?.() ??
      globalAfterFreeze.frozen_week_index,
    frozenWeeklyPoolAmount:
      globalAfterFreeze.frozenWeeklyPoolAmount?.toString?.() ??
      globalAfterFreeze.frozen_weekly_pool_amount,
    frozenTotalEpTw:
      globalAfterFreeze.frozenTotalEpTw?.toString?.() ??
      globalAfterFreeze.frozen_total_ep_tw,
  });

  const economy: any = await economyAccount.fetch(economyPda);

  console.log("Claiming global mining rewards...");
  await program.methods
    .globalMiningClaim()
    .accounts({
      owner,
      global: globalMiningPda,
      minerMining: minerMiningPda,
      minerState: minerStatePda,
      essMint,
      economy: economyPda,
      rewardsAuthority,
      rewardsVault,
      userAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  const minerMiningAfterClaim: any = await minerMiningAccount.fetch(minerMiningPda);

  console.log("\n=== AFTER CLAIM ===");
  console.log({
    minerClaimed: minerMiningAfterClaim.claimed,
    minerEpTw: minerMiningAfterClaim.epTw?.toString?.() ?? minerMiningAfterClaim.ep_tw,
    economyMint: economy.essMint?.toBase58?.() ?? economy.essMint,
    rewardsVault: rewardsVault.toBase58(),
    userAta: userAta.toBase58(),
  });

  console.log("Rollover week...");
  await program.methods
    .globalMiningRolloverWeek(new anchor.BN(100_000))
    .accounts({
      admin: owner,
      global: globalMiningPda,
    })
    .rpc();

  const globalAfterRollover: any = await globalMiningAccount.fetch(globalMiningPda);

  console.log("\n=== AFTER ROLLOVER ===");
  console.log({
    weekIndex: globalAfterRollover.weekIndex?.toString?.() ?? globalAfterRollover.weekIndex,
    totalEpTw: globalAfterRollover.totalEpTw?.toString?.() ?? globalAfterRollover.total_ep_tw,
    frozen: globalAfterRollover.frozen,
  });

  console.log("✅ global_mining_flow completed");
}

main().catch((e) => {
  console.error("FATAL global_mining_flow:", e);
  process.exit(1);
});