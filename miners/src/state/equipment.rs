use anchor_lang::prelude::*;

#[account]
pub struct EquipmentState {
    pub owner: Pubkey,
    pub miner: Pubkey,

    pub hand_equipment: Pubkey,
    pub hand_level: u8,
    pub hand_power_bps: u16,
    pub hand_is_remelted: bool,

    pub head_equipment: Pubkey,
    pub head_level: u8,
    pub head_recharge_discount_bps: u16,
    pub head_is_remelted: bool,

    pub bump: u8,
}

impl EquipmentState {
    pub const LEN: usize =
        32 + // owner
        32 + // miner

        32 + // hand_equipment
        1 +  // hand_level
        2 +  // hand_power_bps
        1 +  // hand_is_remelted

        32 + // head_equipment
        1 +  // head_level
        2 +  // head_recharge_discount_bps
        1 +  // head_is_remelted

        1;   // bump
}

#[account]
pub struct EquipmentCounter {
    pub next_id: u64,
    pub bump: u8,
}

impl EquipmentCounter {
    pub const LEN: usize = 8 + 1;
}