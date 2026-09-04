const test = require('node:test');
const assert = require('node:assert/strict');
const { fundYearNumber, recentFundWindow } = require('../lib/kvic');

test('reads a numeric year from KVIC year labels', () => {
  assert.equal(fundYearNumber('2023년'), 2023);
  assert.equal(fundYearNumber(''), 0);
});

test('keeps the latest three years published by the KVIC fund API', () => {
  const input = [
    { year:'2020년', manager:'D' },
    { year:'2021년', manager:'C' },
    { year:'2022년', manager:'B' },
    { year:'2023년', manager:'A' },
  ];
  const result = recentFundWindow(input,3);
  assert.deepEqual(result.years,[2023,2022,2021]);
  assert.equal(result.latest_year,2023);
  assert.deepEqual(result.items.map(item=>item.year),['2023년','2022년','2021년']);
});
