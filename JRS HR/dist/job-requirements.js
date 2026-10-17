/* Shared job requirement content and validation for the browser and backend.
 * Templates are editable starting points, never inferred from applicant data.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.HRJobRequirements=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const MIN=8,MAX=12;
  const policy='This role is not open to fresh graduates.';
  const teamwork='Strong communication and teamwork';
  const templates={
    'Software Developer':[
      'Diploma or Degree in Computer Science, Information Technology or a related discipline.',
      'At least 2 years of relevant professional software development experience.',
      'Experience with Java or Spring Boot',
      'Frontend experience with React',
      'SQL database and REST API knowledge',
      'Docker or cloud deployment experience',
      'Ability to use Git for version control and participate in code reviews.',
      'Ability to debug application defects and write unit tests for application logic.',
      teamwork,
      policy
    ],
    'UI Designer':[
      'Diploma or Degree in Design, Human-Computer Interaction or a related discipline.',
      'At least 2 years of relevant professional user interface design experience.',
      'Practical experience with Figma',
      'Portfolio demonstrating clear user flows, interface layouts and design decisions.',
      'Ability to create wireframes and interactive prototypes for web or mobile products.',
      'Knowledge of visual hierarchy, typography, colour and consistent component design.',
      'Ability to design accessible interfaces with clear navigation and readable content.',
      'Ability to conduct usability reviews and prepare design specifications for developers.',
      teamwork,
      policy
    ],
    'Data Analyst':[
      'Diploma or Degree in Data Analytics, Statistics, Computer Science or a related discipline.',
      'At least 2 years of relevant professional data analysis experience.',
      'Practical experience with SQL',
      'Ability to use Python to clean, transform and analyse datasets.',
      'Ability to build clear Power BI dashboards and explain the meaning of key measures.',
      'Knowledge of descriptive statistics and appropriate methods for comparing data.',
      'Ability to identify missing values, duplicates and data quality issues before reporting.',
      'Ability to translate business questions into documented metrics and actionable findings.',
      teamwork,
      policy
    ],
    'Marketing Executive':[
      'Diploma or Degree in Marketing, Communications, Business or a related discipline.',
      'At least 2 years of relevant professional marketing experience.',
      'Practical experience with SEO',
      'Ability to plan and coordinate campaigns against agreed objectives and deadlines.',
      'Ability to write and edit clear copy suited to the audience and communication channel.',
      'Experience using analytics to measure campaign reach, engagement and conversion.',
      'Ability to maintain a content calendar and coordinate campaign assets with designers.',
      'Ability to monitor campaign spending and prepare performance reports with recommendations.',
      teamwork,
      policy
    ],
    'Support Officer':[
      'Diploma or Degree in Business, Information Technology or a related discipline.',
      'At least 2 years of relevant professional customer support experience.',
      'Practical experience with customer communication and handling service enquiries.',
      'Ability to record and maintain accurate customer cases in a CRM system.',
      'Ability to troubleshoot common customer issues and explain solutions clearly.',
      'Ability to prioritise cases by urgency and follow agreed response procedures.',
      'Ability to escalate unresolved issues with sufficient context and supporting evidence.',
      'Ability to protect customer information and document solutions for future reference.',
      teamwork,
      policy
    ],
    'System Analyst':[
      'Diploma or Degree in Information Systems, Computer Science or a related discipline.',
      'At least 2 years of relevant professional systems analysis experience.',
      'Practical experience with SQL',
      'Ability to gather, clarify and document business and user requirements.',
      'Ability to describe processes, data flows and system behaviour using UML diagrams.',
      'Ability to prepare functional specifications and maintain traceability to requirements.',
      'Ability to analyse system integrations and identify data validation and access needs.',
      'Ability to define acceptance criteria and help investigate issues found during testing.',
      teamwork,
      policy
    ],
    'Backend Engineer':[
      'Diploma or Degree in Computer Science, Information Technology or a related discipline.',
      'At least 2 years of relevant professional backend development experience.',
      'Practical experience with Node.js',
      'Ability to design and implement REST APIs with clear validation and error handling.',
      'Knowledge of SQL schema design, transactions and query performance.',
      'Ability to implement authentication, authorisation and secure handling of application data.',
      'Ability to use Git, review code and maintain clear API documentation.',
      'Ability to write automated tests and investigate failures using application logs.',
      teamwork,
      policy
    ],
    'HR Business Partner':[
      'Diploma or Degree in Human Resources, Business or a related discipline.',
      'At least 2 years of relevant professional human resources experience.',
      'Practical experience with Recruitment',
      'Ability to work with managers to clarify hiring needs and coordinate selection processes.',
      'Ability to maintain accurate employee and recruitment records in an HRIS.',
      'Knowledge of employment policies and appropriate handling of confidential personnel data.',
      'Ability to handle employee enquiries fairly and escalate sensitive matters appropriately.',
      'Ability to prepare HR reports and communicate practical recommendations to managers.',
      teamwork,
      policy
    ],
    'DevOps Engineer':[
      'Diploma or Degree in Computer Science, Information Technology or a related discipline.',
      'At least 2 years of relevant professional DevOps or infrastructure engineering experience.',
      'Practical experience with Docker',
      'Ability to administer Linux environments and troubleshoot operating system issues.',
      'Ability to build and maintain CI/CD pipelines with repeatable deployment steps.',
      'Experience configuring and operating services on a cloud platform.',
      'Ability to manage service configuration, secrets and access permissions securely.',
      'Ability to monitor application health, investigate incidents and verify backup recovery.',
      teamwork,
      policy
    ],
    'Finance Executive':[
      'Diploma or Degree in Accounting, Finance or a related discipline.',
      'At least 2 years of relevant professional accounting or finance experience.',
      'Practical experience with Excel',
      'Knowledge of double-entry bookkeeping and accurate transaction recording.',
      'Ability to reconcile bank balances, invoices and ledger accounts.',
      'Ability to support accounts payable and receivable with complete supporting documents.',
      'Ability to prepare financial reports and assist with month-end closing deadlines.',
      'Ability to maintain audit records, follow financial controls and protect confidential data.',
      teamwork,
      policy
    ]
  };

  function forTitle(title){
    return Object.prototype.hasOwnProperty.call(templates,title)?templates[title].slice():[];
  }

  // Accept one requirement per line; pasted list markers are presentation only.
  function parse(value){
    const values=Array.isArray(value)?value:typeof value==='string'?[value]:[];
    return values.flatMap(item=>String(item??'').split(/\r\n|\r|\n/))
      .map(item=>item.trim().replace(/^(?:(?:[-*\u2022\u25aa\u25e6\u2023\u2013\u2014])\s+|\(?\d{1,2}[.)]\s+)/,'').trim())
      .filter(Boolean);
  }

  function validate(value){
    const requirements=parse(value);
    if(requirements.length<MIN||requirements.length>MAX)throw Error('Job Requirements must contain 8 to 12 separate criteria, one per line.');
    if(requirements.some(item=>item.length>350))throw Error('Each job requirement must be 350 characters or fewer.');
    if(requirements.join('\n').length>3000)throw Error('Job Requirements must be 3000 characters or fewer in total.');
    const keys=requirements.map(item=>item.toLowerCase().replace(/\s+/g,' ').trim());
    if(new Set(keys).size!==keys.length)throw Error('Job Requirements must not contain duplicate criteria.');
    return requirements;
  }

  return Object.freeze({MIN,MAX,titles:Object.freeze(Object.keys(templates)),forTitle,parse,validate});
});
