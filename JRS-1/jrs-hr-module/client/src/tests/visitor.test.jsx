import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter,Route,Routes,useLocation} from 'react-router-dom';
import JobDetailsPage from '../../../../JRS Applicant Portal/client/pages/jobs/JobDetailsPage';
import api from '../../../../JRS Applicant Portal/client/api/client';
import PublicLayout from '../../../../JRS Applicant Portal/client/components/PublicLayout';
import {AuthProvider} from '../../../../JRS Applicant Portal/client/context/AuthContext';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
const job={id:'role-a',title:'Software Engineer',summary:'Product team',location:'Singapore',workMode:'ON_SITE',employmentType:'FULL_TIME',isOpen:true,responsibilities:['Build services'],requirements:['JavaScript']};
it('the updated public header retains accessible branding and navigation',async()=>{
 vi.spyOn(api,'get').mockResolvedValue({data:{user:null}});

  render(<MemoryRouter><AuthProvider><PublicLayout/></AuthProvider></MemoryRouter>);
  const brand=screen.getByRole('link',{name:'JRS open roles'});
  expect(brand).toHaveAttribute('href','/jobs');
  expect(within(brand).getByText('JRS')).toBeVisible();
  expect(within(brand).getByText('JOB RECRUITMENT SYSTEM')).toBeVisible();
  expect(await screen.findByRole('link',{name:'Sign in'})).toBeVisible();

});
function Location(){return <output aria-label="Current visitor path">{useLocation().pathname}</output>;}
function mount(overrides={}){
 vi.spyOn(api,'get').mockResolvedValue({data:{job:{...job,...overrides}}});
 render(<MemoryRouter initialEntries={['/jobs/role-a']}><Location/><Routes><Route path="/jobs/:jobId" element={<JobDetailsPage/>}/></Routes></MemoryRouter>);
 return userEvent.setup();
}
it('the updated apply link uses the shared sign-in handoff and removes the old modal',async()=>{
 const ui=mount();const link=await screen.findByRole('link',{name:'Sign in to apply'});
 expect(link).toHaveAttribute('href','/connect?returnTo=%2Fapplicant%2Fjobs%2Frole-a');
 await ui.click(link);expect(screen.getByLabelText('Current visitor path')).toHaveTextContent('/connect');
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('closed recruitment disables application entry',async()=>{
 mount({isOpen:false});expect(await screen.findByRole('button',{name:'Applications closed'})).toBeDisabled();
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
