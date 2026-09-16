// Local module contract. Team identity, workflow events and visibility remain pending alignment.
import { requestExamples, successExamples, errorExamples } from './openapi-examples.js';
const ref = name => ({ $ref: `#/components/schemas/${name}` });
const text = (maxLength, extra = {}) => ({ type: 'string', ...(maxLength ? { maxLength } : {}), ...extra });
const id = { type: 'integer', minimum: 1, maximum: 2147483647 };
const timestamp = { type: 'string', format: 'date-time' };
const time = { ...timestamp, nullable: true };
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required });
const input = (properties, required) => ({ ...object(properties, required), additionalProperties: false });
const json = schema => ({ 'application/json': { schema } });
const response = (schema, description = 'Success') => ({ description, ...(schema ? { content: json(schema) } : {}) });
const body = schema => ({ required: true, content: json(schema) });
const errorResponses = Object.fromEntries([400,401,403,404,409,413,422,500,503].map(code => [code, {
  ...response(ref('Error'), ({400:'Malformed JSON',401:'Verified team sign-in required',403:'CSRF, origin or HR authorization rejected',404:'Missing or inaccessible record',409:'Unique name conflict, including archived templates',413:'JSON body exceeds 100 KB',422:'Invalid fields or upload',500:'Internal error',503:'Team identity service unavailable'})[code]),
  content: { 'application/json': { schema:ref('Error'), examples:errorExamples[code] } }
}]));
// No fictional upstream cookie/header is declared before the teammate provides it.
// The separate module cookie is needed for writes, not initial authenticated reads.
const auth = [];
const writeAuth = [{ sessionCookie: [], csrfToken: [] }];
const query = (name, schema, description) => ({ name, in: 'query', required: false, schema, description });
const idParam = { name: 'id', in: 'path', required: true, schema: id };
const pagination = [query('page', { type:'integer',minimum:1,maximum:100000,default:1 }), query('pageSize',{ type:'integer',minimum:1,maximum:50,default:10 })];
const dates = ['from','to'].map(name => query(name,{type:'string',format:'date'},'Inclusive historical calendar date in Asia/Singapore (UTC+08:00). Today is allowed; future dates are rejected; from must not exceed to.'));
const notificationTypes = ['NEW_APPLICATION','STATUS_UPDATED'];
const usageTypes = ['INTERVIEW_INVITE','OFFER_LETTER','ACCEPTED','REJECTED','IN_PROGRESS'];
const profile = object({ userId:id,employeeId:text(30),fullName:text(100),email:text(150,{format:'email'}),phone:text(20),role:text(50),department:text(100),officeLocation:text(100),photoUrl:{type:'string',nullable:true},accountStatus:text(20),lastLoginAt:time });
const editable = { fullName:text(100,{minLength:1}),phone:text(20,{pattern:'^[+0-9 ()-]*$'}),officeLocation:text(100) };
const templateInput = input({ templateName:text(150,{minLength:1}),subject:text(255,{minLength:1,description:'Single line. Supports [CandidateName], [JobTitle], [CompanyName], [HRName].'}),body:text(20000,{minLength:1,description:'Plain text, never HTML. Supports the same four square-bracket variables.'}),usageType:{type:'string',enum:usageTypes} },['templateName','subject','body','usageType']);
const template = object({ ...templateInput.properties,templateId:id,isActive:{type:'boolean'},createdBy:id,updatedBy:{...id,nullable:true},createdAt:time,updatedAt:time });
const notification = object({notificationId:id,recipientUserId:id,applicationId:{...id,nullable:true},notificationType:{type:'string',enum:notificationTypes},title:text(180),message:text(),sourceModule:text(100),isRead:{type:'boolean'},readAt:time,createdAt:time});
const notificationIds = {type:'array',minItems:1,maxItems:5000,items:id};
const readUpdate = object({updated:{type:'integer',minimum:0},notificationIds:{type:'array',items:id}},['updated']);
const log = object({logId:id,applicationId:id,templateId:id,senderUserId:id,triggerEvent:text(100),sourceModule:text(100),recipientEmail:text(150,{format:'email'}),candidateName:text(100),positionTitle:text(150),templateName:text(150),emailSubject:text(255),deliveryStatus:{type:'string',enum:['SENT'],description:'Accepted by the mail provider for submission, not verified delivery to an inbox.'},sentAt:{type:'string',format:'date-time'},createdAt:time,isDemo:{type:'boolean',description:'True means a simulated historical record, never evidence of an actual email.'}});
const paged = item => object({items:{type:'array',items:ref(item)},total:{type:'integer',minimum:0},page:{type:'integer',minimum:1},pageSize:{type:'integer',minimum:1,maximum:50}});
const op = (operationId, tag, summary, schema, options = {}) => ({ operationId,tags:[tag],summary,security:options.write ? writeAuth : auth,
  'x-team-identity-required': !options.security,
  description: options.security ? 'Public module endpoint; it does not grant HR access.' : 'Requires a verified upstream HR identity on every request. The team authentication transport is pending alignment; an empty read security array does not make this endpoint public. See docs/TEAM_AUTH.md. Module writes also require the cookie and CSRF token obtained from GET /api/auth/me.',
  responses:{ [options.code || 200]:response(schema),...errorResponses },...options });
