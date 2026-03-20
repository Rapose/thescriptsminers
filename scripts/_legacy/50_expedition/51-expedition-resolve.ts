import { runFlow } from "../script_runner";

async function main() {
  runFlow(['scripts/_legacy/core/expedition_flow.ts']);
}

main().catch((e) => {
  console.error("FATAL 51-expedition-resolve:", e);
  process.exit(1);
});
