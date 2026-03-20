use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};

use crate::{
    constants::*,
    errors::MoeError,
    state::{Config, LootboxLandState, LootboxMinerState, PresaleReceipt},
    utils::u64_le_bytes,
};


#[event]
pub struct PresaleLootboxPurchased {
    pub buyer: Pubkey,
    pub kind: u8, // 0 = miner, 1 = land
    pub purchase_id: u64,
    pub price_lamports: u64,
    pub treasury: Pubkey,
}

#[event]
pub struct PresaleLootboxClaimed {
    pub buyer: Pubkey,
    pub kind: u8, // 0 = miner, 1 = land
    pub purchase_id: u64,
    pub lootbox: Pubkey,
}
#[derive(Accounts)]
#[instruction(purchase_id: u64)]
pub struct PresalePurchaseMinerLootboxSol<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        seeds = [SEED_CONFIG],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    /// CHECK: treasury configurada pelo admin
    #[account(mut, address = config.presale_treasury)]
    pub treasury: UncheckedAccount<'info>,

    #[account(
        init,
        payer = buyer,
        space = PresaleReceipt::LEN,
        seeds = [
            SEED_PRESALE_RECEIPT,
            buyer.key().as_ref(),
            &[0],
            &u64_le_bytes(purchase_id)
        ],
        bump
    )]
    pub receipt: Account<'info, PresaleReceipt>,

    pub system_program: Program<'info, System>,
}

pub fn handler_presale_purchase_miner_lootbox_sol(
    ctx: Context<PresalePurchaseMinerLootboxSol>,
    purchase_id: u64,
) -> Result<()> {
    let cfg = &mut ctx.accounts.config;
    require!(!cfg.paused, MoeError::Paused);
    require!(cfg.presale_sol_enabled, MoeError::PresaleDisabled);

    let amount = cfg.presale_miner_price_lamports;
    require!(amount > 0, MoeError::InvalidEssCost);

    transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        ),
        amount,
    )?;

    let receipt = &mut ctx.accounts.receipt;
    receipt.owner = ctx.accounts.buyer.key();
    receipt.kind = 0;
    receipt.purchase_id = purchase_id;
    receipt.consumed = false;
    receipt.price_lamports = amount;
    receipt.created_at = Clock::get()?.unix_timestamp;
    receipt.bump = ctx.bumps.receipt;

    cfg.presale_miner_sold = cfg.presale_miner_sold.saturating_add(1);
emit!(PresaleLootboxPurchased {
    buyer: ctx.accounts.buyer.key(),
    kind: 0,
    purchase_id,
    price_lamports: amount,
    treasury: ctx.accounts.treasury.key(),
});
    Ok(())
}

#[derive(Accounts)]
#[instruction(purchase_id: u64)]
pub struct PresalePurchaseLandLootboxSol<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        seeds = [SEED_CONFIG],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    /// CHECK: treasury configurada pelo admin
    #[account(mut, address = config.presale_treasury)]
    pub treasury: UncheckedAccount<'info>,

    #[account(
        init,
        payer = buyer,
        space = PresaleReceipt::LEN,
        seeds = [
            SEED_PRESALE_RECEIPT,
            buyer.key().as_ref(),
            &[1],
            &u64_le_bytes(purchase_id)
        ],
        bump
    )]
    pub receipt: Account<'info, PresaleReceipt>,

    pub system_program: Program<'info, System>,
}

pub fn handler_presale_purchase_land_lootbox_sol(
    ctx: Context<PresalePurchaseLandLootboxSol>,
    purchase_id: u64,
) -> Result<()> {
    let cfg = &mut ctx.accounts.config;
    require!(!cfg.paused, MoeError::Paused);
    require!(cfg.presale_sol_enabled, MoeError::PresaleDisabled);

    let amount = cfg.presale_land_price_lamports;
    require!(amount > 0, MoeError::InvalidEssCost);

    transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        ),
        amount,
    )?;

    let receipt = &mut ctx.accounts.receipt;
    receipt.owner = ctx.accounts.buyer.key();
    receipt.kind = 1;
    receipt.purchase_id = purchase_id;
    receipt.consumed = false;
    receipt.price_lamports = amount;
    receipt.created_at = Clock::get()?.unix_timestamp;
    receipt.bump = ctx.bumps.receipt;

    cfg.presale_land_sold = cfg.presale_land_sold.saturating_add(1);
