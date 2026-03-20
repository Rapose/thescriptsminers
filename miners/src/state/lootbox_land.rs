use anchor_lang::prelude::*;

#[account]
pub struct LootboxLandState {
    pub lootbox_id: u64,
    pub owner: Pubkey,

    pub sale_type: u8, // 0 = normal, 1 = founder

    pub committed: bool,
    pub revealed: bool,

    pub commit_slot: u64,
    pub commitment: [u8; 32],

    pub rarity: u8,
    pub element: u8,
    pub slots: u8,

    pub bump: u8,
}

impl LootboxLandState {
    pub const LEN: usize =
        8 +  // discriminator
        8 +  // lootbox_id
        32 + // owner
        1 +  // sale_type
        1 +  // committed
        1 +  // revealed
        8 +  // commit_slot
        32 + // commitment
        1 +  // rarity
        1 +  // element
        1 +  // slots
        1;   // bump
}