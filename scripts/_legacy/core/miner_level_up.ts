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
const SEED_MINER = Buffer.from("miner");
const SEED_MINER_PROGRESS = Buffer.from("miner_progress_v1");

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

function powBps(baseBps: number, exp: number): number {
  let result = 10_000;
  let base = baseBps;

  while (exp > 0) {
    if (exp & 1) result = Math.floor((result * base) / 10_000);
    base = Math.floor((base * base) / 10_000);
    exp >>= 1;
  }
  return result;
}

function expRequired(cfg: any, rarityIdx: number, level: number): number {
  const base = Number(cfg.expBaseByRarity?.[rarityIdx] ?? cfg.exp_base_by_rarity?.[rarityIdx] ?? 0);
  const growth = Number(cfg.expGrowthBps ?? cfg.exp_growth_bps);
  const mult = powBps(growth, Math.max(level - 1, 0));
  return Math.floor((base * mult) / 10_000);
}

function essCost(cfg: any, rarityIdx: number, level: number): number {
  const base = Number(cfg.essBaseCostByRarity?.[rarityIdx] ?? cfg.ess_base_cost_by_rarity?.[rarityIdx] ?? 0);
  const growth = Number(cfg.essGrowthBps ?? cfg.ess_growth_bps);
  const mult = powBps(growth, Math.max(level - 1, 0));
  return Math.floor((base * mult) / 10_000);
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

  const configAccount = getAccountClient(program, ["config"]);
  const progressionAccount = getAccountClient(program, ["progressionConfig", "progression"]);
  const minerStateAccount = getAccountClient(program, ["minerState"]);
  const minerProgressAccount = getAccountClient(program, ["minerProgress"]);
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

  const progression: any = await progressionAccount.fetch(progressionPda);
  const economy: any = await economyAccount.fetch(economyPda);
  const miner: any = await minerStateAccount.fetch(minerStatePda);
  const progressBefore: any = await minerProgressAccount.fetch(minerProgressPda);

  const rarity = Number(miner.rarity);
  const levelBefore = Number(progressBefore.level);
  const expBefore = Number(progressBefore.exp);

  const needExp = expRequired(progression, rarity, levelBefore);
  const cost = essCost(progression, rarity, levelBefore);
  const missingExp = Math.max(needExp - expBefore, 0);

  const essMint = new PublicKey(fs.readFileSync(".ess_mint.tmp", "utf8").trim());
  const userAta = getAssociatedTokenAddressSync(essMint, owner);
  const recipientWallet = new PublicKey(
    economy.recipientWallet?.toBase58?.() ?? economy.recipient_wallet
  );
  const recipientAta = getAssociatedTokenAddressSync(essMint, recipientWallet, true);

  console.log("\n=== BEFORE MINER LEVEL UP ===");
  console.log({
    minerState: minerStatePda.toBase58(),
    minerProgress: minerProgressPda.toBase58(),
    rarity,
    levelBefore,
    expBefore,
    needExp,
    missingExp,
    essCost: cost,
    listed: miner.listed,
    recipientWallet: recipientWallet.toBase58(),
    userAta: userAta.toBase58(),
    recipientAta: recipientAta.toBase58(),
  });

  if (missingExp > 0) {
    console.log("Granting missing EXP with admin_grant_exp...");
    await program.methods
      .adminGrantExp(new anchor.BN(missingExp))
      .accounts({
        admin: owner,
        config: configPda,
        progression: progressionPda,
        minerState: minerStatePda,
        minerProgress: minerProgressPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  await program.methods
    .minerLevelUp()
    .accounts({
      owner,
      minerState: minerStatePda,
      progression: progressionPda,
      minerProgress: minerProgressPda,
      economy: economyPda,
      essMint,
      userAta,
      recipientWallet,
      recipientAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  const progressAfter: any = await minerProgressAccount.fetch(minerProgressPda);

  console.log("\n=== AFTER MINER LEVEL UP ===");
  console.log({
    levelAfter: Number(progressAfter.level),
    expAfter: Number(progressAfter.exp),
  });

  if (Number(progressAfter.level) !== levelBefore + 1) {
    throw new Error(
      `Level did not increase correctly. Expected ${levelBefore + 1}, got ${Number(progressAfter.level)}`
    );
  }

  if (Number(progressAfter.exp) !== 0) {
    throw new Error(`Expected exp to reset to 0, got ${Number(progressAfter.exp)}`);
  }

  console.log("✅ miner_level_up completed");
}

main().catch((e) => {
  console.error("FATAL miner_level_up:", e);
  process.exit(1);
});