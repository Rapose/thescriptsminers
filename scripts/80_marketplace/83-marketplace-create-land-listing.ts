import { PublicKey, SystemProgram } from "@solana/web3.js";
import { marketCtx, bn, nextListingPda, findOwnedLand, fetchers, assertEq, assertExists, assertTrue, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = marketCtx("83-marketplace-create-land-listing");
  const seller = env.wallet.publicKey;
  const price = Number(args.price ?? "800000");
  const { config, id, listing } = await nextListingPda(env);
  const land = args.land ? new PublicKey(args.land) : await findOwnedLand(env, seller, false);

  const tx = await env.program.methods.marketplaceCreateLandListing(bn(price)).accounts({
    seller,
    config,
    land,
    listing,
    systemProgram: SystemProgram.programId,
  }).rpc();

  const listingAfter: any = assertExists("listing", await fetchers.fetchListingState(env.program, listing));
  const landAfter: any = assertExists("land", await fetchers.fetchLandState(env.program, land));

  assertTrue("listing.active", !!listingAfter.active);
  assertEq("listing.asset_kind land", Number(listingAfter.assetKind), 2);
  assertTrue("land.listed = true", !!landAfter.listed);

  printTx("marketplaceCreateLandListing", tx);
  printJson("accounts", { seller: seller.toBase58(), config: config.toBase58(), land: land.toBase58(), listing: listing.toBase58(), listingId: id.toString() });
  printSuccess("create land listing validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
