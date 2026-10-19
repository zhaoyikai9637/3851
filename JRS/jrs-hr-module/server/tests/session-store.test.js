import { describe, it, expect, vi } from 'vitest';
import { DatabaseSessionStore } from '../src/session-store.js';
const invoke = (store,method,...args) => new Promise((resolve,reject) => store[method](...args,(error,value) => error ? reject(error) : resolve(value)));
describe('database session store contract (mock model)', () => {
  it('returns only unexpired parsed sessions and propagates corrupt JSON', async () => {
    const findByPk=vi.fn(),store=new DatabaseSessionStore({findByPk});
    findByPk.mockResolvedValue({expires:new Date(Date.now()+10000),data:JSON.stringify({auth:{hrUserId:1}})});
    expect(await invoke(store,'get','test-sid')).toEqual({auth:{hrUserId:1}});
    findByPk.mockResolvedValue({expires:new Date(0),data:'{}'});expect(await invoke(store,'get','test-sid')).toBe(null);
    findByPk.mockResolvedValue({expires:new Date(Date.now()+10000),data:'broken'});await expect(invoke(store,'get','test-sid')).rejects.toThrow();
  });
  it('persists, touches and destroys the specific session only', async () => {
    const model={upsert:vi.fn().mockResolvedValue([]),update:vi.fn().mockResolvedValue([1]),destroy:vi.fn().mockResolvedValue(1)},store=new DatabaseSessionStore(model);
    const value={cookie:{expires:new Date('2027-01-01')},auth:{hrUserId:1}};
    await invoke(store,'set','test-sid',value);expect(model.upsert).toHaveBeenCalledWith({sid:'test-sid',data:JSON.stringify(value),expires:value.cookie.expires});
    await invoke(store,'touch','test-sid',value);expect(model.update.mock.calls[0][1]).toEqual({where:{sid:'test-sid'}});
    await invoke(store,'destroy','test-sid');expect(model.destroy).toHaveBeenCalledWith({where:{sid:'test-sid'}});
  });
});
