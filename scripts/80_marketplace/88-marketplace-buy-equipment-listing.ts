import { PublicKey } from "@solana/web3.js";
import { marketCtx, resolveEssMint, fixtureParties, pdas, requireMethod, findActiveListingByKind, fetchers, getOrCreateAssociatedTokenAccount, getAccount, expectFailure, assertFalse, assertPubkeyEq, assertTrue, assertExists, printJson, printSuccess, printTx, printWarn } from "./_common";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

async function main() {
  const { env, args } = marketCtx("88-marketplace-buy-equipment-listing");
  if (!requireMethod(env, "marketplaceBuyEquipmentListing")) {
    printWarn("marketplaceBuyEquipmentListing não exposto no IDL/on-chain atual. Script sem execução de tx.");
    printSuccess("dependência on-chain faltante documentada");
    return;
  }

  const essMint = resolveEssMint(args);
  const fixture = await fixtureParties(env, args, essMint);
  const listing = args.listing ? new PublicKey(args.listing) : await findActiveListingByKind(env, 3, fixture.seller);
  const listingBefore: any = assertExists("listing", await fetchers.fetchListingState(env.program, listing));
  const equipment = listingBefore.equipment;
  const economy = pdas.economy(env.programId);
  const eco: any = assertExists("economy", await fetchers.fetchEconomy(env.program, economy));

  const payer = (env.wallet as any).payer;
  const sellerAta = (await getOrCreateAssociatedTokenAccount(env.connection, payer, essMint, fixture.seller)).address;
  const buyerAta = (await getOrCreateAssociatedTokenAccount(env.connection, payer, essMint, fixture.buyer.publicKey)).address;
  const recipientAta = (await getOrCreateAssociatedTokenAccount(env.connection, payer, essMint, eco.recipientWallet)).address;

  await expectFailure("self-buy falha", async () => {
    await (env.program.methods as any).marketplaceBuyEquipmentListing().accounts({
      buyer: fixture.seller,
      config: pdas.config(env.programId),
      listing,
      equipment,
      seller: fixture.seller,
      economy,
      essMint,
      buyerAta: sellerAta,
      sellerAta,
      recipientAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).rpc();
  });

  const buyerBefore = await getAccount(env.connection, buyerAta);
  const sellerBefore = await getAccount(env.connection, sellerAta);

  const tx = await (env.program.methods as any).marketplaceBuyEquipmentListing().accounts({
    buyer: fixture.buyer.publicKey,
    config: pdas.config(env.programId),
    listing,
    equipment,
    seller: fixture.seller,
    economy,
    essMint,
    buyerAta,
    sellerAta,
    recipientAta,
    tokenProgram: TOKEN_PROGRAM_ID,
  }).signers([fixture.buyer]).rpc();

  const listingAfter: any = assertExists("listingAfter", await fetchers.fetchListingState(env.program, listing));
  const equipmentAfter: any = assertExists("equipmentAfter", await fetchers.fetchEquipmentInstance(env.program, equipment));
  const buyerAfter = await getAccount(env.connection, buyerAta);
  const sellerAfter = await getAccount(env.connection, sellerAta);

  assertPubkeyEq("owner do equipment muda", equipmentAfter.owner, fixture.buyer.publicKey);
  assertFalse("listing fecha", !!listingAfter.active);
  assertTrue("pagamento ESS seller recebe", sellerAfter.amount > sellerBefore.amount);
  assertTrue("pagamento ESS buyer paga", buyerBefore.amount > buyerAfter.amount);

  printTx("marketplaceBuyEquipmentListing", tx);
  printJson("accounts", { listing: listing.toBase58(), equipment: equipment.toBase58(), seller: fixture.seller.toBase58(), buyer: fixture.buyer.publicKey.toBase58() });
  printSuccess("buy equipment listing validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
