import * as anchor from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMintToInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  getMint,
} from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { bn, loadEnv, waitSlots } from "./test_env";
import fs from "node:fs";
import path from "node:path";

const SEED = {
  CONFIG: Buffer.from("config"),
  ECONOMY: Buffer.from("economy_v4"),
  REWARDS_AUTH: Buffer.from("rewards_auth"),
  PROGRESSION: Buffer.from("progression_v1"),
  GLOBAL_MINING: Buffer.from("global_mining_v2"),
  EQUIP_INV: Buffer.from("equipment_inventory_v1"),
  EQUIPMENT: Buffer.from("equipment_v1"),
  MINER: Buffer.from("miner"),
  LAND: Buffer.from("land"),
  MINER_PROGRESS: Buffer.from("miner_progress_v1"),
  MINER_MINING: Buffer.from("miner_mining_v1"),
  LB_MINER: Buffer.from("lb_miner"),
  LISTING: Buffer.from("listing_v1"),
  LB_LAND: Buffer.from("lb_land"),
};

const MINT_TMP = ".ess_mint.tmp";
const MINT_AUTH_TMP = ".ess_mint_auth.tmp";
const DEVNET_WALLETS_DIR = ".devnet_test_wallets";
const SELLER_FILE = path.join(DEVNET_WALLETS_DIR, "seller.json");
const BUYER_FILE = path.join(DEVNET_WALLETS_DIR, "buyer.json");

const DEVNET_SOL_MIN = 0.25 * LAMPORTS_PER_SOL;
const DEVNET_REVEAL_WAIT_SLOTS = 12;

type Fixture = {
  env: ReturnType<typeof loadEnv>;
  seller: Keypair;
  buyer: Keypair;
  recipientWallet: PublicKey;
  essMint: PublicKey;
  config: PublicKey;
  progression: PublicKey;
  economy: PublicKey;
  globalMining: PublicKey;
  rewardsAuthority: PublicKey;
  rewardsVault: PublicKey;
  recipientAta: PublicKey;
  sellerAta: PublicKey;
  buyerAta: PublicKey;
  miner: PublicKey;
  minerProgress: PublicKey;
  minerMining: PublicKey;
  equipment: PublicKey;
  land: PublicKey;
  sellerInventory: PublicKey;
  buyerInventory: PublicKey;
};

function pda(programId: PublicKey, ...parts: (Buffer | Uint8Array)[]) {
  return PublicKey.findProgramAddressSync(parts, programId)[0];
}

function u64Le(n: bigint) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

function getAccountClient(program: any, names: string[]) {
  for (const n of names) {
    if (program.account?.[n]) return program.account[n];
  }
  throw new Error(`Account client not found. Tried: ${names.join(", ")}`);
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadOrCreateKeypair(filePath: string): Keypair {
  if (fs.existsSync(filePath)) {
    const arr = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  }

  const kp = Keypair.generate();
  fs.writeFileSync(filePath, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

async function fundSolFromAdminIfNeeded(
  env: ReturnType<typeof loadEnv>,
  destination: PublicKey,
  minLamports = DEVNET_SOL_MIN
) {
  const connection = env.provider.connection;
  const current = await connection.getBalance(destination, "confirmed");
  if (current >= minLamports) return;

  const amount = Math.ceil(minLamports - current);

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: env.admin.publicKey,
      toPubkey: destination,
      lamports: amount,
    })
  );

  await env.provider.sendAndConfirm(tx, []);
}

async function ensureMint(
  env: ReturnType<typeof loadEnv>
): Promise<{ essMint: PublicKey; mintAuthority: Keypair | null }> {
  if (!fs.existsSync(MINT_TMP)) {
    throw new Error("ESS mint not found. Run the core suite first so .ess_mint.tmp exists.");
  }

  const mintPk = new PublicKey(fs.readFileSync(MINT_TMP, "utf8").trim());
  const info = await env.provider.connection.getAccountInfo(mintPk, "confirmed");
  if (!info) {
    throw new Error(`ESS mint from .ess_mint.tmp does not exist on chain: ${mintPk.toBase58()}`);
  }

  let mintAuthority: Keypair | null = null;
  if (fs.existsSync(MINT_AUTH_TMP)) {
    const authBytes = Uint8Array.from(JSON.parse(fs.readFileSync(MINT_AUTH_TMP, "utf8")));
    mintAuthority = Keypair.fromSecretKey(authBytes);
  }

  return { essMint: mintPk, mintAuthority };
}

