const email=(templateName,usageType,subject,paragraphs)=>({templateName,usageType,subject,body:'Dear [CandidateName],\n\n'+paragraphs.join('\n\n')+'\n\nKind regards,\n[HRName]\n[CompanyName]'});
export const formalTemplates=[
 email('Interview Invite','INTERVIEW_INVITE','Interview invitation for [JobTitle] at [CompanyName]',[
  'Thank you for your interest in the [JobTitle] position. We would like to invite you to the interview stage of our recruitment process.',
  'The recruitment team will contact you separately to arrange a suitable date, time and meeting location. This invitation does not confirm an interview appointment.',
  'If you have any questions or need an adjustment to take part in the interview, please contact the recruitment team.'
 ]),
 email('Interview Schedule','INTERVIEW_INVITE','Interview details: [JobTitle] on [InterviewDate]',[
  'Your interview for [JobTitle] has been scheduled with the following details:',
  'Date: [InterviewDate]\nTime: [InterviewTime] (UTC+08:00)\nFormat: [InterviewFormat]\nLocation or meeting link: [InterviewLocation]\nInterviewer: [Interviewer]',
  'Please review these arrangements and contact the recruitment team if you need clarification, an adjustment or a change to the appointment. For an online interview, check the meeting link and your connection before the scheduled time.'
 ]),
 email('Offer Letter','OFFER_LETTER','Your offer for [JobTitle] at [CompanyName]',[
  'We are pleased to share the approved offer details for the [JobTitle] position:',
  'Recorded salary: [OfferCurrency] [OfferSalary]\nProposed start date: [OfferStartDate]\nResponse deadline: [OfferDeadline]',
  'Please review the formal offer document and its employment terms before making your decision. This message summarizes the approved recruitment record and does not add or replace any contractual terms.',
  'Contact the recruitment team with questions about the offer or to communicate your decision before the stated deadline.'
 ]),
 email('Accepted','ACCEPTED','Your acceptance has been recorded for [JobTitle]',[
  'Thank you for accepting the offer for [JobTitle] at [CompanyName]. The recruitment team has recorded your acceptance.',
  'Your designated contact will confirm the remaining documents and joining arrangements. Please refer to the formal offer and the team\'s instructions for the agreed terms and start arrangements.',
  'We appreciate the time you have taken throughout the recruitment process.'
 ]),
 email('Rejected','REJECTED','Application outcome for [JobTitle]',[
  'Thank you for your interest in [JobTitle] at [CompanyName] and for the time you have invested in your application.',
  'Following our review, we will not be progressing your application for this vacancy.',
  'We appreciate the opportunity to learn about your experience and wish you well in your job search.'
 ]),
 email('In Progress','IN_PROGRESS','Your [JobTitle] application is under review',[
  'Your application for [JobTitle] at [CompanyName] is currently under review.',
  'Our recruitment team is reviewing the information you submitted against the requirements of the role. No further action is required unless the team contacts you.',
  'We will contact you when a further update is available. Thank you for your patience and interest in joining us.'
 ]),
 email('Application Rejection','APPLICATION_REJECTION','Application update for [JobTitle]',[
  'Thank you for applying for [JobTitle] at [CompanyName].',
  'After reviewing your application, we will not be progressing it to the interview stage for this vacancy.',
  'We appreciate the time you spent preparing your application and wish you success in your job search.'
 ]),
 email('Interview Rejection','INTERVIEW_REJECTION','Interview outcome for [JobTitle]',[
  'Thank you for taking the time to interview for [JobTitle] at [CompanyName]. We appreciated the opportunity to learn about your experience.',
  'Following the interview review, we will not be progressing your application further for this position.',
  'We recognize the preparation and time you invested in the process. Thank you for your interest, and we wish you well in your next opportunity.'
 ]),
 email('Offer Withdrawal','OFFER_WITHDRAWAL','Offer withdrawal for [JobTitle]',[
  'We are writing to confirm that [CompanyName] has withdrawn the offer for [JobTitle]. The recruitment team has recorded this decision.',
  'We recognize the time you have invested in the process. Please contact the recruitment team if you need clarification about this update or any arrangements already discussed.'
 ]),
 email('Offer Declined Acknowledgement','OFFER_DECLINED_ACKNOWLEDGEMENT','Acknowledgement of your decision for [JobTitle]',[
  'Thank you for letting us know your decision regarding the offer for [JobTitle] at [CompanyName]. We have recorded that you declined the offer.',
  'We appreciate the time you spent speaking with our team and considering the opportunity. We wish you success in your next step.'
 ])
];
