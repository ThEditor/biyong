# Money & Rounding Rules

## Integer Minor Units
To prevent floating-point imprecision inherent in IEEE 754 arithmetic, all monetary amounts throughout Biyong are integer minor units:
- ₹1.00 = 100 paise
- $1.00 = 100 cents

## Exact Remainder Distribution
When splitting non-divisible amounts (e.g. ₹100 among 3 people):
- Base: `floor(10000 / 3) = 3333`
- Remainder: `10000 % 3 = 1`
- Allocations: Person 1 receives 3334 paise; Person 2 receives 3333 paise; Person 3 receives 3333 paise.
- Sum: `3334 + 3333 + 3333 = 10000`.
- Invariant: `sum(allocations) === totalAmountMinor` always holds.
