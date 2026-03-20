import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

export const SEEDS = {
  CONFIG: Buffer.from("config_v2"),
  MINER: Buffer.from("miner"),
  LAND: Buffer.from("land"),
  LB_MINER: Buffer.from("lb_miner"),
  LB_LAND: Buffer.from("lb_land"),
  GLOBAL_MINING: Buffer.from("global_mining_v2"),
  MINER_MINING: Buffer.from("miner_mining_v1"),
  ECONOMY: Buffer.from("economy_v4"),
  PROGRESSION: Buffer.from("progression_v1"),
  MINER_PROGRESS: Buffer.from("miner_progress_v1"),
  REWARDS_AUTH: Buffer.from("rewards_auth"),
  EQUIPMENT: Buffer.from("equipment_v1"),
  EQUIPMENT_INVENTORY: Buffer.from("equipment_inventory_v1"),
  LISTING: Buffer.from("listing_v2"),
  PRESALE_RECEIPT: Buffer.from("presale_receipt_v1"),
  EQUIPMENT_INSTANCE: Buffer.from("equipment_instance_v1"),
  EQUIPMENT_COUNTER: Buffer.from("equipment_counter_v1"),
  REBIRTH_CONFIG: Buffer.from("rebirth_v1"),
  EXPEDITION_CONFIG: Buffer.from("expedition_config_v1"),
  EXPEDITION_SESSION: Buffer.from("expedition_session_v1"),
};

export const u64Le = (value: bigint): Buffer => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(value);
  return b;
};

const find = (programId: PublicKey, ...parts: (Buffer | Uint8Array)[]) =>
  PublicKey.findProgramAddressSync(parts, programId)[0];

export const pdas = {
  config: (programId: PublicKey) => find(programId, SEEDS.CONFIG),
  economy: (programId: PublicKey) => find(programId, SEEDS.ECONOMY),
  progression: (programId: PublicKey) => find(programId, SEEDS.PROGRESSION),
  minerProgress: (programId: PublicKey, miner: PublicKey) => find(programId, SEEDS.MINER_PROGRESS, miner.toBuffer()),
  globalMining: (programId: PublicKey) => find(programId, SEEDS.GLOBAL_MINING),
  minerMining: (programId: PublicKey, miner: PublicKey) => find(programId, SEEDS.MINER_MINING, miner.toBuffer()),
  rebirthConfig: (programId: PublicKey) => find(programId, SEEDS.REBIRTH_CONFIG),
  expeditionConfig: (programId: PublicKey) => find(programId, SEEDS.EXPEDITION_CONFIG),
  expeditionSession: (programId: PublicKey, miner: PublicKey) =>
    find(programId, SEEDS.EXPEDITION_SESSION, miner.toBuffer()),
  rewardsAuthority: (programId: PublicKey) => find(programId, SEEDS.REWARDS_AUTH),
  rewardsVault: (essMint: PublicKey, rewardsAuthority: PublicKey) =>
    getAssociatedTokenAddressSync(essMint, rewardsAuthority, true),
  equipmentState: (programId: PublicKey, miner: PublicKey) => find(programId, SEEDS.EQUIPMENT, miner.toBuffer()),
  equipmentCounter: (programId: PublicKey) => find(programId, SEEDS.EQUIPMENT_COUNTER),
  equipmentInstance: (programId: PublicKey, id: bigint) =>
    find(programId, SEEDS.EQUIPMENT_INSTANCE, u64Le(id)),
  listing: (programId: PublicKey, id: bigint) => find(programId, SEEDS.LISTING, u64Le(id)),
  lootboxMiner: (programId: PublicKey, owner: PublicKey, lootboxId: bigint, saleType = 0) =>
    find(programId, SEEDS.LB_MINER, owner.toBuffer(), Buffer.from([saleType]), u64Le(lootboxId)),
  lootboxLand: (programId: PublicKey, owner: PublicKey, lootboxId: bigint, saleType = 0) =>
    find(programId, SEEDS.LB_LAND, owner.toBuffer(), Buffer.from([saleType]), u64Le(lootboxId)),
  presaleReceipt: (programId: PublicKey, owner: PublicKey, purchaseId: bigint, kind: 0 | 1) =>
    find(programId, SEEDS.PRESALE_RECEIPT, owner.toBuffer(), Buffer.from([kind]), u64Le(purchaseId)),
  miner: (programId: PublicKey, owner: PublicKey, minerId: bigint) =>
    find(programId, SEEDS.MINER, owner.toBuffer(), u64Le(minerId)),
  land: (programId: PublicKey, owner: PublicKey, landId: bigint) =>
    find(programId, SEEDS.LAND, owner.toBuffer(), u64Le(landId)),
  equipmentInventory: (programId: PublicKey, owner: PublicKey) =>
    find(programId, SEEDS.EQUIPMENT_INVENTORY, owner.toBuffer()),
};
