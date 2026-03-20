import { runFlow } from "../script_runner";

async function main() {
  runFlow(['scripts/_legacy/core/lootbox_miner_flow.ts']);
}

main().catch((e) => {
  console.error("FATAL 20-init-miner-progress:", e);
  process.exit(1);
});
