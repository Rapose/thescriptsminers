import { runFlow } from "../script_runner";

async function main() {
  runFlow(['scripts/_legacy/core/expedition_flow.ts']);
}

main().catch((e) => {
  console.error("FATAL 50-expedition-start:", e);
  process.exit(1);
});
