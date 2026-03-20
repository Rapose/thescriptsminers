import { bootstrapCtx, ensureRewardsVault, resolveEssMint, standardBootstrapAccounts, SystemProgram, fetchers, assertEq, assertPubkeyEq, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = bootstrapCtx("02-economy-init");
  const { economy } = standardBootstrapAccounts(env);
  const essMint = resolveEssMint(args);
  const recipientWallet = args.recipient ? new (await import("@solana/web3.js")).PublicKey(args.recipient) : env.wallet.publicKey;
  const { rewardsAuthority, rewardsVault } = await ensureRewardsVault(env, essMint);

  const before = await fetchers.fetchEconomy(env.program, economy);
  const tx = await env.program.methods.economyInit().accounts({
    admin: env.wallet.publicKey,
    essMint,
    recipientWallet,
    economy,
    rewardsAuthority,
    rewardsVault,
    systemProgram: SystemProgram.programId,
  }).rpc();

  const after: any = await fetchers.fetchEconomy(env.program, economy);
  assertPubkeyEq("economy.admin", after.admin, env.wallet.publicKey);
  assertPubkeyEq("economy.essMint", after.essMint, essMint);
  assertEq("totalsBuyBurn", Number(after.totalsBuy.burn), 0);
  assertEq("totalsSendBurn", Number(after.totalsSend.burn), 0);
  printTx("economyInit", tx);
  printJson("before", { exists: !!before });
  printJson("after", { economy: economy.toBase58(), rewardsVault: rewardsVault.toBase58() });
  printSuccess("Economy inicializada e validada");
}

main().catch((e) => { console.error(e); process.exit(1); });
