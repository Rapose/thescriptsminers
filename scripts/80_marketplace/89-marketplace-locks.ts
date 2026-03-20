import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { marketCtx, bn, resolveEssMint, fixtureParties, pdas, nextListingPda, findOwnedMiner, findOwnedLand, findOwnedEquipment, requireMethod, fetchers, getOrCreateAssociatedTokenAccount, expectFailure, assertExists, printJson, printSuccess, printTx, printWarn } from "./_common";

async function main() {
  const { env, args } = marketCtx("89-marketplace-locks");
  const seller = env.wallet.publicKey;
  const essMint = resolveEssMint(args);
  const fixture = await fixtureParties(env, args, essMint);
  const config = pdas.config(env.programId);

  const miner = args.miner ? new PublicKey(args.miner) : await findOwnedMiner(env, seller, false);
  const land = args.land ? new PublicKey(args.land) : await findOwnedLand(env, seller, false);
  const equipment = args.equipment ? new PublicKey(args.equipment) : await findOwnedEquipment(env, seller, false);

  const minerListing = (await nextListingPda(env)).listing;
  const txMiner = await env.program.methods.marketplaceCreateMinerListing(bn(600000)).accounts({ seller, config, miner, listing: minerListing, systemProgram: SystemProgram.programId }).rpc();

  await expectFailure("double listing miner", async () => {
    const listing2 = (await nextListingPda(env)).listing;
    await env.program.methods.marketplaceCreateMinerListing(bn(700000)).accounts({ seller, config, miner, listing: listing2, systemProgram: SystemProgram.programId }).rpc();
  });

  await expectFailure("miner listado não pode claim exp", async () => {
    await env.program.methods.claimMiningExp().accounts({
      owner: seller,
      minerState: miner,
      progression: pdas.progression(env.programId),
      minerProgress: pdas.minerProgress(env.programId, miner),
    }).rpc();
  });

  await expectFailure("miner listado não pode equipment init", async () => {
    await env.program.methods.equipmentInit().accounts({
      owner: seller,
      minerState: miner,
      equipment: pdas.equipmentState(env.programId, miner),
      systemProgram: SystemProgram.programId,
    }).rpc();
  });

  const landListing = (await nextListingPda(env)).listing;
  const txLand = await env.program.methods.marketplaceCreateLandListing(bn(600000)).accounts({ seller, config, land, listing: landListing, systemProgram: SystemProgram.programId }).rpc();
  await expectFailure("land listada não pode assign", async () => {
    await env.program.methods.globalMiningAssignLand().accounts({ owner: seller, minerState: miner, landState: land }).rpc();
  });

  const eqListing = (await nextListingPda(env)).listing;
  const txEq = await env.program.methods.marketplaceCreateEquipmentListing(bn(300000)).accounts({ seller, config, equipment, listing: eqListing, systemProgram: SystemProgram.programId }).rpc();

  await expectFailure("equipment listado não pode equip hand", async () => {
    await env.program.methods.equipmentEquipHand().accounts({
      owner: seller,
      minerState: miner,
      equipment: pdas.equipmentState(env.programId, miner),
      newEquipment: equipment,
    }).rpc();
  });

  await env.program.methods.marketplaceCancelMinerListing().accounts({ seller, config, listing: minerListing, miner }).rpc();

  const listingAfterCancel: any = assertExists("listingAfterCancel", await fetchers.fetchListingState(env.program, minerListing));
  const economy = pdas.economy(env.programId);
  const eco: any = assertExists("economy", await fetchers.fetchEconomy(env.program, economy));
  const payer = (env.wallet as any).payer;
  const sellerAta = (await getOrCreateAssociatedTokenAccount(env.connection, payer, essMint, fixture.seller)).address;
  const buyerAta = (await getOrCreateAssociatedTokenAccount(env.connection, payer, essMint, fixture.buyer.publicKey)).address;
  const recipientAta = (await getOrCreateAssociatedTokenAccount(env.connection, payer, essMint, eco.recipientWallet)).address;

  await expectFailure("compra de listing inativa falha", async () => {
    await env.program.methods.marketplaceBuyMinerListing().accounts({
      buyer: fixture.buyer.publicKey,
      config,
      listing: minerListing,
      miner,
      minerProgress: pdas.minerProgress(env.programId, miner),
      seller: listingAfterCancel.seller,
      economy,
      essMint,
      buyerAta,
      sellerAta,
      recipientAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([fixture.buyer]).rpc();
  });

  if (!requireMethod(env, "marketplaceCancelEquipmentListing") || !requireMethod(env, "marketplaceBuyEquipmentListing")) {
    printWarn("Cancel/Buy de equipment não expostos no IDL/on-chain atual; testes completos de lock para fluxo de compra/cancelamento de equipment dependem dessa exposição.");
  }

  printTx("marketplaceCreateMinerListing(lock)", txMiner);
  printTx("marketplaceCreateLandListing(lock)", txLand);
  printTx("marketplaceCreateEquipmentListing(lock)", txEq);
  printJson("lockAccounts", { miner: miner.toBase58(), land: land.toBase58(), equipment: equipment.toBase58(), minerListing: minerListing.toBase58(), landListing: landListing.toBase58(), eqListing: eqListing.toBase58() });
  printSuccess("marketplace locks validados");
}

main().catch((e) => { console.error(e); process.exit(1); });
