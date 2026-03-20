import { runSuite } from "./_common";

runSuite("90-suite-bootstrap", [
  "scripts/00_bootstrap/00-create-fixed-mint.ts",
  "scripts/00_bootstrap/01-initialize-config.ts",
  "scripts/00_bootstrap/02-economy-init.ts",
  "scripts/00_bootstrap/03-economy-set-mint.ts",
  "scripts/00_bootstrap/04-economy-set-recipient.ts",
  "scripts/00_bootstrap/05-set-rewards-vault.ts",
  "scripts/00_bootstrap/06-rewards-deposit.ts",
  "scripts/00_bootstrap/07-progression-init.ts",
  "scripts/00_bootstrap/08-global-mining-init.ts",
  "scripts/00_bootstrap/09-rebirth-init.ts",
  "scripts/00_bootstrap/10-expedition-init.ts",
  "scripts/00_bootstrap/11-set-presale-config.ts",
  "scripts/00_bootstrap/12-set-normal-lootbox-prices-ess.ts",
]);
