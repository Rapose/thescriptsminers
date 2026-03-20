import { runSuite } from "./_common";

runSuite("91-suite-lootboxes", [
  "scripts/10_lootboxes/10-buy-miner-lootbox-ess.ts",
  "scripts/10_lootboxes/11-commit-miner-lootbox.ts",
  "scripts/10_lootboxes/12-reveal-miner-lootbox.ts",
  "scripts/10_lootboxes/13-buy-land-lootbox-ess.ts",
  "scripts/10_lootboxes/14-commit-land-lootbox.ts",
  "scripts/10_lootboxes/15-reveal-land-lootbox.ts",
]);
