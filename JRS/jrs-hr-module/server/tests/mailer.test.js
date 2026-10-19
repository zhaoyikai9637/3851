import { describe, it, expect, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { createMailer } from '../src/mailer.js';

describe('mail adapter (never opens a network transport in tests)', () => {
  it('defaults to preview without constructing SMTP transport', async () => {
    const create=vi.spyOn(nodemailer,'createTransport');
    expect(await createMailer({}).send({to:'casey@example.test'})).toEqual({preview:true});expect(create).not.toHaveBeenCalled();
  });
  it('requires explicit SMTP opt-in', () => expect(() => createMailer({MAIL_MODE:'smtp',SMTP_HOST:'smtp.example.test',MAIL_FROM:'hr@example.test'})).toThrow('MAIL_ALLOW_SMTP'));
  it('limits accepted message fields and blocks file/URL access', async () => {
    const sendMail=vi.fn().mockResolvedValue({accepted:['casey@example.test']});
    const create=vi.spyOn(nodemailer,'createTransport').mockReturnValue({sendMail});
    const adapter=createMailer({MAIL_MODE:'smtp',MAIL_ALLOW_SMTP:'true',SMTP_HOST:'smtp.example.test',MAIL_FROM:'hr@example.test'});
    expect(await adapter.send({to:'casey@example.test',subject:'Hi',text:'Text',raw:{path:'private.txt'},attachments:[{path:'private.txt'}],from:'spoof@example.test'})).toEqual({preview:false});
    expect(create).toHaveBeenCalledWith(expect.objectContaining({disableFileAccess:true,disableUrlAccess:true}));
    expect(sendMail).toHaveBeenCalledWith({from:'hr@example.test',to:'casey@example.test',subject:'Hi',text:'Text'});
  });
  it('does not claim submission success with no accepted recipients', async () => {
    vi.spyOn(nodemailer,'createTransport').mockReturnValue({sendMail:vi.fn().mockResolvedValue({accepted:[]})});
    const adapter=createMailer({MAIL_MODE:'smtp',MAIL_ALLOW_SMTP:'true',SMTP_HOST:'smtp.example.test',MAIL_FROM:'hr@example.test'});
    await expect(adapter.send({to:'casey@example.test',subject:'Hi',text:'Text'})).rejects.toThrow('No accepted recipient');
  });
  it('loads the updated real Nodemailer MIME implementation with memory-only transport', async () => {
    const transport=nodemailer.createTransport({streamTransport:true,buffer:true,newline:'unix',disableFileAccess:true,disableUrlAccess:true});
    const result=await transport.sendMail({from:'hr@example.test',to:'casey@example.test',subject:'Test only',text:'Plain text'});
    expect(result.message.toString()).toContain('Subject: Test only'); expect(result.message.toString()).toContain('Plain text');
  });
});
