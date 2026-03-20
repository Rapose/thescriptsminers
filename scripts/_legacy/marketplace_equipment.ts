import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { expectFailure, logStep, SuiteCtx } from "./_shared";

const EQUIPMENT_BUCKET = 1;
const EQUIPMENT_LEVEL = 1;
const EQUIPMENT_AMOUNT = 1;
const EQUIPMENT_PRICE = new BN(200_000);

export async function runMarketplaceEquipmentTests(
  ctx: SuiteCtx,
  a: Record<string, any>
) {
  const p = ctx.program;

  logStep("equipment/create success");
  await p.methods
    .marketplaceCreateEquipmentListing(
      EQUIPMENT_BUCKET,
      EQUIPMENT_LEVEL,
      EQUIPMENT_AMOUNT,
      EQUIPMENT_PRICE
    )
    .accounts({
      seller: ctx.seller.publicKey,
      config: a.config,
      inventory: a.sellerInventory,
      listing: a.listing,
    })
    .signers([ctx.seller])
    .rpc();

  logStep("equipment/invalid amount fail");
  await expectFailure("equipment invalid amount", async () => {
    await p.methods
      .marketplaceCreateEquipmentListing(
        EQUIPMENT_BUCKET,
        EQUIPMENT_LEVEL,
        0,
        EQUIPMENT_PRICE
      )
      .accounts({
        seller: ctx.seller.publicKey,
        config: a.config,
        inventory: a.sellerInventory,
        listing: a.listing2,
      })
      .signers([ctx.seller])
      .rpc();
  });

  logStep("equipment/cancel success");
  await p.methods
    .marketplaceCancelEquipmentListing()
    .accounts({
      seller: ctx.seller.publicKey,
      config: a.config,
      listing: a.listing,
      inventory: a.sellerInventory,
    })
    .signers([ctx.seller])
    .rpc();

  logStep("equipment/relist success");
  await p.methods
    .marketplaceCreateEquipmentListing(
      EQUIPMENT_BUCKET,
      EQUIPMENT_LEVEL,
      EQUIPMENT_AMOUNT,
      EQUIPMENT_PRICE
    )
    .accounts({
      seller: ctx.seller.publicKey,
      config: a.config,
      inventory: a.sellerInventory,
      listing: a.listing2,
    })
    .signers([ctx.seller])
    .rpc();

  logStep("equipment/buy success");
  await p.methods
    .marketplaceBuyEquipmentListing()
    .accounts({
      buyer: ctx.buyer.publicKey,
      config: a.config,
      listing: a.listing2,
      seller: ctx.seller.publicKey,
      sellerInventory: a.sellerInventory,
      buyerInventory: a.buyerInventory,
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