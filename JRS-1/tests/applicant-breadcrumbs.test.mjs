import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import {createRequire} from 'node:module';import {compileFunction} from 'node:vm';import {build} from 'esbuild';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {MemoryRouter} from 'react-router-dom';import {JSDOM} from 'jsdom';
const require=createRequire(import.meta.url);
const output=await build({entryPoints:[path.resolve('JRS Applicant Portal/client/components/ApplicantBreadcrumbs.jsx')],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external'});
const module={exports:{}};compileFunction(output.outputFiles[0].text,['require','module','exports'])(require,module,module.exports);const Breadcrumbs=module.exports.default;
for(const [name,items,links] of [
 ['public job',[{label:'Jobs',to:'/jobs'},{label:'Senior Software Developer'}],['/jobs']],
 ['applicant application',[{label:'Jobs',to:'/applicant/jobs'},{label:'Software Developer',to:'/applicant/jobs/42'},{label:'Apply'}],['/applicant/jobs','/applicant/jobs/42']],
 ['resume upload',[{label:'My Resume',to:'/applicant/resume'},{label:'Upload resume'}],['/applicant/resume']],
 ['upload during application',[{label:'Jobs',to:'/applicant/jobs'},{label:'Apply',to:'/applicant/apply/42'},{label:'Upload resume'}],['/applicant/jobs','/applicant/apply/42']],
])test('breadcrumb parent links and current page: '+name,()=>{
 const dom=new JSDOM(renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Breadcrumbs,{items}))));try{const nav=dom.window.document.querySelector('nav[aria-label="Breadcrumb"]');assert.ok(nav);assert.deepEqual([...nav.querySelectorAll('a')].map(link=>link.getAttribute('href')),links);assert.equal(nav.querySelectorAll('[aria-current="page"]').length,1);assert.equal(nav.querySelector('[aria-current="page"]').textContent,items.at(-1).label);assert.equal(nav.querySelector('[aria-current="page"]').tagName,'SPAN');assert.equal(nav.querySelectorAll('li:not([aria-hidden])').length,items.length);assert.deepEqual([...nav.querySelectorAll('li[aria-hidden]')].map(item=>item.textContent),Array(items.length-1).fill('/'));}finally{dom.window.close();}
});
test('job titles remain plain text in breadcrumbs',()=>{
 const title='<img src=x onerror=alert(1)> & Software Developer';const dom=new JSDOM(renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Breadcrumbs,{items:[{label:'Jobs',to:'/jobs'},{label:title}]}))));try{assert.equal(dom.window.document.querySelector('img'),null);assert.equal(dom.window.document.querySelector('[aria-current]').textContent,title);}finally{dom.window.close();}
});
