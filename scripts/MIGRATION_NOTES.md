# Migration notes: legacy flows -> modular scripts

This project is now **modular-first**. Use `scripts/00_* ... 90_*` for practical validation.

## Legacy core flows (preserved only under `_legacy`)

The old flow files were moved to `scripts/_legacy/core/`:

- `scripts/core/economy_flow.ts` -> `scripts/_legacy/core/economy_flow.ts`
- `scripts/core/equipment_flow.ts` -> `scripts/_legacy/core/equipment_flow.ts`
- `scripts/core/expedition_flow.ts` -> `scripts/_legacy/core/expedition_flow.ts`
- `scripts/core/global_mining_flow.ts` -> `scripts/_legacy/core/global_mining_flow.ts`
- `scripts/core/lootbox_land_flow.ts` -> `scripts/_legacy/core/lootbox_land_flow.ts`
- `scripts/core/lootbox_miner_flow.ts` -> `scripts/_legacy/core/lootbox_miner_flow.ts`
- `scripts/core/rebirth_flow.ts` -> `scripts/_legacy/core/rebirth_flow.ts`
- `scripts/core/full_cycle_flow.ts` -> `scripts/_legacy/core/full_cycle_flow.ts`

## Which folder should I use?

- **Use now**: modular scripts in `scripts/00_bootstrap` ... `scripts/90_suites`
- **Use only if needed**: legacy compatibility wrappers in `scripts/_legacy`

## Why this split?

- Modular scripts are smaller and predictable.
- Suites orchestrate steps without embedding business logic.
- Legacy files stay available for historical behavior and backward compatibility.
