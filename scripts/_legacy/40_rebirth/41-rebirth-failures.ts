import { runFlow } from "../script_runner";

async function main() {
  runFlow(['scripts/_legacy/core/rebirth_flow.ts']);
}

main().catch((e) => {
  console.error("FATAL 41-rebirth-failures:", e);
  process.exit(1);
});
