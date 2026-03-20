use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::*,
    errors::MoeError,
    state::{Config, EconomyConfig, LootboxLandState, LootboxMinerState},
    utils::{token_burn, token_transfer, u64_le_bytes},
};
#[event]
pub struct LootboxPurchasedEss {
    pub buyer: Pubkey,
    pub kind: u8, // 0 = miner, 1 = land
    pub lootbox_id: u64,
    pub price_ess: u64,
    pub lootbox: Pubkey,
}
fn mul_bps(amount: u64, bps: u16) -> u64 {
    (amount as u128)
        .saturating_mul(bps as u128)
        .checked_div(BPS_DENOM as u128)
        .unwrap_or(0) as u64
}

#[derive(Accounts)]
#[instruction(lootbox_id: u64)]
pub struct BuyMinerLootboxEss<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [SEED_ECONOMY],
        bump = economy.bump
    )]
    pub economy: Account<'info, EconomyConfig>,

    #[account(mut)]
    pub ess_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = user_ata.mint == ess_mint.key() @ MoeError::MintMismatch,
        constraint = user_ata.owner == buyer.key() @ MoeError::Unauthorized
    )]
    pub user_ata: Account<'info, TokenAccount>,

    /// CHECK: validado contra economy.recipient_wallet
    pub recipient_wallet: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = recipient_ata.mint == ess_mint.key() @ MoeError::MintMismatch,
        constraint = recipient_ata.owner == recipient_wallet.key() @ MoeError::RecipientMismatch
    )]
    pub recipient_ata: Account<'info, TokenAccount>,

    #[account(
    init,
    payer = buyer,
    space = LootboxMinerState::LEN,
    seeds = [SEED_LB_MINER, buyer.key().as_ref(), &[0], &u64_le_bytes(lootbox_id)],
    bump
)]
pub lootbox: Account<'info, LootboxMinerState>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(lootbox_id: u64)]
pub struct BuyLandLootboxEss<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [SEED_ECONOMY],
        bump = economy.bump
    )]
    pub economy: Account<'info, EconomyConfig>,

    #[account(mut)]
    pub ess_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = user_ata.mint == ess_mint.key() @ MoeError::MintMismatch,
        constraint = user_ata.owner == buyer.key() @ MoeError::Unauthorized
    )]
    pub user_ata: Account<'info, TokenAccount>,

    /// CHECK: validado contra economy.recipient_wallet
    pub recipient_wallet: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = recipient_ata.mint == ess_mint.key() @ MoeError::MintMismatch,
        constraint = recipient_ata.owner == recipient_wallet.key() @ MoeError::RecipientMismatch
    )]
    pub recipient_ata: Account<'info, TokenAccount>,

    #[account(
    init,
    payer = buyer,
    space = LootboxLandState::LEN,
    seeds = [SEED_LB_LAND, buyer.key().as_ref(), &[0], &u64_le_bytes(lootbox_id)],
    bump
)]
pub lootbox: Account<'info, LootboxLandState>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

fn assert_economy_buy(
    economy: &Account<EconomyConfig>,
    ess_mint: &Account<Mint>,
    recipient_wallet: &UncheckedAccount,
) -> Result<()> {
    require!(economy.ess_mint == ess_mint.key(), MoeError::MintMismatch);
    require!(
        economy.recipient_wallet == recipient_wallet.key(),
        MoeError::RecipientMismatch
    );
    Ok(())
}

