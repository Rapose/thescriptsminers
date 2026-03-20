import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
  getMint,
  getOrCreateAssociatedTokenAccount,
  transfer,
} from "@solana/spl-token";
import fs from "node:fs";

process.env.ANCHOR_PROVIDER_URL =
  process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com";

process.env.ANCHOR_WALLET =
  process.env.ANCHOR_WALLET ||
  "/mnt/c/Users/Rapose/miners-of-essence/miners/minha-wallet.json";

const SEED_CONFIG = Buffer.from("config");
const SEED_PROGRESSION = Buffer.from("progression_v1");
const SEED_ECONOMY = Buffer.from("economy_v4");
const SEED_REWARDS_AUTH = Buffer.from("rewards_auth");
const SEED_EXPEDITION_CONFIG = Buffer.from("expedition_config_v1");
const SEED_EXPEDITION_SESSION = Buffer.from("expedition_session_v1");
const SEED_EQUIPMENT_INVENTORY = Buffer.from("equipment_inventory_v1");
const SEED_MINER = Buffer.from("miner");
const SEED_MINER_PROGRESS = Buffer.from("miner_progress_v1");

const RECIPIENT_WALLET = new PublicKey(
  "Ea9pUYYtCF6usjYAd2RdqeZ2WJETSwPaPwrGmfQRktXf"
);

// Config de teste rápido
const TEST_TIER_COST_ESS = [
  new anchor.BN(1),
  new anchor.BN(2),
  new anchor.BN(3),
  new anchor.BN(4),
  new anchor.BN(5),
];
const TEST_TIER_LOCK_SECS = [20, 20, 20, 20, 20];
const TEST_TIER_ITEM_CAP_BPS = [3500, 3100, 2700, 2300, 1900];
const TEST_TIER_LEVEL_CAP = [2, 4, 6, 8, 10];
const TEST_NEW_EQUIPMENT_BPS_BY_RARITY = [4600, 5000, 5500, 5900, 6300];

