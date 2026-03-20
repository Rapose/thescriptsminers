import { runSuite } from "./_common";

runSuite("93-suite-global-mining", [
  "scripts/40_global_mining/40-register-miner.ts",
  "scripts/40_global_mining/41-assign-land.ts",
  "scripts/40_global_mining/42-update-mining.ts",
  "scripts/40_global_mining/43-claim-mining.ts",
  "scripts/40_global_mining/44-unassign-land.ts",
  "scripts/40_global_mining/45-freeze-week.ts",
  "scripts/40_global_mining/46-rollover-week.ts",
]);
