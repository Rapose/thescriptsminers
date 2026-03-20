import { gmCtx, resolveMinerLand, fetchers, assertEq, assertPubkeyEq, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = gmCtx("41-assign-land");
  const { owner, minerPk, landPk } = await resolveMinerLand(env, args);
  const minerBefore: any = await fetchers.fetchMinerState(env.program, minerPk);
  const landBefore: any = await fetchers.fetchLandState(env.program, landPk);

  const tx = await env.program.methods.globalMiningAssignLand().accounts({ owner, minerState: minerPk, landState: landPk }).rpc();

  const minerAfter: any = await fetchers.fetchMinerState(env.program, minerPk);
  const landAfter: any = await fetchers.fetchLandState(env.program, landPk);

  assertPubkeyEq("allocatedLand", minerAfter.allocatedLand, landPk);
  assertEq("allocatedMinersCount +1", Number(landAfter.allocatedMinersCount), Number(landBefore.allocatedMinersCount) + 1);

  printJson("accounts", { owner: owner.toBase58(), miner: minerPk.toBase58(), land: landPk.toBase58() });
  printTx("globalMiningAssignLand", tx);
  printJson("before", { allocatedLand: minerBefore.allocatedLand.toBase58(), allocatedMinersCount: Number(landBefore.allocatedMinersCount) });
  printJson("after", { allocatedLand: minerAfter.allocatedLand.toBase58(), allocatedMinersCount: Number(landAfter.allocatedMinersCount) });
  printSuccess("assign land validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