function resolveIdlPath(): string {
  const p = "target/idl/moe_anchor_v1.json";
  if (!fs.existsSync(p)) {
    throw new Error("IDL not found at target/idl/moe_anchor_v1.json");
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

function toBig(v: any): bigint {
  if (typeof v === "bigint") return v;
  return BigInt(v?.toString?.() ?? v);
}

function toNum(v: any): number {
  if (typeof v === "number") return v;
  return Number(v?.toString?.() ?? v);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureRewardsVaultLiquidity(
  connection: anchor.web3.Connection,
  payer: any,
  owner: PublicKey,
  ownerAta: PublicKey,
  rewardsVault: PublicKey,
  minAmount: bigint
) {
  const current = (await getAccount(connection, rewardsVault)).amount;

  if (current >= minAmount) {
    return current;
  }

  const needed = minAmount - current;

  const sig = await transfer(
    connection,
    payer,
    ownerAta,
    rewardsVault,
    payer,
    needed
  );

  console.log("Top up rewardsVault sig:", sig);

  return (await getAccount(connection, rewardsVault)).amount;
}


function u64Le(n: bigint) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

async function accountExists(
  connection: anchor.web3.Connection,
  pda: PublicKey
): Promise<boolean> {
  return !!(await connection.getAccountInfo(pda, "confirmed"));
}

async function readSessionIfExists(
  program: anchor.Program,
  sessionPda: PublicKey
) {
  const exists = await accountExists(program.provider.connection, sessionPda);
  if (!exists) return null;

  const expeditionSessionAccount = getAccountClient(program, ["expeditionSession"]);
  return await expeditionSessionAccount.fetch(sessionPda);
}

async function resolveExistingSessionIfPossible(
  program: anchor.Program,
  owner: PublicKey,
  economyPda: PublicKey,
  expeditionConfigPda: PublicKey,
  minerPda: PublicKey,
  minerProgressPda: PublicKey,
  sessionPda: PublicKey,
  inventoryPda: PublicKey,
  essMint: PublicKey,
  ownerAta: PublicKey,
  rewardsVault: PublicKey,
  rewardsAuthority: PublicKey
) {
  const session: any = await readSessionIfExists(program, sessionPda);
  if (!session) return false;

  const nowTs = Math.floor(Date.now() / 1000);
  const endsAt = Number(session.endsAt?.toString?.() ?? session.ends_at?.toString?.() ?? 0);

  console.log("\n[INFO] Existing expedition session found:", {
    session: sessionPda.toBase58(),
    miner: minerPda.toBase58(),
    startedAt: session.startedAt?.toString?.() ?? session.started_at?.toString?.(),
    endsAt: String(endsAt),
    nowTs: String(nowTs),
  });

  if (nowTs < endsAt) {
    throw new Error(
      `Existing expedition session is still locked until ${endsAt}. Resolve it later or wait for lock expiration.`
    );
  }

  console.log("[INFO] Resolving leftover expedition session before starting a new one...");

  const sig = await program.methods
    .expeditionResolve()
    .accounts({
      owner,
      expeditionConfig: expeditionConfigPda,
      economy: economyPda,
      minerState: minerPda,
      minerProgress: minerProgressPda,
      expeditionSession: sessionPda,
      inventory: inventoryPda,
      essMint,
      ownerAta,
      rewardsVault,
      rewardsAuthority,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("Resolved leftover expedition session sig:", sig);
  return true;
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

  // Garantir ESS mint/recipient corretos
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

async function ensureExpeditionConfig(
  program: anchor.Program,
  owner: PublicKey,
  essMint: PublicKey
) {
  const [expeditionConfigPda] = PublicKey.findProgramAddressSync(
    [SEED_EXPEDITION_CONFIG],
    program.programId
  );

  const exists = await accountExists(
    program.provider.connection,
    expeditionConfigPda
  );

  if (!exists) {
    console.log("Expedition config not found. Initializing...");
    await program.methods
      .expeditionInit()
      .accounts({
        admin: owner,
        essMint,
        expeditionConfig: expeditionConfigPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  console.log("Updating expedition config to test values...");
  await program.methods
  .expeditionUpdateConfig(
    TEST_TIER_COST_ESS,
    TEST_TIER_LOCK_SECS,
    TEST_TIER_ITEM_CAP_BPS,
    TEST_TIER_LEVEL_CAP,
    TEST_NEW_EQUIPMENT_BPS_BY_RARITY,
    true
  )
    .accounts({
      admin: owner,
      essMint,
      expeditionConfig: expeditionConfigPda,
    })
    .rpc();

  return expeditionConfigPda;
}

async function ensureEquipmentInventory(program: anchor.Program, owner: PublicKey) {
  const [inventoryPda] = PublicKey.findProgramAddressSync(
    [SEED_EQUIPMENT_INVENTORY, owner.toBuffer()],
    program.programId
  );

  const exists = await accountExists(program.provider.connection, inventoryPda);
  if (!exists) {
    console.log("Equipment inventory not found. Initializing...");
    await program.methods
      .equipmentInventoryInit()
      .accounts({
        owner,
        inventory: inventoryPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  return inventoryPda;
}

async function findCandidateMiner(program: anchor.Program, owner: PublicKey) {
  const minerStateAccount = getAccountClient(program, ["minerState"]);
  const minerProgressAccount = getAccountClient(program, ["minerProgress"]);

  const allMiners = await minerStateAccount.all();

  const owned = [];
  for (const row of allMiners) {
    const acc: any = row.account;
    const minerPda: PublicKey = row.publicKey;

    const minerOwner = acc.owner?.toBase58?.() ?? String(acc.owner);
    if (minerOwner !== owner.toBase58()) continue;
    if (!!acc.listed) continue;

    const allocatedLand =
      acc.allocatedLand?.toBase58?.() ??
      acc.allocated_land?.toBase58?.() ??
      String(acc.allocatedLand ?? acc.allocated_land);

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
        id: acc.id?.toString?.() ?? String(acc.id),
        rarity: toNum(acc.rarity),
        hashBase: toBig(acc.hashBase ?? acc.hash_base),
        level: toNum(progress.level),
      });
    } catch {
      // ignore
    }
  }

  if (!owned.length) {
    throw new Error("No eligible miner found. Mint/reveal at least one miner first.");
  }

  // Preferir miner mais forte
  owned.sort((a, b) => Number(b.hashBase - a.hashBase));
  return owned[0];
}

function summarizeInventory(inv: any) {
  const pick = (arr: any) => {
    const out: Record<string, string> = {};
    for (let i = 1; i < arr.length; i++) {
      const v = BigInt(arr[i]?.toString?.() ?? arr[i] ?? 0);
      if (v > 0n) out[String(i)] = v.toString();
    }
    return out;
  };

  return {
    newHand: pick(inv.newHand ?? inv.new_hand ?? []),
    newHead: pick(inv.newHead ?? inv.new_head ?? []),
    brokenHand: pick(inv.brokenHand ?? inv.broken_hand ?? []),
    brokenHead: pick(inv.brokenHead ?? inv.broken_head ?? []),
    newHandRemelted: pick(inv.newHandRemelted ?? inv.new_hand_remelted ?? []),
    newHeadRemelted: pick(inv.newHeadRemelted ?? inv.new_head_remelted ?? []),
    brokenHandRemelted: pick(inv.brokenHandRemelted ?? inv.broken_hand_remelted ?? []),
    brokenHeadRemelted: pick(inv.brokenHeadRemelted ?? inv.broken_head_remelted ?? []),
  };
}

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = loadProgram(provider);

  const owner = provider.wallet.publicKey;
  const payer = (provider.wallet as any).payer;

  if (!fs.existsSync(".ess_mint.tmp")) {
    throw new Error("ESS mint not found. Run scripts/core/create_fixed_mint.ts first.");
  }

  const essMint = new PublicKey(fs.readFileSync(".ess_mint.tmp", "utf8").trim());

  const [configPda] = PublicKey.findProgramAddressSync(
    [SEED_CONFIG],
    program.programId
  );
  const [economyPda] = PublicKey.findProgramAddressSync(
    [SEED_ECONOMY],
    program.programId
  );
  const [expeditionConfigPda] = PublicKey.findProgramAddressSync(
    [SEED_EXPEDITION_CONFIG],
    program.programId
  );
  const [rewardsAuthority] = PublicKey.findProgramAddressSync(
    [SEED_REWARDS_AUTH],
    program.programId
  );

  const inventoryAccount = getAccountClient(program, [
    "equipmentInventoryState",
    "inventory",
  ]);
  const expeditionSessionAccount = getAccountClient(program, [
    "expeditionSession",
  ]);

  await ensureProgression(program, owner);
  const economy = await ensureEconomy(program, owner, payer, essMint);
  await ensureExpeditionConfig(program, owner, essMint);
  const inventoryPda = await ensureEquipmentInventory(program, owner);

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

  const rewardsVault = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    essMint,
    rewardsAuthority,
    true
  );
await ensureRewardsVaultLiquidity(
  provider.connection,
  payer,
  owner,
  ownerAta.address,
  rewardsVault.address,
  5_000_000_000n // 50 ESS with 8 decimals
);

  const miner = await findCandidateMiner(program, owner);
  const [sessionPda] = PublicKey.findProgramAddressSync(
    [SEED_EXPEDITION_SESSION, miner.minerPda.toBuffer()],
    program.programId
  );

  const invBefore: any = await inventoryAccount.fetch(inventoryPda);
  const ownerBalBefore = (await getAccount(provider.connection, ownerAta.address)).amount;
  const recipientBalBefore = (await getAccount(provider.connection, recipientAta.address)).amount;
  const rewardsBalBefore = (await getAccount(provider.connection, rewardsVault.address)).amount;
  const mintBefore = await getMint(provider.connection, essMint);

  console.log("\n=== EXPEDITION TEST START ===");
  console.log({
    programId: program.programId.toBase58(),
    rewardsVaultBalance: (await getAccount(provider.connection, rewardsVault.address)).amount.toString(),
    owner: owner.toBase58(),
    config: configPda.toBase58(),
    economy: economyPda.toBase58(),
    expeditionConfig: expeditionConfigPda.toBase58(),
    inventory: inventoryPda.toBase58(),
    miner: {
      pda: miner.minerPda.toBase58(),
      progressPda: miner.progressPda.toBase58(),
      id: miner.id,
      rarity: miner.rarity,
      hashBase: miner.hashBase.toString(),
      level: miner.level,
    },
    session: sessionPda.toBase58(),
    essMint: essMint.toBase58(),
    ownerAta: ownerAta.address.toBase58(),
    recipientAta: recipientAta.address.toBase58(),
    rewardsVault: rewardsVault.address.toBase58(),
    testLockSecs: TEST_TIER_LOCK_SECS[0],
  });

  console.log("\n=== INVENTORY BEFORE ===");
console.log(summarizeInventory(invBefore));

await resolveExistingSessionIfPossible(
  program,
  owner,
  economyPda,
  expeditionConfigPda,
  miner.minerPda,
  miner.progressPda,
  sessionPda,
  inventoryPda,
  essMint,
  ownerAta.address,
  rewardsVault.address,
  rewardsAuthority
);

const sessionExistsBeforeStart = await accountExists(provider.connection, sessionPda);
console.log("\nSession exists before start?", sessionExistsBeforeStart);

const startSig = await program.methods
  .expeditionStart(1)
    .accounts({
  owner,
  expeditionConfig: expeditionConfigPda,
  economy: economyPda,
  minerState: miner.minerPda,
  minerProgress: miner.progressPda,
  expeditionSession: sessionPda,
  inventory: inventoryPda,
  essMint,
  ownerAta: ownerAta.address,
  tokenProgram: TOKEN_PROGRAM_ID,
  systemProgram: SystemProgram.programId,
})
    .rpc();

  console.log("\nexpeditionStart sig:", startSig);

  const session: any = await expeditionSessionAccount.fetch(sessionPda);
  console.log("\n=== SESSION AFTER START ===");
  console.log({
    owner: session.owner.toBase58(),
    miner: session.miner.toBase58(),
    tier: Number(session.tier),
    essSpent: session.essSpent.toString(),
    startedAt: session.startedAt.toString(),
    endsAt: session.endsAt.toString(),
  });

  console.log(`\nWaiting ${TEST_TIER_LOCK_SECS[0] + 2}s for expedition lock...`);
  await sleep((TEST_TIER_LOCK_SECS[0] + 2) * 1000);

  const resolveSig = await program.methods
    .expeditionResolve()
    .accounts({
      owner,
      expeditionConfig: expeditionConfigPda,
      economy: economyPda,
      minerState: miner.minerPda,
      minerProgress: miner.progressPda,
      expeditionSession: sessionPda,
      inventory: inventoryPda,
      essMint,
      ownerAta: ownerAta.address,
      rewardsVault: rewardsVault.address,
      rewardsAuthority,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("\nexpeditionResolve sig:", resolveSig);

  const sessionExistsAfter = await accountExists(provider.connection, sessionPda);
  const invAfter: any = await inventoryAccount.fetch(inventoryPda);
  const ownerBalAfter = (await getAccount(provider.connection, ownerAta.address)).amount;
  const recipientBalAfter = (await getAccount(provider.connection, recipientAta.address)).amount;
  const rewardsBalAfter = (await getAccount(provider.connection, rewardsVault.address)).amount;
  const mintAfter = await getMint(provider.connection, essMint);

  console.log("\n=== INVENTORY AFTER ===");
  console.log(summarizeInventory(invAfter));

  console.log("\n=== BALANCE DELTAS ===");
  console.log({
    ownerDelta: (ownerBalBefore - ownerBalAfter).toString(),
    recipientDelta: (recipientBalAfter - recipientBalBefore).toString(),
    rewardsVaultDelta: (rewardsBalAfter - rewardsBalBefore).toString(),
    mintSupplyDelta: (mintBefore.supply - mintAfter.supply).toString(),
    sessionExistsAfter,
  });

  if (sessionExistsAfter) {
    throw new Error("Expedition session should be closed after resolve");
  }

  console.log("\n✅ expedition_flow completed successfully");
}

main().catch((e) => {
  console.error("FATAL expedition_flow:", e);
  process.exit(1);
});