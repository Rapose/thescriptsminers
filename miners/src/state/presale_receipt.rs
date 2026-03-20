use anchor_lang::prelude::*;

#[account]
pub struct PresaleReceipt {
    pub owner: Pubkey,
    pub kind: u8, // 0 = miner, 1 = land
    pub purchase_id: u64,
    pub consumed: bool,
    pub price_lamports: u64,
    pub created_at: i64,
    pub bump: u8,
}

impl PresaleReceipt {
    pub const LEN: usize =
        8 +   // discriminator
        32 +  // owner
        1 +   // kind
        8 +   // purchase_id
        1 +   // consumed
        8 +   // price_lamports
        8 +   // created_at
        1;    // bump
}