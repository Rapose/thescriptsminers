import { bootstrapCtx, resolveEssMint, standardBootstrapAccounts, fetchers, assertPubkeyEq, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = bootstrapCtx("03-economy-set-mint");
  const { economy } = standardBootstrapAccounts(env);
  const essMint = resolveEssMint(args);
  const before: any = await fetchers.fetchEconomy(env.program, economy);
  const tx = await env.program.methods.economySetMint().accounts({ admin: env.wallet.publicKey, essMint, economy }).rpc();
  const after: any = await fetchers.fetchEconomy(env.program, economy);
  assertPubkeyEq("essMint", after.essMint, essMint);
  printTx("economySetMint", tx);
  printJson("before", { essMint: before?.essMint?.toBase58?.() });
  printJson("after", { essMint: after.essMint.toBase58() });
  printSuccess("economy_set_mint validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
