import { describe, it, expect, beforeAll } from 'vitest';
import vm from 'node:vm';
import { openapi } from '../src/openapi.js';
import { postmanCollection, postmanEnvironment } from '../../scripts/export-docs.mjs';
import { contractValidator } from './helpers/api-contract.js';
describe('API documentation contract', () => {
  let contract;
  beforeAll(async () => { contract = await contractValidator(); });
  it('validates the OpenAPI structure and every JSON request/response example offline', () => {
    expect(contract.examples()).toBeGreaterThan(100);
  });
  it('has unique operations, valid local schema references and CSRF on every mutation', () => {
    const ids=[];
    for(const methods of Object.values(openapi.paths)) for(const [method,operation] of Object.entries(methods)) {
      ids.push(operation.operationId);
      if(['post','put','patch','delete'].includes(method)) expect(operation.security).toEqual([{sessionCookie:[],csrfToken:[]}]);
      expect(operation).not.toHaveProperty('write');expect(operation).not.toHaveProperty('code');
    }
    expect(new Set(ids).size).toBe(ids.length);
    const walk=value=>{if(value && typeof value==='object') {if(value.$ref) expect(openapi.components.schemas[value.$ref.split('/').at(-1)]).toBeDefined();Object.values(value).forEach(walk);}};walk(openapi);
  });
  it('exports every operation, preserves cookie flow and never embeds login passwords', () => {
    const collection=postmanCollection(openapi),items=collection.item.flatMap(group=>group.item);
    expect(items.length).toBe(Object.values(openapi.paths).reduce((n,methods)=>n+Object.keys(methods).length,0));
    expect(collection.variable.some(variable=>variable.key==='loginPassword')).toBe(false);
    expect(items.some(item=>item.request.url.raw.endsWith('/api/auth/login'))).toBe(false);
    const me=items.find(item=>item.request.url.raw.endsWith('/api/auth/me'));
    expect(me.event[0].script.exec.join('\n')).toContain("pm.environment.set('csrfToken'");
    expect(openapi.components.securitySchemes.sessionCookie.name).toBe('jrs.hr.sid');
    expect(items.every(item=>!item.request.header.some(header=>header.key==='Cookie'))).toBe(true);
  });
  it('rejects missing documented fields, wrong types and non-SENT successful history', () => {
    const response = body => ({status:200,headers:{'content-type':'application/json'},body});
    expect(() => contract.response('/api/hr/profile','get',response({userId:1}))).toThrow('required');
    expect(() => contract.response('/api/hr/notifications','get',response({items:[],total:'1',page:1,pageSize:10,unread:0}))).toThrow('integer');
    const sample = structuredClone(openapi.paths['/api/hr/logs'].get.responses[200].content['application/json'].examples.sent.value);
    sample.items[0].deliveryStatus='PREVIEW';
    expect(() => contract.response('/api/hr/logs','get',response(sample))).toThrow('allowed values');
  });
  it('never resolves references to external files or network resources', async () => {
    const source = structuredClone(openapi);
    source.components.schemas.Profile={$ref:'file:///private-config.json'};
    await expect(contractValidator(source)).rejects.toThrow('Only internal');
  });
  it('separates unknown team transport from the module CSRF cookie', () => {
    expect(openapi.paths['/api/auth/me'].get.security).toEqual([]);
    expect(openapi.paths['/api/auth/me'].get['x-team-identity-required']).toBe(true);
    expect(openapi.paths['/api/health'].get['x-team-identity-required']).toBe(false);
    expect(openapi.paths['/api/hr/profile'].patch['x-team-identity-required']).toBe(true);
  });
  it('exports fictional response examples, leaves fixture IDs blank and runs logout last', () => {
    const collection=postmanCollection(openapi), environment=postmanEnvironment();
    expect(collection.item.at(-1).name).toBe('Logout (run last)');
    expect(collection.variable.map(x=>x.key)).toEqual(['baseUrl','appOrigin']);
    for(const key of ['csrfToken','templateId','notificationId','logId','attachmentId','applicationId']) expect(environment.values.find(v=>v.key===key).value).toBe('');
    for(const item of collection.item.flatMap(group=>group.item)) {
      // Swagger serves an HTML application, not a fabricated JSON response.
      if (!item.request.url.raw.endsWith('/api/docs')) expect(item.response.length).toBeGreaterThan(0);
      expect(item.response.every(r=>r.cookie.length===0)).toBe(true);
    }
  });
  it('executes exported Postman scripts against local environment variables', () => {
    const collection=postmanCollection(openapi),items=collection.item.flatMap(group=>group.item);
    const environment=new Map();
    const run=(url,status,body) => {
      const item=items.find(item=>item.request.url.raw.endsWith(url));
      const pm={
        environment:{set:(key,value)=>environment.set(key,value),unset:key=>environment.delete(key)},
        test:(_name,fn)=>fn(),
        response:{code:status,json:()=>body,to:{have:{status:expected=>expect(status).toBe(expected)}}},
      };
      vm.runInNewContext(item.event[0].script.exec.join('\n'),{pm},{timeout:1000});
    };
    run('/api/auth/me',200,{csrfToken:'test-session-token'});
    expect(environment.get('csrfToken')).toBe('test-session-token');
    const create=items.find(item=>item.request.method==='POST'&&item.request.url.raw.endsWith('/api/hr/templates'));
    const values=new Map();
    vm.runInNewContext(create.event[0].script.exec.join('\n'),{pm:{test:()=>{},response:{code:201,json:()=>({templateId:7,templateName:'Created example'})},environment:{set:(k,v)=>values.set(k,v)}}},{timeout:1000});
    expect(values.get('templateId')).toBe('7');expect(values.get('templateName')).toBe('Created example');
    run('/api/auth/logout',204,null);
    expect(environment.has('csrfToken')).toBe(false);
  });
});
