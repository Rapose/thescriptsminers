use anchor_lang::prelude::*;
use solana_program::hash::hashv;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

use crate::{
    constants::{
        SEED_ECONOMY,
        SEED_EQUIPMENT_COUNTER,
        SEED_EQUIPMENT_INSTANCE,
        SEED_REWARDS_AUTH,
    },
    errors::MoeError,
    state::{
        EconomyConfig,
        EquipmentCounter,
        EquipmentInstance,
        ExpeditionConfig,
        ExpeditionSession,
        MinerProgress,
        MinerState,
    },
    utils::equipment_balance::{hand_power_bps_by_level, head_discount_bps_by_level},
    utils::seeds::SEED_MINER_PROGRESS,
    utils::token_burn,
};

pub const SEED_EXPEDITION_CONFIG: &[u8] = b"expedition_config_v1";
pub const SEED_EXPEDITION_SESSION: &[u8] = b"expedition_session_v1";

#[event]
pub struct ExpeditionStarted {
    pub owner: Pubkey,
    pub miner: Pubkey,
    pub tier: u8,
    pub ess_spent: u64,
    pub ends_at: i64,
}

#[event]
pub struct ExpeditionResolved {
    pub owner: Pubkey,
    pub miner: Pubkey,
    pub tier: u8,
    pub got_item: bool,
    pub refund_amount: u64,
    pub slot: u8,
    pub item_level: u8,
    pub broken: bool,
}

fn validate_tier(tier: u8) -> Result<()> {
    require!(tier >= 1 && tier <= 5, MoeError::InvalidExpeditionTier);
    Ok(())
}

fn required_level_for_tier(tier: u8) -> u16 {
    (tier.saturating_sub(1)) as u16
}

fn mul_bps(amount: u64, bps: u16) -> u64 {
    (amount as u128)
        .saturating_mul(bps as u128)
        .checked_div(10_000u128)
        .unwrap_or(0) as u64
}

fn rarity_hash_range(rarity: u8) -> Result<(u64, u64)> {
    match rarity {
        0 => Ok((60, 100)),
        1 => Ok((120, 225)),
        2 => Ok((300, 450)),
        3 => Ok((600, 900)),
        4 => Ok((1200, 1800)),
        _ => err!(MoeError::InvalidRarity),
    }
}

fn item_drop_chance_bps(cfg: &ExpeditionConfig, miner_level: u16, tier: u8) -> u16 {
    let i = (tier - 1) as usize;
    let cap_bps = cfg.tier_item_cap_bps[i] as u32;
    let level_cap = cfg.tier_level_cap[i].max(1) as u32;

    let effective_level = if tier == 1 {
        (miner_level as u32).max(1).min(level_cap)
    } else {
        (miner_level as u32).min(level_cap)
    };

    ((cap_bps * effective_level) / level_cap) as u16
}

fn hash_band(rarity: u8, hash_base: u64) -> Result<u8> {
    let (min_h, max_h) = rarity_hash_range(rarity)?;
    let span = max_h.saturating_sub(min_h).saturating_add(1);
    let step = (span / 3).max(1);

    let low_max = min_h.saturating_add(step).saturating_sub(1);
    let mid_max = min_h.saturating_add(step * 2).saturating_sub(1);

    if hash_base <= low_max {
        Ok(0)
    } else if hash_base <= mid_max {
        Ok(1)
    } else {
        Ok(2)
    }
}

fn pick_slot(roll_bps: u16) -> u8 {
    if roll_bps < 5000 {
        0
    } else {
        1
    }
}

fn pick_quality_level(tier: u8, band: u8, roll_bps: u16) -> u8 {
    let weights = match band {
        0 => [5500u16, 3000u16, 1500u16],
        1 => [3500u16, 3500u16, 3000u16],
        _ => [2000u16, 3000u16, 5000u16],
    };

    let idx = if roll_bps < weights[0] {
        0
    } else if roll_bps < weights[0] + weights[1] {
        1
    } else {
        2
    };

    match (tier, idx) {
        (1, 0) => 1,
        (1, 1) => 2,
        (1, 2) => 3,

        (2, 0) => 4,
        (2, 1) => 5,
        (2, 2) => 6,

        (3, 0) => 7,
        (3, 1) => 8,
        (3, 2) => 9,

        (4, 0) => 10,
        (4, 1) => 11,
        (4, 2) => 12,

        (5, 0) => 13,
        (5, 1) => 14,
        (5, 2) => 15,

        _ => 1,
    }
}

