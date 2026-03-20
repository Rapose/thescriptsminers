fn rarity_hash_range(rarity: u8) -> Result<(u64, u64)> {
    match rarity {
        0 => Ok((60, 100)),
        1 => Ok((120, 180)),
        2 => Ok((300, 450)),
        3 => Ok((600, 900)),
        4 => Ok((1200, 1600)),
        _ => err!(MoeError::InvalidRarity),
    }
}

fn compute_rebirth_hash(parent_a: u64, parent_b: u64, next_rarity: u8, entropy: &[u8; 32]) -> Result<u64> {
    let sum = parent_a.saturating_add(parent_b);
    let (min_next, max_next) = rarity_hash_range(next_rarity)?;
    let low = sum.max(min_next);
    let high = max_next;

    require!(low <= high, MoeError::InvalidRebirthRange);

    let span = high.saturating_sub(low).saturating_add(1);
    let roll = u16::from_le_bytes([entropy[0], entropy[1]]) as u64 % span;

    Ok(low.saturating_add(roll))
}
