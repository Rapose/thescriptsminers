import { BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { expectFailure, logStep, SuiteCtx } from "./_shared";

const MINER_PRICE = new BN(1_000_000);
const SEED_LISTING = Buffer.from("listing_v1");

function u64Le(n: bigint) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

function pda(programId: PublicKey, ...parts: (Buffer | Uint8Array)[]) {
  return PublicKey.findProgramAddressSync(parts, programId)[0];
}

async function nextListingPda(ctx: SuiteCtx, configPk: PublicKey) {
  const configAccount =
    ctx.program.account?.config ??
    (() => {
      throw new Error("config account client not found");
    })();

  const cfg: any = await configAccount.fetch(configPk);
  const nextListingId = BigInt(cfg.nextListingId.toString());

  return {
    id: nextListingId,
    pda: pda(ctx.program.programId, SEED_LISTING, u64Le(nextListingId)),
  };
}

export async function runMarketplaceMinerTests(
  ctx: SuiteCtx,
  a: Record<string, any>
) {
  const p = ctx.program;

  const firstListing = await nextListingPda(ctx, a.config);
  console.log(
    "miner create listing =",
    firstListing.pda.toBase58(),
    "id =",
    firstListing.id.toString()
  );

  logStep("miner/create success");
  await p.methods
    .marketplaceCreateMinerListing(MINER_PRICE)
    .accounts({
      seller: ctx.seller.publicKey,
      config: a.config,
      miner: a.miner,
      listing: firstListing.pda,
      systemProgram: SystemProgram.programId,
    })
    .signers([ctx.seller])
    .rpc();

  const createdInfo = await ctx.provider.connection.getAccountInfo(
    firstListing.pda,
    "confirmed"
  );
  console.log("miner created listing info:", {
    exists: !!createdInfo,
    owner: createdInfo?.owner?.toBase58?.(),
    dataLen: createdInfo?.data?.length ?? 0,
  });

  const listingAccount =
    ctx.program.account?.listingState ?? ctx.program.account?.listing;

  if (!listingAccount) {
    throw new Error("listing account client not found");
  }

  const firstListingData: any = await listingAccount.fetch(firstListing.pda);
  console.log("listing after first create:", {
    id: firstListingData.id?.toString?.() ?? firstListingData.id,
    seller:
      firstListingData.seller?.toBase58?.() ?? firstListingData.seller,
    active: firstListingData.active,
    miner: firstListingData.miner?.toBase58?.() ?? firstListingData.miner,
  });

  logStep("miner/double listing fail");
  const secondListingPreview = await nextListingPda(ctx, a.config);
  await expectFailure("miner double listing", async () => {
    await p.methods
      .marketplaceCreateMinerListing(MINER_PRICE)
      .accounts({
        seller: ctx.seller.publicKey,
        config: a.config,
        miner: a.miner,
        listing: secondListingPreview.pda,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.seller])
      .rpc();
  });

  console.log("miner cancel listing =", firstListing.pda.toBase58());

  logStep("miner/cancel success");
  await p.methods
    .marketplaceCancelMinerListing()
    .accounts({
      seller: ctx.seller.publicKey,
      config: a.config,
      listing: firstListing.pda,
      miner: a.miner,
    })
    .signers([ctx.seller])
    .rpc();

  const relist = await nextListingPda(ctx, a.config);
  console.log(
    "miner relist listing =",
    relist.pda.toBase58(),
    "id =",
    relist.id.toString()
  );

  logStep("miner/relist success");
  await p.methods
    .marketplaceCreateMinerListing(MINER_PRICE)
    .accounts({
      seller: ctx.seller.publicKey,
      config: a.config,
      miner: a.miner,
      listing: relist.pda,
      systemProgram: SystemProgram.programId,
    })
    .signers([ctx.seller])
    .rpc();

  const relistData: any = await listingAccount.fetch(relist.pda);
  console.log("listing after relist:", {
    id: relistData.id?.toString?.() ?? relistData.id,
    seller: relistData.seller?.toBase58?.() ?? relistData.seller,
    active: relistData.active,
    miner: relistData.miner?.toBase58?.() ?? relistData.miner,
  });

  logStep("miner/self buy fail");
  await expectFailure("miner self buy", async () => {
    await p.methods
      .marketplaceBuyMinerListing()
      .accounts({
        buyer: ctx.seller.publicKey,
        config: a.config,
        listing: relist.pda,
        miner: a.miner,
        minerProgress: a.minerProgress,
        seller: ctx.seller.publicKey,
        economy: a.economy,
        essMint: ctx.essMint,
        buyerAta: a.sellerAta,
        sellerAta: a.sellerAta,
        recipientAta: a.recipientAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([ctx.seller])
      .rpc();
  });

  logStep("miner/buy success");
  await p.methods
    .marketplaceBuyMinerListing()
    .accounts({
      buyer: ctx.buyer.publicKey,
      config: a.config,
      listing: relist.pda,
      miner: a.miner,
      minerProgress: a.minerProgress,
      seller: ctx.seller.publicKey,
      economy: a.economy,
      essMint: ctx.essMint,
      buyerAta: a.buyerAta,
      sellerAta: a.sellerAta,
      recipientAta: a.recipientAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([ctx.buyer])
    .rpc();
}