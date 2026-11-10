import test from 'node:test';import assert from 'node:assert/strict';
import validation from '../JRS Login and profile/server/services/validation.js';
import repository from '../JRS Login and profile/server/services/repository.js';
test('structured education validates level and year order, retaining existing optional fields',()=>{
 const input={institution:'University',qualification:'Course',is_current_study:false,description:'Existing highlights',start_year:'2020',finished_year:'2024',qualification_level:'BACHELOR'};
 const parsed=validation.sections.education.validate(input);assert.equal(parsed.start_year,'2020');assert.equal(parsed.qualification_level,'BACHELOR');assert.equal(parsed.description,'Existing highlights');
 assert.throws(()=>validation.sections.education.validate({...input,start_year:'2025'}),/must not precede/);
 assert.throws(()=>validation.sections.education.validate({...input,qualification_level:'invented'}),/qualification level/);
 const old=validation.sections.education.validate({institution:'University',qualification:'Course',is_current_study:true,end_month_year:'2027-06'});assert.equal(Object.hasOwn(old,'start_year'),false);assert.equal(old.end_month_year,'2027-06');
});
test('language levels and codes survive validation and owner-scoped database replacement',async()=>{
 const parsed=validation.languages([{language_name:'English',can_read:true,can_write:true,language_code:'en',reading_level:'Advanced',writing_level:'Native'},{language_name:'Legacy language',can_read:true,can_write:false}]);
 assert.equal(parsed[0].writing_level,'Native');assert.equal(Object.hasOwn(parsed[1],'reading_level'),false);
 assert.throws(()=>validation.languages([{...parsed[0],reading_level:'Expert'}]),/language level/);
 const calls=[],db={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{},query:async(sql,args)=>{calls.push({sql,args});return [[]];}};
 const repo=new repository.Repository({getConnection:async()=>db},{integratedRoot:true});await repo.replaceList(19,'languages',parsed);
 const insert=calls.find(call=>call.sql.startsWith('INSERT INTO LANGUAGE'));assert.match(insert.sql,/language_code, reading_level, writing_level/);assert.deepEqual(insert.args,[19,'English',true,true,'en','Advanced','Native']);
 assert.deepEqual(calls.find(call=>call.sql.startsWith('DELETE')).args,[19]);
});
