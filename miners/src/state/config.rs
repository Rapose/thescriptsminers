use anchor_lang::prelude::*;

use anchor_lang::prelude::*;

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub paused: bool,

    pub next_miner_id: u64,
    pub next_land_id: u64,
    pub next_listing_id: u64,

    pub presale_sol_enabled: bool,
    pub public_lootbox_init_enabled: bool,

    pub presale_treasury: Pubkey,

    pub presale_miner_price_lamports: u64,
    pub presale_land_price_lamports: u64,

    pub presale_miner_sold: u64,
    pub presale_land_sold: u64,

    pub normal_miner_price_ess: u64,
    pub normal_land_price_ess: u64,

    pub bump: u8,
}

impl Config {
    pub const LEN: usize =
        8 +   // discriminator
        32 +  // admin
        1 +   // paused
        8 +   // next_miner_id
        8 +   // next_land_id
        8 +   // next_listing_id
        1 +   // presale_sol_enabled
        1 +   // public_lootbox_init_enabled
        32 +  // presale_treasury
        8 +   // presale_miner_price_lamports
        8 +   // presale_land_price_lamports
        8 +   // presale_miner_sold
        8 +   // presale_land_sold
        8 +   // normal_miner_price_ess
        8 +   // normal_land_price_ess
        1;    // bump
}
