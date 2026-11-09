import {beforeEach,expect,it,vi} from 'vitest';
import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import JobsPage from '../../../../JRS Applicant Portal/client/pages/jobs/JobsPage';
import JobDetailsPage from '../../../../JRS Applicant Portal/client/pages/jobs/JobDetailsPage';
import ApplicationPage from '../../../../JRS Applicant Portal/client/pages/application/ApplicationPage';
import {isActiveApplication} from '../../../../JRS Applicant Portal/client/hooks/useCurrentApplication';
import api from '../../../../JRS Applicant Portal/client/api/client';
vi.mock('../../../../JRS Applicant Portal/client/api/client',()=>({default:{get:vi.fn(),post:vi.fn()},getApiError:()=> 'Request failed'}));
const job={id:1,title:'Example Engineer',summary:'Build software',location:'Singapore',employmentType:'FULL_TIME',experienceLevel:'ENTRY',isOpen:true,responsibilities:['Build software'],requirements:['Testing'],benefits:[],roleQuestions:[]};
let application;
beforeEach(()=>{
 application={id:2,status:'Interview',job:{title:'Previous role'}};
 vi.spyOn(window,'scrollTo').mockImplementation(()=>{});api.post.mockReset();api.get.mockReset();
 api.get.mockImplementation(async url=>({data:url==='/applications/me'?{application}:url==='/jobs'?{jobs:[job],filters:{locations:[],employmentTypes:[],experienceLevels:[]}}:url==='/jobs/1'?{job}:url==='/profile'?{profile:{phone:'+6581234567',location:'Singapore'}}:url==='/resumes'?{resumes:[]}:{options:[]}}));
});
function mount(element,path='/applicant/jobs/1') {render(<MemoryRouter initialEntries={[path]}><Routes><Route path='/applicant/jobs' element={element}/><Route path='/applicant/jobs/:jobId' element={element}/><Route path='/applicant/apply/:jobId' element={element}/><Route path='/applicant/status' element={<p>Existing application status</p>}/></Routes></MemoryRouter>);return userEvent.setup();}
it.each(['Submitted','Pending Review','Interview','Interview Results','Offer'])('recognizes an active %s application',status=>expect(isActiveApplication({status})).toBe(true));
it.each(['Withdrawn','Rejected','Accepted'])('allows a new application after %s as the backend does',status=>expect(isActiveApplication({status})).toBe(false));
it('allows a first application',()=>expect(isActiveApplication(null)).toBe(false));
it('shows the existing application on the jobs list with a status link',async()=>{
 const ui=mount(<JobsPage authenticated/>,'/applicant/jobs');
 expect(await screen.findByText('You already have an active application')).toBeVisible();
 expect(screen.getByText(/Your application for Previous role/)).toBeVisible();
 await ui.click(screen.getByRole('link',{name:'View status'}));expect(screen.getByText('Existing application status')).toBeVisible();
});
it('disables applying on role details while an application is active',async()=>{
 mount(<JobDetailsPage authenticated/>);expect(await screen.findByRole('button',{name:'Application in progress'})).toBeDisabled();
 expect(screen.getByText('You already have an active application')).toBeVisible();
});
it('blocks direct application form links before users fill the steps',async()=>{
 mount(<ApplicationPage/>,'/applicant/apply/1');expect(await screen.findByText('You already have an active application')).toBeVisible();
 expect(screen.queryByRole('button',{name:'Continue',exact:true})).not.toBeInTheDocument();expect(api.post).not.toHaveBeenCalled();
});
it('retains the normal role application entry after withdrawal',async()=>{
 application={status:'Withdrawn'};mount(<JobDetailsPage authenticated/>);
 expect(await screen.findByRole('button',{name:'Apply for this role'})).toBeEnabled();
 expect(screen.queryByText('You already have an active application')).not.toBeInTheDocument();
});
it('keeps visitors on their existing login flow without fetching a personal application',async()=>{
 mount(<JobDetailsPage/>);expect(await screen.findByRole('link',{name:'Sign in to apply'})).toHaveAttribute('href','/connect?returnTo=%2Fapplicant%2Fjobs%2F1');
 expect(api.get.mock.calls.some(([url])=>url==='/applications/me')).toBe(false);
});