fn refund_percent_bps(roll_bps: u16) -> u16 {
    if roll_bps < 2500 {
        1000
    } else if roll_bps < 4700 {
        2000
    } else if roll_bps < 6700 {
        3000
    } else {
        4000
    }
}

#[derive(Accounts)]
pub struct ExpeditionInit<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    pub ess_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = admin,
        space = ExpeditionConfig::LEN,
        seeds = [SEED_EXPEDITION_CONFIG],
        bump
    )]
    pub expedition_config: Account<'info, ExpeditionConfig>,

    pub system_program: Program<'info, System>,
}

pub fn handler_init(ctx: Context<ExpeditionInit>) -> Result<()> {
    let cfg = &mut ctx.accounts.expedition_config;

    cfg.admin = ctx.accounts.admin.key();
    cfg.ess_mint = ctx.accounts.ess_mint.key();

    cfg.tier_cost_ess = [50, 125, 350, 700, 1400];
    cfg.tier_lock_secs = [21_600, 21_600, 43_200, 43_200, 64_800];
    cfg.tier_item_cap_bps = [3500, 3100, 2700, 2300, 1900];
    cfg.tier_level_cap = [2, 4, 6, 8, 10];
    cfg.new_equipment_bps_by_rarity = [4600, 5000, 5500, 5900, 6300];

    cfg.enabled = true;
    cfg.bump = ctx.bumps.expedition_config;

    Ok(())
}

#[derive(Accounts)]
pub struct ExpeditionUpdateConfig<'info> {
    pub admin: Signer<'info>,

    pub ess_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [SEED_EXPEDITION_CONFIG],
        bump = expedition_config.bump,
        constraint = expedition_config.admin == admin.key() @ MoeError::Unauthorized
    )]
    pub expedition_config: Account<'info, ExpeditionConfig>,
}

pub fn handler_update_config(
    ctx: Context<ExpeditionUpdateConfig>,
    tier_cost_ess: [u64; 5],
    tier_lock_secs: [u32; 5],
    tier_item_cap_bps: [u16; 5],
    tier_level_cap: [u16; 5],
    new_equipment_bps_by_rarity: [u16; 5],
    enabled: bool,
) -> Result<()> {
    let cfg = &mut ctx.accounts.expedition_config;

    cfg.ess_mint = ctx.accounts.ess_mint.key();
    cfg.tier_cost_ess = tier_cost_ess;
    cfg.tier_lock_secs = tier_lock_secs;
    cfg.tier_item_cap_bps = tier_item_cap_bps;
    cfg.tier_level_cap = tier_level_cap;
    cfg.new_equipment_bps_by_rarity = new_equipment_bps_by_rarity;
    cfg.enabled = enabled;

    Ok(())
}

