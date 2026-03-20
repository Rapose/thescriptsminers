import { gmCtx, resolveMinerLand, fetchers, assertDefaultPubkey, assertEq, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = gmCtx("44-unassign-land");
  const { owner, minerPk, landPk } = await resolveMinerLand(env, args);
  const landBefore: any = await fetchers.fetchLandState(env.program, landPk);

  const tx = await env.program.methods.globalMiningUnassignLand().accounts({ owner, minerState: minerPk, landState: landPk }).rpc();

  const minerAfter: any = await fetchers.fetchMinerState(env.program, minerPk);
  const landAfter: any = await fetchers.fetchLandState(env.program, landPk);

  assertDefaultPubkey("allocatedLand", minerAfter.allocatedLand);
  assertEq("allocatedMinersCount -1", Number(landAfter.allocatedMinersCount), Number(landBefore.allocatedMinersCount) - 1);

  printJson("accounts", { owner: owner.toBase58(), miner: minerPk.toBase58(), land: landPk.toBase58() });
  printTx("globalMiningUnassignLand", tx);
  printJson("before", { allocatedMinersCount: Number(landBefore.allocatedMinersCount) });
  printJson("after", { allocatedLand: minerAfter.allocatedLand.toBase58(), allocatedMinersCount: Number(landAfter.allocatedMinersCount) });
  printSuccess("unassign land validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