async function ensureAta(
  env: ReturnType<typeof loadEnv>,
  mint: PublicKey,
  owner: PublicKey
) {
  const ata = await getOrCreateAssociatedTokenAccount(
    env.provider.connection,
    env.admin.payer,
    mint,
    owner
  );
  return ata.address;
}

async function fundTokenAccount(
  env: ReturnType<typeof loadEnv>,
  mint: PublicKey,
  destinationOwner: PublicKey,
  amount: bigint,
  mintAuthority?: Keypair | null
) {
  const destinationAta = await ensureAta(env, mint, destinationOwner);
  if (amount === 0n) return destinationAta;

  const mintInfo = await getMint(env.provider.connection, mint);

  if (mintInfo.mintAuthority && mintAuthority) {
    const tx = new Transaction().add(
      createMintToInstruction(mint, destinationAta, mintAuthority.publicKey, amount)
    );
    await env.provider.sendAndConfirm(tx, [mintAuthority]);
    return destinationAta;
  }

  const adminAta = await ensureAta(env, mint, env.admin.publicKey);
  const adminAcc = await getAccount(env.provider.connection, adminAta);

  if (adminAcc.amount < amount) {
    throw new Error(
      `Admin ATA has insufficient ESS. Have=${adminAcc.amount.toString()} need=${amount.toString()}`
    );
  }

  const tx = new Transaction().add(
    createTransferInstruction(adminAta, destinationAta, env.admin.publicKey, amount)
  );
  await env.provider.sendAndConfirm(tx, []);

  return destinationAta;
}

