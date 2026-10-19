import SwaggerParser from '@apidevtools/swagger-parser';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import assert from 'node:assert/strict';
import { openapi } from '../../src/openapi.js';

export async function contractValidator(source = openapi) {
  const spec = JSON.parse(JSON.stringify(source));
  const rejectExternalRefs = value => {
    if (!value || typeof value !== 'object') return;
    if (value.$ref && !value.$ref.startsWith('#/')) throw new Error('Only internal OpenAPI references are allowed.');
    Object.values(value).forEach(rejectExternalRefs);
  };
  rejectExternalRefs(spec);
  const resolved = await SwaggerParser.validate(spec, {resolve:{external:false,file:false,http:false},dereference:{circular:false}});
  const ajv = new Ajv({allErrors:true,strict:false});
  addFormats(ajv);
  const cache = new WeakMap();
  function validate(schema, value, label) {
    let check = cache.get(schema);
    if (!check) {check = ajv.compile(schema);cache.set(schema, check);}
    assert.ok(check(value), label + ': ' + ajv.errorsText(check.errors));
  }
  return {
    spec:resolved,
    examples() {
      let count = 0;
      for (const [route, methods] of Object.entries(resolved.paths)) for (const [method, operation] of Object.entries(methods)) {
        const request = operation.requestBody?.content?.['application/json'];
        if (request) {
          assert.ok(Object.keys(request.examples || {}).length, operation.operationId + ' request examples missing');
          for (const example of Object.values(request.examples)) {validate(request.schema, example.value, method + ' ' + route + ' request');count++;}
        }
        for (const [code, response] of Object.entries(operation.responses)) {
          const json = response.content?.['application/json'];
          if (code === '204') {assert.equal(response.content, undefined);continue;}
          if (!json || (operation.operationId === 'openapi' && code === '200')) continue;
          assert.ok(Object.keys(json.examples || {}).length, operation.operationId + ' ' + code + ' examples missing');
          for (const example of Object.values(json.examples)) {validate(json.schema, example.value, method + ' ' + route + ' ' + code);count++;}
        }
      }
      return count;
    },
    response(route, method, response) {
      const contract = resolved.paths[route]?.[method]?.responses[response.status];
      assert.ok(contract, 'Undocumented response: ' + method + ' ' + route + ' ' + response.status);
      if (response.status === 204) {assert.equal(response.text, '');return;}
      const json = contract.content?.['application/json'];
      if (json) {
        assert.match(response.headers['content-type'] || '', /application\/json/);
        validate(json.schema, response.body, method + ' ' + route + ' ' + response.status);
      }
    },
  };
}
