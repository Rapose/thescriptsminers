import { bootstrapCtx, standardBootstrapAccounts, validateConfigDefaults, SystemProgram, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env } = bootstrapCtx("01-initialize-config");
  const { config } = standardBootstrapAccounts(env);
  const before = await env.connection.getAccountInfo(config, "confirmed");
  const tx = await env.program.methods.initializeConfig().accounts({ admin: env.wallet.publicKey, config, systemProgram: SystemProgram.programId }).rpc();
  await validateConfigDefaults(env.program, config, env.wallet.publicKey);
  const after = await env.connection.getAccountInfo(config, "confirmed");
  printTx("initializeConfig", tx);
  printJson("before", { exists: !!before });
  printJson("after", { exists: !!after, config: config.toBase58() });
  printSuccess("Config inicializado e validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
