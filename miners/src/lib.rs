#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;

use crate::instructions::affinity::ComputeAffinity;
use instructions::*;

declare_id!("FRGTMbBV8dAVRxqhDpy2h1DGsr7DcAeHij2BaBEwUYCa");

#[program]
pub mod moe_anchor_v1 {
    use super::*;
pub fn expedition_claim_equipment(ctx: Context<ExpeditionClaimEquipment>) -> Result<()> {
    instructions::expedition::handler_claim_equipment(ctx)
}
pub fn equipment_counter_init(ctx: Context<EquipmentCounterInit>) -> Result<()> {
    instructions::equipment::handler_counter_init(ctx)
}

pub fn equipment_init(ctx: Context<EquipmentInit>) -> Result<()> {
    instructions::equipment::handler_init(ctx)
}

pub fn equipment_equip_hand(ctx: Context<EquipmentEquipHand>) -> Result<()> {
    instructions::equipment::handler_equip_hand(ctx)
}

pub fn equipment_replace_hand(ctx: Context<EquipmentReplaceHand>) -> Result<()> {
    instructions::equipment::handler_replace_hand(ctx)
}

pub fn equipment_equip_head(ctx: Context<EquipmentEquipHead>) -> Result<()> {
    instructions::equipment::handler_equip_head(ctx)
}

pub fn equipment_replace_head(ctx: Context<EquipmentReplaceHead>) -> Result<()> {
    instructions::equipment::handler_replace_head(ctx)
}

pub fn equipment_remelt_hand(ctx: Context<EquipmentRemeltHand>) -> Result<()> {
    instructions::equipment::handler_remelt_hand(ctx)
}

pub fn equipment_remelt_head(ctx: Context<EquipmentRemeltHead>) -> Result<()> {
    instructions::equipment::handler_remelt_head(ctx)
}

pub fn buy_miner_lootbox_ess(
    ctx: Context<BuyMinerLootboxEss>,
    lootbox_id: u64,
) -> Result<()> {
    instructions::buy_lootbox_ess::handler_buy_miner_lootbox_ess(ctx, lootbox_id)
}

pub fn buy_land_lootbox_ess(
    ctx: Context<BuyLandLootboxEss>,
    lootbox_id: u64,
) -> Result<()> {
    instructions::buy_lootbox_ess::handler_buy_land_lootbox_ess(ctx, lootbox_id)
}


    pub fn set_normal_lootbox_prices_ess(
    ctx: Context<SetNormalLootboxPricesEss>,
    normal_miner_price_ess: u64,
    normal_land_price_ess: u64,
) -> Result<()> {
    instructions::config::handler_set_normal_lootbox_prices_ess(
        ctx,
        normal_miner_price_ess,
        normal_land_price_ess,
    )
}
pub fn presale_purchase_miner_lootbox_sol(
    ctx: Context<PresalePurchaseMinerLootboxSol>,
    purchase_id: u64,
) -> Result<()> {
    instructions::presale::handler_presale_purchase_miner_lootbox_sol(ctx, purchase_id)
}

pub fn presale_purchase_land_lootbox_sol(
    ctx: Context<PresalePurchaseLandLootboxSol>,
    purchase_id: u64,
) -> Result<()> {
    instructions::presale::handler_presale_purchase_land_lootbox_sol(ctx, purchase_id)
}

pub fn presale_claim_miner_lootbox(
    ctx: Context<PresaleClaimMinerLootbox>,
    purchase_id: u64,
) -> Result<()> {
    instructions::presale::handler_presale_claim_miner_lootbox(ctx, purchase_id)
}

pub fn presale_claim_land_lootbox(
    ctx: Context<PresaleClaimLandLootbox>,
    purchase_id: u64,
) -> Result<()> {
    instructions::presale::handler_presale_claim_land_lootbox(ctx, purchase_id)
}



