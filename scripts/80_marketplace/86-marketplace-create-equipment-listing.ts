import { PublicKey, SystemProgram } from "@solana/web3.js";
import { marketCtx, bn, nextListingPda, findOwnedEquipment, fetchers, assertEq, assertExists, assertTrue, printJson, printSuccess, printTx } from "./_common";

async function main() {
  const { env, args } = marketCtx("86-marketplace-create-equipment-listing");
  const seller = env.wallet.publicKey;
  const price = Number(args.price ?? "500000");
  const { config, id, listing } = await nextListingPda(env);
  const equipment = args.equipment ? new PublicKey(args.equipment) : await findOwnedEquipment(env, seller, false);

  const tx = await env.program.methods.marketplaceCreateEquipmentListing(bn(price)).accounts({
    seller,
    config,
    equipment,
    listing,
    systemProgram: SystemProgram.programId,
  }).rpc();

  const listingAfter: any = assertExists("listing", await fetchers.fetchListingState(env.program, listing));
  const equipmentAfter: any = assertExists("equipment", await fetchers.fetchEquipmentInstance(env.program, equipment));

  assertTrue("listing.active", !!listingAfter.active);
  assertEq("listing.asset_kind equipment", Number(listingAfter.assetKind), 3);
  assertTrue("equipment listed", !!equipmentAfter.listed);

  printTx("marketplaceCreateEquipmentListing", tx);
  printJson("accounts", { seller: seller.toBase58(), config: config.toBase58(), equipment: equipment.toBase58(), listing: listing.toBase58(), listingId: id.toString() });
  printSuccess("create equipment listing validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
