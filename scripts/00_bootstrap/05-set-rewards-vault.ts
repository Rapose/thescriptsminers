import { bootstrapCtx, ensureRewardsVault, resolveEssMint, standardBootstrapAccounts, TOKEN_PROGRAM_ID, fetchers, assertPubkeyEq, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = bootstrapCtx("05-set-rewards-vault");
  const { economy } = standardBootstrapAccounts(env);
  const essMint = resolveEssMint(args);
  const { rewardsAuthority, rewardsVault } = await ensureRewardsVault(env, essMint);
  const before: any = await fetchers.fetchEconomy(env.program, economy);
  const tx = await env.program.methods.economySetRewardsVault().accounts({
    admin: env.wallet.publicKey,
    economy,
    rewardsAuthority,
    rewardsVault,
    tokenProgram: TOKEN_PROGRAM_ID,
  }).rpc();
  const after: any = await fetchers.fetchEconomy(env.program, economy);
  assertPubkeyEq("rewardsAuthority", after.rewardsAuthority, rewardsAuthority);
  assertPubkeyEq("rewardsVault", after.rewardsVault, rewardsVault);
  printTx("economySetRewardsVault", tx);
  printJson("before", { rewardsAuthority: before?.rewardsAuthority?.toBase58?.(), rewardsVault: before?.rewardsVault?.toBase58?.() });
  printJson("after", { rewardsAuthority: after.rewardsAuthority.toBase58(), rewardsVault: after.rewardsVault.toBase58() });
  printSuccess("rewards vault configurado");
}

main().catch((e) => { console.error(e); process.exit(1); });
