import { runScript } from "./script_runner";


process.env.ANCHOR_PROVIDER_URL =
  process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com";

process.env.ANCHOR_WALLET =
  process.env.ANCHOR_WALLET ||
  "/mnt/c/Users/Rapose/miners-of-essence/miners/minha-wallet.json";
  
async function main() {
  runScript("scripts/_legacy/core/create_fixed_mint.ts");
  runScript("scripts/_legacy/core/economy_flow.ts");
  runScript("scripts/_legacy/core/lootbox_land_flow.ts");
  runScript("scripts/_legacy/core/lootbox_miner_flow.ts");
  runScript("scripts/_legacy/core/equipment_flow.ts");
  runScript("scripts/_legacy/core/global_mining_flow.ts");
  runScript("scripts/_legacy/core/claim_mining_exp.ts");
  runScript("scripts/_legacy/core/miner_level_up.ts");
}



main().catch((e) => {
  console.error("FATAL run_core_suite:", e);
  process.exit(1);
});