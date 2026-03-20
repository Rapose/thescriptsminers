import { runFlow } from "../script_runner";

async function main() {
  runFlow(['scripts/_legacy/run_marketplace_suite.ts']);
}

main().catch((e) => {
  console.error("FATAL 73-marketplace-list-land:", e);
  process.exit(1);
});