const paths = {
  '/api/health': {get:op('health','Session','Process health (does not check database)',object({status:text(),module:text()}),{security:[]})},
  '/api/auth/csrf': {get:op('csrf','Session','Create or retrieve anonymous/session CSRF token',object({csrfToken:text(64,{pattern:'^[a-f0-9]{64}$'})}),{security:[]})},
  '/api/auth/config': {get:op('authConfig','Session','Read team entry URL and adapter registration status',object({loginUrl:{type:'string',format:'uri',nullable:true},adapterConfigured:{type:'boolean'}}),{security:[]})},
  '/api/auth/me': {get:op('me','Session','Read the current authorized HR session',ref('Auth'))},
  '/api/auth/logout': {post:op('logout','Session','Revoke the upstream session, then clear the HR module session',null,{write:true,code:204})},
  '/api/hr/profile': {
    get:op('profile','Profile','Read own profile',ref('Profile')),
    patch:op('updateProfile','Profile','Update full name, phone and office location only',ref('Profile'),{write:true,requestBody:body(input(editable,Object.keys(editable)))})
  },
  '/api/hr/profile/photo': {
    get:op('photo','Profile','Read own profile image',null,{responses:{200:{description:'JPEG image',content:{'image/jpeg':{schema:{type:'string',format:'binary'}}}},...errorResponses}}),
    post:op('uploadPhoto','Profile','Upload one JPEG or PNG (2 MB, 16 megapixels maximum)',ref('Profile'),{write:true,requestBody:{required:true,content:{'multipart/form-data':{schema:input({photo:{type:'string',format:'binary'}},['photo'])}}}})
  },
  '/api/hr/notifications': {get:op('notifications','Notifications','List own internal notifications and total counts',ref('Notifications'),{parameters:[...pagination,query('read',{type:'string',enum:['all','unread'],default:'all'}),query('search',{type:'string',maxLength:150}),query('type',{type:'string',enum:notificationTypes}),...dates]})},
  '/api/hr/notifications/read-all': {patch:op('readAll','Notifications','Mark all own unread notifications as read and return the changed IDs for undo',readUpdate,{write:true})},
  '/api/hr/notifications/restore-unread': {patch:op('restoreUnread','Notifications','Restore only the owned notifications changed by a previous read-all action',object({updated:{type:'integer',minimum:0}}),{write:true,requestBody:body(input({notificationIds},['notificationIds']))})},
  '/api/hr/notifications/{id}/read': {patch:op('readOne','Notifications','Mark an owned notification as read (idempotent)',null,{write:true,code:204,parameters:[idParam]})},
  '/api/hr/templates': {
    get:op('templates','Templates','List company-shared active templates',object({items:{type:'array',items:ref('Template')}})),
    post:op('createTemplate','Templates','Create a uniquely named template',ref('Template'),{write:true,code:201,requestBody:body(ref('TemplateInput'))})
  },
  '/api/hr/templates/{id}': {
    put:op('updateTemplate','Templates','Replace editable fields without changing past email snapshots',ref('Template'),{write:true,parameters:[idParam],requestBody:body(ref('TemplateInput'))}),
    delete:op('deleteTemplate','Templates','Archive a template; its name remains reserved',null,{write:true,code:204,parameters:[idParam]})
  },
  '/api/hr/logs': {get:op('logs','Logs','List own successful submissions, filtering and ordering by sentAt',ref('Logs'),{parameters:[...pagination,query('search',text(150),'Candidate name or position title.'),query('trigger',text(100),'Exact upstream event label; team vocabulary pending.'),query('status',{type:'string',enum:['SENT']},'Only SENT is supported. PREVIEW, PENDING and FAILED are excluded.'),...dates]})},
  '/api/hr/logs/{id}': {get:op('log','Logs','Read an owned successful historical email snapshot',ref('LogDetail'),{parameters:[idParam]})},
  '/api/hr/attachments/{id}/download': {get:op('attachment','Logs','Download an attachment of an owned successful log',null,{parameters:[idParam],responses:{200:{description:'Authorized file download',content:{'application/octet-stream':{schema:{type:'string',format:'binary'}}}},...errorResponses}})},
  '/api/hr/applications/{id}': {get:op('application','Integration','Read-only summary of an application assigned to this HR',object({applicationId:id,candidateName:text(100),positionTitle:text(150),currentStatus:text(50),appliedAt:time}),{parameters:[idParam]})},
  '/api/openapi.json': {get:op('openapi','Documentation','Read this OpenAPI document',{type:'object'},{security:[]})},
  '/api/docs': {get:op('swagger','Documentation','Open Swagger UI',null,{security:[],responses:{200:{description:'Swagger HTML page',content:{'text/html':{schema:{type:'string'}}}},301:{description:'Redirect to trailing slash'}}})}
};
// Options used by the generator are not OpenAPI fields.
for (const item of Object.values(paths)) for (const operation of Object.values(item)) { delete operation.write; delete operation.code; }
export const openapi = {
  openapi:'3.0.3',info:{title:'JRS HR Notification and Profile API',version:'0.1.0',description:'The team owns sign-in; there is no password login endpoint in this module. The upstream authentication transport is pending agreement and is not specified by this document. An installed server adapter must verify it. GET /api/auth/me checks that identity and returns a token bound to its subject/session/HR mapping. Retain the separate jrs.hr.sid CSRF-session cookie and send x-csrf-token for mutations. A changed upstream identity requires refreshing /api/auth/me. The module cookie alone never authenticates a user. POST/PATCH/PUT/DELETE with a supplied Origin must match APP_ORIGIN. Log success means provider acceptance, not confirmed inbox delivery. PREVIEW/PENDING/FAILED are not successful history. No public workflow-send endpoint.'},
  servers:[{url:'/',description:'Same-origin API (including Vite proxy)'}],paths,
  components:{ securitySchemes:{sessionCookie:{type:'apiKey',in:'cookie',name:'jrs.hr.sid',description:'Module CSRF session only. A separately verified upstream identity is also mandatory; its cookie or token transport remains to be agreed.'},csrfToken:{type:'apiKey',in:'header',name:'x-csrf-token',description:'64 lowercase hex characters bound to the current session.'}},
    schemas:{ Error:object({error:object({message:text(),fields:{type:'array',items:object({field:text(),message:text()})}},['message'])},['error']),Profile:profile,
      Auth:object({user:ref('Profile'),csrfToken:text(64,{pattern:'^[a-f0-9]{64}$'}),mode:{type:'string',enum:['standalone','team']}}),TemplateInput:templateInput,Template:template,Notification:notification,
      Notifications:{...paged('Notification'),required:[...paged('Notification').required,'unread','all'],properties:{...paged('Notification').properties,unread:{type:'integer',minimum:0,description:'All unread notifications for current HR, independent of list filters.'},all:{type:'integer',minimum:0,description:'All notifications for current HR, independent of list filters.'}}},
      Log:log,Logs:paged('Log'),LogDetail:object({...log.properties,emailBody:text(),attachments:{type:'array',items:object({attachmentId:id,fileName:text(255),fileType:text(80)})}})
    }
  }
};

