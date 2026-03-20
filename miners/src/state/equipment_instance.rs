use anchor_lang::prelude::*;

#[account]
pub struct EquipmentInstance {
    pub owner: Pubkey,
    pub slot: u8,
    pub level: u8,
    pub power_bps: u16,
    pub recharge_discount_bps: u16,
    pub broken: bool,
    pub remelted: bool,
    pub equipped_to_miner: Pubkey,
    pub listed: bool,
    pub active: bool,
    pub source_kind: u8,
    pub created_at: i64,
    pub bump: u8,
}

impl EquipmentInstance {
    pub const LEN: usize =
        32 +
        1 +
        1 +
        2 +
        2 +
        1 +
        1 +
        32 +
        1 +
        1 +
        1 +
        8 +
        1;
}