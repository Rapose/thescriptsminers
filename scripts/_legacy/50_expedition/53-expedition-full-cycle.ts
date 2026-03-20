import { runFlow } from "../script_runner";

async function main() {
  runFlow(['scripts/_legacy/core/full_cycle_flow.ts']);
}

main().catch((e) => {
  console.error("FATAL 53-expedition-full-cycle:", e);
  process.exit(1);
});
