import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { buildMarketplaceFixture } from "./helpers/marketplace_fixture";
import { logStep, SuiteCtx } from "./_shared";
import { runMarketplaceMinerTests } from "./marketplace_miner";
import { runMarketplaceLandTests } from "./marketplace_land";
import { runMarketplaceEquipmentTests } from "./marketplace_equipment";
import { runMarketplaceLockTests } from "./marketplace_locks";

const SEED_LISTING = Buffer.from("listing_v1");
const SEED_LB_MINER = Buffer.from("lb_miner");
const SEED_LB_LAND = Buffer.from("lb_land");
const SEED_LAND = Buffer.from("land");
const SEED_MINER = Buffer.from("miner");
const SEED_MINER_PROGRESS = Buffer.from("miner_progress_v1");
const SEED_MINER_MINING = Buffer.from("miner_mining_v1");
const SEED_EQUIPMENT = Buffer.from("equipment_v1");
const SEED_CONFIG = Buffer.from("config");

// Para devnet
const REVEAL_WAIT_SLOTS = 12;
const REVEAL_RETRY_ATTEMPTS = 3;

process.env.ANCHOR_PROVIDER_URL =
  process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com";

process.env.ANCHOR_WALLET =
  process.env.ANCHOR_WALLET ||
  "/mnt/c/Users/Rapose/miners-of-essence/miners/minha-wallet.json";

console.log("ANCHOR_PROVIDER_URL =", process.env.ANCHOR_PROVIDER_URL);
console.log("ANCHOR_WALLET =", process.env.ANCHOR_WALLET);

async function waitForReveal(connection: anchor.web3.Connection) {
  const start = await connection.getSlot("confirmed");
  while (true) {
    const current = await connection.getSlot("confirmed");
    if (current >= start + REVEAL_WAIT_SLOTS) break;
    await new Promise((r) => setTimeout(r, 800));
  }
}

function u64Le(n: bigint) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

function pda(programId: PublicKey, ...parts: (Buffer | Uint8Array)[]) {
  return PublicKey.findProgramAddressSync(parts, programId)[0];
}

function getAccountClient(program: any, names: string[]) {
  for (const n of names) {
    if (program.account?.[n]) return program.account[n];
  }
  throw new Error(`Account client not found. Tried: ${names.join(", ")}`);
}

function isConstraintSeedsError(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? e);
  return msg.includes("ConstraintSeeds");
}

