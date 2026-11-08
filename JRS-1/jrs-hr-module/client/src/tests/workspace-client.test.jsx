import {expect,it,vi,afterEach} from 'vitest';
import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {useWorkspace} from '../../pages/recruitment/workspaceClient';
afterEach(()=>cleanup());
const json=body=>Promise.resolve(new Response(JSON.stringify(body),{status:200}));
const db=()=>({revision:1,jobs:[],candidates:[],applications:[],interviews:[],tasks:[],notifications:[{id:'n',status:'Draft'}]});
it.each(['Sent','Uncertain'])('checks %s delivery after a connection failure without automatically resending',async(status)=>{
 let release;const pending=new Promise(resolve=>release=resolve),fetcher=vi.fn(async(url)=>{
  if(url.endsWith('/auth/me'))return json({user:{id:'hr'},csrfToken:'token'});
  if(url.endsWith('/workspace'))return json(db());
  if(url.endsWith('/send')){await pending;throw Error('Connection interrupted');}
  if(url.endsWith('/status'))return json({status});
  throw Error('Unexpected route');
 });
 const {result}=renderHook(()=>useWorkspace(fetcher));await waitFor(()=>expect(result.current.db).toBeTruthy());
 await act(async()=>{const first=result.current.send('n',false),second=result.current.send('n',false);expect(second).toBe(first);release();if(status==='Sent')await first;else await expect(first).rejects.toThrow('will not be resent automatically');});
 expect(fetcher.mock.calls.filter(([url])=>url.endsWith('/send'))).toHaveLength(1);
 expect(fetcher.mock.calls.filter(([url])=>url.endsWith('/status'))).toHaveLength(1);
});
