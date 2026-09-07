const assert = require('node:assert/strict');

function calc(income, expense) {
  const profit = income - expense;
  const margin = income > 0 ? profit / income * 100 : 0;
  return { income, expense, profit, margin };
}

assert.deepEqual(calc(100000, 40000), { income: 100000, expense: 40000, profit: 60000, margin: 60 });
assert.deepEqual(calc(100000, 120000), { income: 100000, expense: 120000, profit: -20000, margin: -20 });
assert.deepEqual(calc(0, 1000), { income: 0, expense: 1000, profit: -1000, margin: 0 });

// Floating-point arithmetic can produce tiny differences in percentage calculations.
// Check the financial result with a tolerance instead of relying on an exact float.
const fractional = calc(250000.5, 100000.25);
assert.equal(fractional.income, 250000.5);
assert.equal(fractional.expense, 100000.25);
assert.equal(fractional.profit, 150000.25);
assert.ok(Math.abs(fractional.margin - 59.99998) < 1e-9, `Unexpected margin: ${fractional.margin}`);

// Acceptance scenario used by scripts/seed-demo.js.
assert.deepEqual(calc(1000000, 500000), { income: 1000000, expense: 500000, profit: 500000, margin: 50 });

console.log('Finance calculation tests: OK');