fn spend_buy_inline<'info>(
    economy: &mut Account<'info, EconomyConfig>,
    token_program: &Program<'info, Token>,
    ess_mint: &Account<'info, Mint>,
    user_ata: &Account<'info, TokenAccount>,
    recipient_ata: &Account<'info, TokenAccount>,
    buyer: &Signer<'info>,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, MoeError::InvalidEssCost);

    let alloc = economy.buy;

    let burn_amt = mul_bps(amount, alloc.burn_bps);
    let liq_amt = mul_bps(amount, alloc.liquidity_bps);
    let mining_amt = mul_bps(amount, alloc.mining_pool_bps);
    let mkt_amt = mul_bps(amount, alloc.marketing_bps);
    let dev_amt = mul_bps(amount, alloc.dev_infra_bps);
    let forge_amt = mul_bps(amount, alloc.forges_bps);
    let tres_amt = mul_bps(amount, alloc.treasury_bps);

    let non_burn = liq_amt
        .saturating_add(mining_amt)
        .saturating_add(mkt_amt)
        .saturating_add(dev_amt)
        .saturating_add(forge_amt)
        .saturating_add(tres_amt);

    token_burn(
        token_program,
        ess_mint,
        user_ata,
        buyer,
        burn_amt,
    )?;

    token_transfer(
        token_program,
        user_ata,
        recipient_ata,
        buyer,
        non_burn,
    )?;

    economy.totals_buy.burn = economy.totals_buy.burn.saturating_add(burn_amt);
    economy.totals_buy.liquidity = economy.totals_buy.liquidity.saturating_add(liq_amt);
    economy.totals_buy.mining_pool = economy.totals_buy.mining_pool.saturating_add(mining_amt);
    economy.totals_buy.marketing = economy.totals_buy.marketing.saturating_add(mkt_amt);
    economy.totals_buy.dev_infra = economy.totals_buy.dev_infra.saturating_add(dev_amt);
    economy.totals_buy.forges = economy.totals_buy.forges.saturating_add(forge_amt);
    economy.totals_buy.treasury = economy.totals_buy.treasury.saturating_add(tres_amt);

    Ok(())
}

pub fn handler_buy_miner_lootbox_ess(
    ctx: Context<BuyMinerLootboxEss>,
    lootbox_id: u64,
) -> Result<()> {
    let cfg = &ctx.accounts.config;
    require!(!cfg.paused, MoeError::Paused);
    require!(cfg.normal_miner_price_ess > 0, MoeError::InvalidEssCost);

    assert_economy_buy(
        &ctx.accounts.economy,
        &ctx.accounts.ess_mint,
        &ctx.accounts.recipient_wallet,
    )?;

    let economy = &mut ctx.accounts.economy;
    spend_buy_inline(
        economy,
        &ctx.accounts.token_program,
        &ctx.accounts.ess_mint,
        &ctx.accounts.user_ata,
        &ctx.accounts.recipient_ata,
        &ctx.accounts.buyer,
        cfg.normal_miner_price_ess,
    )?;

    let lb = &mut ctx.accounts.lootbox;
    lb.lootbox_id = lootbox_id;
    lb.owner = ctx.accounts.buyer.key();
    lb.sale_type = 0;
    lb.committed = false;
    lb.revealed = false;
    lb.commit_slot = 0;
    lb.commitment = [0u8; 32];
    lb.rarity = 0;
    lb.element = 0;
    lb.hash_base = 0;
    lb.face = 0;
    lb.helmet = 0;
    lb.backpack = 0;
    lb.jacket = 0;
    lb.item = 0;
    lb.background = 0;
    lb.bump = ctx.bumps.lootbox;
emit!(LootboxPurchasedEss {
    buyer: ctx.accounts.buyer.key(),
    kind: 0,
    lootbox_id,
    price_ess: cfg.normal_miner_price_ess,
    lootbox: ctx.accounts.lootbox.key(),
});
    Ok(())
}

pub fn handler_buy_land_lootbox_ess(
    ctx: Context<BuyLandLootboxEss>,
    lootbox_id: u64,
) -> Result<()> {
    let cfg = &ctx.accounts.config;
    require!(!cfg.paused, MoeError::Paused);
    require!(cfg.normal_land_price_ess > 0, MoeError::InvalidEssCost);

    assert_economy_buy(
        &ctx.accounts.economy,
        &ctx.accounts.ess_mint,
        &ctx.accounts.recipient_wallet,
    )?;

    let economy = &mut ctx.accounts.economy;
    spend_buy_inline(
        economy,
        &ctx.accounts.token_program,
        &ctx.accounts.ess_mint,
        &ctx.accounts.user_ata,
        &ctx.accounts.recipient_ata,
        &ctx.accounts.buyer,
        cfg.normal_land_price_ess,
    )?;

    let lb = &mut ctx.accounts.lootbox;
    lb.lootbox_id = lootbox_id;
    lb.owner = ctx.accounts.buyer.key();
    lb.sale_type = 0;
    lb.committed = false;
    lb.revealed = false;
    lb.commit_slot = 0;
    lb.commitment = [0u8; 32];
    lb.rarity = 0;
    lb.element = 0;
    lb.slots = 0;
    lb.bump = ctx.bumps.lootbox;
emit!(LootboxPurchasedEss {
    buyer: ctx.accounts.buyer.key(),
    kind: 1,
    lootbox_id,
    price_ess: cfg.normal_land_price_ess,
    lootbox: ctx.accounts.lootbox.key(),
});
    Ok(())
}