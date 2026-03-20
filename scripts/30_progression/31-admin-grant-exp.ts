import { progressionCtx, resolveMinerAndProgress, pdas, fetchers, requireArg, bn, SystemProgram, assertEq, printJson, printSuccess, printTx, toNum } from "./_common";

async function main() {
  const { env, args } = progressionCtx("31-admin-grant-exp");
  const { owner, config, minerPk, progressPk } = await resolveMinerAndProgress(env, args);
  const progression = pdas.progression(env.programId);
  const amount = bn(requireArg(args, "amount"));

  const before: any = await fetchers.fetchMinerProgress(env.program, progressPk);
  if (!before) throw new Error("MinerProgress não existe");

  const tx = await env.program.methods.adminGrantExp(amount).accounts({
    admin: owner,
    config,
    progression,
    minerState: minerPk,
    minerProgress: progressPk,
    systemProgram: SystemProgram.programId,
  }).rpc();

  const after: any = await fetchers.fetchMinerProgress(env.program, progressPk);
  const delta = toNum(after.exp) - toNum(before.exp);
  assertEq("exp increment exact", delta, Number(amount.toString()));

  printJson("accounts", { admin: owner.toBase58(), miner: minerPk.toBase58(), progress: progressPk.toBase58(), amount: amount.toString() });
  printTx("adminGrantExp", tx);
  printJson("before", { exp: toNum(before.exp) });
  printJson("after", { exp: toNum(after.exp), delta });
  printSuccess("admin_grant_exp utilitário validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
