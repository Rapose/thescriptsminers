import { runFlow } from "../script_runner";

async function main() {
  runFlow(['scripts/_legacy/core/global_mining_flow.ts']);
}

main().catch((e) => {
  console.error("FATAL 30-register-miner:", e);
  process.exit(1);
});
