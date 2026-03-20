import { runFlow } from "../script_runner";

async function main() {
  runFlow(['scripts/_legacy/core/miner_level_up.ts']);
}

main().catch((e) => {
  console.error("FATAL 22-miner-level-up:", e);
  process.exit(1);
});
