import { describe, it, expect, vi } from 'vitest';
import { targets, grantDatabase, preflight } from '../../scripts/setup-local.mjs';

describe('approved database provisioning preflight (no real SQL writes)', () => {
  it('uses only the two approved schema names with separate users', () => {
    expect(targets.map(t => t.name)).toEqual(['jrs_hr_module_dev_20260908', 'jrs_hr_module_test_20260908']);
    expect(new Set(targets.map(t => t.user)).size).toBe(2);
  });
  it('rejects an existing schema before reading accounts', async () => {
    const connection = { execute: vi.fn().mockResolvedValue([[{ SCHEMA_NAME: targets[0].name }]]), query: vi.fn() };
    await expect(preflight(connection)).rejects.toThrow('already exists');
    expect(connection.execute).toHaveBeenCalledTimes(1);
    expect(connection.query).not.toHaveBeenCalled();
  });
  it('rejects an existing dedicated account at any host', async () => {
    const connection = { execute: vi.fn().mockResolvedValueOnce([[]]).mockResolvedValueOnce([[{ User: targets[0].user }]]), query: vi.fn() };
    await expect(preflight(connection)).rejects.toThrow('account name already exists');
    expect(connection.query).not.toHaveBeenCalled();
  });
  it('rejects a different port and issues only reads', async () => {
    const connection = { execute: vi.fn().mockResolvedValue([[]]), query: vi.fn().mockResolvedValue([[{ port: 3307 }]]) };
    await expect(preflight(connection)).rejects.toThrow('port differs');
    for (const [sql] of [...connection.execute.mock.calls, ...connection.query.mock.calls]) expect(sql).toMatch(/^SELECT /);
  });
  it('returns settings only after all metadata checks', async () => {
    const settings = { port: 3306, partialRevokes: 1, version: '26.7.0' };
    const connection = { execute: vi.fn().mockResolvedValue([[]]), query: vi.fn().mockResolvedValue([[settings]]) };
    expect(await preflight(connection)).toEqual(settings);
  });
  it('prevents underscore wildcard grants and refuses unapproved names', () => {
    expect(grantDatabase(targets[0].name, false)).toBe('`jrs\\_hr\\_module\\_dev\\_20260908`');
    expect(grantDatabase(targets[0].name, true)).toBe('`jrs_hr_module_dev_20260908`');
    expect(() => grantDatabase('team_db', false)).toThrow('Unapproved');
  });
});
