import { PublicKey } from "@solana/web3.js";

export function getAccountClient(program: any, possibleNames: string[]) {
  for (const name of possibleNames) {
    if (program.account?.[name]) return program.account[name];
  }
  throw new Error(`Account client not found. Tried: ${possibleNames.join(", ")}`);
}

async function fetchMaybe(program: any, possibleNames: string[], address: PublicKey) {
  try {
    return await getAccountClient(program, possibleNames).fetch(address);
  } catch {
    return null;
  }
}

export const fetchers = {
  fetchConfig: (p: any, a: PublicKey) => fetchMaybe(p, ["config"], a),
  fetchEconomy: (p: any, a: PublicKey) => fetchMaybe(p, ["economyConfig", "economy"], a),
  fetchProgression: (p: any, a: PublicKey) => fetchMaybe(p, ["progressionConfig", "progression"], a),
  fetchMinerState: (p: any, a: PublicKey) => fetchMaybe(p, ["minerState", "miner"], a),
  fetchLandState: (p: any, a: PublicKey) => fetchMaybe(p, ["landState", "land"], a),
  fetchMinerProgress: (p: any, a: PublicKey) => fetchMaybe(p, ["minerProgress"], a),
  fetchGlobalMiningState: (p: any, a: PublicKey) => fetchMaybe(p, ["globalMiningState", "globalMining"], a),
  fetchMinerMiningState: (p: any, a: PublicKey) => fetchMaybe(p, ["minerMiningState", "minerMining"], a),
  fetchRebirthConfig: (p: any, a: PublicKey) => fetchMaybe(p, ["rebirthConfig"], a),
  fetchExpeditionConfig: (p: any, a: PublicKey) => fetchMaybe(p, ["expeditionConfig"], a),
  fetchExpeditionSession: (p: any, a: PublicKey) => fetchMaybe(p, ["expeditionSession"], a),
  fetchEquipmentState: (p: any, a: PublicKey) => fetchMaybe(p, ["equipmentState", "equipment"], a),
  fetchEquipmentCounter: (p: any, a: PublicKey) => fetchMaybe(p, ["equipmentCounter"], a),
  fetchEquipmentInstance: (p: any, a: PublicKey) => fetchMaybe(p, ["equipmentInstance"], a),
  fetchListingState: (p: any, a: PublicKey) => fetchMaybe(p, ["listingState", "listing"], a),
  fetchLootboxMinerState: (p: any, a: PublicKey) => fetchMaybe(p, ["lootboxMinerState", "lootboxMiner"], a),
  fetchLootboxLandState: (p: any, a: PublicKey) => fetchMaybe(p, ["lootboxLandState", "lootboxLand"], a),
  fetchPresaleReceipt: (p: any, a: PublicKey) => fetchMaybe(p, ["presaleReceipt"], a),
};
