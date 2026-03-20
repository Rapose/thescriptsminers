import { presaleCtx, purchaseIdFromArgs, SystemProgram, pdas, fetchers, assertEq, assertPubkeyEq, assertTrue, assertFalse, printJson, printSuccess, printTx, bn } from "./_common";

async function main() {
  const { env, args } = presaleCtx("23-presale-claim-land");
  const buyer = env.wallet.publicKey;
  const purchaseId = purchaseIdFromArgs(args);
  const config = pdas.config(env.programId);
  const receipt = pdas.presaleReceipt(env.programId, buyer, purchaseId, 1);
  const lootbox = pdas.lootboxLand(env.programId, buyer, purchaseId, 1);

  const receiptBefore: any = await fetchers.fetchPresaleReceipt(env.program, receipt);
  const tx = await env.program.methods.presaleClaimLandLootbox(bn(purchaseId)).accounts({
    buyer,
    config,
    receipt,
    lootbox,
    systemProgram: SystemProgram.programId,
  }).rpc();

  const receiptAfter: any = await fetchers.fetchPresaleReceipt(env.program, receipt);
  const lb: any = await fetchers.fetchLootboxLandState(env.program, lootbox);

  assertTrue("receipt consumed", receiptAfter.consumed);
  assertPubkeyEq("lootbox owner", lb.owner, buyer);
  assertEq("lootboxId", Number(lb.lootboxId), Number(purchaseId));
  assertEq("saleType founder", Number(lb.saleType), 1);
  assertFalse("revealed", lb.revealed);

  printJson("accounts", { buyer: buyer.toBase58(), receipt: receipt.toBase58(), lootbox: lootbox.toBase58(), purchaseId: purchaseId.toString() });
  printTx("presaleClaimLandLootbox", tx);
  printJson("before", { consumed: receiptBefore?.consumed });
  printJson("after", { consumed: receiptAfter.consumed, lootboxSaleType: Number(lb.saleType) });
  printSuccess("Claim presale land validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
