use anchor_lang::prelude::*;
use crate::errors::MoeError;

pub const SLOT_HAND: u8 = 0;
pub const SLOT_HEAD: u8 = 1;

pub const MAX_EQUIPMENT_LEVEL: u8 = 18;

/// Internal equipment ladder:
///  1 = Tier I  / A
///  2 = Tier I  / B
///  3 = Tier I  / C
///  4 = Tier II / A
///  5 = Tier II / B
///  6 = Tier II / C
///  7 = Tier III / B
///  8 = Tier III / C
///  9 = Tier III / D
/// 10 = Tier IV / C
/// 11 = Tier IV / D
/// 12 = Tier IV / E
/// 13 = Tier V / D
/// 14 = Tier V / E
/// 15 = Tier V / F
/// 16 = Tier VI / D (Remelt only)
/// 17 = Tier VI / E (Remelt only)
/// 18 = Tier VI / F (Remelt only)

pub fn validate_equipment_level(level: u8) -> Result<()> {
    require!(
        level >= 1 && level <= MAX_EQUIPMENT_LEVEL,
        MoeError::InvalidBaseLevel
    );
    Ok(())
}

pub fn hand_power_bps_by_level(level: u8) -> Result<u16> {
    validate_equipment_level(level)?;

    let bps = match level {
        1 => 200,   // I-A  +2%
        2 => 400,   // I-B  +4%
        3 => 500,   // I-C  +5%
        4 => 800,   // II-A +8%
        5 => 900,   // II-B +9%
        6 => 1000,  // II-C +10%
        7 => 1200,  // III-B +12%
        8 => 1300,  // III-C +13%
        9 => 1400,  // III-D +14%
        10 => 1800, // IV-C +18%
        11 => 2000, // IV-D +20%
        12 => 2100, // IV-E +21%
        13 => 2300, // V-D +23%
        14 => 2400, // V-E +24%
        15 => 2500, // V-F +25%
        16 => 3000, // VI-D +30% (remelt only)
        17 => 4000, // VI-E +40% (remelt only)
        18 => 6000, // VI-F +60% (remelt only)
        _ => return err!(MoeError::InvalidBaseLevel),
    };

    Ok(bps)
}

pub fn head_discount_bps_by_level(level: u8) -> Result<u16> {
    validate_equipment_level(level)?;

    let bps = match level {
        1 => 500,   // I-A  -5%
        2 => 600,   // I-B  -6%
        3 => 700,   // I-C  -7%
        4 => 1000,  // II-A -10%
        5 => 1100,  // II-B -11%
        6 => 1200,  // II-C -12%
        7 => 1400,  // III-B -14%
        8 => 1500,  // III-C -15%
        9 => 1600,  // III-D -16%
        10 => 1800, // IV-C -18%
        11 => 2000, // IV-D -20%
        12 => 2300, // IV-E -23%
        13 => 2500, // V-D -25%
        14 => 2600, // V-E -26%
        15 => 2700, // V-F -27%
        16 => 3300, // VI-D -33% (remelt only)
        17 => 4500, // VI-E -45% (remelt only)
        18 => 7500, // VI-F -75% (remelt only)
        _ => return err!(MoeError::InvalidBaseLevel),
    };

    Ok(bps)
}

/// Helper used by UI / logs / future remelting rules.
/// Returns true only for levels that can drop directly from Expedition.
pub fn is_expedition_drop_level(level: u8) -> bool {
    (1..=15).contains(&level)
}

/// Helper used by UI / logs / future remelting rules.
/// Returns true only for remelt-exclusive levels.
pub fn is_remelt_only_level(level: u8) -> bool {
    (16..=18).contains(&level)
}

/// Maps internal level -> human tier label (1..6)
pub fn equipment_tier_from_level(level: u8) -> Result<u8> {
    validate_equipment_level(level)?;

    let tier = match level {
        1..=3 => 1,
        4..=6 => 2,
        7..=9 => 3,
        10..=12 => 4,
        13..=15 => 5,
        16..=18 => 6,
        _ => return err!(MoeError::InvalidBaseLevel),
    };

    Ok(tier)
}

/// Maps internal level -> quality label as byte:
/// A=0, B=1, C=2, D=3, E=4, F=5
pub fn equipment_quality_index_from_level(level: u8) -> Result<u8> {
    validate_equipment_level(level)?;

    let q = match level {
        1 | 4 => 0,               // A
        2 | 5 | 7 => 1,           // B
        3 | 6 | 8 | 10 => 2,      // C
        9 | 11 | 13 | 16 => 3,    // D
        12 | 14 | 17 => 4,        // E
        15 | 18 => 5,             // F
        _ => return err!(MoeError::InvalidBaseLevel),
    };

    Ok(q)
}

pub fn remelt_cost_ess(base_level: u8) -> Result<u64> {
    validate_equipment_level(base_level)?;

    let cost = match base_level {
        1..=3 => 25,
        4..=6 => 60,
        7..=9 => 140,
        10..=12 => 320,
        13..=15 => 700,
        16..=18 => 0,
        _ => return err!(MoeError::InvalidBaseLevel),
    };

    Ok(cost)
}