import { runFlow } from "../script_runner";

async function main() {
  runFlow(['scripts/_legacy/core/rebirth_flow.ts']);
}

main().catch((e) => {
  console.error("FATAL 40-rebirth-success:", e);
  process.exit(1);
});
