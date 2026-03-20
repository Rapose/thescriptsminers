import { createFixedMintIfNeeded } from "./_common";

createFixedMintIfNeeded().catch((e) => {
  console.error("FATAL 00-create-fixed-mint", e);
  process.exit(1);
});
