# CubeFinance — Budgeting Logic (Worker 3)

This document explains the deterministic math in `backend/src/logic/budgetEngine.js`,
worked against the **10,000 ILS** reference income.

> No bank data is ever used. Every input here comes from the onboarding
> questionnaire or a manual update.

## Inputs

| Field | From onboarding step |
|---|---|
| `age` | Personal info |
| `employed` | "Do you work?" |
| `monthlyIncome` | "Estimated monthly income" (required if employed) |
| `livesWithParents` | "Do you live with parents?" |
| `housing.{rent,arnona,utilities,houseCommittee}` | Independent-living step |
| `initialBalance` | "Enter the balance you want to track" |

## Step 1 — Housing (independent only)

```
housingCost = rent + arnona + utilities + houseCommittee
housingShare = clamp(housingCost / income, 0, 0.85)
discretionaryShare = 1 - housingShare
```

For the 10,000 ILS example with rent 3,500 + arnona 300 + utilities 400 + committee 100:

```
housingCost   = 4,300 ILS
housingShare  = 43%
discretionary = 57%
```

## Step 2 — Age tilt

Younger users invest a larger share (longer horizon); older users lean to
savings/emergency:

```
aggressiveness = clamp((60 - age) / 40, 0, 1)   // 1 at ≤20, 0 at ≥60
investments *= 0.7 + aggressiveness*0.8          // 0.7x .. 1.5x
savings     *= 1.3 - aggressiveness*0.4
emergency   *= 1.2 - aggressiveness*0.3
lifestyle   *= 0.9 + aggressiveness*0.2
```

## Step 3 — Discretionary split

Base weights differ by living situation, then normalized to fill the
discretionary share exactly.

**Independent** base weights: essentials .32, savings .24, investments .18,
emergency .12, lifestyle .14.

**With parents** (no housing cube — money redistributed to wealth-building):
essentials .22, savings .30, investments .26, emergency .10, lifestyle .12.

### Worked example — Independent, age 28, 10,000 ILS

| Cube | % of income | Monthly (ILS) |
|---|---|---|
| 🏠 Housing & Bills | 43.0% | 4,300 |
| 🛒 Essentials | ~18.2% | ~1,825 |
| 🐷 Savings | ~13.9% | ~1,385 |
| 📈 Investments | ~11.0% | ~1,100 |
| 🛡️ Emergency | ~6.8% | ~680 |
| ✨ Lifestyle | ~7.1% | ~710 |
| **Total** | **100%** | **10,000** |

### Worked example — With parents, age 28, 10,000 ILS

No Housing cube. The full 10,000 ILS is discretionary, so Savings, Investments
and Lifestyle absorb what would have been housing:

| Cube | % of income | Monthly (ILS) |
|---|---|---|
| 🛒 Essentials | ~22% | ~2,200 |
| 🐷 Savings | ~30% | ~3,000 |
| 📈 Investments | ~27% | ~2,700 |
| 🛡️ Emergency | ~9% | ~900 |
| ✨ Lifestyle | ~12% | ~1,200 |

(Exact figures shift with the age tilt; a rounding reconciliation guarantees the
cubes always sum to income.)

## Step 4 — Transfer simulation (`transfer.js`)

The "main account" is a pool holding `initialBalance`. On **Distribute**:

1. **Fixed cubes first** — Housing is topped up toward its monthly target.
2. **Remainder by percentage** — whatever's left is split across the flexible
   cubes proportionally to their `percentage`; the last cube absorbs rounding so
   the moved total is exact.

Example: distributing 5,000 ILS (independent plan above) funds Housing to
4,300 ILS, then splits the remaining 700 ILS across the other cubes by weight.

## Alerts (`alerts.js`)

- `balance < 0` → **critical** (overdrawn).
- `balance < 20% of monthly target` → **warning** (running low).

These power the dashboard banner and the pulsing chatbot FAB badge.
