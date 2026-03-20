import { presaleCtx, purchaseIdFromArgs, ensureBuyerFunded, SystemProgram, pdas, fetchers, assertEq, assertFalse, assertPubkeyEq, assertTrue, printJson, printSuccess, printTx, bn } from "./_common";

async function main() {
  const { env, args } = presaleCtx("21-presale-buy-land-sol");
  const buyer = env.wallet.publicKey;
  const purchaseId = purchaseIdFromArgs(args);
  const config = pdas.config(env.programId);
  const cfgBefore: any = await fetchers.fetchConfig(env.program, config);
  const treasury = cfgBefore.presaleTreasury;
  const receipt = pdas.presaleReceipt(env.programId, buyer, purchaseId, 1);

  await ensureBuyerFunded(env, buyer);
  const treasuryBefore = await env.connection.getBalance(treasury, "confirmed");

  const tx = await env.program.methods.presalePurchaseLandLootboxSol(bn(purchaseId)).accounts({
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
  assertEq("receipt.kind land", Number(rcpt.kind), 1);
  assertFalse("receipt.consumed", rcpt.consumed);
  assertEq("presaleLandSold +1", Number(cfgAfter.presaleLandSold), Number(cfgBefore.presaleLandSold) + 1);

  printJson("accounts", { buyer: buyer.toBase58(), treasury: treasury.toBase58(), receipt: receipt.toBase58(), purchaseId: purchaseId.toString() });
  printTx("presalePurchaseLandLootboxSol", tx);
  printJson("before", { treasuryLamports: treasuryBefore, presaleLandSold: Number(cfgBefore.presaleLandSold) });
  printJson("after", { treasuryLamports: treasuryAfter, presaleLandSold: Number(cfgAfter.presaleLandSold), receiptKind: Number(rcpt.kind) });
  printSuccess("Compra presale land via SOL validada");
}

main().catch((e) => { console.error(e); process.exit(1); });
