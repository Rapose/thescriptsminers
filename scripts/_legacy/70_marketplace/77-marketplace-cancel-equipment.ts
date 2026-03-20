import { runFlow } from "../script_runner";

async function main() {
  runFlow(['scripts/_legacy/run_marketplace_suite.ts']);
}

main().catch((e) => {
  console.error("FATAL 77-marketplace-cancel-equipment:", e);
  process.exit(1);
});
