import { runSuite } from "./_common";

runSuite("94-suite-rebirth", [
  "scripts/50_rebirth/50-rebirth-update-config.ts",
  "scripts/50_rebirth/51-rebirth-success.ts",
  "scripts/50_rebirth/52-rebirth-failures.ts",
]);
