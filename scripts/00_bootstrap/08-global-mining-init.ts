import { bootstrapCtx, standardBootstrapAccounts, SystemProgram, fetchers, bn, assertEq, assertFalse, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = bootstrapCtx("08-global-mining-init");
  const { globalMining } = standardBootstrapAccounts(env);
  const tickLen = Number(args.tickLenSec ?? "60");
  const weeklyPool = bn(args.weeklyPool ?? "1000000");
  const before = await fetchers.fetchGlobalMiningState(env.program, globalMining);
  const tx = await env.program.methods.globalMiningInit(tickLen, weeklyPool).accounts({ admin: env.wallet.publicKey, global: globalMining, systemProgram: SystemProgram.programId }).rpc();
  const after: any = await fetchers.fetchGlobalMiningState(env.program, globalMining);
  assertEq("weekIndex", Number(after.weekIndex), 0);
  assertEq("tickLenSec", Number(after.tickLenSec), tickLen);
  assertEq("weeklyPoolAmount", Number(after.weeklyPoolAmount), Number(weeklyPool.toString()));
  assertFalse("frozen", after.frozen);
  printTx("globalMiningInit", tx);
  printJson("before", { exists: !!before });
  printJson("after", { weekStartTs: Number(after.weekStartTs), globalMining: globalMining.toBase58() });
  printSuccess("global_mining_init validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
