import { PublicKey } from "@solana/web3.js";
import { bootstrapCtx, standardBootstrapAccounts, fetchers, assertPubkeyEq, requireArg, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = bootstrapCtx("04-economy-set-recipient");
  const { economy } = standardBootstrapAccounts(env);
  const recipientWallet = new PublicKey(requireArg(args, "recipient"));
  const before: any = await fetchers.fetchEconomy(env.program, economy);
  const tx = await env.program.methods.economySetRecipient().accounts({ admin: env.wallet.publicKey, recipientWallet, economy }).rpc();
  const after: any = await fetchers.fetchEconomy(env.program, economy);
  assertPubkeyEq("recipientWallet", after.recipientWallet, recipientWallet);
  printTx("economySetRecipient", tx);
  printJson("before", { recipient: before?.recipientWallet?.toBase58?.() });
  printJson("after", { recipient: after.recipientWallet.toBase58() });
  printSuccess("economy_set_recipient validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
