const assert = require('node:assert/strict');

function calc(income, expense) {
  const profit = income - expense;
  const margin = income > 0 ? profit / income * 100 : 0;
  return { income, expense, profit, margin };
}

assert.deepEqual(calc(100000, 40000), { income: 100000, expense: 40000, profit: 60000, margin: 60 });
assert.deepEqual(calc(100000, 120000), { income: 100000, expense: 120000, profit: -20000, margin: -20 });
assert.deepEqual(calc(0, 1000), { income: 0, expense: 1000, profit: -1000, margin: 0 });
assert.deepEqual(calc(250000.5, 100000.25), { income: 250000.5, expense: 100000.25, profit: 150000.25, margin: 59.99998003995992 });

// Acceptance scenario used by scripts/seed-demo.js.
assert.deepEqual(calc(1000000, 500000), { income: 1000000, expense: 500000, profit: 500000, margin: 50 });

console.log('Finance calculation tests: OK');
