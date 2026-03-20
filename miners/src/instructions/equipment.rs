use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

use crate::constants::*;
use crate::errors::MoeError;
use crate::state::{
    EquipmentCounter, EquipmentInstance, EquipmentState, MinerState,
};
use crate::utils::equipment_balance::{
    hand_power_bps_by_level,
    head_discount_bps_by_level,
    remelt_cost_ess,
};

fn idx(level: u8) -> Result<usize> {
    if level < 1 {
        return err!(MoeError::InvalidBaseLevel);
    }
    let i = level as usize;
    if i > MAX_ITEM_LEVEL {
        return err!(MoeError::InvalidBaseLevel);
    }
    Ok(i)
}

fn validate_free_equipment(
    eq: &Account<EquipmentInstance>,
    owner: Pubkey,
    slot: u8,
) -> Result<()> {
    require_keys_eq!(eq.owner, owner, MoeError::Unauthorized);
    require!(eq.active, MoeError::EquipmentInactive);
    require!(!eq.listed, MoeError::EquipmentListed);
    require!(
        eq.equipped_to_miner == Pubkey::default(),
        MoeError::EquipmentMustBeFree
    );
    require!(eq.slot == slot, MoeError::EquipmentSlotMismatch);
    require!(!eq.broken, MoeError::InvalidEquipmentInstance);
    Ok(())
}

fn validate_remelt_input(
    eq: &Account<EquipmentInstance>,
    owner: Pubkey,
    slot: u8,
    level: u8,
) -> Result<()> {
    require_keys_eq!(eq.owner, owner, MoeError::Unauthorized);
    require!(eq.active, MoeError::EquipmentInactive);
    require!(!eq.listed, MoeError::EquipmentListed);
    require!(
        eq.equipped_to_miner == Pubkey::default(),
        MoeError::EquipmentMustBeFree
    );
    require!(eq.slot == slot, MoeError::EquipmentSlotMismatch);
    require!(eq.level == level, MoeError::EquipmentSetMismatch);
    require!(!eq.remelted, MoeError::InvalidEquipmentInstance);
    Ok(())
}

// =========================
// COUNTER INIT
// =========================

pub fn handler_counter_init(ctx: Context<EquipmentCounterInit>) -> Result<()> {
    let counter = &mut ctx.accounts.equipment_counter;
    counter.next_id = 1;
    counter.bump = ctx.bumps.equipment_counter;
    Ok(())
}

#[derive(Accounts)]
pub struct EquipmentCounterInit<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + EquipmentCounter::LEN,
        seeds = [SEED_EQUIPMENT_COUNTER],
        bump
    )]
    pub equipment_counter: Account<'info, EquipmentCounter>,

    pub system_program: Program<'info, System>,
}

// =========================
// INIT
// =========================

pub fn handler_init(ctx: Context<EquipmentInit>) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.miner_state.owner,
        ctx.accounts.owner.key(),
        MoeError::Unauthorized
    );
    require!(
        !ctx.accounts.miner_state.listed,
        MoeError::AssetListedLocked
    );

    let eq = &mut ctx.accounts.equipment;

    eq.owner = ctx.accounts.owner.key();
    eq.miner = ctx.accounts.miner_state.key();

    eq.hand_equipment = Pubkey::default();
    eq.hand_level = 0;
    eq.hand_power_bps = 0;
    eq.hand_is_remelted = false;

    eq.head_equipment = Pubkey::default();
    eq.head_level = 0;
    eq.head_recharge_discount_bps = 0;
    eq.head_is_remelted = false;

    eq.bump = ctx.bumps.equipment;

    Ok(())
}

#[derive(Accounts)]
pub struct EquipmentInit<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    pub miner_state: Account<'info, MinerState>,

    #[account(
        init,
        payer = owner,
        space = 8 + EquipmentState::LEN,
        seeds = [SEED_EQUIPMENT, miner_state.key().as_ref()],
        bump
    )]
    pub equipment: Account<'info, EquipmentState>,

    pub system_program: Program<'info, System>,
}

