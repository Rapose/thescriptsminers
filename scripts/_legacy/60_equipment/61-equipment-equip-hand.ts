import { runFlow } from "../script_runner";

async function main() {
  runFlow(['scripts/_legacy/core/equipment_flow.ts']);
}

main().catch((e) => {
  console.error("FATAL 61-equipment-equip-hand:", e);
  process.exit(1);
});
