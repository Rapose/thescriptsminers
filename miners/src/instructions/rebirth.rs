use anchor_lang::prelude::*;
use solana_program::hash::hashv;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::{BPS_DENOM, ELEMENTS, RARITIES, SEED_CONFIG, SEED_MINER},
    errors::MoeError,
    state::{Config, MinerProgress, MinerState, RebirthConfig},
    utils::{token_burn, token_transfer, u64_le_bytes, SEED_MINER_PROGRESS},
};

pub const SEED_REBIRTH: &[u8] = b"rebirth_v1";

#[event]
pub struct MinerRebirthEvent {
    pub owner: Pubkey,
    pub parent_a: Pubkey,
    pub parent_b: Pubkey,
    pub child: Pubkey,
    pub parent_rarity: u8,
    pub child_rarity: u8,
    pub child_hash_base: u64,
    pub ess_cost: u64,
}

fn rarity_hash_range(rarity: u8) -> Result<(u64, u64)> {
    match rarity {
        0 => Ok((60, 100)),
        1 => Ok((120, 180)),
        2 => Ok((300, 450)),
        3 => Ok((600, 900)),
        4 => Ok((1200, 1600)),
        _ => err!(MoeError::InvalidRarity),
    }
}

fn compute_rebirth_hash(
    parent_a: u64,
    parent_b: u64,
    next_rarity: u8,
    entropy: &[u8; 32],
) -> Result<u64> {
    let sum = parent_a.saturating_add(parent_b);
    let (min_next, max_next) = rarity_hash_range(next_rarity)?;

    let unclamped_low = sum.max(min_next);
    let low = unclamped_low.min(max_next);
    let high = max_next;

    let span = high.saturating_sub(low).saturating_add(1);
    let roll = u16::from_le_bytes([entropy[0], entropy[1]]) as u64 % span;

    Ok(low.saturating_add(roll))
}

fn pick_background(rarity: u8, dna_byte: u8) -> u8 {
    match rarity {
        0 => dna_byte % 3,
        1 => 3 + (dna_byte % 3),
        2 => 6 + (dna_byte % 3),
        3 => 9 + (dna_byte % 2),
        4 => 11,
        _ => 0,
    }
}

fn pick_visuals(
    rarity: u8,
    element_a: u8,
    element_b: u8,
    dna: &[u8; 32],
) -> (u8, u8, u8, u8, u8, u8, u8) {
    let element = match dna[1] % 3 {
        0 => element_a,
        1 => element_b,
        _ => dna[1] % ELEMENTS,
    };

    let mut face = dna[2] % 12;
    let mut helmet = dna[3] % 12;
    let mut backpack = dna[4] % 12;
    let mut jacket = dna[5] % 3;
    let mut item = dna[6] % 12;
    let background = pick_background(rarity, dna[7]);

    match rarity {
        0 => {
            helmet = 0;
            backpack = 0;
            jacket = 0;
            item = 0;
        }
        1 => {
            backpack = 0;
            jacket = 0;
            item = 0;
        }
        2 => {
            jacket = 0;
            item = 0;
        }
        3 => {
            item = 0;
        }
        4 => {
            if face == 0 {
                face = 1 + (dna[2] % 11);
            }
            if helmet == 0 {
                helmet = 1 + (dna[3] % 11);
            }
            if backpack == 0 {
                backpack = 1 + (dna[4] % 11);
            }
            if item == 0 {
                item = 1 + (dna[6] % 11);
            }
        }
        _ => {}
    }

    (face, element, helmet, backpack, jacket, item, background)
}

fn calc_bps_amount(amount: u64, bps: u16) -> u64 {
    (amount as u128)
        .saturating_mul(bps as u128)
        .checked_div(BPS_DENOM as u128)
        .unwrap_or(0) as u64
}

#[derive(Accounts)]
pub struct RebirthInit<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    pub ess_mint: Account<'info, Mint>,

    /// CHECK: armazenado apenas como pubkey
    pub recipient_wallet: UncheckedAccount<'info>,

    #[account(
        init,
        payer = admin,
        space = RebirthConfig::LEN,
        seeds = [SEED_REBIRTH],
        bump
    )]
    pub rebirth_config: Account<'info, RebirthConfig>,

    pub system_program: Program<'info, System>,
}

pub fn handler_init(
    ctx: Context<RebirthInit>,
    burn_bps: u16,
    treasury_bps: u16,
    min_parent_level_by_rarity: [u16; 5],
    ess_cost_by_rarity: [u64; 5],
) -> Result<()> {
    require!(
        burn_bps as u64 + treasury_bps as u64 == BPS_DENOM,
        MoeError::InvalidBpsSum
    );

    let cfg = &mut ctx.accounts.rebirth_config;
    cfg.admin = ctx.accounts.admin.key();
    cfg.ess_mint = ctx.accounts.ess_mint.key();
    cfg.recipient_wallet = ctx.accounts.recipient_wallet.key();
    cfg.burn_bps = burn_bps;
    cfg.treasury_bps = treasury_bps;
    cfg.enabled = true;
    cfg.min_parent_level_by_rarity = min_parent_level_by_rarity;
    cfg.ess_cost_by_rarity = ess_cost_by_rarity;
    cfg.bump = ctx.bumps.rebirth_config;

    Ok(())
}

