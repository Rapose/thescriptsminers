import { bootstrapCtx, standardBootstrapAccounts, SystemProgram, fetchers, assertEq, assertPubkeyEq, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env } = bootstrapCtx("07-progression-init");
  const { progression } = standardBootstrapAccounts(env);
  const before = await fetchers.fetchProgression(env.program, progression);
  const tx = await env.program.methods.progressionInit().accounts({ admin: env.wallet.publicKey, progression, systemProgram: SystemProgram.programId }).rpc();
  const after: any = await fetchers.fetchProgression(env.program, progression);
  assertPubkeyEq("progression.admin", after.admin, env.wallet.publicKey);
  assertEq("maxAccrualWindows", Number(after.maxAccrualWindows), 28);
  assertEq("linearHashKBps", Number(after.linearHashKBps), 200);
  printTx("progressionInit", tx);
  printJson("before", { exists: !!before });
  printJson("after", { progression: progression.toBase58(), expGrowthBps: Number(after.expGrowthBps) });
  printSuccess("progression_init validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