async function ensureEconomy(
  env: ReturnType<typeof loadEnv>,
  essMint: PublicKey
) {
  const config = pda(env.program.programId, SEED.CONFIG);
  const progression = pda(env.program.programId, SEED.PROGRESSION);
  const economy = pda(env.program.programId, SEED.ECONOMY);
  const rewardsAuthority = pda(env.program.programId, SEED.REWARDS_AUTH);
  const globalMining = pda(env.program.programId, SEED.GLOBAL_MINING);

  const configAccount = getAccountClient(env.program, ["config"]);
  const progressionAccount = getAccountClient(env.program, ["progressionConfig", "progression"]);
  const economyAccount = getAccountClient(env.program, ["economyConfig", "economy"]);
  const globalMiningAccount = getAccountClient(
    env.program,
    ["globalMiningState", "globalMiningConfig", "globalMining"]
  );

  try {
    await configAccount.fetch(config);
  } catch {
    await env.program.methods
      .initializeConfig()
      .accounts({
        admin: env.admin.publicKey,
        config,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  try {
    await progressionAccount.fetch(progression);
  } catch {
    await env.program.methods
      .progressionInit()
      .accounts({
        admin: env.admin.publicKey,
        progression,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  let recipientWallet = env.admin.publicKey;
  let rewardsVault = getAssociatedTokenAddressSync(essMint, rewardsAuthority, true);

  let economyExists = true;
  try {
    const eco: any = await economyAccount.fetch(economy);

    recipientWallet =
      eco.recipientWallet ??
      eco.recipient_wallet ??
      env.admin.publicKey;

    rewardsVault =
      eco.rewardsVault ??
      eco.rewards_vault ??
      getAssociatedTokenAddressSync(essMint, rewardsAuthority, true);
  } catch {
    economyExists = false;
  }

  await getOrCreateAssociatedTokenAccount(
    env.provider.connection,
    env.admin.payer,
    essMint,
    rewardsAuthority,
    true
  );

  if (!economyExists) {
    await env.program.methods
      .economyInit()
      .accounts({
        admin: env.admin.publicKey,
        essMint,
        recipientWallet,
        economy,
        rewardsAuthority,
        rewardsVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  try {
    await globalMiningAccount.fetch(globalMining);
  } catch {
    await env.program.methods
      .globalMiningInit(2, bn(100_000))
      .accounts({
        admin: env.admin.publicKey,
        global: globalMining,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  return {
    config,
    progression,
    economy,
    globalMining,
    rewardsAuthority,
    rewardsVault,
    recipientWallet,
  };
}

async function createMinerWithProgress(
  env: ReturnType<typeof loadEnv>,
  ownerKp: Keypair
) {
  const owner = ownerKp.publicKey;

  const config = pda(env.program.programId, SEED.CONFIG);
  const configAccount = getAccountClient(env.program, ["config"]);
  const minerStateAccount = getAccountClient(env.program, ["minerState", "miner"]);

  const lootboxId = BigInt(Date.now()) + BigInt(Math.floor(Math.random() * 100000));
  const lootbox = pda(
    env.program.programId,
    SEED.LB_MINER,
    owner.toBuffer(),
    u64Le(lootboxId)
  );

  const salt = new Uint8Array(32);

  await env.program.methods
    .lootboxMinerInit(new anchor.BN(lootboxId.toString()))
    .accounts({
      owner,
      config,
      lootbox,
      systemProgram: SystemProgram.programId,
    })
    .signers([ownerKp])
    .rpc();

  await env.program.methods
    .lootboxMinerCommit(new anchor.BN(lootboxId.toString()), [...salt])
    .accounts({
      owner,
      lootbox,
    })
    .signers([ownerKp])
    .rpc();

  await waitSlots(env.provider.connection, DEVNET_REVEAL_WAIT_SLOTS);

  for (let attempt = 0; attempt < 3; attempt++) {
    const cfg: any = await configAccount.fetch(config);
    const nextMinerId = BigInt(cfg.nextMinerId.toString());

    const miner = pda(
      env.program.programId,
      SEED.MINER,
      owner.toBuffer(),
      u64Le(nextMinerId)
    );

    const minerProgress = pda(
      env.program.programId,
      SEED.MINER_PROGRESS,
      miner.toBuffer()
    );

    const minerMining = pda(
      env.program.programId,
      SEED.MINER_MINING,
      miner.toBuffer()
    );

    const equipment = pda(
      env.program.programId,
      SEED.EQUIPMENT,
      miner.toBuffer()
    );

    try {
      const existing = await env.provider.connection.getAccountInfo(miner, "confirmed");
      if (existing) {
        return { miner, minerProgress, minerMining, equipment };
      }

      await env.program.methods
        .lootboxMinerReveal(new anchor.BN(lootboxId.toString()), [...salt])
        .accounts({
          owner,
          config,
          lootbox,
          minerState: miner,
          minerProgress,
          systemProgram: SystemProgram.programId,
        })
        .signers([ownerKp])
        .rpc();

      return { miner, minerProgress, minerMining, equipment };
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (!msg.includes("ConstraintSeeds")) throw e;

      if (attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  throw new Error("createMinerWithProgress failed unexpectedly");
}

async function createLand(
  env: ReturnType<typeof loadEnv>,
  ownerKp: Keypair
) {
  const owner = ownerKp.publicKey;
  const config = pda(env.program.programId, SEED.CONFIG);
  const configAccount = getAccountClient(env.program, ["config"]);
  const landStateAccount = getAccountClient(env.program, ["landState", "land"]);

  const lootboxId = BigInt(Date.now()) + BigInt(Math.floor(Math.random() * 100000));
  const lootbox = pda(
    env.program.programId,
    SEED.LB_LAND,
    owner.toBuffer(),
    u64Le(lootboxId)
  );

  const salt = new Uint8Array(32);

  await env.program.methods
    .lootboxLandInit(new anchor.BN(lootboxId.toString()))
    .accounts({
      owner,
      config,
      lootbox,
      systemProgram: SystemProgram.programId,
    })
    .signers([ownerKp])
    .rpc();

  await env.program.methods
    .lootboxLandCommit(new anchor.BN(lootboxId.toString()), [...salt])
    .accounts({
      owner,
      lootbox,
    })
    .signers([ownerKp])
    .rpc();

  await waitSlots(env.provider.connection, DEVNET_REVEAL_WAIT_SLOTS);

  for (let attempt = 0; attempt < 3; attempt++) {
    const cfg: any = await configAccount.fetch(config);
    const nextLandId = BigInt(cfg.nextLandId.toString());

    const land = pda(
      env.program.programId,
      SEED.LAND,
      owner.toBuffer(),
      u64Le(nextLandId)
    );

    try {
      const existing = await env.provider.connection.getAccountInfo(land, "confirmed");
      if (existing) {
        return { land };
      }

      await env.program.methods
        .lootboxLandReveal(new anchor.BN(lootboxId.toString()), [...salt])
        .accounts({
          owner,
          config,
          lootbox,
          landState: land,
          systemProgram: SystemProgram.programId,
        })
        .signers([ownerKp])
        .rpc();

      return { land };
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (!msg.includes("ConstraintSeeds")) throw e;

      if (attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  throw new Error("createLand failed unexpectedly");
}

async function ensureInventory(
  env: ReturnType<typeof loadEnv>,
  ownerKp: Keypair
) {
  const owner = ownerKp.publicKey;
  const inventory = pda(env.program.programId, SEED.EQUIP_INV, owner.toBuffer());

  const inventoryAccount = getAccountClient(
    env.program,
    ["equipmentInventoryState", "equipmentInventory"]
  );

  try {
    await inventoryAccount.fetch(inventory);
  } catch {
    await env.program.methods
      .equipmentInventoryInit()
      .accounts({
        owner,
        inventory,
        systemProgram: SystemProgram.programId,
      })
      .signers([ownerKp])
      .rpc();
  }

  return inventory;
}

async function ensureEquipment(
  env: ReturnType<typeof loadEnv>,
  ownerKp: Keypair,
  miner: PublicKey,
  equipment: PublicKey
) {
  const owner = ownerKp.publicKey;
  const equipmentAccount = getAccountClient(env.program, ["equipmentState", "equipment"]);

  try {
    await equipmentAccount.fetch(equipment);
  } catch {
    await env.program.methods
      .equipmentInit()
      .accounts({
        owner,
        minerState: miner,
        equipment,
        systemProgram: SystemProgram.programId,
      })
      .signers([ownerKp])
      .rpc();
  }
}

async function ensureMinerMining(
  env: ReturnType<typeof loadEnv>,
  ownerKp: Keypair,
  miner: PublicKey,
  minerMining: PublicKey
) {
  const owner = ownerKp.publicKey;
  const globalMining = pda(env.program.programId, SEED.GLOBAL_MINING);

  const globalMiningAccount = getAccountClient(
    env.program,
    ["globalMiningState", "globalMiningConfig", "globalMining"]
  );
  const minerMiningAccount = getAccountClient(
    env.program,
    ["minerMiningState", "minerMining"]
  );

  try {
    await globalMiningAccount.fetch(globalMining);
  } catch {
    await env.program.methods
      .globalMiningInit(2, bn(100_000))
      .accounts({
        admin: env.admin.publicKey,
        global: globalMining,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  try {
    await minerMiningAccount.fetch(minerMining);
  } catch {
    await env.program.methods
      .globalMiningRegisterMiner()
      .accounts({
        owner,
        global: globalMining,
        minerState: miner,
        minerMining,
        systemProgram: SystemProgram.programId,
      })
      .signers([ownerKp])
      .rpc();
  }
}

async function grantEquipment(
  env: ReturnType<typeof loadEnv>,
  inventory: PublicKey,
  owner: PublicKey
) {
  await env.program.methods
    .equipmentInventoryGrantItem({ hand: {} }, 1, 1, false, false)
    .accounts({
      admin: env.admin.publicKey,
      config: pda(env.program.programId, SEED.CONFIG),
      inventory,
      owner,
    })
    .rpc();
}

export async function buildMarketplaceFixture(): Promise<Fixture> {
  const env = loadEnv();

  ensureDir(DEVNET_WALLETS_DIR);
  const seller = loadOrCreateKeypair(SELLER_FILE);
  const buyer = loadOrCreateKeypair(BUYER_FILE);

  await fundSolFromAdminIfNeeded(env, seller.publicKey);
  await fundSolFromAdminIfNeeded(env, buyer.publicKey);

  const { essMint, mintAuthority } = await ensureMint(env);

  const {
    config,
    progression,
    economy,
    globalMining,
    rewardsAuthority,
    rewardsVault,
    recipientWallet,
  } = await ensureEconomy(env, essMint);

  const sellerAta = await fundTokenAccount(
    env,
    essMint,
    seller.publicKey,
    5_000_000_000n,
    mintAuthority
  );

  const buyerAta = await fundTokenAccount(
    env,
    essMint,
    buyer.publicKey,
    5_000_000_000n,
    mintAuthority
  );

  const recipientAta = await ensureAta(env, essMint, recipientWallet);

  const sellerMiner = await createMinerWithProgress(env, seller);
  await ensureEquipment(env, seller, sellerMiner.miner, sellerMiner.equipment);
  await ensureMinerMining(env, seller, sellerMiner.miner, sellerMiner.minerMining);

  const sellerLand = await createLand(env, seller);

  const sellerInventory = await ensureInventory(env, seller);
  const buyerInventory = await ensureInventory(env, buyer);

  await grantEquipment(env, sellerInventory, seller.publicKey);

  return {
    env,
    seller,
    buyer,
    recipientWallet,
    essMint,
    config,
    progression,
    economy,
    globalMining,
    rewardsAuthority,
    rewardsVault,
    recipientAta,
    sellerAta,
    buyerAta,
    miner: sellerMiner.miner,
    minerProgress: sellerMiner.minerProgress,
    minerMining: sellerMiner.minerMining,
    equipment: sellerMiner.equipment,
    land: sellerLand.land,
    sellerInventory,
    buyerInventory,
  };
}