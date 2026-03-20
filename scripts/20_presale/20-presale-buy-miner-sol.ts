import { presaleCtx, purchaseIdFromArgs, ensureBuyerFunded, SystemProgram, pdas, fetchers, assertEq, assertFalse, assertPubkeyEq, assertTrue, printJson, printSuccess, printTx, bn } from "./_common";

async function main() {
  const { env, args } = presaleCtx("20-presale-buy-miner-sol");
  const buyer = env.wallet.publicKey;
  const purchaseId = purchaseIdFromArgs(args);
  const config = pdas.config(env.programId);
  const cfgBefore: any = await fetchers.fetchConfig(env.program, config);
  const treasury = cfgBefore.presaleTreasury;
  const receipt = pdas.presaleReceipt(env.programId, buyer, purchaseId, 0);

  await ensureBuyerFunded(env, buyer);
  const treasuryBefore = await env.connection.getBalance(treasury, "confirmed");

  const tx = await env.program.methods.presalePurchaseMinerLootboxSol(bn(purchaseId)).accounts({
    buyer,
    config,
    treasury,
    receipt,
    systemProgram: SystemProgram.programId,
  }).rpc();

  const treasuryAfter = await env.connection.getBalance(treasury, "confirmed");
  const cfgAfter: any = await fetchers.fetchConfig(env.program, config);
  const rcpt: any = await fetchers.fetchPresaleReceipt(env.program, receipt);

  assertTrue("treasury received lamports", treasuryAfter > treasuryBefore);
  assertPubkeyEq("receipt.owner", rcpt.owner, buyer);
  assertEq("receipt.purchaseId", Number(rcpt.purchaseId), Number(purchaseId));
  assertEq("receipt.kind miner", Number(rcpt.kind), 0);
  assertFalse("receipt.consumed", rcpt.consumed);
  assertEq("presaleMinerSold +1", Number(cfgAfter.presaleMinerSold), Number(cfgBefore.presaleMinerSold) + 1);

  printJson("accounts", { buyer: buyer.toBase58(), treasury: treasury.toBase58(), receipt: receipt.toBase58(), purchaseId: purchaseId.toString() });
  printTx("presalePurchaseMinerLootboxSol", tx);
  printJson("before", { treasuryLamports: treasuryBefore, presaleMinerSold: Number(cfgBefore.presaleMinerSold) });
  printJson("after", { treasuryLamports: treasuryAfter, presaleMinerSold: Number(cfgAfter.presaleMinerSold), receiptKind: Number(rcpt.kind) });
  printSuccess("Compra presale miner via SOL validada");
}

main().catch((e) => { console.error(e); process.exit(1); });
