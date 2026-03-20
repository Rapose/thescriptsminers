import { PublicKey, SystemProgram } from "@solana/web3.js";
import { marketCtx, bn, nextListingPda, findOwnedMiner, fetchers, assertEq, assertExists, assertTrue, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = marketCtx("80-marketplace-create-miner-listing");
  const seller = env.wallet.publicKey;
  const price = Number(args.price ?? "1000000");

  const { config, id, listing } = await nextListingPda(env);
  const miner = args.miner ? new PublicKey(args.miner) : await findOwnedMiner(env, seller, false);

  const tx = await env.program.methods.marketplaceCreateMinerListing(bn(price)).accounts({
    seller,
    config,
    miner,
    listing,
    systemProgram: SystemProgram.programId,
  }).rpc();

  const listingAfter: any = assertExists("listing", await fetchers.fetchListingState(env.program, listing));
  const minerAfter: any = assertExists("miner", await fetchers.fetchMinerState(env.program, miner));

  assertTrue("listing.active", !!listingAfter.active);
  assertEq("listing.asset_kind miner", Number(listingAfter.assetKind), 1);
  assertTrue("miner.listed = true", !!minerAfter.listed);

  printTx("marketplaceCreateMinerListing", tx);
  printJson("accounts", { seller: seller.toBase58(), config: config.toBase58(), miner: miner.toBase58(), listing: listing.toBase58(), listingId: id.toString() });
  printSuccess("create miner listing validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
