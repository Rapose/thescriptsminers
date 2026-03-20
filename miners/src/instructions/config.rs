use crate::{constants::*, errors::MoeError, state::Config};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = Config::LEN,
        seeds = [SEED_CONFIG],
        bump
    )]
    pub config: Account<'info, Config>,

    pub system_program: Program<'info, System>,
}

pub fn handler_initialize_config(ctx: Context<InitializeConfig>) -> Result<()> {
    let cfg = &mut ctx.accounts.config;
    cfg.admin = ctx.accounts.admin.key();
    cfg.paused = false;

    cfg.next_miner_id = 0;
    cfg.next_land_id = 0;
    cfg.next_listing_id = 0;

    cfg.presale_sol_enabled = false;
    cfg.public_lootbox_init_enabled = false;

    cfg.presale_treasury = ctx.accounts.admin.key();

    cfg.presale_miner_price_lamports = 0;
    cfg.presale_land_price_lamports = 0;

    cfg.presale_miner_sold = 0;
    cfg.presale_land_sold = 0;


    cfg.normal_miner_price_ess = 0;
    cfg.normal_land_price_ess = 0;

    cfg.bump = ctx.bumps.config;
    Ok(())
}


#[derive(Accounts)]
pub struct SetNormalLootboxPricesEss<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [SEED_CONFIG],
        bump = config.bump,
        constraint = config.admin == admin.key() @ MoeError::Unauthorized
    )]
    pub config: Account<'info, Config>,
}

pub fn handler_set_normal_lootbox_prices_ess(
    ctx: Context<SetNormalLootboxPricesEss>,
    normal_miner_price_ess: u64,
    normal_land_price_ess: u64,
) -> Result<()> {
    let cfg = &mut ctx.accounts.config;
    cfg.normal_miner_price_ess = normal_miner_price_ess;
    cfg.normal_land_price_ess = normal_land_price_ess;
    Ok(())
}

#[derive(Accounts)]
pub struct SetPaused<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [SEED_CONFIG],
        bump = config.bump,
        constraint = config.admin == admin.key() @ MoeError::Unauthorized
    )]
    pub config: Account<'info, Config>,
}

pub fn handler_set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
    ctx.accounts.config.paused = paused;
    Ok(())
}

#[derive(Accounts)]
pub struct SetPresaleConfig<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [SEED_CONFIG],
        bump = config.bump,
        constraint = config.admin == admin.key() @ MoeError::Unauthorized
    )]
    pub config: Account<'info, Config>,
}

pub fn handler_set_presale_config(
    ctx: Context<SetPresaleConfig>,
    presale_sol_enabled: bool,
    public_lootbox_init_enabled: bool,
    presale_treasury: Pubkey,
    presale_miner_price_lamports: u64,
    presale_land_price_lamports: u64,
) -> Result<()> {
    let cfg = &mut ctx.accounts.config;

    cfg.presale_sol_enabled = presale_sol_enabled;
    cfg.public_lootbox_init_enabled = public_lootbox_init_enabled;
    cfg.presale_treasury = presale_treasury;
    cfg.presale_miner_price_lamports = presale_miner_price_lamports;
    cfg.presale_land_price_lamports = presale_land_price_lamports;

    Ok(())
}

#[derive(Accounts)]
pub struct SetNextListingId<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [SEED_CONFIG],
        bump = config.bump,
        constraint = config.admin == admin.key() @ MoeError::Unauthorized
    )]
    pub config: Account<'info, Config>,
}

pub fn handler_set_next_listing_id(
    ctx: Context<SetNextListingId>,
    next_listing_id: u64,
) -> Result<()> {
    let cfg = &mut ctx.accounts.config;
    cfg.next_listing_id = next_listing_id;
    Ok(())
}