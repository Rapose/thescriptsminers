import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
  getMint,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import fs from "node:fs";
import { waitSlots } from "../helpers/test_env";

process.env.ANCHOR_PROVIDER_URL =
  process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com";

process.env.ANCHOR_WALLET =
  process.env.ANCHOR_WALLET ||
  "/mnt/c/Users/Rapose/miners-of-essence/miners/minha-wallet.json";

const SEED_CONFIG = Buffer.from("config");
const SEED_PROGRESSION = Buffer.from("progression_v1");
const SEED_ECONOMY = Buffer.from("economy_v4");
const SEED_REWARDS_AUTH = Buffer.from("rewards_auth");
const SEED_REBIRTH = Buffer.from("rebirth_v1");
const SEED_LB_MINER = Buffer.from("lb_miner");
const SEED_MINER = Buffer.from("miner");
const SEED_MINER_PROGRESS = Buffer.from("miner_progress_v1");

const RECIPIENT_WALLET = new PublicKey(
  "Ea9pUYYtCF6usjYAd2RdqeZ2WJETSwPaPwrGmfQRktXf"
);

const TARGET_PARENT_LEVEL = 3;

// rebirth config de teste
const BURN_BPS = 7000;
const TREASURY_BPS = 3000;
const MIN_PARENT_LEVEL_BY_RARITY = [0, 0, 0, 0, 0];
const ESS_COST_BY_RARITY = [
  new anchor.BN("100000000"),
  new anchor.BN("200000000"),
  new anchor.BN("300000000"),
  new anchor.BN("400000000"),
  new anchor.BN("0"),
];

function u64Le(n: bigint) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

