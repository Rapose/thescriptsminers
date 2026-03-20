import { runFlow } from "../script_runner";

async function main() {
  runFlow(['scripts/_legacy/core/global_mining_flow.ts']);
}

main().catch((e) => {
  console.error("FATAL 35-freeze-week:", e);
  process.exit(1);
});
