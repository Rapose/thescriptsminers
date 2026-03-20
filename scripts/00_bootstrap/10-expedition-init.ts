import { bootstrapCtx, resolveEssMint, standardBootstrapAccounts, SystemProgram, fetchers, assertTrue, assertPubkeyEq, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = bootstrapCtx("10-expedition-init");
  const { expeditionConfig } = standardBootstrapAccounts(env);
  const essMint = resolveEssMint(args);
  const before = await fetchers.fetchExpeditionConfig(env.program, expeditionConfig);
  const tx = await env.program.methods.expeditionInit().accounts({
    admin: env.wallet.publicKey,
    essMint,
    expeditionConfig,
    systemProgram: SystemProgram.programId,
  }).rpc();
  const after: any = await fetchers.fetchExpeditionConfig(env.program, expeditionConfig);
  assertPubkeyEq("expedition.essMint", after.essMint, essMint);
  assertTrue("expedition.enabled", after.enabled);
  printTx("expeditionInit", tx);
  printJson("before", { exists: !!before });
  printJson("after", {
    tierCostEss: after.tierCostEss,
    tierLockSecs: after.tierLockSecs,
    tierItemCapBps: after.tierItemCapBps,
    tierLevelCap: after.tierLevelCap,
    newEquipmentBpsByRarity: after.newEquipmentBpsByRarity,
  });
  printSuccess("expedition_init validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
