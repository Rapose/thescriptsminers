import { runFlow } from "../script_runner";

async function main() {
  runFlow(['scripts/_legacy/run_marketplace_suite.ts']);
}

main().catch((e) => {
  console.error("FATAL 70-marketplace-list-miner:", e);
  process.exit(1);
});