// =========================
// EQUIP HAND
// =========================

pub fn handler_equip_hand(ctx: Context<EquipmentEquipHand>) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.miner_state.owner,
        ctx.accounts.owner.key(),
        MoeError::Unauthorized
    );
    require_keys_eq!(
        ctx.accounts.equipment.owner,
        ctx.accounts.owner.key(),
        MoeError::Unauthorized
    );
    require_keys_eq!(
        ctx.accounts.equipment.miner,
        ctx.accounts.miner_state.key(),
        MoeError::InvalidMinerRef
    );
    require!(
        !ctx.accounts.miner_state.listed,
        MoeError::AssetListedLocked
    );

    let state = &mut ctx.accounts.equipment;
    require!(state.hand_level == 0, MoeError::InvalidUpgrade);

    validate_free_equipment(&ctx.accounts.new_equipment, ctx.accounts.owner.key(), 0)?;

    let new_eq = &mut ctx.accounts.new_equipment;
    new_eq.equipped_to_miner = ctx.accounts.miner_state.key();
    new_eq.listed = false;

    state.hand_equipment = new_eq.key();
    state.hand_level = new_eq.level;
    state.hand_power_bps = new_eq.power_bps;
    state.hand_is_remelted = new_eq.remelted;

    Ok(())
}

#[derive(Accounts)]
pub struct EquipmentEquipHand<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    pub miner_state: Account<'info, MinerState>,

    #[account(
        mut,
        seeds = [SEED_EQUIPMENT, miner_state.key().as_ref()],
        bump = equipment.bump
    )]
    pub equipment: Account<'info, EquipmentState>,

    #[account(mut)]
    pub new_equipment: Account<'info, EquipmentInstance>,
}

// =========================
// REPLACE HAND
// =========================

pub fn handler_replace_hand(ctx: Context<EquipmentReplaceHand>) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.miner_state.owner,
        ctx.accounts.owner.key(),
        MoeError::Unauthorized
    );
    require_keys_eq!(
        ctx.accounts.equipment.owner,
        ctx.accounts.owner.key(),
        MoeError::Unauthorized
    );
    require_keys_eq!(
        ctx.accounts.equipment.miner,
        ctx.accounts.miner_state.key(),
        MoeError::InvalidMinerRef
    );
    require!(
        !ctx.accounts.miner_state.listed,
        MoeError::AssetListedLocked
    );

    let state = &mut ctx.accounts.equipment;
    require!(state.hand_level > 0, MoeError::InvalidUpgrade);

    validate_free_equipment(&ctx.accounts.new_equipment, ctx.accounts.owner.key(), 0)?;

    let old_eq = &mut ctx.accounts.old_equipment;
    require_keys_eq!(
        old_eq.key(),
        state.hand_equipment,
        MoeError::InvalidEquipmentInstance
    );
    require_keys_eq!(old_eq.owner, ctx.accounts.owner.key(), MoeError::Unauthorized);
    require!(
        old_eq.equipped_to_miner == ctx.accounts.miner_state.key(),
        MoeError::InvalidEquipmentInstance
    );
    require!(old_eq.active, MoeError::EquipmentInactive);

    let new_eq = &mut ctx.accounts.new_equipment;
    require!(new_eq.level > state.hand_level, MoeError::InvalidUpgrade);

    old_eq.broken = true;
    old_eq.equipped_to_miner = Pubkey::default();
    old_eq.listed = false;

    new_eq.equipped_to_miner = ctx.accounts.miner_state.key();
    new_eq.listed = false;

    state.hand_equipment = new_eq.key();
    state.hand_level = new_eq.level;
    state.hand_power_bps = new_eq.power_bps;
    state.hand_is_remelted = new_eq.remelted;

    Ok(())
}