async function createExtraMiner(
  env: any,
  ownerKp: anchor.web3.Keypair,
  lootboxId: bigint
) {
  const owner = ownerKp.publicKey;
  const config = pda(env.program.programId, SEED_CONFIG);
  const configAccount = getAccountClient(env.program, ["config"]);

  const lbMiner = pda(
    env.program.programId,
    SEED_LB_MINER,
    owner.toBuffer(),
    u64Le(lootboxId)
  );

  const salt = new Uint8Array(32);

  const lootboxInfo = await env.provider.connection.getAccountInfo(lbMiner, "confirmed");
  if (!lootboxInfo) {
    await env.program.methods
      .lootboxMinerInit(new anchor.BN(lootboxId.toString()))
      .accounts({
        owner,
        config,
        lootbox: lbMiner,
        systemProgram: SystemProgram.programId,
      })
      .signers([ownerKp])
      .rpc();

    await env.program.methods
      .lootboxMinerCommit(new anchor.BN(lootboxId.toString()), [...salt])
      .accounts({
        owner,
        lootbox: lbMiner,
      })
      .signers([ownerKp])
      .rpc();
  }

  await waitForReveal(env.provider.connection);

  for (let attempt = 0; attempt < REVEAL_RETRY_ATTEMPTS; attempt++) {
    const cfg: any = await configAccount.fetch(config);
    const nextMinerId = BigInt(cfg.nextMinerId.toString());

    const miner = pda(
      env.program.programId,
      SEED_MINER,
      owner.toBuffer(),
      u64Le(nextMinerId)
    );
    const minerProgress = pda(
      env.program.programId,
      SEED_MINER_PROGRESS,
      miner.toBuffer()
    );
    const minerMining = pda(
      env.program.programId,
      SEED_MINER_MINING,
      miner.toBuffer()
    );
    const equipment = pda(
      env.program.programId,
      SEED_EQUIPMENT,
      miner.toBuffer()
    );

    const minerInfo = await env.provider.connection.getAccountInfo(miner, "confirmed");
    if (minerInfo) {
      return { miner, minerProgress, minerMining, equipment };
    }

    try {
      await env.program.methods
        .lootboxMinerReveal(new anchor.BN(lootboxId.toString()), [...salt])
        .accounts({
          owner,
          config,
          lootbox: lbMiner,
          minerState: miner,
          minerProgress,
          systemProgram: SystemProgram.programId,
        })
        .signers([ownerKp])
        .rpc();

      return { miner, minerProgress, minerMining, equipment };
    } catch (e) {
      if (!isConstraintSeedsError(e) || attempt === REVEAL_RETRY_ATTEMPTS - 1) {
        throw e;
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  throw new Error("createExtraMiner failed unexpectedly");
}

async function createExtraMinerNoEquipment(
  env: any,
  ownerKp: anchor.web3.Keypair,
  lootboxId: bigint
) {
  return createExtraMiner(env, ownerKp, lootboxId);
}

async function createExtraLand(
  env: any,
  ownerKp: anchor.web3.Keypair,
  lootboxId: bigint
) {
  const owner = ownerKp.publicKey;
  const config = pda(env.program.programId, SEED_CONFIG);
  const configAccount = getAccountClient(env.program, ["config"]);

  const lootbox = pda(
    env.program.programId,
    SEED_LB_LAND,
    owner.toBuffer(),
    u64Le(lootboxId)
  );

  const salt = new Uint8Array(32);

  const lootboxInfo = await env.provider.connection.getAccountInfo(lootbox, "confirmed");
  if (!lootboxInfo) {
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
  }

  await waitForReveal(env.provider.connection);

  for (let attempt = 0; attempt < REVEAL_RETRY_ATTEMPTS; attempt++) {
    const cfg: any = await configAccount.fetch(config);
    const nextLandId = BigInt(cfg.nextLandId.toString());

    const land = pda(
      env.program.programId,
      SEED_LAND,
      owner.toBuffer(),
      u64Le(nextLandId)
    );

    const landInfo = await env.provider.connection.getAccountInfo(land, "confirmed");
    if (landInfo) {
      return { land };
    }

    try {
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
    } catch (e) {
      if (!isConstraintSeedsError(e) || attempt === REVEAL_RETRY_ATTEMPTS - 1) {
        throw e;
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  throw new Error("createExtraLand failed unexpectedly");
}

async function main() {
  logStep("Marketplace suite bootstrap");

  const fixture = await buildMarketplaceFixture();
  const { env } = fixture;
  const configAccount = getAccountClient(env.program, ["config"]);

  const ctx: SuiteCtx = {
    provider: env.provider,
    program: env.program,
    admin: env.admin.payer,
    seller: fixture.seller,
    buyer: fixture.buyer,
    essMint: fixture.essMint,
    recipientWallet: fixture.recipientWallet,
  };

  const config: any = await configAccount.fetch(fixture.config);
  const listingId1 = BigInt(config.nextListingId.toString());
  const listing1 = pda(env.program.programId, SEED_LISTING, u64Le(listingId1));
  const listing2 = pda(env.program.programId, SEED_LISTING, u64Le(listingId1 + 1n));

  const aBase = {
    config: fixture.config,
    economy: fixture.economy,
    progression: fixture.progression,
    miner: fixture.miner,
    minerProgress: fixture.minerProgress,
    minerMining: fixture.minerMining,
    equipment: fixture.equipment,
    land: fixture.land,
    sellerInventory: fixture.sellerInventory,
    buyerInventory: fixture.buyerInventory,
    listing: listing1,
    listing2,
    sellerAta: fixture.sellerAta,
    buyerAta: fixture.buyerAta,
    recipientAta: fixture.recipientAta,
  };

  await runMarketplaceMinerTests(ctx, aBase);

  const configAfterMiner: any = await configAccount.fetch(fixture.config);
  const landListingId1 = BigInt(configAfterMiner.nextListingId.toString());
  const landListing1 = pda(env.program.programId, SEED_LISTING, u64Le(landListingId1));
  const landListing2 = pda(env.program.programId, SEED_LISTING, u64Le(landListingId1 + 1n));

  await runMarketplaceLandTests(ctx, {
    ...aBase,
    listing: landListing1,
    listing2: landListing2,
  });

  const configAfterLand: any = await configAccount.fetch(fixture.config);
  const eqListingId1 = BigInt(configAfterLand.nextListingId.toString());
  const eqListing1 = pda(env.program.programId, SEED_LISTING, u64Le(eqListingId1));
  const eqListing2 = pda(env.program.programId, SEED_LISTING, u64Le(eqListingId1 + 1n));

  await runMarketplaceEquipmentTests(ctx, {
    ...aBase,
    listing: eqListing1,
    listing2: eqListing2,
  });

  logStep("Preparing dedicated lock fixture");

  const lockFixture = await buildMarketplaceFixture();
  const lockConfigAccount = getAccountClient(lockFixture.env.program, ["config"]);

  const lockCtx: SuiteCtx = {
    provider: lockFixture.env.provider,
    program: lockFixture.env.program,
    admin: lockFixture.env.admin.payer,
    seller: lockFixture.seller,
    buyer: lockFixture.buyer,
    essMint: lockFixture.essMint,
    recipientWallet: lockFixture.recipientWallet,
  };

  const sellerOwner = lockFixture.seller.publicKey;

  const lockConfig0: any = await lockConfigAccount.fetch(lockFixture.config);
  const listedMinerListingId = BigInt(lockConfig0.nextListingId.toString());
  const listedMinerListing = pda(
    lockFixture.env.program.programId,
    SEED_LISTING,
    u64Le(listedMinerListingId)
  );

  await lockFixture.env.program.methods
    .marketplaceCreateMinerListing(new anchor.BN(1_000_000))
    .accounts({
      seller: sellerOwner,
      config: lockFixture.config,
      miner: lockFixture.miner,
      listing: listedMinerListing,
      systemProgram: SystemProgram.programId,
    })
    .signers([lockFixture.seller])
    .rpc();

  const lockConfig1: any = await lockConfigAccount.fetch(lockFixture.config);
  const unlockedMinerLootboxId =
    BigInt(Date.now()) + BigInt(Math.floor(Math.random() * 100000));
  const unlockedMiner = await createExtraMiner(
    lockFixture.env,
    lockFixture.seller,
    unlockedMinerLootboxId
  );

  const freshListedMinerLootboxId =
    BigInt(Date.now()) + 1n + BigInt(Math.floor(Math.random() * 100000));
  const freshListedMiner = await createExtraMinerNoEquipment(
    lockFixture.env,
    lockFixture.seller,
    freshListedMinerLootboxId
  );

  const lockConfig2: any = await lockConfigAccount.fetch(lockFixture.config);
  const freshMinerListingId = BigInt(lockConfig2.nextListingId.toString());
  const freshMinerListing = pda(
    lockFixture.env.program.programId,
    SEED_LISTING,
    u64Le(freshMinerListingId)
  );

  await lockFixture.env.program.methods
    .marketplaceCreateMinerListing(new anchor.BN(1_100_000))
    .accounts({
      seller: sellerOwner,
      config: lockFixture.config,
      miner: freshListedMiner.miner,
      listing: freshMinerListing,
      systemProgram: SystemProgram.programId,
    })
    .signers([lockFixture.seller])
    .rpc();

  const listedLandLootboxId =
    BigInt(Date.now()) + 2n + BigInt(Math.floor(Math.random() * 100000));
  const listedLand = await createExtraLand(
    lockFixture.env,
    lockFixture.seller,
    listedLandLootboxId
  );

  const lockConfig4: any = await lockConfigAccount.fetch(lockFixture.config);
  const listedLandListingId = BigInt(lockConfig4.nextListingId.toString());
  const listedLandListing = pda(
    lockFixture.env.program.programId,
    SEED_LISTING,
    u64Le(listedLandListingId)
  );

  await lockFixture.env.program.methods
    .marketplaceCreateLandListing(new anchor.BN(500_000))
    .accounts({
      seller: sellerOwner,
      config: lockFixture.config,
      land: listedLand.land,
      listing: listedLandListing,
      systemProgram: SystemProgram.programId,
    })
    .signers([lockFixture.seller])
    .rpc();

  await runMarketplaceLockTests(lockCtx, {
    config: lockFixture.config,
    economy: lockFixture.economy,
    progression: lockFixture.progression,
    miner: lockFixture.miner,
    minerUnlocked: unlockedMiner.miner,
    minerListedNoEquipment: freshListedMiner.miner,
    minerProgress: lockFixture.minerProgress,
    minerMining: lockFixture.minerMining,
    equipment: lockFixture.equipment,
    land: lockFixture.land,
    landListed: listedLand.land,
    sellerInventory: lockFixture.sellerInventory,
    buyerInventory: lockFixture.buyerInventory,
    listing: listedMinerListing,
    listing2: listedLandListing,
    sellerAta: lockFixture.sellerAta,
    buyerAta: lockFixture.buyerAta,
    recipientAta: lockFixture.recipientAta,
  });

  logStep("Marketplace suite finished");
}

main().catch((e) => {
  console.error("FATAL run_marketplace_suite:", e);
  process.exit(1);
});