# Scripts layout (modular-first)

This directory is organized for **modular, practical validation runs**.

## New standard (use this by default)
- `00_bootstrap`
- `10_lootboxes`
- `20_presale`
- `30_progression`
- `40_global_mining`
- `50_rebirth`
- `60_expedition`
- `70_equipment`
- `80_marketplace`
- `90_suites`

Each folder contains small scripts that execute one focused action with local assertions.
Use the suites in `90_suites` to orchestrate full flows in sequence.

## Legacy compatibility
Old flow-style scripts were moved to `scripts/_legacy/`.
They are kept only for backward compatibility and historical reference.

If you are building new checks, add/extend scripts in the modular folders above (not in `_legacy`).