#[derive(Accounts)]
pub struct EquipmentReplaceHand<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    pub miner_state: Account<'info, MinerState>,

    #[account(
        mut,
        seeds = [SEED_EQUIPMENT, miner_state.key().as_ref()],
        bump = equipment.bump
    )]
    pub equipment: Account<'info, EquipmentState>,

    #[account(mut)]
    pub old_equipment: Account<'info, EquipmentInstance>,

    #[account(mut)]
    pub new_equipment: Account<'info, EquipmentInstance>,
}

// =========================
// EQUIP HEAD
// =========================

pub fn handler_equip_head(ctx: Context<EquipmentEquipHead>) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.miner_state.owner,
        ctx.accounts.owner.key(),
        MoeError::Unauthorized
    );
    require_keys_eq!(
        ctx.accounts.equipment.owner,
        ctx.accounts.owner.key(),
        MoeError::Unauthorized
    );
    require_keys_eq!(
        ctx.accounts.equipment.miner,
        ctx.accounts.miner_state.key(),
        MoeError::InvalidMinerRef
    );
    require!(
        !ctx.accounts.miner_state.listed,
        MoeError::AssetListedLocked
    );

    let state = &mut ctx.accounts.equipment;
    require!(state.head_level == 0, MoeError::InvalidUpgrade);

    validate_free_equipment(&ctx.accounts.new_equipment, ctx.accounts.owner.key(), 1)?;

    let new_eq = &mut ctx.accounts.new_equipment;
    new_eq.equipped_to_miner = ctx.accounts.miner_state.key();
    new_eq.listed = false;

    state.head_equipment = new_eq.key();
    state.head_level = new_eq.level;
    state.head_recharge_discount_bps = new_eq.recharge_discount_bps;
    state.head_is_remelted = new_eq.remelted;

    Ok(())
}

#[derive(Accounts)]
pub struct EquipmentEquipHead<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    pub miner_state: Account<'info, MinerState>,

    #[account(
        mut,
        seeds = [SEED_EQUIPMENT, miner_state.key().as_ref()],
        bump = equipment.bump
    )]
    pub equipment: Account<'info, EquipmentState>,

    #[account(mut)]
    pub new_equipment: Account<'info, EquipmentInstance>,
}

// =========================
// REPLACE HEAD
// =========================

pub fn handler_replace_head(ctx: Context<EquipmentReplaceHead>) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.miner_state.owner,
        ctx.accounts.owner.key(),
        MoeError::Unauthorized
    );
    require_keys_eq!(
        ctx.accounts.equipment.owner,
        ctx.accounts.owner.key(),
        MoeError::Unauthorized
    );
    require_keys_eq!(
        ctx.accounts.equipment.miner,
        ctx.accounts.miner_state.key(),
        MoeError::InvalidMinerRef
    );
    require!(
        !ctx.accounts.miner_state.listed,
        MoeError::AssetListedLocked
    );

    let state = &mut ctx.accounts.equipment;
    require!(state.head_level > 0, MoeError::InvalidUpgrade);

    validate_free_equipment(&ctx.accounts.new_equipment, ctx.accounts.owner.key(), 1)?;

    let old_eq = &mut ctx.accounts.old_equipment;
    require_keys_eq!(
        old_eq.key(),
        state.head_equipment,
        MoeError::InvalidEquipmentInstance
    );
    require_keys_eq!(old_eq.owner, ctx.accounts.owner.key(), MoeError::Unauthorized);
    require!(
        old_eq.equipped_to_miner == ctx.accounts.miner_state.key(),
        MoeError::InvalidEquipmentInstance
    );
    require!(old_eq.active, MoeError::EquipmentInactive);

    let new_eq = &mut ctx.accounts.new_equipment;
    require!(new_eq.level > state.head_level, MoeError::InvalidUpgrade);

    old_eq.broken = true;
    old_eq.equipped_to_miner = Pubkey::default();
    old_eq.listed = false;

    new_eq.equipped_to_miner = ctx.accounts.miner_state.key();
    new_eq.listed = false;

    state.head_equipment = new_eq.key();
    state.head_level = new_eq.level;
    state.head_recharge_discount_bps = new_eq.recharge_discount_bps;
    state.head_is_remelted = new_eq.remelted;

    Ok(())
}

