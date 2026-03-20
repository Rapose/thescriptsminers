import { lootboxCtx, resolveEssMint, parseLootboxId, economyAccounts, TOKEN_PROGRAM_ID, SystemProgram, pdas, fetchers, getAccount, assertEq, assertFalse, assertPubkeyEq, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = lootboxCtx("10-buy-miner-lootbox-ess");
  const buyer = env.wallet.publicKey;
  const lootboxId = parseLootboxId(args);
  const saleType = Number(args.saleType ?? "0");
  const config = pdas.config(env.programId);
  const essMint = resolveEssMint(args);
  const { economy, recipientWallet, userAta, recipientAta } = await economyAccounts(env, essMint, buyer);
  const lootbox = pdas.lootboxMiner(env.programId, buyer, lootboxId, saleType);

  const cfgBefore: any = await fetchers.fetchConfig(env.program, config);
  const userBefore = await getAccount(env.connection, userAta);

  const tx = await env.program.methods.buyMinerLootboxEss(lootboxId).accounts({
    buyer,
    config,
    economy,
    essMint,
    userAta,
    recipientWallet,
    recipientAta,
    lootbox,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  }).rpc();

  const lb: any = await fetchers.fetchLootboxMinerState(env.program, lootbox);
  const cfgAfter: any = await fetchers.fetchConfig(env.program, config);
  const userAfter = await getAccount(env.connection, userAta);

  assertTrue("ESS debit", userAfter.amount < userBefore.amount);
  assertPubkeyEq("owner", lb.owner, buyer);
  assertFalse("revealed", lb.revealed);
  assertEq("saleType", Number(lb.saleType), saleType);
  assertEq("nextMinerId unchanged", Number(cfgAfter.nextMinerId), Number(cfgBefore.nextMinerId));

  printJson("accounts", { buyer: buyer.toBase58(), lootbox: lootbox.toBase58(), config: config.toBase58() });
  printTx("buyMinerLootboxEss", tx);
  printJson("before", { userAta: userBefore.amount.toString(), nextMinerId: Number(cfgBefore.nextMinerId) });
  printJson("after", { userAta: userAfter.amount.toString(), nextMinerId: Number(cfgAfter.nextMinerId), revealed: lb.revealed });
  printSuccess("Compra de lootbox miner validada");
}

main().catch((e) => { console.error(e); process.exit(1); });
