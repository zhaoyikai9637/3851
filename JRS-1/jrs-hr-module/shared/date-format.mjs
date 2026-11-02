// Visible dates are DD MM YYYY; API and storage dates remain ISO.
export function parseDisplayDate(value) {
  const text=String(value||'').trim();
  if(!text)return '';
  const match=/^(\d{2}) (\d{2}) (\d{4})$/.exec(text);
  if(!match)return null;
  const [,day,month,year]=match, iso=year+'-'+month+'-'+day;
  const date=new Date(iso+'T12:00:00Z');
  return Number(year)>0&&!Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===iso?iso:null;
}
export function formatDate(value) {
  if(!value)return '';
  const date=new Date(String(value).length===10?value+'T12:00:00+08:00':value);
  if(Number.isNaN(date.getTime()))return '';
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Singapore',day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(date);
  const part=type=>parts.find(p=>p.type===type).value;
  return part('day')+' '+part('month')+' '+part('year').padStart(4,'0');
}
export function formatDateTime(value) {
  if(!value)return '—';
  const day=formatDate(value);
  return day?day+', '+new Intl.DateTimeFormat('en-SG',{timeZone:'Asia/Singapore',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'—';
}
