import { runSuite } from "./_common";

runSuite("96-suite-marketplace", [
  "scripts/80_marketplace/80-marketplace-create-miner-listing.ts",
  "scripts/80_marketplace/81-marketplace-cancel-miner-listing.ts",
  "scripts/80_marketplace/82-marketplace-buy-miner-listing.ts",
  "scripts/80_marketplace/83-marketplace-create-land-listing.ts",
  "scripts/80_marketplace/84-marketplace-cancel-land-listing.ts",
  "scripts/80_marketplace/85-marketplace-buy-land-listing.ts",
  "scripts/80_marketplace/86-marketplace-create-equipment-listing.ts",
  "scripts/80_marketplace/87-marketplace-cancel-equipment-listing.ts",
  "scripts/80_marketplace/88-marketplace-buy-equipment-listing.ts",
  "scripts/80_marketplace/89-marketplace-locks.ts",
]);