function resolveIdlPath(): string {
  const p = "target/idl/moe_anchor_v1.json";
  if (!fs.existsSync(p)) {
    throw new Error(
      "IDL not found at target/idl/moe_anchor_v1.json. Run `anchor build` first."
    );
  }
  console.log("Using IDL:", p);
  return p;
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

function toNum(v: any): number {
  if (typeof v === "number") return v;
  return Number(v?.toString?.() ?? v);
}

function toBig(v: any): bigint {
  if (typeof v === "bigint") return v;
  return BigInt(v?.toString?.() ?? v);
}

function toBase58Safe(v: any): string {
  return v?.toBase58?.() ?? String(v);
}

function readMinerId(acc: any): string {
  return acc.id?.toString?.() ?? String(acc.id);
}

function readElement(acc: any): number {
  return Number(acc.element);
}

function readAllocatedLand(acc: any): string {
  return (
    acc.allocatedLand?.toBase58?.() ??
    acc.allocated_land?.toBase58?.() ??
    String(acc.allocatedLand ?? acc.allocated_land)
  );
}

function readLastExpClaimTs(progress: any): string {
  return (
    progress.lastExpClaimTs?.toString?.() ??
    progress.last_exp_claim_ts?.toString?.() ??
    "unknown"
  );
}

function formatParent(label: string, parent: any) {
  return {
    label,
    minerPda: parent.minerPda.toBase58(),
    progressPda: parent.progressPda.toBase58(),
    minerId: readMinerId(parent.miner),
    owner: toBase58Safe(parent.miner.owner),
    rarity: parent.rarity,
    element: readElement(parent.miner),
    hashBase: parent.hashBase.toString(),
    listed: !!parent.miner.listed,
    allocatedLand: readAllocatedLand(parent.miner),
    level: parent.level,
    exp: toBig(parent.progress.exp).toString(),
    lastExpClaimTs: readLastExpClaimTs(parent.progress),
  };
}

async function accountExists(
  connection: anchor.web3.Connection,
  pda: PublicKey
): Promise<boolean> {
  return !!(await connection.getAccountInfo(pda, "confirmed"));
}

function rarityHashRange(rarity: number): [bigint, bigint] {
  switch (rarity) {
    case 0:
      return [60n, 100n];
    case 1:
      return [120n, 180n];
    case 2:
      return [300n, 450n];
    case 3:
      return [600n, 900n];
    case 4:
      return [1200n, 1600n];
    default:
      throw new Error(`Invalid rarity: ${rarity}`);
  }
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
  const base = Number(
    cfg.expBaseByRarity?.[rarityIdx] ?? cfg.exp_base_by_rarity?.[rarityIdx] ?? 0
  );
  const growth = Number(cfg.expGrowthBps ?? cfg.exp_growth_bps);
  const mult = powBps(growth, Math.max(level - 1, 0));
  return Math.floor((base * mult) / 10_000);
}

function essCostForLevelUp(cfg: any, rarityIdx: number, level: number): number {
  const base = Number(
    cfg.essBaseCostByRarity?.[rarityIdx] ??
      cfg.ess_base_cost_by_rarity?.[rarityIdx] ??
      0
  );
  const growth = Number(cfg.essGrowthBps ?? cfg.ess_growth_bps);
  const mult = powBps(growth, Math.max(level - 1, 0));
  return Math.floor((base * mult) / 10_000);
}

async function ensureConfig(program: anchor.Program, owner: PublicKey) {
  const [configPda] = PublicKey.findProgramAddressSync(
    [SEED_CONFIG],
    program.programId
  );

  const exists = await accountExists(program.provider.connection, configPda);
  if (!exists) {
    console.log("Config not found. Initializing...");
    await program.methods
      .initializeConfig()
      .accounts({
        admin: owner,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  return configPda;
}

async function ensureProgression(program: anchor.Program, owner: PublicKey) {
  const [progressionPda] = PublicKey.findProgramAddressSync(
    [SEED_PROGRESSION],
    program.programId
  );

  const exists = await accountExists(program.provider.connection, progressionPda);
  if (!exists) {
    console.log("Progression not found. Initializing...");
    await program.methods
      .progressionInit()
      .accounts({
        admin: owner,
        progression: progressionPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  return progressionPda;
}

async function ensureEconomy(
  program: anchor.Program,
  owner: PublicKey,
  payer: any,
  essMint: PublicKey
) {
  const [economyPda] = PublicKey.findProgramAddressSync(
    [SEED_ECONOMY],
    program.programId
  );

  const [rewardsAuthority] = PublicKey.findProgramAddressSync(
    [SEED_REWARDS_AUTH],
    program.programId
  );

  const rewardsVault = await getOrCreateAssociatedTokenAccount(
    program.provider.connection,
    payer,
    essMint,
    rewardsAuthority,
    true
  );

  const exists = await accountExists(program.provider.connection, economyPda);
  if (!exists) {
    console.log("Economy not found. Initializing...");
    await program.methods
      .economyInit()
      .accounts({
        admin: owner,
        essMint,
        recipientWallet: RECIPIENT_WALLET,
        economy: economyPda,
        rewardsAuthority,
        rewardsVault: rewardsVault.address,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  await program.methods
    .economySetMint()
    .accounts({
      admin: owner,
      essMint,
      economy: economyPda,
    })
    .rpc();

  await program.methods
    .economySetRecipient()
    .accounts({
      admin: owner,
      recipientWallet: RECIPIENT_WALLET,
      economy: economyPda,
    })
    .rpc();

  return {
    economyPda,
    rewardsAuthority,
    rewardsVault: rewardsVault.address,
  };
}

async function ensureRebirthConfig(
  program: anchor.Program,
  owner: PublicKey,
  essMint: PublicKey
) {
  const [rebirthConfigPda] = PublicKey.findProgramAddressSync(
    [SEED_REBIRTH],
    program.programId
  );

  const exists = await accountExists(
    program.provider.connection,
    rebirthConfigPda
  );

  if (!exists) {
    console.log("Rebirth config not found. Initializing...");
    await program.methods
      .rebirthInit(
        BURN_BPS,
        TREASURY_BPS,
        MIN_PARENT_LEVEL_BY_RARITY,
        ESS_COST_BY_RARITY
      )
      .accounts({
        admin: owner,
        essMint,
        recipientWallet: RECIPIENT_WALLET,
        rebirthConfig: rebirthConfigPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  } else {
    console.log("Rebirth config exists. Updating to known test values...");
    await program.methods
      .rebirthUpdateConfig(
        BURN_BPS,
        TREASURY_BPS,
        true,
        MIN_PARENT_LEVEL_BY_RARITY,
        ESS_COST_BY_RARITY
      )
      .accounts({
        admin: owner,
        essMint,
        recipientWallet: RECIPIENT_WALLET,
        rebirthConfig: rebirthConfigPda,
      })
      .rpc();
  }

  return rebirthConfigPda;
}

async function createLootboxMiner(program: anchor.Program, owner: PublicKey) {
  const configAccount = getAccountClient(program, ["config"]);
  const minerStateAccount = getAccountClient(program, ["minerState"]);
  const minerProgressAccount = getAccountClient(program, ["minerProgress"]);

  const [configPda] = PublicKey.findProgramAddressSync(
    [SEED_CONFIG],
    program.programId
  );

  const cfgBefore: any = await configAccount.fetch(configPda);
  const nextMinerId = BigInt(cfgBefore.nextMinerId.toString());

  const lootboxId =
    BigInt(Date.now()) + BigInt(Math.floor(Math.random() * 100000));

  const [lootboxPda] = PublicKey.findProgramAddressSync(
    [SEED_LB_MINER, owner.toBuffer(), u64Le(lootboxId)],
    program.programId
  );

  const [minerStatePda] = PublicKey.findProgramAddressSync(
    [SEED_MINER, owner.toBuffer(), u64Le(nextMinerId)],
    program.programId
  );

  const [minerProgressPda] = PublicKey.findProgramAddressSync(
    [SEED_MINER_PROGRESS, minerStatePda.toBuffer()],
    program.programId
  );

  const salt = new Uint8Array(32);

  await program.methods
    .lootboxMinerInit(new anchor.BN(lootboxId.toString()))
    .accounts({
      owner,
      config: configPda,
      lootbox: lootboxPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  await program.methods
    .lootboxMinerCommit(new anchor.BN(lootboxId.toString()), [...salt])
    .accounts({
      owner,
      lootbox: lootboxPda,
    })
    .rpc();

  await waitSlots(program.provider.connection, 10);

  await program.methods
    .lootboxMinerReveal(new anchor.BN(lootboxId.toString()), [...salt])
    .accounts({
      owner,
      config: configPda,
      lootbox: lootboxPda,
      minerState: minerStatePda,
      minerProgress: minerProgressPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  const miner: any = await minerStateAccount.fetch(minerStatePda);
  const progress: any = await minerProgressAccount.fetch(minerProgressPda);

  return {
    minerStatePda,
    minerProgressPda,
    miner,
    progress,
  };
}

async function findOwnedMinerPairs(program: anchor.Program, owner: PublicKey) {
  const minerStateAccount = getAccountClient(program, ["minerState"]);
  const minerProgressAccount = getAccountClient(program, ["minerProgress"]);

  const allMiners = await minerStateAccount.all();

  const owned = [];
  for (const row of allMiners) {
    const acc: any = row.account;
    const minerPda: PublicKey = row.publicKey;

    const minerOwner = acc.owner?.toBase58?.() ?? String(acc.owner);
    if (minerOwner !== owner.toBase58()) continue;

    const listed = !!acc.listed;
    const allocatedLand = readAllocatedLand(acc);

    if (listed) continue;
    if (allocatedLand !== PublicKey.default.toBase58()) continue;

    const [progressPda] = PublicKey.findProgramAddressSync(
      [SEED_MINER_PROGRESS, minerPda.toBuffer()],
      program.programId
    );

    try {
      const progress: any = await minerProgressAccount.fetch(progressPda);
      owned.push({
        minerPda,
        progressPda,
        miner: acc,
        progress,
        rarity: toNum(acc.rarity),
        element: toNum(acc.element),
        hashBase: toBig(acc.hashBase ?? acc.hash_base),
        level: toNum(progress.level),
        exp: toBig(progress.exp),
        allocatedLand,
        listed,
      });
    } catch {
      // ignora miner sem progress
    }
  }

  const grouped = new Map<number, any[]>();
  for (const item of owned) {
    if (item.rarity >= 4) continue;
    if (!grouped.has(item.rarity)) grouped.set(item.rarity, []);
    grouped.get(item.rarity)!.push(item);
  }

  for (const [rarity, items] of grouped.entries()) {
    if (items.length >= 2) {
      return {
        rarity,
        parents: items.slice(0, 2),
        allOwned: owned,
      };
    }
  }

  return {
    rarity: null,
    parents: [],
    allOwned: owned,
  };
}

async function levelMinerToTarget(
  program: anchor.Program,
  owner: PublicKey,
  essMint: PublicKey,
  economyPda: PublicKey,
  progressionPda: PublicKey,
  miner: any,
  targetLevel: number
) {
  const progressionAccount = getAccountClient(program, [
    "progressionConfig",
    "progression",
  ]);
  const economyAccount = getAccountClient(program, ["economyConfig", "economy"]);
  const minerProgressAccount = getAccountClient(program, ["minerProgress"]);

  const progression: any = await progressionAccount.fetch(progressionPda);
  const economy: any = await economyAccount.fetch(economyPda);

  const recipientWallet = new PublicKey(
    economy.recipientWallet?.toBase58?.() ?? economy.recipient_wallet
  );

  const ownerAta = await getOrCreateAssociatedTokenAccount(
    program.provider.connection,
    (program.provider.wallet as any).payer,
    essMint,
    owner
  );

  const recipientAta = await getOrCreateAssociatedTokenAccount(
    program.provider.connection,
    (program.provider.wallet as any).payer,
    essMint,
    recipientWallet,
    true
  );

  let current: any = await minerProgressAccount.fetch(miner.progressPda);
  const rarity = miner.rarity;

  while (Number(current.level) < targetLevel) {
    const levelNow = Number(current.level);
    const expNow = Number(current.exp);
    const needExp = expRequired(progression, rarity, levelNow);
    const missingExp = Math.max(needExp - expNow, 0);
    const essCost = essCostForLevelUp(progression, rarity, levelNow);

    if (missingExp > 0) {
      const sigGrant = await program.methods
        .adminGrantExp(new anchor.BN(missingExp))
        .accounts({
          admin: owner,
          config: PublicKey.findProgramAddressSync(
            [SEED_CONFIG],
            program.programId
          )[0],
          progression: progressionPda,
          minerState: miner.minerPda,
          minerProgress: miner.progressPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(`grantExp sig (${miner.minerPda.toBase58()}):`, sigGrant);
    }

    const sigLevel = await program.methods
      .minerLevelUp()
      .accounts({
        owner,
        minerState: miner.minerPda,
        progression: progressionPda,
        minerProgress: miner.progressPda,
        economy: economyPda,
        essMint,
        userAta: ownerAta.address,
        recipientWallet,
        recipientAta: recipientAta.address,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log(
      `minerLevelUp sig (${miner.minerPda.toBase58()}) level=${levelNow} cost=${essCost}:`,
      sigLevel
    );

    current = await minerProgressAccount.fetch(miner.progressPda);
  }

  miner.progress = current;
  miner.level = Number(current.level);
  miner.exp = toBig(current.exp);

  return miner;
}

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = loadProgram(provider);

  const owner = provider.wallet.publicKey;
  const payer = (provider.wallet as any).payer;

  if (!fs.existsSync(".ess_mint.tmp")) {
    throw new Error(
      "ESS mint not found. Run scripts/_legacy/core/create_fixed_mint.ts first."
    );
  }

  const essMint = new PublicKey(
    fs.readFileSync(".ess_mint.tmp", "utf8").trim()
  );

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
  const [rebirthConfigPda] = PublicKey.findProgramAddressSync(
    [SEED_REBIRTH],
    program.programId
  );

  const configAccount = getAccountClient(program, ["config"]);
  const minerStateAccount = getAccountClient(program, ["minerState"]);
  const minerProgressAccount = getAccountClient(program, ["minerProgress"]);
  const rebirthConfigAccount = getAccountClient(program, ["rebirthConfig"]);

  await ensureConfig(program, owner);
  await ensureProgression(program, owner);
  await ensureEconomy(program, owner, payer, essMint);
  await ensureRebirthConfig(program, owner, essMint);

  const ownerAta = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    essMint,
    owner
  );

  const recipientAta = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    essMint,
    RECIPIENT_WALLET,
    true
  );

  console.log("\n=== REBIRTH TEST START ===");
  console.log({
    programId: program.programId.toBase58(),
    owner: owner.toBase58(),
    config: configPda.toBase58(),
    progression: progressionPda.toBase58(),
    economy: economyPda.toBase58(),
    rebirthConfig: rebirthConfigPda.toBase58(),
    essMint: essMint.toBase58(),
    ownerAta: ownerAta.address.toBase58(),
    recipientWallet: RECIPIENT_WALLET.toBase58(),
    recipientAta: recipientAta.address.toBase58(),
    targetParentLevel: TARGET_PARENT_LEVEL,
  });

  let pairInfo = await findOwnedMinerPairs(program, owner);

  let attempts = 0;
  while (pairInfo.parents.length < 2 && attempts < 10) {
    attempts += 1;
    console.log(`No valid pair yet. Creating lootbox miner #${attempts} ...`);
    const created = await createLootboxMiner(program, owner);
    console.log("Created miner:", {
      miner: created.minerStatePda.toBase58(),
      minerId: readMinerId(created.miner),
      rarity: toNum(created.miner.rarity),
      element: toNum(created.miner.element),
      hashBase: String(toBig(created.miner.hashBase ?? created.miner.hash_base)),
    });
    pairInfo = await findOwnedMinerPairs(program, owner);
  }

  if (pairInfo.parents.length < 2) {
    throw new Error(
      "Could not get two miners of same rarity after several lootboxes. Run again."
    );
  }

  let parentA = pairInfo.parents[0];
  let parentB = pairInfo.parents[1];

  console.log("\n=== LEVELING PARENTS ===");
  console.log("Before level-up:", {
    parentA: {
      miner: parentA.minerPda.toBase58(),
      minerId: readMinerId(parentA.miner),
      rarity: parentA.rarity,
      level: parentA.level,
      exp: parentA.exp.toString(),
    },
    parentB: {
      miner: parentB.minerPda.toBase58(),
      minerId: readMinerId(parentB.miner),
      rarity: parentB.rarity,
      level: parentB.level,
      exp: parentB.exp.toString(),
    },
  });

  parentA = await levelMinerToTarget(
    program,
    owner,
    essMint,
    economyPda,
    progressionPda,
    parentA,
    TARGET_PARENT_LEVEL
  );

  parentB = await levelMinerToTarget(
    program,
    owner,
    essMint,
    economyPda,
    progressionPda,
    parentB,
    TARGET_PARENT_LEVEL
  );

  parentA.progress = await minerProgressAccount.fetch(parentA.progressPda);
  parentB.progress = await minerProgressAccount.fetch(parentB.progressPda);
  parentA.level = Number(parentA.progress.level);
  parentB.level = Number(parentB.progress.level);
  parentA.exp = toBig(parentA.progress.exp);
  parentB.exp = toBig(parentB.progress.exp);

  console.log("After level-up:", {
    parentA: {
      miner: parentA.minerPda.toBase58(),
      minerId: readMinerId(parentA.miner),
      rarity: parentA.rarity,
      level: parentA.level,
      exp: parentA.exp.toString(),
    },
    parentB: {
      miner: parentB.minerPda.toBase58(),
      minerId: readMinerId(parentB.miner),
      rarity: parentB.rarity,
      level: parentB.level,
      exp: parentB.exp.toString(),
    },
  });

  const parentRarity = parentA.rarity;
  const nextRarity = parentRarity + 1;
  const expectedChildLevel = Math.floor((parentA.level + parentB.level) / 2);

  const rebirthCfg: any = await rebirthConfigAccount.fetch(rebirthConfigPda);
  const essCost = BigInt(
    rebirthCfg.essCostByRarity?.[parentRarity]?.toString?.() ??
      rebirthCfg.ess_cost_by_rarity?.[parentRarity]?.toString?.()
  );
  const burnBps = Number(rebirthCfg.burnBps ?? rebirthCfg.burn_bps);
  const treasuryBps = Number(rebirthCfg.treasuryBps ?? rebirthCfg.treasury_bps);

  const burnAmount = (essCost * BigInt(burnBps)) / 10000n;
  const treasuryAmount = essCost - burnAmount;

  const cfgBefore: any = await configAccount.fetch(configPda);
  const childId = BigInt(cfgBefore.nextMinerId.toString());

  const [childStatePda] = PublicKey.findProgramAddressSync(
    [SEED_MINER, owner.toBuffer(), u64Le(childId)],
    program.programId
  );

  const [childProgressPda] = PublicKey.findProgramAddressSync(
    [SEED_MINER_PROGRESS, childStatePda.toBuffer()],
    program.programId
  );

  const ownerBalBefore = (
    await getAccount(provider.connection, ownerAta.address)
  ).amount;
  const recipientBalBefore = (
    await getAccount(provider.connection, recipientAta.address)
  ).amount;
  const mintBefore = await getMint(provider.connection, essMint);

  const parentAExistsBefore = await provider.connection.getAccountInfo(
    parentA.minerPda,
    "confirmed"
  );
  const parentBExistsBefore = await provider.connection.getAccountInfo(
    parentB.minerPda,
    "confirmed"
  );

  const parentASummary = formatParent("Parent A", parentA);
  const parentBSummary = formatParent("Parent B", parentB);

  const parentHashSum = parentA.hashBase + parentB.hashBase;
  const [rebirthMin, rebirthMax] = rarityHashRange(nextRarity);
  const expectedLowBefore =
    parentHashSum > rebirthMin ? parentHashSum : rebirthMin;
  const expectedHighBefore = rebirthMax;

  console.log("\n=== BEFORE REBIRTH ===");
  console.log({
    parentA: parentASummary,
    parentB: parentBSummary,
    rebirthInput: {
      parentRarity,
      nextRarity,
      expectedChildLevel,
      parentHashSum: parentHashSum.toString(),
      expectedChildHashRange: {
        low: expectedLowBefore.toString(),
        high: expectedHighBefore.toString(),
      },
      essCost: essCost.toString(),
      burnAmount: burnAmount.toString(),
      treasuryAmount: treasuryAmount.toString(),
    },
    expectedAccounts: {
      childStateExpected: childStatePda.toBase58(),
      childProgressExpected: childProgressPda.toBase58(),
    },
    balancesBefore: {
      ownerBalBefore: ownerBalBefore.toString(),
      recipientBalBefore: recipientBalBefore.toString(),
      mintSupplyBefore: mintBefore.supply.toString(),
    },
    accountExistenceBefore: {
      parentAExistsBefore: !!parentAExistsBefore,
      parentBExistsBefore: !!parentBExistsBefore,
    },
  });

  const sig = await program.methods
    .rebirthMiner()
    .accounts({
      owner,
      config: configPda,
      rebirthConfig: rebirthConfigPda,
      parentAState: parentA.minerPda,
      parentBState: parentB.minerPda,
      parentAProgress: parentA.progressPda,
      parentBProgress: parentB.progressPda,
      childState: childStatePda,
      childProgress: childProgressPda,
      essMint,
      ownerAta: ownerAta.address,
      recipientAta: recipientAta.address,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("rebirthMiner sig:", sig);

  const childState: any = await minerStateAccount.fetch(childStatePda);
  const childProgress: any = await minerProgressAccount.fetch(childProgressPda);
  const cfgAfter: any = await configAccount.fetch(configPda);

  const parentAExistsAfter = await provider.connection.getAccountInfo(
    parentA.minerPda,
    "confirmed"
  );
  const parentBExistsAfter = await provider.connection.getAccountInfo(
    parentB.minerPda,
    "confirmed"
  );
  const parentAProgExistsAfter = await provider.connection.getAccountInfo(
    parentA.progressPda,
    "confirmed"
  );
  const parentBProgExistsAfter = await provider.connection.getAccountInfo(
    parentB.progressPda,
    "confirmed"
  );

  const ownerBalAfter = (
    await getAccount(provider.connection, ownerAta.address)
  ).amount;
  const recipientBalAfter = (
    await getAccount(provider.connection, recipientAta.address)
  ).amount;
  const mintAfter = await getMint(provider.connection, essMint);

  const ownerDelta = ownerBalBefore - ownerBalAfter;
  const recipientDelta = recipientBalAfter - recipientBalBefore;
  const supplyDelta = mintBefore.supply - mintAfter.supply;

  const childHashBase = BigInt(
    childState.hashBase?.toString?.() ?? childState.hash_base?.toString?.()
  );
  const [minNext, maxNext] = rarityHashRange(nextRarity);
  const expectedLow =
    parentA.hashBase + parentB.hashBase > minNext
      ? parentA.hashBase + parentB.hashBase
      : minNext;
  const expectedHigh = maxNext;

  console.log("\n=== AFTER REBIRTH ===");
  console.log({
    usedParents: {
      parentA: parentASummary,
      parentB: parentBSummary,
    },
    childState: childStatePda.toBase58(),
    childProgress: childProgressPda.toBase58(),
    childId: childState.id?.toString?.() ?? String(childState.id),
    childOwner: childState.owner.toBase58(),
    childRarity: Number(childState.rarity),
    childElement: Number(childState.element),
    childHashBase: childHashBase.toString(),
    childListed: !!childState.listed,
    childAllocatedLand: childState.allocatedLand.toBase58(),
    childLevel: Number(childProgress.level),
    childExp: childProgress.exp.toString(),
    expectedChildLevel,
    configNextMinerIdAfter: cfgAfter.nextMinerId.toString(),
    ownerDelta: ownerDelta.toString(),
    recipientDelta: recipientDelta.toString(),
    supplyDelta: supplyDelta.toString(),
    parentAExistsAfter: !!parentAExistsAfter,
    parentBExistsAfter: !!parentBExistsAfter,
    parentAProgExistsAfter: !!parentAProgExistsAfter,
    parentBProgExistsAfter: !!parentBProgExistsAfter,
    expectedHashRange: {
      low: expectedLow.toString(),
      high: expectedHigh.toString(),
    },
  });

  if (Number(childState.rarity) !== nextRarity) {
    throw new Error(
      `Child rarity invalid. Expected ${nextRarity}, got ${Number(childState.rarity)}`
    );
  }

  if (childState.owner.toBase58() !== owner.toBase58()) {
    throw new Error(
      `Child owner invalid. Expected ${owner.toBase58()}, got ${childState.owner.toBase58()}`
    );
  }

  if (!!childState.listed !== false) {
    throw new Error("Child should not be listed");
  }

  if (childState.allocatedLand.toBase58() !== PublicKey.default.toBase58()) {
    throw new Error("Child allocated_land should be default pubkey");
  }

  if (Number(childProgress.level) !== expectedChildLevel) {
    throw new Error(
      `Child level invalid. Expected ${expectedChildLevel}, got ${Number(childProgress.level)}`
    );
  }

  if (BigInt(childProgress.exp.toString()) !== 0n) {
    throw new Error(
      `Child exp invalid. Expected 0, got ${childProgress.exp.toString()}`
    );
  }

  if (BigInt(cfgAfter.nextMinerId.toString()) !== childId + 1n) {
    throw new Error(
      `nextMinerId invalid. Expected ${childId + 1n}, got ${cfgAfter.nextMinerId.toString()}`
    );
  }

  if (parentAExistsAfter || parentBExistsAfter) {
    throw new Error("Parent miner accounts should be closed after rebirth");
  }

  if (parentAProgExistsAfter || parentBProgExistsAfter) {
    throw new Error("Parent progress accounts should be closed after rebirth");
  }

  if (ownerDelta !== essCost) {
    throw new Error(
      `Owner ESS delta invalid. Expected ${essCost}, got ${ownerDelta}`
    );
  }

  if (recipientDelta !== treasuryAmount) {
    throw new Error(
      `Recipient ESS delta invalid. Expected ${treasuryAmount}, got ${recipientDelta}`
    );
  }

  if (supplyDelta !== burnAmount) {
    throw new Error(
      `Mint supply burn delta invalid. Expected ${burnAmount}, got ${supplyDelta}`
    );
  }

  if (childHashBase < expectedLow || childHashBase > expectedHigh) {
    throw new Error(
      `Child hash_base out of range. Expected ${expectedLow}..${expectedHigh}, got ${childHashBase}`
    );
  }

  console.log("\n✅ rebirth_flow completed successfully");
}

main().catch((e) => {
  console.error("FATAL rebirth_flow:", e);
  process.exit(1);
});