    pub fn set_presale_config(
    ctx: Context<SetPresaleConfig>,
    presale_sol_enabled: bool,
    public_lootbox_init_enabled: bool,
    presale_treasury: Pubkey,
    presale_miner_price_lamports: u64,
    presale_land_price_lamports: u64,
) -> Result<()> {
    instructions::config::handler_set_presale_config(
        ctx,
        presale_sol_enabled,
        public_lootbox_init_enabled,
        presale_treasury,
        presale_miner_price_lamports,
        presale_land_price_lamports,
    )
}
pub fn expedition_update_config(
    ctx: Context<ExpeditionUpdateConfig>,
    tier_cost_ess: [u64; 5],
    tier_lock_secs: [u32; 5],
    tier_item_cap_bps: [u16; 5],
    tier_level_cap: [u16; 5],
    new_equipment_bps_by_rarity: [u16; 5],
    enabled: bool,
) -> Result<()> {
    instructions::expedition::handler_update_config(
        ctx,
        tier_cost_ess,
        tier_lock_secs,
        tier_item_cap_bps,
        tier_level_cap,
        new_equipment_bps_by_rarity,
        enabled,
    )
}
    pub fn expedition_resolve(ctx: Context<ExpeditionResolve>) -> Result<()> {
    instructions::expedition::handler_resolve(ctx)
}
pub fn expedition_init(ctx: Context<ExpeditionInit>) -> Result<()> {
    instructions::expedition::handler_init(ctx)
}

pub fn expedition_start(ctx: Context<ExpeditionStart>, tier: u8) -> Result<()> {
    instructions::expedition::handler_start(ctx, tier)
}
pub fn rebirth_init(
    ctx: Context<RebirthInit>,
    burn_bps: u16,
    treasury_bps: u16,
    min_parent_level_by_rarity: [u16; 5],
    ess_cost_by_rarity: [u64; 5],
) -> Result<()> {
    instructions::rebirth::handler_init(
        ctx,
        burn_bps,
        treasury_bps,
        min_parent_level_by_rarity,
        ess_cost_by_rarity,
    )
}

pub fn rebirth_update_config(
    ctx: Context<RebirthUpdateConfig>,
    burn_bps: u16,
    treasury_bps: u16,
    enabled: bool,
    min_parent_level_by_rarity: [u16; 5],
    ess_cost_by_rarity: [u64; 5],
) -> Result<()> {
    instructions::rebirth::handler_update_config(
        ctx,
        burn_bps,
        treasury_bps,
        enabled,
        min_parent_level_by_rarity,
        ess_cost_by_rarity,
    )
}

pub fn rebirth_miner(ctx: Context<RebirthMiner>) -> Result<()> {
    instructions::rebirth::handler_rebirth(ctx)
}

    pub fn marketplace_create_miner_listing(
        ctx: Context<MarketplaceCreateMinerListing>,
        price_ess: u64,
    ) -> Result<()> {
        instructions::marketplace::handler_create_miner_listing(ctx, price_ess)
    }

    pub fn marketplace_create_land_listing(
        ctx: Context<MarketplaceCreateLandListing>,
        price_ess: u64,
    ) -> Result<()> {
        instructions::marketplace::handler_create_land_listing(ctx, price_ess)
    }


    pub fn marketplace_cancel_miner_listing(
        ctx: Context<MarketplaceCancelMinerListing>,
    ) -> Result<()> {
        instructions::marketplace::handler_cancel_miner_listing(ctx)
    }

    pub fn marketplace_cancel_land_listing(
        ctx: Context<MarketplaceCancelLandListing>,
    ) -> Result<()> {
        instructions::marketplace::handler_cancel_land_listing(ctx)
    }

    pub fn marketplace_buy_miner_listing(ctx: Context<MarketplaceBuyMinerListing>) -> Result<()> {
        instructions::marketplace::handler_buy_miner_listing(ctx)
    }

    pub fn marketplace_buy_land_listing(ctx: Context<MarketplaceBuyLandListing>) -> Result<()> {
        instructions::marketplace::handler_buy_land_listing(ctx)
    }

    pub fn global_mining_freeze_week(ctx: Context<GlobalMiningFreezeWeek>) -> Result<()> {
        instructions::global_mining::handler_freeze_week(ctx)
    }

    pub fn global_mining_init(
        ctx: Context<GlobalMiningInit>,
        tick_len_sec: u32,
        weekly_pool_amount: u64,
    ) -> Result<()> {
        instructions::global_mining::handler_init(ctx, tick_len_sec, weekly_pool_amount)
    }

    pub fn global_mining_rollover_week(
        ctx: Context<GlobalMiningRolloverWeek>,
        new_weekly_pool_amount: u64,
    ) -> Result<()> {
        instructions::global_mining::handler_rollover_week(ctx, new_weekly_pool_amount)
    }

    pub fn global_mining_register_miner(ctx: Context<GlobalMiningRegisterMiner>) -> Result<()> {
        instructions::global_mining::handler_register_miner(ctx)
    }

    pub fn global_mining_update(ctx: Context<GlobalMiningUpdate>) -> Result<()> {
        instructions::global_mining::handler_update(ctx)
    }

    pub fn global_mining_claim(ctx: Context<GlobalMiningClaim>) -> Result<u64> {
        instructions::global_mining::handler_claim(ctx)
    }

    pub fn global_mining_assign_land(ctx: Context<GlobalMiningAssignLand>) -> Result<()> {
        instructions::global_mining::handler_assign_land(ctx)
    }

    pub fn global_mining_unassign_land(ctx: Context<GlobalMiningUnassignLand>) -> Result<()> {
        instructions::global_mining::handler_unassign_land(ctx)
    }