#[derive(Accounts)]
pub struct EquipmentReplaceHead<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    pub miner_state: Account<'info, MinerState>,

    #[account(
        mut,
        seeds = [SEED_EQUIPMENT, miner_state.key().as_ref()],
        bump = equipment.bump
    )]
    pub equipment: Account<'info, EquipmentState>,

    #[account(mut)]
    pub old_equipment: Account<'info, EquipmentInstance>,

    #[account(mut)]
    pub new_equipment: Account<'info, EquipmentInstance>,
}

// =========================
// REMELT HAND
// =========================

pub fn handler_remelt_hand(ctx: Context<EquipmentRemeltHand>) -> Result<()> {
    let base_level = ctx.accounts.item_a.level;
    let ess_cost = remelt_cost_ess(base_level)?;

    let _ = idx(base_level)?;
    require!(
        (base_level as usize) < MAX_ITEM_LEVEL,
        MoeError::InvalidBaseLevel
    );

    let owner = ctx.accounts.owner.key();

    validate_remelt_input(&ctx.accounts.item_a, owner, 0, base_level)?;
    validate_remelt_input(&ctx.accounts.item_b, owner, 0, base_level)?;
    validate_remelt_input(&ctx.accounts.item_c, owner, 0, base_level)?;
    validate_remelt_input(&ctx.accounts.item_d, owner, 0, base_level)?;

    require!(ctx.accounts.item_a.key() != ctx.accounts.item_b.key(), MoeError::EquipmentSetMismatch);
    require!(ctx.accounts.item_a.key() != ctx.accounts.item_c.key(), MoeError::EquipmentSetMismatch);
    require!(ctx.accounts.item_a.key() != ctx.accounts.item_d.key(), MoeError::EquipmentSetMismatch);
    require!(ctx.accounts.item_b.key() != ctx.accounts.item_c.key(), MoeError::EquipmentSetMismatch);
    require!(ctx.accounts.item_b.key() != ctx.accounts.item_d.key(), MoeError::EquipmentSetMismatch);
    require!(ctx.accounts.item_c.key() != ctx.accounts.item_d.key(), MoeError::EquipmentSetMismatch);

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.user_ata.to_account_info(),
                to: ctx.accounts.rewards_vault.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        ess_cost,
    )?;

    ctx.accounts.item_a.active = false;
    ctx.accounts.item_a.listed = false;
    ctx.accounts.item_b.active = false;
    ctx.accounts.item_b.listed = false;
    ctx.accounts.item_c.active = false;
    ctx.accounts.item_c.listed = false;
    ctx.accounts.item_d.active = false;
    ctx.accounts.item_d.listed = false;

    let new_level = base_level + 1;
    let counter = &mut ctx.accounts.equipment_counter;

    let out = &mut ctx.accounts.output_equipment;
    out.owner = owner;
    out.slot = 0;
    out.level = new_level;
    out.power_bps = hand_power_bps_by_level(new_level)?;
    out.recharge_discount_bps = 0;
    out.broken = false;
    out.remelted = true;
    out.equipped_to_miner = Pubkey::default();
    out.listed = false;
    out.active = true;
    out.source_kind = 2;
    out.created_at = Clock::get()?.unix_timestamp;
    out.bump = ctx.bumps.output_equipment;

    counter.next_id = counter.next_id.saturating_add(1);

    Ok(())
}

