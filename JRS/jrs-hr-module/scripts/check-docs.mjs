import { contractValidator } from '../server/tests/helpers/api-contract.js';
const contract = await contractValidator();
const count = contract.examples();
const operations = Object.values(contract.spec.paths).reduce((n,methods) => n + Object.keys(methods).length, 0);
console.log('OPENAPI_CONTRACT_OK: ' + operations + ' operations, ' + count + ' JSON request/response examples; external references disabled.');
