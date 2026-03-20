use anchor_lang::prelude::*;

#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum ListingAssetKind {
    Miner = 1,
    Land = 2,
    Equipment = 3,
}

#[account]
pub struct ListingState {
    pub id: u64,
    pub seller: Pubkey,
    pub active: bool,
    pub asset_kind: u8,
    pub price_ess: u64,
    pub created_at: i64,

    pub miner: Pubkey,
    pub land: Pubkey,
    pub equipment: Pubkey,

    pub bump: u8,
}

impl ListingState {
    pub const LEN: usize =
        8 +  // id
        32 + // seller
        1 +  // active
        1 +  // asset_kind
        8 +  // price_ess
        8 +  // created_at
        32 + // miner
        32 + // land
        32 + // equipment
        1;   // bump
}