#[derive(Accounts)]
pub struct EquipmentRemeltHand<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

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
        seeds = [SEED_EQUIPMENT_INSTANCE, &equipment_counter.next_id.to_le_bytes()],
        bump
    )]
    pub output_equipment: Account<'info, EquipmentInstance>,

    #[account(mut)]
    pub item_a: Account<'info, EquipmentInstance>,
    #[account(mut)]
    pub item_b: Account<'info, EquipmentInstance>,
    #[account(mut)]
    pub item_c: Account<'info, EquipmentInstance>,
    #[account(mut)]
    pub item_d: Account<'info, EquipmentInstance>,

    #[account(mut)]
    pub user_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub rewards_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// =========================
// REMELT HEAD
// =========================

pub fn handler_remelt_head(ctx: Context<EquipmentRemeltHead>) -> Result<()> {
    let base_level = ctx.accounts.item_a.level;
    let ess_cost = remelt_cost_ess(base_level)?;

    let _ = idx(base_level)?;
    require!(
        (base_level as usize) < MAX_ITEM_LEVEL,
        MoeError::InvalidBaseLevel
    );

    let owner = ctx.accounts.owner.key();

    validate_remelt_input(&ctx.accounts.item_a, owner, 1, base_level)?;
    validate_remelt_input(&ctx.accounts.item_b, owner, 1, base_level)?;
    validate_remelt_input(&ctx.accounts.item_c, owner, 1, base_level)?;
    validate_remelt_input(&ctx.accounts.item_d, owner, 1, base_level)?;

    require!(ctx.accounts.item_a.key() != ctx.accounts.item_b.key(), MoeError::EquipmentSetMismatch);
    require!(ctx.accounts.item_a.key() != ctx.accounts.item_c.key(), MoeError::EquipmentSetMismatch);
    require!(ctx.accounts.item_a.key() != ctx.accounts.item_d.key(), MoeError::EquipmentSetMismatch);
    require!(ctx.accounts.item_b.key() != ctx.accounts.item_c.key(), MoeError::EquipmentSetMismatch);
    require!(ctx.accounts.item_b.key() != ctx.accounts.item_d.key(), MoeError::EquipmentSetMismatch);
    require!(ctx.accounts.item_c.key() != ctx.accounts.item_d.key(), MoeError::EquipmentSetMismatch);

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.user_ata.to_account_info(),
                to: ctx.accounts.rewards_vault.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        ess_cost,
    )?;

    ctx.accounts.item_a.active = false;
    ctx.accounts.item_a.listed = false;
    ctx.accounts.item_b.active = false;
    ctx.accounts.item_b.listed = false;
    ctx.accounts.item_c.active = false;
    ctx.accounts.item_c.listed = false;
    ctx.accounts.item_d.active = false;
    ctx.accounts.item_d.listed = false;

    let new_level = base_level + 1;
    let counter = &mut ctx.accounts.equipment_counter;

    let out = &mut ctx.accounts.output_equipment;
    out.owner = owner;
    out.slot = 1;
    out.level = new_level;
    out.power_bps = 0;
    out.recharge_discount_bps = head_discount_bps_by_level(new_level)?;
    out.broken = false;
    out.remelted = true;
    out.equipped_to_miner = Pubkey::default();
    out.listed = false;
    out.active = true;
    out.source_kind = 2;
    out.created_at = Clock::get()?.unix_timestamp;
    out.bump = ctx.bumps.output_equipment;

    counter.next_id = counter.next_id.saturating_add(1);

    Ok(())
}

#[derive(Accounts)]
pub struct EquipmentRemeltHead<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

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
        seeds = [SEED_EQUIPMENT_INSTANCE, &equipment_counter.next_id.to_le_bytes()],
        bump
    )]
    pub output_equipment: Account<'info, EquipmentInstance>,

    #[account(mut)]
    pub item_a: Account<'info, EquipmentInstance>,
    #[account(mut)]
    pub item_b: Account<'info, EquipmentInstance>,
    #[account(mut)]
    pub item_c: Account<'info, EquipmentInstance>,
    #[account(mut)]
    pub item_d: Account<'info, EquipmentInstance>,

    #[account(mut)]
    pub user_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub rewards_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}