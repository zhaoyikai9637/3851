import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { STATUS_CODES } from 'node:http';
import { openapi } from '../server/src/openapi.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const jsonText = value => JSON.stringify(value, null, 2);
const successCode = operation => Object.keys(operation.responses).find(code => code.startsWith('2'));
function idVariable(route) {
  return route.includes('notifications/') ? 'notificationId' : route.includes('templates/') ? 'templateId' : route.includes('attachments/') ? 'attachmentId' : route.includes('applications/') ? 'applicationId' : 'logId';
}
export function postmanEnvironment() {
  return {
    name:'JRS HR — local values only', _postman_variable_scope:'environment',
    values:Object.entries({baseUrl:'http://localhost:5173',appOrigin:'http://localhost:5173',csrfToken:'',notificationId:'',templateId:'',templateName:'',logId:'',attachmentId:'',applicationId:''})
      .map(([key,value]) => ({key,value,type:key === 'csrfToken' ? 'secret' : 'default',enabled:true})),
  };
}
export function postmanCollection(spec) {
  const groups = new Map();
  for (const [route, methods] of Object.entries(spec.paths)) for (const [method, operation] of Object.entries(methods)) {
    const tag = operation.operationId === 'logout' ? 'Logout (run last)' : operation.tags[0];
    if (!groups.has(tag)) groups.set(tag, []);
    const mutation = !['get','head','options'].includes(method);
    const routePath = route.replace('{id}', '{{' + idVariable(route) + '}}');
    const request = {
      method:method.toUpperCase(),
      header:mutation ? [{key:'x-csrf-token',value:'{{csrfToken}}'},{key:'Origin',value:'{{appOrigin}}'}] : [],
      url:{raw:'{{baseUrl}}' + routePath,host:['{{baseUrl}}'],path:routePath.slice(1).split('/')},
      description:operation.description,
    };
    const firstExample = Object.values(operation.requestBody?.content?.['application/json']?.examples || {})[0]?.value;
    if (firstExample) {
      request.header.push({key:'Content-Type',value:'application/json'});
      const value = structuredClone(firstExample);
      if (operation.operationId === 'createTemplate') value.templateName = 'Postman example {{$guid}}';
      if (operation.operationId === 'updateTemplate') value.templateName = '{{templateName}}';
      request.body = {mode:'raw',raw:jsonText(value),options:{raw:{language:'json'}}};
    }
    if (operation.operationId === 'uploadPhoto') request.body = {mode:'formdata',formdata:[{key:'photo',type:'file',src:[],description:'Choose a local JPEG/PNG up to 2 MB.'}]};
    const queries = (operation.parameters || []).filter(p => p.in === 'query').map(p => ({key:p.name,value:String(p.example ?? p.schema.default ?? ''),disabled:true,description:p.description || p.name}));
    if (queries.length) request.url.query = queries;
    const code = successCode(operation);
    const scripts = ["pm.test('Expected HTTP " + code + "', () => pm.response.to.have.status(" + code + "));"];
    if (['csrf','me'].includes(operation.operationId)) scripts.push("if (pm.response.code === 200) { const token = pm.response.json().csrfToken; if (token) pm.environment.set('csrfToken', token); }");
    if (operation.operationId === 'logout') scripts.push("if (pm.response.code === 204) pm.environment.unset('csrfToken');");
    if (['createTemplate','updateTemplate'].includes(operation.operationId)) scripts.push("if ([200,201].includes(pm.response.code)) { const item = pm.response.json(); pm.environment.set('templateId', String(item.templateId)); pm.environment.set('templateName', item.templateName); }");
    const responses = [];
    for (const [status, response] of Object.entries(operation.responses)) {
      for (const [name, example] of Object.entries(response.content?.['application/json']?.examples || {})) responses.push({
        name:status + ' — ' + name + ' (fictional example)', originalRequest:structuredClone(request),
        status:STATUS_CODES[status] || response.description,code:Number(status),
        header:[{key:'Content-Type',value:'application/json'}],cookie:[],
        body:jsonText(example.value),_postman_previewlanguage:'json',
      });
      if (status === '204') responses.push({name:'204 — no response body',originalRequest:structuredClone(request),status:'No Content',code:204,header:[],cookie:[],body:''});
    }
    groups.get(tag).push({name:operation.summary,request,response:responses,event:[{listen:'test',script:{type:'text/javascript',exec:scripts}}]});
  }
  const ordered = [...groups].sort(([a],[b]) => Number(a.startsWith('Logout')) - Number(b.startsWith('Logout')));
  return {
    info:{name:'JRS HR Module — Local Development',schema:'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',description:'Import the blank local environment first. Team sign-in has not been implemented; protected requests require its verified adapter. Start with Session /me after upstream sign-in and retain cookies. jrs.hr.sid alone never authenticates. No module login or mail-send endpoint. Examples are fictional, not captured traffic. Select local fixture IDs explicitly and run only intended requests; Logout is last. Keep credentials and tokens in unshared local environment values, never in the collection.'},
    variable:[{key:'baseUrl',value:'http://localhost:5173',type:'string'},{key:'appOrigin',value:'http://localhost:5173',type:'string'}],
    item:ordered.map(([name,item]) => ({name,item})),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = path.join(root, 'docs');
  await fs.mkdir(out, {recursive:true});
  // Source fixtures only; .env is never read here.
  await fs.writeFile(path.join(out,'openapi.json'),jsonText(openapi) + '\n');
  await fs.writeFile(path.join(out,'JRS-HR.postman_collection.json'),jsonText(postmanCollection(openapi)) + '\n');
  await fs.writeFile(path.join(out,'JRS-HR.postman_environment.example.json'),jsonText(postmanEnvironment()) + '\n');
  console.log('Exported OpenAPI, Postman collection and blank environment (fictional examples, no credentials).');
}
