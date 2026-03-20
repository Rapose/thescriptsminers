import { runSuite } from "./_common";

runSuite("95-suite-expedition-equipment", [
  "scripts/60_expedition/61-expedition-start.ts",
  "scripts/60_expedition/62-expedition-resolve.ts",
  "scripts/70_equipment/70-equipment-counter-init.ts",
  "scripts/60_expedition/63-expedition-claim-equipment.ts",
  "scripts/70_equipment/71-equipment-init.ts",
  "scripts/70_equipment/72-equipment-equip-hand.ts",
  "scripts/70_equipment/73-equipment-equip-head.ts",
  "scripts/70_equipment/74-equipment-replace-hand.ts",
  "scripts/70_equipment/75-equipment-replace-head.ts",
  "scripts/70_equipment/76-equipment-remelt-hand.ts",
  "scripts/70_equipment/77-equipment-remelt-head.ts",
]);
