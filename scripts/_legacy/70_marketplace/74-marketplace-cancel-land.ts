import { runFlow } from "../script_runner";

async function main() {
  runFlow(['scripts/_legacy/run_marketplace_suite.ts']);
}

main().catch((e) => {
  console.error("FATAL 74-marketplace-cancel-land:", e);
  process.exit(1);
});
