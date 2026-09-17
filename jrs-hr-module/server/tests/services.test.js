import { describe, it, expect, vi } from 'vitest';
import { Op } from 'sequelize';
import { createServices } from '../src/services.js';

const filters = {page:1,pageSize:10,read:'all'};
const row = data => ({...data,update:vi.fn(async patch => Object.assign(data,patch))});
describe('HR service boundaries (mock ORM; not SQL integration)', () => {
  it('filters successful history by sentAt with UTC+08 inclusive calendar days', async () => {
    const findAndCountAll = vi.fn().mockResolvedValue({rows:[],count:0});
    const svc = createServices({Log:{findAndCountAll}});
    await svc.logs(7,{...filters,from:'2026-09-08',to:'2026-09-08',search:'Casey',trigger:'Accepted'});
    const q = findAndCountAll.mock.calls[0][0];
    expect(q.where).toMatchObject({senderUserId:7,deliveryStatus:'SENT',triggerEvent:'Accepted'});
    expect(q.where.sentAt[Op.gte].toISOString()).toBe('2026-09-07T16:00:00.000Z');
    expect(q.where.sentAt[Op.lt].toISOString()).toBe('2026-09-08T16:00:00.000Z');
    expect(q.where).not.toHaveProperty('createdAt'); expect(q.order[0]).toEqual(['sentAt','DESC']);
    expect(q.where[Op.or]).toHaveLength(2);
  });
  it('requires SENT and a sentAt even when no date range is supplied', async () => {
    const findAndCountAll = vi.fn().mockResolvedValue({rows:[],count:0});
    await createServices({Log:{findAndCountAll}}).logs(1,{...filters,status:'PREVIEW'});
    const where=findAndCountAll.mock.calls[0][0].where;
    expect(where.deliveryStatus).toBe('SENT'); expect(where.sentAt[Op.ne]).toBe(null);
  });
  it('restricts detail and attachments to own successful records', async () => {
    const findOne = vi.fn().mockResolvedValue(null), findByPk=vi.fn().mockResolvedValue(null);
    const svc = createServices({Log:{findOne},Attachment:{findByPk}});
    await expect(svc.log(2,42)).rejects.toMatchObject({status:404});
    expect(findOne.mock.calls[0][0].where).toMatchObject({logId:42,senderUserId:2,deliveryStatus:'SENT'});
    await expect(svc.attachment(2,13)).rejects.toMatchObject({status:404});
    expect(findByPk.mock.calls[0][1].include[0].where).toMatchObject({senderUserId:2,deliveryStatus:'SENT'});
  });
  it('returns stored email snapshots and only public attachment metadata', async () => {
    const svc=createServices({Log:{findOne:vi.fn().mockResolvedValue({logId:2,emailBody:'Original final text',attachments:[{attachmentId:3,fileName:'Offer.pdf',fileType:'application/pdf',fileUrl:'private.pdf'}]})}});
    expect(await svc.log(1,2)).toMatchObject({emailBody:'Original final text',attachments:[{attachmentId:3,fileName:'Offer.pdf',fileType:'application/pdf'}]});
  });
  it('scopes notification list, search and counts to the current HR', async () => {
    const findAndCountAll=vi.fn().mockResolvedValue({rows:[{notificationId:1}],count:1}),count=vi.fn().mockResolvedValue(3);
    const value=await createServices({Notification:{findAndCountAll,count}}).notifications(9,{...filters,read:'unread',type:'NEW_APPLICATION',search:'Casey'});
    expect(findAndCountAll.mock.calls[0][0].where).toMatchObject({recipientUserId:9,isRead:false,notificationType:'NEW_APPLICATION'});
    expect(findAndCountAll.mock.calls[0][0].where[Op.or]).toHaveLength(3);
    expect(count).toHaveBeenCalledWith({where:{recipientUserId:9,isRead:false}});
    expect(count).toHaveBeenCalledWith({where:{recipientUserId:9}});
    expect(value).toMatchObject({unread:3,all:3});
  });
  it('does not mark another HR notification and preserves already-read timestamps', async () => {
    const existing = row({isRead:true,readAt:new Date('2026-01-01')});
    const findOne=vi.fn().mockImplementation(async ({where}) => where.recipientUserId===1 ? existing : null);
    const svc=createServices({Notification:{findOne}});
    await expect(svc.markRead(2,5)).rejects.toMatchObject({status:404});
    await svc.markRead(1,5); expect(existing.update).not.toHaveBeenCalled();
  });
  it('marks only own unread records when marking all', async () => {
    const update=vi.fn().mockResolvedValue([2]),findAll=vi.fn().mockResolvedValue([{notificationId:7},{notificationId:8}]);
    expect(await createServices({Notification:{update,findAll}}).markAllRead(4)).toEqual({updated:2,notificationIds:[7,8]});
    expect(findAll).toHaveBeenCalledWith({where:{recipientUserId:4,isRead:false},attributes:['notificationId']});
    expect(update.mock.calls[0][1].where).toMatchObject({recipientUserId:4,isRead:false});
  });
  it('restores only selected owned read notifications for read-all undo', async () => {
    const update=vi.fn().mockResolvedValue([2]);
    expect(await createServices({Notification:{update}}).restoreUnread(4,[7,8])).toEqual({updated:2});
    expect(update.mock.calls[0][0]).toEqual({isRead:false,readAt:null});
    expect(update.mock.calls[0][1].where).toMatchObject({recipientUserId:4,isRead:true});
  });
  it('allows only profile fields even for an internal service caller', async () => {
    const hr=row({userId:1,role:'HR Manager',email:'hr@example.test'});
    await createServices({HrUser:{findByPk:vi.fn().mockResolvedValue(hr)}}).updateProfile(1,{fullName:'Riley',phone:'',officeLocation:'',role:'Admin',email:'other@example.test'});
    expect(hr.update).toHaveBeenCalledWith({fullName:'Riley',phone:null,officeLocation:null});
  });
  it('archives templates and never updates a historical log', async () => {
    const t=row({templateId:1}),logUpdate=vi.fn();
    const svc=createServices({Template:{findOne:vi.fn().mockResolvedValue(t)},Log:{update:logUpdate}});
    await svc.deleteTemplate(3,1); expect(t.update).toHaveBeenCalledWith({isActive:false,updatedBy:3}); expect(logUpdate).not.toHaveBeenCalled();
  });
  it('requires HR assignment for the read-only application adapter', async () => {
    const findOne=vi.fn().mockResolvedValue(null);
    await expect(createServices({Application:{findOne}}).application(2,55)).rejects.toMatchObject({status:404});
    expect(findOne.mock.calls[0][0].where).toEqual({applicationId:55,assignedHrUserId:2});
  });
  it.each([{accountStatus:'SUSPENDED'},null])('rejects inactive or unmapped HR profiles %j', async hr => {
    const svc=createServices({HrUser:{findByPk:vi.fn().mockResolvedValue(hr)}});
    await expect(svc.authorize({hrUserId:1,role:'HR'})).rejects.toMatchObject({status:403});
  });
  it('uses only the verified HR mapping, never the legacy password account', async () => {
    const hr={userId:7,accountStatus:'ACTIVE'}, findByPk=vi.fn().mockResolvedValue(hr);
    const svc=createServices({HrUser:{findByPk}});
    expect(await svc.authorize({hrUserId:7,role:'HR'})).toBe(hr);
    expect(findByPk).toHaveBeenCalledWith(7);
    await expect(svc.authorize({hrUserId:7,role:'CANDIDATE'})).rejects.toMatchObject({status:403});
    expect(svc.login).toBeUndefined();
  });
});
