import { runFlow } from "../script_runner";

async function main() {
  runFlow(['scripts/30_global_mining/30-register-miner.ts', 'scripts/30_global_mining/31-assign-land.ts', 'scripts/30_global_mining/32-update-mining.ts', 'scripts/30_global_mining/33-claim-mining.ts', 'scripts/40_rebirth/40-rebirth-success.ts', 'scripts/50_expedition/53-expedition-full-cycle.ts', 'scripts/60_equipment/66-equipment-remelt-head.ts']);
}

main().catch((e) => {
  console.error("FATAL 92-suite-gameplay:", e);
  process.exit(1);
});
