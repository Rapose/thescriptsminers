import { gmCtx, resolveMinerLand, pdas, fetchers, assertTrue, assertEq, printJson, printSuccess, printTx, toNum } from "./_common";

async function main() {
  const { env, args } = gmCtx("42-update-mining");
  const { owner, minerPk, landPk, minerProgress, minerMining, equipment } = await resolveMinerLand(env, args);
  const global = pdas.globalMining(env.programId);

  const before: any = await fetchers.fetchMinerMiningState(env.program, minerMining);
  const tx = await env.program.methods.globalMiningUpdate().accounts({
    owner,
    global,
    minerState: minerPk,
    minerProgress,
    equipment,
    minerMining,
    landState: landPk,
  }).rpc();
  const after: any = await fetchers.fetchMinerMiningState(env.program, minerMining);

  assertTrue("lastTick non-decreasing", toNum(after.lastTick) >= toNum(before.lastTick));
  assertTrue("epTw non-decreasing", Number(after.epTw) >= Number(before.epTw));

  printJson("accounts", { owner: owner.toBase58(), global: global.toBase58(), miner: minerPk.toBase58(), land: landPk.toBase58(), minerMining: minerMining.toBase58() });
  printTx("globalMiningUpdate", tx);
  printJson("before", { lastTick: toNum(before.lastTick), epTw: before.epTw.toString() });
  printJson("after", { lastTick: toNum(after.lastTick), epTw: after.epTw.toString() });
  printSuccess("update mining validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
