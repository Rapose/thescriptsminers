import { runFlow } from "../script_runner";

async function main() {
  runFlow(['scripts/70_marketplace/70-marketplace-list-miner.ts', 'scripts/70_marketplace/72-marketplace-buy-miner.ts', 'scripts/70_marketplace/75-marketplace-buy-land.ts', 'scripts/70_marketplace/78-marketplace-buy-equipment.ts', 'scripts/70_marketplace/79-marketplace-locks.ts']);
}

main().catch((e) => {
  console.error("FATAL 93-suite-marketplace:", e);
  process.exit(1);
});