#[derive(Accounts)]
pub struct RebirthUpdateConfig<'info> {
    pub admin: Signer<'info>,

    pub ess_mint: Account<'info, Mint>,

    /// CHECK: armazenado apenas como pubkey
    pub recipient_wallet: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [SEED_REBIRTH],
        bump = rebirth_config.bump,
        constraint = rebirth_config.admin == admin.key() @ MoeError::Unauthorized
    )]
    pub rebirth_config: Account<'info, RebirthConfig>,
}

pub fn handler_update_config(
    ctx: Context<RebirthUpdateConfig>,
    burn_bps: u16,
    treasury_bps: u16,
    enabled: bool,
    min_parent_level_by_rarity: [u16; 5],
    ess_cost_by_rarity: [u64; 5],
) -> Result<()> {
    require!(
        burn_bps as u64 + treasury_bps as u64 == BPS_DENOM,
        MoeError::InvalidBpsSum
    );

    let cfg = &mut ctx.accounts.rebirth_config;
    cfg.ess_mint = ctx.accounts.ess_mint.key();
    cfg.recipient_wallet = ctx.accounts.recipient_wallet.key();
    cfg.burn_bps = burn_bps;
    cfg.treasury_bps = treasury_bps;
    cfg.enabled = enabled;
    cfg.min_parent_level_by_rarity = min_parent_level_by_rarity;
    cfg.ess_cost_by_rarity = ess_cost_by_rarity;

    Ok(())
}

