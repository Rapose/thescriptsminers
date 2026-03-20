import { runFlow } from "../script_runner";

async function main() {
  runFlow(['scripts/10_lootboxes/10-buy-miner-lootbox-ess.ts', 'scripts/10_lootboxes/11-reveal-miner-lootbox.ts', 'scripts/10_lootboxes/12-buy-land-lootbox-ess.ts', 'scripts/10_lootboxes/13-reveal-land-lootbox.ts', 'scripts/20_miners/20-init-miner-progress.ts', 'scripts/20_miners/21-claim-mining-exp.ts', 'scripts/20_miners/22-miner-level-up.ts']);
}

main().catch((e) => {
  console.error("FATAL 91-suite-core-progression:", e);
  process.exit(1);
});