emit!(PresaleLootboxPurchased {
    buyer: ctx.accounts.buyer.key(),
    kind: 1,
    purchase_id,
    price_lamports: amount,
    treasury: ctx.accounts.treasury.key(),
});
    Ok(())
}

#[derive(Accounts)]
#[instruction(purchase_id: u64)]
pub struct PresaleClaimMinerLootbox<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [
            SEED_PRESALE_RECEIPT,
            buyer.key().as_ref(),
            &[0],
            &u64_le_bytes(purchase_id)
        ],
        bump = receipt.bump,
        constraint = receipt.owner == buyer.key() @ MoeError::InvalidPresaleReceipt,
        constraint = receipt.kind == 0 @ MoeError::InvalidPresaleKind
    )]
    pub receipt: Account<'info, PresaleReceipt>,

    #[account(
    init,
    payer = buyer,
    space = LootboxMinerState::LEN,
    seeds = [SEED_LB_MINER, buyer.key().as_ref(), &[1], &u64_le_bytes(purchase_id)],
    bump
)]
pub lootbox: Account<'info, LootboxMinerState>,

    pub system_program: Program<'info, System>,
}

pub fn handler_presale_claim_miner_lootbox(
    ctx: Context<PresaleClaimMinerLootbox>,
    purchase_id: u64,
) -> Result<()> {
    let cfg = &ctx.accounts.config;
    require!(!cfg.paused, MoeError::Paused);

    let receipt = &mut ctx.accounts.receipt;
    require!(!receipt.consumed, MoeError::PresaleReceiptConsumed);

    let lootbox = &mut ctx.accounts.lootbox;
    lootbox.lootbox_id = purchase_id;
    lootbox.owner = ctx.accounts.buyer.key();
    lootbox.sale_type = 1;

    lootbox.committed = false;
    lootbox.revealed = false;

    lootbox.commit_slot = 0;
    lootbox.commitment = [0u8; 32];

    lootbox.rarity = 0;
    lootbox.element = 0;
    lootbox.hash_base = 0;

    lootbox.face = 0;
    lootbox.helmet = 0;
    lootbox.backpack = 0;
    lootbox.jacket = 0;
    lootbox.item = 0;
    lootbox.background = 0;

    lootbox.bump = ctx.bumps.lootbox;

    receipt.consumed = true;
emit!(PresaleLootboxClaimed {
    buyer: ctx.accounts.buyer.key(),
    kind: 0,
    purchase_id,
    lootbox: ctx.accounts.lootbox.key(),
});
    Ok(())
}

#[derive(Accounts)]
#[instruction(purchase_id: u64)]
pub struct PresaleClaimLandLootbox<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [
            SEED_PRESALE_RECEIPT,
            buyer.key().as_ref(),
            &[1],
            &u64_le_bytes(purchase_id)
        ],
        bump = receipt.bump,
        constraint = receipt.owner == buyer.key() @ MoeError::InvalidPresaleReceipt,
        constraint = receipt.kind == 1 @ MoeError::InvalidPresaleKind
    )]
    pub receipt: Account<'info, PresaleReceipt>,

    #[account(
    init,
    payer = buyer,
    space = LootboxLandState::LEN,
    seeds = [SEED_LB_LAND, buyer.key().as_ref(), &[1], &u64_le_bytes(purchase_id)],
    bump
)]
pub lootbox: Account<'info, LootboxLandState>,

    pub system_program: Program<'info, System>,
}

pub fn handler_presale_claim_land_lootbox(
    ctx: Context<PresaleClaimLandLootbox>,
    purchase_id: u64,
) -> Result<()> {
    let cfg = &ctx.accounts.config;
    require!(!cfg.paused, MoeError::Paused);

    let receipt = &mut ctx.accounts.receipt;
    require!(!receipt.consumed, MoeError::PresaleReceiptConsumed);

    let lootbox = &mut ctx.accounts.lootbox;
    lootbox.lootbox_id = purchase_id;
    lootbox.owner = ctx.accounts.buyer.key();
    lootbox.sale_type = 1;

    lootbox.committed = false;
    lootbox.revealed = false;

    lootbox.commit_slot = 0;
    lootbox.commitment = [0u8; 32];

    lootbox.rarity = 0;
    lootbox.element = 0;
    lootbox.slots = 0;

    lootbox.bump = ctx.bumps.lootbox;

    receipt.consumed = true;
emit!(PresaleLootboxClaimed {
    buyer: ctx.accounts.buyer.key(),
    kind: 1,
    purchase_id,
    lootbox: ctx.accounts.lootbox.key(),
});
    Ok(())
}