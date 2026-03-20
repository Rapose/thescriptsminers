import { gmCtx, resolveMinerLand, pdas, fetchers, SystemProgram, assertEq, assertFalse, assertPubkeyEq, printJson, printSuccess, printTx, toNum } from "./_common";

async function main() {
  const { env, args } = gmCtx("40-register-miner");
  const { owner, minerPk, minerMining } = await resolveMinerLand(env, args);
  const global = pdas.globalMining(env.programId);
  const before = await fetchers.fetchMinerMiningState(env.program, minerMining);
  const globalState: any = await fetchers.fetchGlobalMiningState(env.program, global);

  const tx = await env.program.methods.globalMiningRegisterMiner().accounts({
    owner,
    global,
    minerState: minerPk,
    minerMining,
    systemProgram: SystemProgram.programId,
  }).rpc();

  const after: any = await fetchers.fetchMinerMiningState(env.program, minerMining);
  assertPubkeyEq("owner", after.owner, owner);
  assertEq("weekIndex", toNum(after.weekIndex), toNum(globalState.weekIndex));
  assertFalse("claimed", after.claimed);

  printJson("accounts", { owner: owner.toBase58(), global: global.toBase58(), miner: minerPk.toBase58(), minerMining: minerMining.toBase58() });
  printTx("globalMiningRegisterMiner", tx);
  printJson("before", { exists: !!before });
  printJson("after", { weekIndex: toNum(after.weekIndex), claimed: after.claimed });
  printSuccess("register miner validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