#[derive(Accounts)]
pub struct ExpeditionStart<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [SEED_EXPEDITION_CONFIG],
        bump = expedition_config.bump
    )]
    pub expedition_config: Box<Account<'info, ExpeditionConfig>>,

    #[account(
        seeds = [SEED_ECONOMY],
        bump = economy.bump,
        constraint = economy.ess_mint == ess_mint.key() @ MoeError::MintMismatch
    )]
    pub economy: Box<Account<'info, EconomyConfig>>,

    #[account(
        mut,
        has_one = owner
    )]
    pub miner_state: Box<Account<'info, MinerState>>,

    #[account(
        mut,
        seeds = [SEED_MINER_PROGRESS, miner_state.key().as_ref()],
        bump = miner_progress.bump,
        constraint = miner_progress.owner == owner.key() @ MoeError::Unauthorized,
        constraint = miner_progress.miner == miner_state.key() @ MoeError::InvalidMinerProgress
    )]
    pub miner_progress: Box<Account<'info, MinerProgress>>,

    #[account(
        init,
        payer = owner,
        space = ExpeditionSession::LEN,
        seeds = [SEED_EXPEDITION_SESSION, miner_state.key().as_ref()],
        bump
    )]
    pub expedition_session: Box<Account<'info, ExpeditionSession>>,

    #[account(
        mut,
        constraint = ess_mint.key() == expedition_config.ess_mint @ MoeError::MintMismatch
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
        constraint = rewards_vault.key() == economy.rewards_vault @ MoeError::Unauthorized,
        constraint = rewards_vault.mint == ess_mint.key() @ MoeError::MintMismatch
    )]
    pub rewards_vault: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler_start(ctx: Context<ExpeditionStart>, tier: u8) -> Result<()> {
    validate_tier(tier)?;

    let cfg = &ctx.accounts.expedition_config;
    require!(cfg.enabled, MoeError::ExpeditionDisabled);

    let now_ts = Clock::get()?.unix_timestamp;

    require!(
        !ctx.accounts.miner_state.listed,
        MoeError::AssetListedLocked
    );

    require!(
        ctx.accounts.miner_state.allocated_land == Pubkey::default(),
        MoeError::ExpeditionMinerBusy
    );

    require!(
        ctx.accounts.miner_state.expedition_ends_at <= now_ts,
        MoeError::ExpeditionStillLocked
    );

    let miner_level = ctx.accounts.miner_progress.level;
    let required_level = required_level_for_tier(tier);

    require!(
        miner_level >= required_level,
        MoeError::MinerLevelTooLowForExpeditionTier
    );

    let i = (tier - 1) as usize;
    let ess_spent = cfg.tier_cost_ess[i].saturating_mul(100_000_000u64);

    let burn_amount = mul_bps(ess_spent, 6000);
    let vault_amount = ess_spent.saturating_sub(burn_amount);

    if burn_amount > 0 {
        token_burn(
            &ctx.accounts.token_program,
            &ctx.accounts.ess_mint,
            &ctx.accounts.owner_ata,
            &ctx.accounts.owner,
            burn_amount,
        )?;
    }

    if vault_amount > 0 {
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.owner_ata.to_account_info(),
                    to: ctx.accounts.rewards_vault.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            vault_amount,
        )?;
    }

    let ends_at = now_ts.saturating_add(cfg.tier_lock_secs[i] as i64);

    let miner = &mut ctx.accounts.miner_state;
    miner.expedition_ends_at = ends_at;

    let s = &mut ctx.accounts.expedition_session;
    s.owner = ctx.accounts.owner.key();
    s.miner = miner.key();
    s.tier = tier;
    s.ess_spent = ess_spent;
    s.started_at = now_ts;
    s.ends_at = ends_at;
    s.bump = ctx.bumps.expedition_session;

    emit!(ExpeditionStarted {
        owner: ctx.accounts.owner.key(),
        miner: miner.key(),
        tier,
        ess_spent,
        ends_at,
    });

    Ok(())
}
#[derive(Accounts)]
pub struct ExpeditionResolve<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut)]
    pub miner_state: Account<'info, MinerState>,

    #[account(mut)]
    pub miner_progress: Account<'info, MinerProgress>,

    #[account(
        mut,
        seeds = [SEED_EXPEDITION_SESSION, miner_state.key().as_ref()],
        bump
    )]
    pub expedition_session: Account<'info, ExpeditionSession>,

    #[account(
        mut,
        seeds = [SEED_ECONOMY],
        bump = economy.bump
    )]
    pub economy: Account<'info, EconomyConfig>,

    #[account(
        mut,
        seeds = [SEED_EXPEDITION_CONFIG],
        bump = expedition_config.bump
    )]
    pub expedition_config: Account<'info, ExpeditionConfig>,

pub token_program: Program<'info, Token>,

#[account(mut)]
pub rewards_vault: Account<'info, TokenAccount>,

/// CHECK: PDA authority for rewards vault
#[account(
    seeds = [SEED_REWARDS_AUTH],
    bump
)]
pub rewards_authority: UncheckedAccount<'info>,

