use anchor_lang::prelude::*;

#[account]
pub struct RebirthConfig {
    pub admin: Pubkey,
    pub ess_mint: Pubkey,
    pub recipient_wallet: Pubkey,
    pub burn_bps: u16,
    pub treasury_bps: u16,
    pub enabled: bool,
    pub min_parent_level_by_rarity: [u16; 5],
    pub ess_cost_by_rarity: [u64; 5],
    pub bump: u8,
}

impl RebirthConfig {
    pub const LEN: usize = 8 // discriminator
        + 32 // admin
        + 32 // ess_mint
        + 32 // recipient_wallet
        + 2  // burn_bps
        + 2  // treasury_bps
        + 1  // enabled
        + (2 * 5) // min_parent_level_by_rarity
        + (8 * 5) // ess_cost_by_rarity
        + 1; // bump
}
