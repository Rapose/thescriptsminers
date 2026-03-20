import { expeditionCtx, resolveEssMint, pdas, fetchers, assertEq, assertPubkeyEq, printJson, printSuccess, printTx } from "./_common";

const TEST_TIER_COST_ESS = [1, 2, 3, 4, 5];
const TEST_TIER_LOCK_SECS = [20, 20, 20, 20, 20];
const TEST_TIER_ITEM_CAP_BPS = [3500, 3100, 2700, 2300, 1900];
const TEST_TIER_LEVEL_CAP = [2, 4, 6, 8, 10];
const TEST_NEW_EQUIPMENT_BPS_BY_RARITY = [4600, 5000, 5500, 5900, 6300];

async function main() {
  const { env, args } = expeditionCtx("60-expedition-update-config");
  const expeditionConfig = pdas.expeditionConfig(env.programId);
  const essMint = resolveEssMint(args);

  const before: any = await fetchers.fetchExpeditionConfig(env.program, expeditionConfig);
  const tx = await env.program.methods.expeditionUpdateConfig(
    TEST_TIER_COST_ESS,
    TEST_TIER_LOCK_SECS,
    TEST_TIER_ITEM_CAP_BPS,
    TEST_TIER_LEVEL_CAP,
    TEST_NEW_EQUIPMENT_BPS_BY_RARITY,
    true,
  ).accounts({
    admin: env.wallet.publicKey,
    essMint,
    expeditionConfig,
  }).rpc();

  const after: any = await fetchers.fetchExpeditionConfig(env.program, expeditionConfig);
  assertPubkeyEq("expedition.essMint", after.essMint, essMint);
  assertEq("expedition.enabled", after.enabled, true);

  printTx("expeditionUpdateConfig", tx);
  printJson("before", {
    enabled: before?.enabled,
    tierCostEss: before?.tierCostEss,
    tierLockSecs: before?.tierLockSecs,
  });
  printJson("after", {
    enabled: after.enabled,
    tierCostEss: after.tierCostEss,
    tierLockSecs: after.tierLockSecs,
    tierItemCapBps: after.tierItemCapBps,
    tierLevelCap: after.tierLevelCap,
    newEquipmentBpsByRarity: after.newEquipmentBpsByRarity,
  });
  printSuccess("expedition_update_config validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
