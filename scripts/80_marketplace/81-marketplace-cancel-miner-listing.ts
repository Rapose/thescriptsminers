import { PublicKey } from "@solana/web3.js";
import { marketCtx, pdas, findActiveListingByKind, fetchers, assertFalse, assertExists, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = marketCtx("81-marketplace-cancel-miner-listing");
  const seller = env.wallet.publicKey;
  const listing = args.listing ? new PublicKey(args.listing) : await findActiveListingByKind(env, 1, seller);
  const listingBefore: any = assertExists("listing", await fetchers.fetchListingState(env.program, listing));
  const miner = listingBefore.miner;

  const tx = await env.program.methods.marketplaceCancelMinerListing().accounts({
    seller,
    config: pdas.config(env.programId),
    listing,
    miner,
  }).rpc();

  const listingAfter: any = assertExists("listingAfter", await fetchers.fetchListingState(env.program, listing));
  const minerAfter: any = assertExists("minerAfter", await fetchers.fetchMinerState(env.program, miner));
  assertFalse("listing encerrada", !!listingAfter.active);
  assertFalse("miner.listed = false", !!minerAfter.listed);

  printTx("marketplaceCancelMinerListing", tx);
  printJson("accounts", { seller: seller.toBase58(), listing: listing.toBase58(), miner: miner.toBase58() });
  printSuccess("cancel miner listing validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
