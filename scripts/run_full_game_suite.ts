import { runScript } from "./helpers/script_runner";


process.env.ANCHOR_PROVIDER_URL =
  process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com";

process.env.ANCHOR_WALLET =
  process.env.ANCHOR_WALLET ||
  "/mnt/c/Users/Rapose/miners-of-essence/miners/minha-wallet.json";
  
async function main() {
  runScript("scripts/run_core_suite.ts");
  runScript("scripts/run_marketplace_suite.ts");
}

main().catch((e) => {
  console.error("FATAL run_full_game_suite:", e);
  process.exit(1);
});