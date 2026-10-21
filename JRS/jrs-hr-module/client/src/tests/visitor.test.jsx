import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter,Route,Routes,useLocation} from 'react-router-dom';
import JobDetailsPage from '../../../../JRS Applicant Portal/client/pages/jobs/JobDetailsPage';
import api from '../../../../JRS Applicant Portal/client/api/client';
import PublicLayout from '../../../../JRS Applicant Portal/client/components/PublicLayout';
import {AuthProvider} from '../../../../JRS Applicant Portal/client/context/AuthContext';
import {readFileSync} from 'node:fs';
import path from 'node:path';
const projectRoot=process.cwd().endsWith('client')?path.resolve(process.cwd(),'../..'):process.cwd();
const publicStyles=readFileSync(path.join(projectRoot,'JRS Applicant Portal/client/assets/css/styles.css'),'utf8');
afterEach(()=>{cleanup();vi.restoreAllMocks();});
const job={id:'role-a',title:'Software Engineer',summary:'Product team',location:'Singapore',workMode:'ON_SITE',employmentType:'FULL_TIME',isOpen:true,responsibilities:['Build services'],requirements:['JavaScript']};
it('public branding uses the login two-circle identity while retaining public navigation',async()=>{
 vi.spyOn(api,'get').mockResolvedValue({data:{user:null}});
 const style=document.createElement('style');style.textContent=publicStyles;document.head.append(style);
 try{
  render(<MemoryRouter><AuthProvider><PublicLayout/></AuthProvider></MemoryRouter>);
  const brand=screen.getByRole('link',{name:'JRS open roles'});
  expect(brand).toHaveAttribute('href','/jobs');
  expect(within(brand).getByText('JRS')).toBeVisible();
  expect(within(brand).getByText('JOB RECRUITMENT SYSTEM')).toBeVisible();
  const circles=brand.querySelectorAll('.public-logo-circle');
  expect(circles).toHaveLength(2);
  expect(getComputedStyle(circles[0]).width).toBe('24px');
  expect(getComputedStyle(circles[0]).backgroundColor).toBe('rgb(15, 23, 42)');
  expect(getComputedStyle(circles[1]).backgroundColor).toBe('rgb(37, 99, 235)');
  expect(getComputedStyle(circles[1]).marginLeft).toBe('-8px');
  expect(await screen.findByRole('link',{name:'Sign in'})).toBeVisible();
 }finally{style.remove();}
});
function Location(){return <output aria-label="Current visitor path">{useLocation().pathname}</output>;}
function mount(overrides={}){
 vi.spyOn(api,'get').mockResolvedValue({data:{job:{...job,...overrides}}});
 render(<MemoryRouter initialEntries={['/jobs/role-a']}><Location/><Routes><Route path="/jobs/:jobId" element={<JobDetailsPage/>}/></Routes></MemoryRouter>);
 return userEvent.setup();
}
it('Apply opens a dismissible sign-in prompt without leaving the job or submitting an application',async()=>{
 const ui=mount();await ui.click(await screen.findByRole('button',{name:'Apply for this role'}));
 const dialog=screen.getByRole('dialog',{name:'Sign in to apply'});
 expect(screen.getByLabelText('Current visitor path')).toHaveTextContent('/jobs/role-a');
 const signIn=within(dialog).getByRole('link',{name:'Sign in'}),registration=within(dialog).getByRole('link',{name:'Create account'});
 expect(new URL(signIn.href).searchParams.get('returnTo')).toBe('/applicant/apply/role-a');
 expect(new URL(registration.href).searchParams.get('mode')).toBe('register');
 await ui.click(within(dialog).getByRole('button',{name:'Continue browsing'}));
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Apply for this role'})).toHaveFocus();
});
it('closed recruitment cannot open an application login prompt',async()=>{
 mount({isOpen:false});expect(await screen.findByRole('button',{name:'Applications closed'})).toBeDisabled();
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
