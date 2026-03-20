import { PublicKey } from "@solana/web3.js";
import { marketCtx, pdas, requireMethod, findActiveListingByKind, fetchers, assertFalse, assertExists, printJson, printSuccess, printTx, printWarn } from "./_common";

async function main() {
  const { env, args } = marketCtx("87-marketplace-cancel-equipment-listing");
  if (!requireMethod(env, "marketplaceCancelEquipmentListing")) {
    printWarn("marketplaceCancelEquipmentListing não exposto no IDL/on-chain atual. Script sem execução de tx.");
    printSuccess("dependência on-chain faltante documentada");
    return;
  }

  const seller = env.wallet.publicKey;
  const listing = args.listing ? new PublicKey(args.listing) : await findActiveListingByKind(env, 3, seller);
  const listingBefore: any = assertExists("listing", await fetchers.fetchListingState(env.program, listing));
  const equipment = listingBefore.equipment;

  const tx = await (env.program.methods as any).marketplaceCancelEquipmentListing().accounts({
    seller,
    config: pdas.config(env.programId),
    listing,
    equipment,
  }).rpc();

  const listingAfter: any = assertExists("listingAfter", await fetchers.fetchListingState(env.program, listing));
  const equipmentAfter: any = assertExists("equipmentAfter", await fetchers.fetchEquipmentInstance(env.program, equipment));
  assertFalse("listing encerrada", !!listingAfter.active);
  assertFalse("equipment.listed = false", !!equipmentAfter.listed);

  printTx("marketplaceCancelEquipmentListing", tx);
  printJson("accounts", { seller: seller.toBase58(), listing: listing.toBase58(), equipment: equipment.toBase58() });
  printSuccess("cancel equipment listing validado");
}

main().catch((e) => { console.error(e); process.exit(1); });
