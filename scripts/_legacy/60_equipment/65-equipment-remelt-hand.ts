import { runFlow } from "../script_runner";

async function main() {
  runFlow(['scripts/_legacy/core/equipment_flow.ts']);
}

main().catch((e) => {
  console.error("FATAL 65-equipment-remelt-hand:", e);
  process.exit(1);
});