    pub fn admin_grant_exp(ctx: Context<AdminGrantExp>, amount: u64) -> Result<()> {
        instructions::admin_grant_exp::handler(ctx, amount)
    }

    pub fn rewards_deposit(ctx: Context<RewardsDeposit>, amount: u64) -> Result<()> {
        instructions::economy::handler_rewards_deposit(ctx, amount)
    }

    pub fn economy_set_rewards_vault(ctx: Context<EconomySetRewardsVault>) -> Result<()> {
        instructions::economy::handler_set_rewards_vault(ctx)
    }

    pub fn progression_init(ctx: Context<ProgressionInit>) -> Result<()> {
        instructions::progression_init::handler(ctx)
    }

    pub fn claim_mining_exp(ctx: Context<ClaimMiningExp>) -> Result<()> {
        instructions::claim_mining_exp::handler(ctx)
    }

    pub fn miner_level_up(ctx: Context<MinerLevelUp>) -> Result<()> {
        instructions::miner_level_up::handler(ctx)
    }

    pub fn economy_init(ctx: Context<EconomyInit>) -> Result<()> {
        instructions::economy::handler_economy_init(ctx)
    }

    pub fn economy_set_recipient(ctx: Context<EconomySetRecipient>) -> Result<()> {
        instructions::economy::handler_set_recipient(ctx)
    }

    pub fn economy_set_mint(ctx: Context<EconomySetMint>) -> Result<()> {
        instructions::economy::handler_set_mint(ctx)
    }

    pub fn spend_buy(ctx: Context<SpendEss>, amount: u64) -> Result<()> {
        instructions::economy::handler_spend_buy(ctx, amount)
    }

    pub fn spend_send(ctx: Context<SpendEss>, amount: u64) -> Result<()> {
        instructions::economy::handler_spend_send(ctx, amount)
    }

    pub fn spend_recharge(ctx: Context<SpendEss>, amount: u64) -> Result<()> {
        instructions::economy::handler_spend_recharge(ctx, amount)
    }

    pub fn spend_trade_fee(ctx: Context<SpendEss>, fee_amount: u64) -> Result<()> {
        instructions::economy::handler_spend_trade_fee(ctx, fee_amount)
    }

    pub fn initialize_config(ctx: Context<InitializeConfig>) -> Result<()> {
        instructions::config::handler_initialize_config(ctx)
    }

    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        instructions::config::handler_set_paused(ctx, paused)
    }

    pub fn create_miner_debug(
        ctx: Context<CreateMinerDebug>,
        rarity: u8,
        element: u8,
        hash_base: u64,
    ) -> Result<()> {
        instructions::debug::handler_create_miner_debug(ctx, rarity, element, hash_base)
    }

    pub fn create_land_debug(
        ctx: Context<CreateLandDebug>,
        rarity: u8,
        element: u8,
        slots: u8,
    ) -> Result<()> {
        instructions::debug::handler_create_land_debug(ctx, rarity, element, slots)
    }

    pub fn compute_affinity(
        ctx: Context<ComputeAffinity>,
        land_element: u8,
        miner_element: u8,
    ) -> Result<()> {
        instructions::affinity::handler_compute_affinity(ctx, land_element, miner_element)
    }


pub fn lootbox_miner_commit(
    ctx: Context<LootboxMinerCommit>,
    lootbox_id: u64,
    sale_type: u8,
    salt32: [u8; 32],
) -> Result<()> {
    lootbox_miner::handler_commit(ctx, lootbox_id, sale_type, salt32)
}

pub fn lootbox_miner_reveal(
    ctx: Context<LootboxMinerReveal>,
    lootbox_id: u64,
    sale_type: u8,
    salt32: [u8; 32],
) -> Result<()> {
    lootbox_miner::handler_reveal(ctx, lootbox_id, sale_type, salt32)
}

   

pub fn lootbox_land_commit(
    ctx: Context<LootboxLandCommit>,
    lootbox_id: u64,
    sale_type: u8,
    salt32: [u8; 32],
) -> Result<()> {
    lootbox_land::handler_commit(ctx, lootbox_id, sale_type, salt32)
}

pub fn lootbox_land_reveal(
    ctx: Context<LootboxLandReveal>,
    lootbox_id: u64,
    sale_type: u8,
    salt32: [u8; 32],
) -> Result<()> {
    lootbox_land::handler_reveal(ctx, lootbox_id, sale_type, salt32)
}

pub fn marketplace_create_equipment_listing(
    ctx: Context<MarketplaceCreateEquipmentListing>,
    price_ess: u64,
) -> Result<()> {
    instructions::marketplace::handler_create_equipment_listing(ctx, price_ess)
}
}