#[account(mut)]
pub owner_ata: Account<'info, TokenAccount>,

}
pub fn handler_resolve(ctx: Context<ExpeditionResolve>) -> Result<()> {
    let clock = Clock::get()?;
    let now_ts = clock.unix_timestamp;

    let session = &mut ctx.accounts.expedition_session;

    require!(
        now_ts >= session.ends_at,
        MoeError::ExpeditionStillLocked
    );

    let tier = session.tier;
    let miner_level = ctx.accounts.miner_progress.level;
    let rarity = ctx.accounts.miner_state.rarity;
    let hash_base = ctx.accounts.miner_state.hash_base;
    let cfg = &ctx.accounts.expedition_config;

    let item_chance_bps = item_drop_chance_bps(cfg, miner_level, tier);

    let entropy = hashv(&[
        b"expedition_resolve_v2",
        ctx.accounts.owner.key().as_ref(),
        ctx.accounts.miner_state.key().as_ref(),
        &session.started_at.to_le_bytes(),
        &session.ends_at.to_le_bytes(),
        &clock.slot.to_le_bytes(),
    ])
    .to_bytes();

    let roll_item = u16::from_le_bytes([entropy[0], entropy[1]]) % 10_000;

    if roll_item < item_chance_bps {
        // 🎯 EQUIPMENT

        let roll_slot = u16::from_le_bytes([entropy[2], entropy[3]]) % 10_000;
        let roll_quality = u16::from_le_bytes([entropy[4], entropy[5]]) % 10_000;
        let roll_state = u16::from_le_bytes([entropy[6], entropy[7]]) % 10_000;

        let slot = pick_slot(roll_slot);
        let band = hash_band(rarity, hash_base)?;
        let item_level = pick_quality_level(tier, band, roll_quality);

        let new_bps = cfg.new_equipment_bps_by_rarity[rarity as usize];
        let broken = roll_state >= new_bps;

        session.reward_kind = 2;
        session.reward_slot = slot;
        session.reward_level = item_level;
        session.reward_broken = broken;
        session.reward_remelted = false;
        session.reward_claimed = false;
        session.refund_amount = 0;
        session.resolved_at = now_ts;

        // libera miner
        ctx.accounts.miner_state.expedition_ends_at = 0;
    } else {
        // 💸 REFUND

        let roll_refund = u16::from_le_bytes([entropy[8], entropy[9]]) % 8500;
        let refund_bps = refund_percent_bps(roll_refund);

        let refund_amount = mul_bps(session.ess_spent, refund_bps);

        if refund_amount > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    token::Transfer {
                        from: ctx.accounts.rewards_vault.to_account_info(),
                        to: ctx.accounts.owner_ata.to_account_info(),
                        authority: ctx.accounts.rewards_authority.to_account_info(),
                    },
                    &[&[SEED_REWARDS_AUTH, &[ctx.bumps.rewards_authority]]],
                ),
                refund_amount,
            )?;
        }

        session.reward_kind = 1;
        session.reward_claimed = true;
        session.refund_amount = refund_amount;
        session.resolved_at = now_ts;

        ctx.accounts.miner_state.expedition_ends_at = 0;
    }

    Ok(())
}

#[derive(Accounts)]
pub struct ExpeditionClaimEquipment<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut)]
    pub miner_state: Account<'info, MinerState>,

    #[account(
        mut,
        seeds = [SEED_EXPEDITION_SESSION, miner_state.key().as_ref()],
        bump
    )]
    pub expedition_session: Account<'info, ExpeditionSession>,

    #[account(
        mut,
        seeds = [SEED_EQUIPMENT_COUNTER],
        bump = equipment_counter.bump
    )]
    pub equipment_counter: Account<'info, EquipmentCounter>,

    #[account(
        init,
        payer = owner,
        space = 8 + EquipmentInstance::LEN,
        seeds = [
            SEED_EQUIPMENT_INSTANCE,
            &equipment_counter.next_id.to_le_bytes()
        ],
        bump
    )]
    pub equipment_instance: Account<'info, EquipmentInstance>,

    pub system_program: Program<'info, System>,
}

pub fn handler_claim_equipment(ctx: Context<ExpeditionClaimEquipment>) -> Result<()> {
    let session = &mut ctx.accounts.expedition_session;

    require!(session.reward_kind == 2, MoeError::InvalidReward);
    require!(!session.reward_claimed, MoeError::AlreadyClaimed);

    let eq = &mut ctx.accounts.equipment_instance;

    eq.owner = ctx.accounts.owner.key();
    eq.slot = session.reward_slot;
    eq.level = session.reward_level;
    eq.broken = session.reward_broken;
    eq.remelted = session.reward_remelted;
    eq.equipped_to_miner = Pubkey::default();
    eq.listed = false;
    eq.active = true;
    eq.source_kind = 1;
    eq.created_at = Clock::get()?.unix_timestamp;
    eq.bump = ctx.bumps.equipment_instance;

    if eq.slot == 0 {
        eq.power_bps = hand_power_bps_by_level(eq.level)?;
        eq.recharge_discount_bps = 0;
    } else {
        eq.power_bps = 0;
        eq.recharge_discount_bps = head_discount_bps_by_level(eq.level)?;
    }

    ctx.accounts.equipment_counter.next_id += 1;
    session.reward_claimed = true;

    Ok(())
}