import {beforeEach,expect,it,vi} from 'vitest';
import {useState} from 'react';
import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import SkillSelector from '../../../../JRS Applicant Portal/client/components/SkillSelector';
import ApplicationPage from '../../../../JRS Applicant Portal/client/pages/application/ApplicationPage';
import api from '../../../../JRS Applicant Portal/client/api/client';
vi.mock('../../../../JRS Applicant Portal/client/api/client',()=>({default:{get:vi.fn(),post:vi.fn()},getApiError:()=> 'Request failed'}));
beforeEach(()=>{vi.spyOn(window,'scrollTo').mockImplementation(()=>{});api.get.mockReset();api.post.mockReset();});
it('adds free-form skills and refuses case-insensitive duplicates before removal',async()=>{
 function Skills(){const [value,setValue]=useState([]);return <SkillSelector value={value} onChange={setValue}/>;}
 render(<Skills/>);const ui=userEvent.setup();await ui.type(screen.getByRole('textbox',{name:'Add a skill'}),'Stakeholder engagement{Enter}');expect(screen.getByTitle('Remove Stakeholder engagement')).toBeVisible();
 await ui.type(screen.getByRole('textbox',{name:'Add a skill'}),'stakeholder engagement{Enter}');expect(screen.getByRole('alert')).toHaveTextContent('already been added');
 await ui.click(screen.getByTitle('Remove Stakeholder engagement'));expect(screen.queryByTitle('Remove Stakeholder engagement')).not.toBeInTheDocument();
});
it('retains section edits, highlights missing answers and requires declaration before submitting',async()=>{
 const job={id:1,title:'Example Engineer',location:'Singapore',employmentType:'FULL_TIME',roleQuestions:[{id:'availability',label:'When could you start this role?',type:'select',required:true,maxLength:40,options:['Immediately','Within 1 month']}]};
 api.get.mockImplementation(async(url,options)=>({data:url==='/jobs/1'?{job}:url==='/profile'?{profile:{phone:'+6581234567',location:'["SG","",""]',experiences:[{companyName:'Historical entry'}]}}:url==='/resumes'?{resumes:[{id:1,originalName:'Example.pdf'}]}:{options:options?.params?[]:[{code:'SG',name:'Singapore'}]}}));api.post.mockResolvedValue({data:{application:{id:1}}});
 render(<MemoryRouter initialEntries={['/applicant/apply/1']}><Routes><Route path='/applicant/apply/:jobId' element={<ApplicationPage/>}/><Route path='/applicant/status' element={<p>Submitted test application</p>}/></Routes></MemoryRouter>);
 const ui=userEvent.setup();await screen.findByRole('heading',{name:'Example Engineer'});await ui.click(screen.getByRole('button',{name:'Continue',exact:true}));expect(screen.getByLabelText(/Company name/)).toHaveValue('');
 await ui.type(screen.getByLabelText(/Company name/),'Example Company');await ui.type(screen.getByLabelText(/Job title/),'Developer');await ui.selectOptions(screen.getByRole('combobox',{name:'Start year'}),'2024');await ui.selectOptions(screen.getByRole('combobox',{name:'Start month'}),'01');await ui.click(screen.getByRole('checkbox',{name:'I currently work in this role'}));await ui.type(screen.getByLabelText(/Main responsibilities/),'Implemented reliable software for business users.');await ui.type(screen.getByRole('textbox',{name:'Add a skill'}),'Stakeholder engagement{Enter}');await ui.click(screen.getByRole('button',{name:'Continue',exact:true}));
 await ui.click(screen.getByRole('button',{name:'Continue',exact:true}));expect(screen.getByText('This answer is required.')).toBeVisible();await ui.selectOptions(screen.getByRole('combobox',{name:/When could you start/}),'Within 1 month');await ui.click(screen.getByRole('button',{name:'Continue',exact:true}));
 await ui.click(screen.getByRole('button',{name:'Edit work experience',exact:true}));expect(screen.getByLabelText(/Company name/)).toHaveValue('Example Company');expect(screen.getByTitle('Remove Stakeholder engagement')).toBeVisible();await ui.click(screen.getByRole('button',{name:'Continue',exact:true}));await ui.click(screen.getByRole('button',{name:'Continue',exact:true}));
 await ui.click(screen.getByRole('button',{name:'Submit application',exact:true}));expect(screen.getByRole('alert')).toHaveTextContent('accept the declaration');expect(api.post).not.toHaveBeenCalled();await ui.click(screen.getByRole('checkbox'));await ui.click(screen.getByRole('button',{name:'Submit application',exact:true}));await screen.findByText('Submitted test application');
 expect(api.post).toHaveBeenCalledWith('/applications',expect.objectContaining({declarationAccepted:true,roleAnswers:{availability:'Within 1 month'},experiences:[expect.objectContaining({skills:['Stakeholder engagement']})]}));
});
