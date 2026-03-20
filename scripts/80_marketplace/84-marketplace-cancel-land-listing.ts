import { PublicKey } from "@solana/web3.js";
import { marketCtx, pdas, findActiveListingByKind, fetchers, assertFalse, assertExists, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = marketCtx("84-marketplace-cancel-land-listing");
  const seller = env.wallet.publicKey;
  const listing = args.listing ? new PublicKey(args.listing) : await findActiveListingByKind(env, 2, seller);
  const listingBefore: any = assertExists("listing", await fetchers.fetchListingState(env.program, listing));
  const land = listingBefore.land;

  const tx = await env.program.methods.marketplaceCancelLandListing().accounts({
    seller,
    config: pdas.config(env.programId),
    listing,
    land,
  }).rpc();

  const listingAfter: any = assertExists("listingAfter", await fetchers.fetchListingState(env.program, listing));
  const landAfter: any = assertExists("landAfter", await fetchers.fetchLandState(env.program, land));
  assertFalse("listing encerrada", !!listingAfter.active);
  assertFalse("land.listed = false", !!landAfter.listed);

  printTx("marketplaceCancelLandListing", tx);
  printJson("accounts", { seller: seller.toBase58(), listing: listing.toBase58(), land: land.toBase58() });
  printSuccess("cancel land listing validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
