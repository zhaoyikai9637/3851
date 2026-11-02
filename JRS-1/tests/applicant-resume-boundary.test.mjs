import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {compileFunction} from 'node:vm';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {JSDOM} from 'jsdom';
const require=createRequire(import.meta.url);
async function component(relative){
 const output=await build({entryPoints:[path.resolve('JRS Applicant Portal/client',relative)],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',plugins:[{name:'test-boundaries',setup(build){
  build.onResolve({filter:/context\/AuthContext$/},()=>({path:'auth',namespace:'fixture'}));
  build.onResolve({filter:/api\/client$/},()=>({path:'api',namespace:'fixture'}));
  build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='auth'?'export const useAuth=()=>({user:{fullName:"Example Candidate"},logout:async()=>{}});':'export default globalThis.__applicantUiApi;export const getApiError=(error,fallback)=>fallback;',loader:'js'}));
 }}]});
 const module={exports:{}};compileFunction(output.outputFiles[0].text,['require','module','exports'])(require,module,module.exports);return module.exports.default;
}
test('profile is accessible only from the header identity, never the applicant sidebar',async()=>{
 const Layout=await component('components/AppLayout.jsx');
 const markup=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Layout)));
 const dom=new JSDOM(markup);try{
  const doc=dom.window.document;
  assert.equal(doc.querySelectorAll('.sidebar-nav a[href*="profile"]').length,0);
  assert.equal(doc.querySelectorAll('a[href="/pages/profile/profile.html"]').length,1);
  assert.match(doc.querySelector('.topbar a').textContent,/Example Candidate/);
  assert.equal(doc.querySelector('.sidebar-nav').textContent.includes('Personal Profile'),false);
 }finally{dom.window.close();}
});
