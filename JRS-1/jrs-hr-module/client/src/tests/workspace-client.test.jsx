import {expect,it,vi,afterEach} from 'vitest';
import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {useWorkspace,saveWithEmail} from '../../pages/recruitment/workspaceClient';
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

it('sends the newly created notification only when explicitly selected',async()=>{
 const commit=vi.fn(async()=>({notification:{id:'new-note'}})),send=vi.fn(async()=>({sent:true})),workspace={db:{mailEnabled:true},commit,send};
 await saveWithEmail(workspace,'schedule',{notify:false});expect(send).not.toHaveBeenCalled();
 await saveWithEmail(workspace,'schedule',{notify:true});expect(send).toHaveBeenCalledWith('new-note',false);
});
it('a send failure reports a saved decision without resubmitting it',async()=>{
 const commit=vi.fn(async()=>({notification:{id:'note'}})),send=vi.fn(async()=>{throw Error('Provider unavailable');});
 const result=await saveWithEmail({db:{mailEnabled:true},commit,send},'reject',{notify:true});
 expect(result.notice).toContain('Saved.');expect(result.notice).toContain('Provider unavailable');expect(commit).toHaveBeenCalledTimes(1);expect(send).toHaveBeenCalledTimes(1);
});
it('disabled email cannot silently turn a Send selection into an unsent draft',async()=>{
 const commit=vi.fn();await expect(saveWithEmail({db:{mailEnabled:false},commit},'schedule',{notify:true})).rejects.toThrow('not enabled');expect(commit).not.toHaveBeenCalled();
});
it('uses the saved revision for the immediate email send',async()=>{
 const fetcher=vi.fn(async(url,options={})=>{
  if(url.endsWith('/auth/me'))return json({user:{id:'hr'},csrfToken:'token'});
  if(url.endsWith('/workspace'))return json(db());
  if(url.includes('/commands/'))return json({db:{...db(),revision:2},result:{notification:{id:'n'}}});
  if(url.endsWith('/send')){expect(options.headers['If-Match']).toBe('2');return json({db:{...db(),revision:3}});}
 });
 const {result}=renderHook(()=>useWorkspace(fetcher));await waitFor(()=>expect(result.current.db).toBeTruthy());
 await act(async()=>{await result.current.commit('schedule',{});await result.current.send('n',false);});
});
