import { runSuite } from "./_common";

runSuite("99-suite-all", [
  "scripts/90_suites/90-suite-bootstrap.ts",
  "scripts/90_suites/91-suite-lootboxes.ts",
  "scripts/90_suites/92-suite-progression.ts",
  "scripts/90_suites/93-suite-global-mining.ts",
  "scripts/90_suites/94-suite-rebirth.ts",
  "scripts/90_suites/95-suite-expedition-equipment.ts",
  "scripts/90_suites/96-suite-marketplace.ts",
]);
