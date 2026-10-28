// Apply the current intake question contract without rewriting historical answers.
export const startAvailabilityOptions=['Immediately','Within 2 weeks','Within 1 month','Within 2 months','More than 2 months'];
export function applicationQuestions(value) {
 const rows=typeof value==='string'?JSON.parse(value):value||[];
 const availability={id:'availability',label:'When could you start this role?',type:'select',options:[...startAvailabilityOptions],maxLength:40,required:true};
 return rows.some(q=>q.id==='availability')?rows.map(q=>q.id==='availability'?{...q,...availability}:q):[availability,...rows];
}