#[derive(Accounts)]
pub struct RebirthMiner<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [SEED_CONFIG],
        bump = config.bump
    )]
    pub config: Box<Account<'info, Config>>,

    #[account(
        seeds = [SEED_REBIRTH],
        bump = rebirth_config.bump
    )]
    pub rebirth_config: Box<Account<'info, RebirthConfig>>,

    #[account(
        mut,
        has_one = owner,
        close = owner
    )]
    pub parent_a_state: Box<Account<'info, MinerState>>,

    #[account(
        mut,
        has_one = owner,
        close = owner
    )]
    pub parent_b_state: Box<Account<'info, MinerState>>,

    #[account(
        mut,
        close = owner,
        seeds = [SEED_MINER_PROGRESS, parent_a_state.key().as_ref()],
        bump = parent_a_progress.bump,
        constraint = parent_a_progress.owner == owner.key() @ MoeError::Unauthorized,
        constraint = parent_a_progress.miner == parent_a_state.key() @ MoeError::InvalidMinerProgress
    )]
    pub parent_a_progress: Box<Account<'info, MinerProgress>>,

    #[account(
        mut,
        close = owner,
        seeds = [SEED_MINER_PROGRESS, parent_b_state.key().as_ref()],
        bump = parent_b_progress.bump,
        constraint = parent_b_progress.owner == owner.key() @ MoeError::Unauthorized,
        constraint = parent_b_progress.miner == parent_b_state.key() @ MoeError::InvalidMinerProgress
    )]
    pub parent_b_progress: Box<Account<'info, MinerProgress>>,

    #[account(
        init,
        payer = owner,
        space = 8 + MinerState::LEN,
        seeds = [SEED_MINER, owner.key().as_ref(), &u64_le_bytes(config.next_miner_id)],
        bump
    )]
    pub child_state: Box<Account<'info, MinerState>>,

    #[account(
        init,
        payer = owner,
        space = 8 + MinerProgress::LEN,
        seeds = [SEED_MINER_PROGRESS, child_state.key().as_ref()],
        bump
    )]
    pub child_progress: Box<Account<'info, MinerProgress>>,

    #[account(
        mut,
        constraint = ess_mint.key() == rebirth_config.ess_mint @ MoeError::MintMismatch
    )]
    pub ess_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        constraint = owner_ata.owner == owner.key() @ MoeError::Unauthorized,
        constraint = owner_ata.mint == ess_mint.key() @ MoeError::MintMismatch
    )]
    pub owner_ata: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = recipient_ata.owner == rebirth_config.recipient_wallet @ MoeError::RecipientMismatch,
        constraint = recipient_ata.mint == ess_mint.key() @ MoeError::MintMismatch
    )]
    pub recipient_ata: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler_rebirth(ctx: Context<RebirthMiner>) -> Result<()> {
    let owner_key = ctx.accounts.owner.key();
    let rebirth_cfg = &ctx.accounts.rebirth_config;
    let now_ts = Clock::get()?.unix_timestamp;

    require!(rebirth_cfg.enabled, MoeError::RebirthDisabled);
    require!(
        ctx.accounts.parent_a_state.key() != ctx.accounts.parent_b_state.key(),
        MoeError::RebirthSameParent
    );

    let parent_rarity = ctx.accounts.parent_a_state.rarity;
    require!(parent_rarity < (RARITIES - 1), MoeError::RebirthMaxRarity);
    require!(
        ctx.accounts.parent_b_state.rarity == parent_rarity,
        MoeError::RebirthRarityMismatch
    );

    require!(
        !ctx.accounts.parent_a_state.listed,
        MoeError::AssetListedLocked
    );
    require!(
        !ctx.accounts.parent_b_state.listed,
        MoeError::AssetListedLocked
    );

    require!(
        ctx.accounts.parent_a_state.allocated_land == Pubkey::default(),
        MoeError::RebirthParentBusy
    );
    require!(
        ctx.accounts.parent_b_state.allocated_land == Pubkey::default(),
        MoeError::RebirthParentBusy
    );

    let min_level = rebirth_cfg.min_parent_level_by_rarity[parent_rarity as usize];
    require!(
        ctx.accounts.parent_a_progress.level >= min_level,
        MoeError::RebirthParentLevelTooLow
    );
    require!(
        ctx.accounts.parent_b_progress.level >= min_level,
        MoeError::RebirthParentLevelTooLow
    );

    let ess_cost = rebirth_cfg.ess_cost_by_rarity[parent_rarity as usize];
    let burn_amount = calc_bps_amount(ess_cost, rebirth_cfg.burn_bps);
    let treasury_amount = ess_cost.saturating_sub(burn_amount);

    if burn_amount > 0 {
        token_burn(
            &ctx.accounts.token_program,
            &ctx.accounts.ess_mint,
            &ctx.accounts.owner_ata,
            &ctx.accounts.owner,
            burn_amount,
        )?;
    }

    if treasury_amount > 0 {
        token_transfer(
            &ctx.accounts.token_program,
            &ctx.accounts.owner_ata,
            &ctx.accounts.recipient_ata,
            &ctx.accounts.owner,
            treasury_amount,
        )?;
    }

    let next_rarity = parent_rarity.saturating_add(1);
    let cfg = &mut ctx.accounts.config;
    let child_id = cfg.next_miner_id;

    let entropy = hashv(&[
        b"rebirth_v1_entropy",
        owner_key.as_ref(),
        ctx.accounts.parent_a_state.key().as_ref(),
        ctx.accounts.parent_b_state.key().as_ref(),
        &ctx.accounts.parent_a_state.hash_base.to_le_bytes(),
        &ctx.accounts.parent_b_state.hash_base.to_le_bytes(),
        &child_id.to_le_bytes(),
        &now_ts.to_le_bytes(),
    ])
    .to_bytes();

    let child_hash_base = compute_rebirth_hash(
        ctx.accounts.parent_a_state.hash_base,
        ctx.accounts.parent_b_state.hash_base,
        next_rarity,
        &entropy,
    )?;

    let (face, element, helmet, backpack, jacket, item, background) = pick_visuals(
        next_rarity,
        ctx.accounts.parent_a_state.element,
        ctx.accounts.parent_b_state.element,
        &entropy,
    );

        let child = &mut ctx.accounts.child_state;
    child.id = child_id;
    child.owner = owner_key;
    child.rarity = next_rarity;
    child.element = element;
    child.hash_base = child_hash_base;
    child.face = face;
    child.helmet = helmet;
    child.backpack = backpack;
    child.jacket = jacket;
    child.item = item;
    child.background = background;
    child.allocated_land = Pubkey::default();
    child.listed = false;
    child.expedition_ends_at = 0;
    child.created_at = now_ts;
    child.bump = ctx.bumps.child_state;

    let inherited_level = ((ctx.accounts.parent_a_progress.level as u32
        + ctx.accounts.parent_b_progress.level as u32)
        / 2) as u16;

    let child_progress = &mut ctx.accounts.child_progress;
    child_progress.miner = child.key();
    child_progress.owner = owner_key;
    child_progress.level = inherited_level;
    child_progress.exp = 0;
    child_progress.last_exp_claim_ts = now_ts;
    child_progress.bump = ctx.bumps.child_progress;

    cfg.next_miner_id = cfg.next_miner_id.saturating_add(1);

    emit!(MinerRebirthEvent {
        owner: owner_key,
        parent_a: ctx.accounts.parent_a_state.key(),
        parent_b: ctx.accounts.parent_b_state.key(),
        child: child.key(),
        parent_rarity,
        child_rarity: next_rarity,
        child_hash_base,
        ess_cost,
    });

    Ok(())
}