// A single source supplies Swagger examples and Postman request/response examples.
for (const methods of Object.values(paths)) for (const operation of Object.values(methods)) {
  const requestJson = operation.requestBody?.content?.['application/json'];
  if (requestJson) requestJson.examples = requestExamples[operation.operationId];
  const successCode = Object.keys(operation.responses).find(code => code.startsWith('2'));
  const result = operation.responses[successCode];
  const responseJson = result?.content?.['application/json'];
  if (responseJson && successExamples[operation.operationId]) responseJson.examples = successExamples[operation.operationId];
  if (successCode === '204') result.description = 'Success; the response body is empty. Do not parse JSON.';
  for (const parameter of operation.parameters || []) {
    if (parameter.in === 'path') parameter.example = 1;
    else parameter.example = parameter.schema.default ?? parameter.schema.enum?.[0] ?? (parameter.schema.format === 'date' ? '2026-09-09' : parameter.name === 'search' ? 'Casey' : 'Moved to Interview');
  }
}
paths['/api/auth/me'].get.responses[200].headers = {
  'Set-Cookie': { description:'On identity binding/rotation only: jrs.hr.sid; HttpOnly; SameSite=Lax; Path=/; Secure in production. This cookie is not the upstream credential.', schema:{type:'string'} },
};
paths['/api/auth/logout'].post.responses[204].headers = {
  'Set-Cookie': { description:'Expires the HR module cookie after the adapter successfully revokes the upstream session.', schema:{type:'string'} },
};
paths['/api/hr/attachments/{id}/download'].get.responses[200].description = 'Raw file bytes. Content-Type follows the stored filename; the example metadata is fictional. Missing or inaccessible files return a JSON error.';
paths['/api/hr/attachments/{id}/download'].get.responses[200].content = { '*/*': {schema:{type:'string',format:'binary'}} };
paths['/api/hr/attachments/{id}/download'].get.responses[200].headers = {
  'Content-Disposition': { description:'Attachment filename supplied by the authorized metadata; use the download response, not a public file URL.', schema:{type:'string'}, example:'attachment; filename="Demo note.txt"' },
};
// Persistent timestamps are present; only last-login/read-at explicitly allow null.
for (const schema of [profile, template, notification, log]) for (const field of ['createdAt','updatedAt']) {
  if (schema.properties[field]) schema.properties[field] = timestamp;
}
openapi.components.schemas.LogDetail.properties.createdAt = timestamp;
paths['/api/hr/applications/{id}'].get.responses[200].content['application/json'].schema.properties.appliedAt = timestamp;
