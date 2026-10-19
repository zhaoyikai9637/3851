const crypto = require('node:crypto');
const { statements, validateLedger } = require('../scripts/migrate');
const step = i => ({ step_id: i, checksum: crypto.createHash('sha256').update(statements[i - 1]).digest('hex') });
test('migration accepts an empty or contiguous journal for resumption', () => {
    expect(() => validateLedger([])).not.toThrow();
    expect(() => validateLedger([step(2), step(1)])).not.toThrow();
    expect(() => validateLedger(statements.map((_, i) => step(i + 1)))).not.toThrow();
});
test('migration refuses missing, unknown or modified journal entries', () => {
    expect(() => validateLedger([step(2)])).toThrow(/gaps/);
    expect(() => validateLedger([{ step_id: 99, checksum: 'x' }])).toThrow(/unknown/);
    expect(() => validateLedger([{ ...step(1), checksum: 'changed' }])).toThrow(/changed/);
});
