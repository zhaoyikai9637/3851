import { beforeEach, describe, it, expect, vi } from 'vitest';
import { createServices } from '../src/services.js';

describe('trusted workflow adapter and immutable sending history', () => {
  let models,svc,log,mailer,payload;
  beforeEach(() => {
    payload={userId:1,applicationId:2,templateId:3,eventKey:'test:event:1',triggerEvent:'Accepted'};
    log={...payload,senderUserId:1,deliveryStatus:'PENDING',update:vi.fn(async patch => Object.assign(log,patch))};
    models={Application:{findOne:vi.fn().mockResolvedValue({candidate:{fullName:'Casey',email:'casey@example.test'},position:{title:'Engineer'}})},Template:{findOne:vi.fn().mockResolvedValue({templateName:'Accepted',subject:'[CompanyName]: [JobTitle]',body:'Dear [CandidateName],\nRegards [HRName]'})},HrUser:{findByPk:vi.fn().mockResolvedValue({fullName:'Riley'})},Log:{findOrCreate:vi.fn().mockResolvedValue([log,true])}};
    svc=createServices(models,{companyName:'Example Company'}); mailer={send:vi.fn().mockResolvedValue({preview:true})};
  });
  it('writes a final plain-text snapshot and keeps PREVIEW sentAt null', async () => {
    await svc.sendWorkflowEmail(payload,mailer);
    expect(log.update).toHaveBeenCalledWith({deliveryStatus:'PREVIEW',sentAt:null});
    expect(models.Log.findOrCreate.mock.calls[0][0].defaults).toMatchObject({deliveryStatus:'PENDING',candidateName:'Casey',positionTitle:'Engineer',templateName:'Accepted',emailSubject:'Example Company: Engineer',emailBody:'Dear Casey,\nRegards Riley'});
  });
  it('records provider acceptance as SENT, never DELIVERED', async () => {
    mailer.send.mockResolvedValue({preview:false}); await svc.sendWorkflowEmail(payload,mailer);
    expect(log.update).toHaveBeenCalledWith({deliveryStatus:'SENT',sentAt:expect.any(Date)});
  });
  it('records a failed attempt with a redacted provider error', async () => {
    mailer.send.mockRejectedValue(new Error('test provider secret'));
    await svc.sendWorkflowEmail(payload,mailer);
    expect(log.update).toHaveBeenCalledWith({deliveryStatus:'FAILED',errorMessage:'Mail provider rejected or could not confirm this attempt.'});
  });
  it.each(['SENT','PREVIEW','FAILED','PENDING'])('never resends an existing %s attempt', async status => {
    log.deliveryStatus=status; models.Log.findOrCreate.mockResolvedValue([log,false]);
    expect(await svc.sendWorkflowEmail(payload,mailer)).toBe(log); expect(mailer.send).not.toHaveBeenCalled(); expect(log.update).not.toHaveBeenCalled();
  });
  it('does not resend when provider acceptance was followed by DB update failure', async () => {
    mailer.send.mockResolvedValue({preview:false});log.update.mockRejectedValue(new Error('test persistence failure'));
    await expect(svc.sendWorkflowEmail(payload,mailer)).rejects.toThrow('test persistence failure');
    models.Log.findOrCreate.mockResolvedValue([log,false]); await svc.sendWorkflowEmail(payload,mailer);
    expect(mailer.send).toHaveBeenCalledTimes(1);
  });
  it('does not claim success for an invalid mail adapter response', async () => {
    mailer.send.mockResolvedValue({});await expect(svc.sendWorkflowEmail(payload,mailer)).rejects.toThrow('unconfirmed');
    expect(log.update).not.toHaveBeenCalled();
  });
  it('rejects event key reuse for a different HR', async () => {
    log.senderUserId=5;models.Log.findOrCreate.mockResolvedValue([log,false]);
    await expect(svc.sendWorkflowEmail(payload,mailer)).rejects.toMatchObject({status:409});expect(mailer.send).not.toHaveBeenCalled();
  });
  it('rejects archived templates before creating any log or sending', async () => {
    models.Template.findOne.mockResolvedValue(null);await expect(svc.sendWorkflowEmail(payload,mailer)).rejects.toMatchObject({status:404});
    expect(models.Template.findOne).toHaveBeenCalledWith({where:{templateId:3,isActive:true}});
    expect(models.Log.findOrCreate).not.toHaveBeenCalled();expect(mailer.send).not.toHaveBeenCalled();
  });
  it.each([{},'', ' ', 'x'.repeat(151)])('rejects invalid internal event keys %j', async eventKey => {
    await expect(svc.sendWorkflowEmail({...payload,eventKey},mailer)).rejects.toMatchObject({status:422});expect(mailer.send).not.toHaveBeenCalled();
  });
  it('passes a trusted upstream transaction and recipient into notification creation', async () => {
    const transaction={id:'test-transaction'},record={applicationId:2,notificationType:'NEW_APPLICATION'};
    const Application={findByPk:vi.fn().mockResolvedValue({assignedHrUserId:6,candidate:{fullName:'Casey'},position:{title:'Engineer'}})};
    const Notification={findOrCreate:vi.fn().mockResolvedValue([record,true])};
    await createServices({Application,Notification}).recordApplicationEvent({eventKey:'application:2:new',applicationId:2,type:'NEW_APPLICATION'},{transaction});
    expect(Notification.findOrCreate.mock.calls[0][0]).toMatchObject({transaction,defaults:{recipientUserId:6,applicationId:2,notificationType:'NEW_APPLICATION'}});
  });
});
