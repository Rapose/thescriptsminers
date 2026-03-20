import { runScript } from "./helpers/script_runner";


process.env.ANCHOR_PROVIDER_URL =
  process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com";

process.env.ANCHOR_WALLET =
  process.env.ANCHOR_WALLET ||
  "/mnt/c/Users/Rapose/miners-of-essence/miners/minha-wallet.json";
  
async function main() {
  runScript("scripts/core/create_fixed_mint.ts");
  runScript("scripts/core/economy_flow.ts");
  runScript("scripts/core/lootbox_land_flow.ts");
  runScript("scripts/core/lootbox_miner_flow.ts");
  runScript("scripts/core/equipment_flow.ts");
  runScript("scripts/core/global_mining_flow.ts");
  runScript("scripts/core/claim_mining_exp.ts");
  runScript("scripts/core/miner_level_up.ts");
}



main().catch((e) => {
  console.error("FATAL run_core_suite:", e);
  process.exit(1);
});