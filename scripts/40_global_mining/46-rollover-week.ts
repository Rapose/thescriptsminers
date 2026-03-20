import { gmCtx, pdas, fetchers, bn, assertEq, assertFalse, printJson, printSuccess, printTx, toNum } from "./_common";

async function main() {
  const { env, args } = gmCtx("46-rollover-week");
  const global = pdas.globalMining(env.programId);
  const newPool = bn(args.newWeeklyPoolAmount ?? "100000");
  const before: any = await fetchers.fetchGlobalMiningState(env.program, global);

  const tx = await env.program.methods.globalMiningRolloverWeek(newPool).accounts({ admin: env.wallet.publicKey, global }).rpc();

  const after: any = await fetchers.fetchGlobalMiningState(env.program, global);
  assertEq("weekIndex +1", toNum(after.weekIndex), toNum(before.weekIndex) + 1);
  assertEq("weeklyPoolAmount updated", toNum(after.weeklyPoolAmount), Number(newPool.toString()));
  assertFalse("frozen reset", after.frozen);

  printJson("accounts", { admin: env.wallet.publicKey.toBase58(), global: global.toBase58() });
  printTx("globalMiningRolloverWeek", tx);
  printJson("before", { weekIndex: toNum(before.weekIndex), weeklyPoolAmount: toNum(before.weeklyPoolAmount), frozen: before.frozen });
  printJson("after", { weekIndex: toNum(after.weekIndex), weeklyPoolAmount: toNum(after.weeklyPoolAmount), frozen: after.frozen, totalEpTw: after.totalEpTw.toString() });
  printSuccess("rollover week validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
