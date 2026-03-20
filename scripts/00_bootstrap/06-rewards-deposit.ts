import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { Keypair } from "@solana/web3.js";
import { bootstrapCtx, ensureRewardsVault, resolveEssMint, standardBootstrapAccounts, TOKEN_PROGRAM_ID, fetchers, bn, getAccount, assertTrue, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = bootstrapCtx("06-rewards-deposit");
  const { economy } = standardBootstrapAccounts(env);
  const essMint = resolveEssMint(args);
  const depositor = (env.wallet as any).payer as Keypair;
  const { rewardsAuthority, rewardsVault } = await ensureRewardsVault(env, essMint);
  const depositorAta = await getOrCreateAssociatedTokenAccount(env.connection, depositor, essMint, env.wallet.publicKey);

  const beforeVault = await getAccount(env.connection, rewardsVault);
  const amount = bn(args.amount ?? "1000");
  const tx = await env.program.methods.rewardsDeposit(amount).accounts({
    depositor: env.wallet.publicKey,
    essMint,
    depositorAta: depositorAta.address,
    economy,
    rewardsAuthority,
    rewardsVault,
    tokenProgram: TOKEN_PROGRAM_ID,
  }).rpc();

  const afterVault = await getAccount(env.connection, rewardsVault);
  assertTrue("vault balance increased", afterVault.amount > beforeVault.amount);
  printTx("rewardsDeposit", tx);
  printJson("vault", { before: beforeVault.amount.toString(), after: afterVault.amount.toString() });
  printSuccess("rewards_deposit validado com saldo real");
}

main().catch((e) => { console.error(e); process.exit(1); });
