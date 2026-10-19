import { describe, it, expect } from 'vitest';
import { businessToday, filtersSchema, notificationRestoreSchema, profileSchema, templateSchema, renderTemplate, idSchema } from '../src/validation.js';
import { profileDto } from '../src/services.js';

const fields = { templateName:'Interview Invite', subject:'Hello [CandidateName]', body:'Apply to [CompanyName] for [JobTitle]. Regards, [HRName]',usageType:'INTERVIEW_INVITE' };
describe('validation and safe DTOs', () => {
  it('renders supported square-bracket variables once as plain text', () => {
    expect(renderTemplate('[CandidateName] / [JobTitle] / [CompanyName] / [HRName]',{CandidateName:'[HRName]',JobTitle:'<b>Engineer</b>',CompanyName:'Example',HRName:'Riley'})).toBe('[HRName] / <b>Engineer</b> / Example / Riley');
  });
  it.each(['[Unknown]','[CandidateName]'])('rejects unsupported or missing values: %s',value => expect(() => renderTemplate(value,{})).toThrow());
  it('accepts and trims a template', () => expect(templateSchema.parse({...fields,templateName:' Interview Invite '})).toEqual(fields));
  it.each([{subject:'Hi\nInjected header'},{body:'[Unknown]'},{templateName:' '},{usageType:'REMINDER'},{createdBy:99}])('rejects invalid template %j',patch => expect(templateSchema.safeParse({...fields,...patch}).success).toBe(false));
  it.each(['email','employeeId','department','role','accountStatus','profilePhotoUrl','userId'])('rejects protected profile field %s',key => {
    expect(profileSchema.safeParse({fullName:'Riley',phone:'',officeLocation:'',[key]:'changed'}).success).toBe(false);
  });
  it('normalizes valid profile fields', () => expect(profileSchema.parse({fullName:' Riley ',phone:' +65 1234 ',officeLocation:' Office '})).toEqual({fullName:'Riley',phone:'+65 1234',officeLocation:'Office'}));
  it('strips storage paths and secrets from profile DTO', () => {
    const dto = profileDto({get:() => ({userId:1,fullName:'Riley',passwordHash:'test-only',profilePhotoUrl:'private.jpg',phone:null,officeLocation:null})});
    expect(dto.photoUrl).toBe('/api/hr/profile/photo'); expect(dto.phone).toBe('');
    expect(dto).not.toHaveProperty('passwordHash'); expect(dto).not.toHaveProperty('profilePhotoUrl');
  });
  it.each(['0','-1','1.5','2147483648','text'])('rejects invalid ID %s',value => expect(idSchema.safeParse(value).success).toBe(false));
  it('sets bounded pagination defaults', () => expect(filtersSchema.parse({})).toMatchObject({page:1,pageSize:10}));
  it('accepts bounded notification search and strictly validates undo IDs', () => {
    expect(filtersSchema.parse({search:' Casey '})).toMatchObject({search:'Casey'});
    expect(notificationRestoreSchema.parse({notificationIds:[1,2]})).toEqual({notificationIds:[1,2]});
    expect(notificationRestoreSchema.safeParse({notificationIds:[]}).success).toBe(false);
    expect(notificationRestoreSchema.safeParse({notificationIds:[1],extra:true}).success).toBe(false);
  });
  it('uses the UTC+08 calendar boundary for today', () => {
    expect(businessToday(new Date('2026-09-10T15:59:59Z'))).toBe('2026-09-10');
    expect(businessToday(new Date('2026-09-10T16:00:00Z'))).toBe('2026-09-11');
  });
  it.each([{from:'2026-02-30'},{from:'2026-09-09',to:'2026-09-08'},{from:'9999-12-31'},{to:'9999-12-31'},{pageSize:'51'},{page:'0'},{from:['2026-09-08']},{unexpected:'x'}])('rejects malformed or future filters %j',value => expect(filtersSchema.safeParse(value).success).toBe(false));
});
