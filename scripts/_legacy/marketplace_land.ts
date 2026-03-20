import { BN } from "@coral-xyz/anchor";
import { SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { expectFailure, logStep, SuiteCtx } from "./_shared";

const LAND_PRICE = new BN(500_000);

export async function runMarketplaceLandTests(
  ctx: SuiteCtx,
  a: Record<string, any>
) {
  const p = ctx.program;

  logStep("land/create success");
  await p.methods
    .marketplaceCreateLandListing(LAND_PRICE)
    .accounts({
      seller: ctx.seller.publicKey,
      config: a.config,
      land: a.land,
      listing: a.listing,
      systemProgram: SystemProgram.programId,
    })
    .signers([ctx.seller])
    .rpc();

  logStep("land/double listing fail");
  await expectFailure("land double listing", async () => {
    await p.methods
      .marketplaceCreateLandListing(LAND_PRICE)
      .accounts({
        seller: ctx.seller.publicKey,
        config: a.config,
        land: a.land,
        listing: a.listing2,
        systemProgram: SystemProgram.programId,
      })
      .signers([ctx.seller])
      .rpc();
  });

  logStep("land/cancel success");
  await p.methods
    .marketplaceCancelLandListing()
    .accounts({
      seller: ctx.seller.publicKey,
      config: a.config,
      listing: a.listing,
      land: a.land,
    })
    .signers([ctx.seller])
    .rpc();

  logStep("land/relist success");
  await p.methods
    .marketplaceCreateLandListing(LAND_PRICE)
    .accounts({
      seller: ctx.seller.publicKey,
      config: a.config,
      land: a.land,
      listing: a.listing2,
      systemProgram: SystemProgram.programId,
    })
    .signers([ctx.seller])
    .rpc();

  logStep("land/buy success");
  await p.methods
    .marketplaceBuyLandListing()
    .accounts({
      buyer: ctx.buyer.publicKey,
      config: a.config,
      listing: a.listing2,
      land: a.land,
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