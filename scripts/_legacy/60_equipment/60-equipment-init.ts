import { runFlow } from "../script_runner";

async function main() {
  runFlow(['scripts/_legacy/core/equipment_flow.ts']);
}

main().catch((e) => {
  console.error("FATAL 60-equipment-init:", e);
  process.exit(1);
});
