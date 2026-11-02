import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';

test('offscreen action labels are contained by the horizontally scrollable table header',async()=>{
  const css=await readFile(new URL('../jrs-hr-module/client/pages/jobs/jobs.css',import.meta.url),'utf8');
  const dom=new JSDOM('<style>'+css+'</style><div class="jobs-table-scroll"><table class="jobs-table"><thead><tr><th><span class="visually-hidden">Actions</span></th></tr></thead></table></div>');
  try {
    assert.equal(dom.window.getComputedStyle(dom.window.document.querySelector('th')).position,'relative');
    assert.equal(dom.window.getComputedStyle(dom.window.document.querySelector('.jobs-table-scroll')).overflowX,'auto');
  }finally{dom.window.close();}
});
