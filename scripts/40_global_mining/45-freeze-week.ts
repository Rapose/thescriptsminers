import { gmCtx, pdas, fetchers, assertTrue, printJson, printSuccess, printTx, toNum } from "./_common";

async function main() {
  const { env } = gmCtx("45-freeze-week");
  const global = pdas.globalMining(env.programId);
  const before: any = await fetchers.fetchGlobalMiningState(env.program, global);

  const tx = await env.program.methods.globalMiningFreezeWeek().accounts({ admin: env.wallet.publicKey, global }).rpc();

  const after: any = await fetchers.fetchGlobalMiningState(env.program, global);
  assertTrue("frozen", after.frozen);
  assertTrue("frozenWeekIndex set", toNum(after.frozenWeekIndex) >= 0);

  printJson("accounts", { admin: env.wallet.publicKey.toBase58(), global: global.toBase58() });
  printTx("globalMiningFreezeWeek", tx);
  printJson("before", { frozen: before.frozen, weekIndex: toNum(before.weekIndex), totalEpTw: before.totalEpTw.toString() });
  printJson("after", { frozen: after.frozen, frozenWeekIndex: toNum(after.frozenWeekIndex), frozenWeeklyPoolAmount: after.frozenWeeklyPoolAmount.toString(), frozenTotalEpTw: after.frozenTotalEpTw.toString() });
  printSuccess("freeze week validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
