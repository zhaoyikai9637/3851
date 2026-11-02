import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {compileFunction} from 'node:vm';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
test('current employment with a null end date renders disabled blank month/year fields',async()=>{
 const output=await build({entryPoints:[path.resolve('JRS Applicant Portal/client/components/MonthSelect.jsx')],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external'});
 const module={exports:{}};compileFunction(output.outputFiles[0].text,['require','module','exports'])(require,module,module.exports);
 for(const value of [null,undefined,'']) {
 const markup=renderToStaticMarkup(React.createElement(module.exports.default,{name:'endDate',value,disabled:true,onChange(){}}));
 assert.equal((markup.match(/disabled=""/g)||[]).length,2);
 assert.equal((markup.match(/value="" selected=""/g)||[]).length,2);
 }
});
