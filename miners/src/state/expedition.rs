use anchor_lang::prelude::*;

#[account]
pub struct ExpeditionConfig {
    pub admin: Pubkey,
    pub ess_mint: Pubkey,

    // ESS cost per expedition tier (human units, not decimals-adjusted)
    pub tier_cost_ess: [u64; 5],

    // Lock duration in seconds
    pub tier_lock_secs: [u32; 5],

    // Max item chance in basis points
    // Tier I = 3500 = 35%
    pub tier_item_cap_bps: [u16; 5],

    // Level required to reach max chance
    // Tier I -> level 2, Tier II -> 4, ...
    pub tier_level_cap: [u16; 5],

    // New equipment chance by miner rarity
    // Common..Legendary
    pub new_equipment_bps_by_rarity: [u16; 5],

    pub enabled: bool,
    pub bump: u8,
}

impl ExpeditionConfig {
    pub const LEN: usize = 8
        + 32 // admin
        + 32 // ess_mint
        + (8 * 5) // tier_cost_ess
        + (4 * 5) // tier_lock_secs
        + (2 * 5) // tier_item_cap_bps
        + (2 * 5) // tier_level_cap
        + (2 * 5) // new_equipment_bps_by_rarity
        + 1 // enabled
        + 1; // bump
}

#[account]
pub struct ExpeditionSession {
    pub owner: Pubkey,
    pub miner: Pubkey,

    // 1..5
    pub tier: u8,

    // decimals-adjusted ESS actually spent
    pub ess_spent: u64,

    pub started_at: i64,
    pub ends_at: i64,

    pub bump: u8,

    // reward result
    pub reward_kind: u8,       // 0 = none, 1 = refund, 2 = equipment
    pub reward_slot: u8,       // 0 = hand, 1 = head, 255 = none
    pub reward_level: u8,      // 0 if none
    pub reward_broken: bool,
    pub reward_remelted: bool, // false for now
    pub reward_claimed: bool,
    pub refund_amount: u64,
    pub resolved_at: i64,
}

impl ExpeditionSession {
    pub const LEN: usize = 8
        + 32 // owner
        + 32 // miner
        + 1  // tier
        + 8  // ess_spent
        + 8  // started_at
        + 8  // ends_at
        + 1  // bump
        + 1  // reward_kind
        + 1  // reward_slot
        + 1  // reward_level
        + 1  // reward_broken
        + 1  // reward_remelted
        + 1  // reward_claimed
        + 8  // refund_amount
        + 8; // resolved_at
}