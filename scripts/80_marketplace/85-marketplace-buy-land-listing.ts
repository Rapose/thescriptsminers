import { PublicKey } from "@solana/web3.js";
import { marketCtx, resolveEssMint, fixtureParties, pdas, findActiveListingByKind, fetchers, getOrCreateAssociatedTokenAccount, getAccount, expectFailure, assertFalse, assertPubkeyEq, assertTrue, assertExists, printJson, printSuccess, printTx } from "./_common";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

async function main() {
  const { env, args } = marketCtx("85-marketplace-buy-land-listing");
  const essMint = resolveEssMint(args);
  const fixture = await fixtureParties(env, args, essMint);
  const listing = args.listing ? new PublicKey(args.listing) : await findActiveListingByKind(env, 2, fixture.seller);
  const listingBefore: any = assertExists("listing", await fetchers.fetchListingState(env.program, listing));
  const land = listingBefore.land;
  const economy = pdas.economy(env.programId);
  const eco: any = assertExists("economy", await fetchers.fetchEconomy(env.program, economy));

  const payer = (env.wallet as any).payer;
  const sellerAta = (await getOrCreateAssociatedTokenAccount(env.connection, payer, essMint, fixture.seller)).address;
  const buyerAta = (await getOrCreateAssociatedTokenAccount(env.connection, payer, essMint, fixture.buyer.publicKey)).address;
  const recipientAta = (await getOrCreateAssociatedTokenAccount(env.connection, payer, essMint, eco.recipientWallet)).address;

  await expectFailure("self-buy falha", async () => {
    await env.program.methods.marketplaceBuyLandListing().accounts({
      buyer: fixture.seller,
      config: pdas.config(env.programId),
      listing,
      land,
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

  const tx = await env.program.methods.marketplaceBuyLandListing().accounts({
    buyer: fixture.buyer.publicKey,
    config: pdas.config(env.programId),
    listing,
    land,
    seller: fixture.seller,
    economy,
    essMint,
    buyerAta,
    sellerAta,
    recipientAta,
    tokenProgram: TOKEN_PROGRAM_ID,
  }).signers([fixture.buyer]).rpc();

  const listingAfter: any = assertExists("listingAfter", await fetchers.fetchListingState(env.program, listing));
  const landAfter: any = assertExists("landAfter", await fetchers.fetchLandState(env.program, land));
  const buyerAfter = await getAccount(env.connection, buyerAta);
  const sellerAfter = await getAccount(env.connection, sellerAta);

  assertPubkeyEq("owner da land muda", landAfter.owner, fixture.buyer.publicKey);
  assertFalse("listing fecha", !!listingAfter.active);
  assertTrue("pagamento ESS seller recebe", sellerAfter.amount > sellerBefore.amount);
  assertTrue("pagamento ESS buyer paga", buyerBefore.amount > buyerAfter.amount);

  printTx("marketplaceBuyLandListing", tx);
  printJson("accounts", { listing: listing.toBase58(), land: land.toBase58(), seller: fixture.seller.toBase58(), buyer: fixture.buyer.publicKey.toBase58() });
  printSuccess("buy land listing validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
