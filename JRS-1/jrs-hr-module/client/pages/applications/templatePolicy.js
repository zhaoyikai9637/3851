// Client mirror of HRModel.templateAllowed; the server enforces this policy independently.
const businessDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function templateAllowed(db,a,t){
    if(!a||!t?.active)return false;
    const source=db.activity?.find(event=>event.applicationId===a.id&&event.to==='Rejected')?.from;
    switch(t.kind){
      case 'In Progress':return ['Pending Review','Interview','Interview Results'].includes(a.stage);
      case 'Interview Invite':return a.stage==='Interview'&&db.interviews.some(i=>i.applicationId===a.id&&i.status==='Scheduled');
      case 'Offer Letter':return a.stage==='Offer'&&a.offer?.approval==='Approved'&&/^\d{4}-\d{2}-\d{2}$/.test(a.offer.expiry||'')&&a.offer.expiry>=businessDay();
      case 'Accepted':return a.stage==='Hired';
      case 'Rejected':return a.stage==='Rejected';
      case 'Application Rejection':return a.stage==='Rejected'&&source==='Pending Review';
      case 'Interview Rejection':return a.stage==='Rejected'&&['Interview','Interview Results'].includes(source);
      case 'Offer Withdrawal':return a.stage==='Rejected'&&source==='Offer';
      case 'Offer Declined Acknowledgement':return a.offer?.status==='Declined';
      default:return false;
    }
  }
