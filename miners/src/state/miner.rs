use anchor_lang::prelude::*;

#[account]
pub struct MinerState {
    pub id: u64,
    pub owner: Pubkey,
    pub rarity: u8,  // 0..4
    pub element: u8, // 0..4
    pub hash_base: u64,
    pub face: u8,
    pub helmet: u8,
    pub backpack: u8,
    pub jacket: u8,
    pub item: u8,
    pub background: u8,

    pub allocated_land: Pubkey,
    pub listed: bool,

    // 0 = livre
    // > now = miner em expedition
    pub expedition_ends_at: i64,

    pub created_at: i64,
    pub bump: u8,
}

impl MinerState {
    pub const LEN: usize =
        8 +  // discriminator
        8 +  // id
        32 + // owner
        1 +  // rarity
        1 +  // element
        8 +  // hash_base
        1 +  // face
        1 +  // helmet
        1 +  // backpack
        1 +  // jacket
        1 +  // item
        1 +  // background
        32 + // allocated_land
        1 +  // listed
        8 +  // expedition_ends_at
        8 +  // created_at
        1;   // bump
}