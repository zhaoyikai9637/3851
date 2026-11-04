import React from 'react';import {beforeEach,afterEach,expect,it,vi} from 'vitest';import {render,screen,waitFor,cleanup} from '@testing-library/react';import userEvent from '@testing-library/user-event';import {MemoryRouter} from 'react-router-dom';
vi.mock('../../../../JRS Applicant Portal/client/api/client',()=>({default:{get:vi.fn(),put:vi.fn()},getApiError:(_e,f)=>f}));
import api from '../../../../JRS Applicant Portal/client/api/client';import Page from '../../../../JRS Applicant Portal/client/pages/application/ApplicationStatusPage';
const application={id:9,status:'Accepted',job:{title:'Accepted role',department:'Engineering',location:'Singapore'},submittedAt:'2026-11-01',updatedAt:'2026-11-03',resume:{originalName:'Resume.pdf'}};
beforeEach(()=>vi.clearAllMocks());afterEach(cleanup);
it('renders accepted application while profile is pending, then keeps it after profile failure',async()=>{let rejectProfile;api.get.mockImplementation(url=>url==='/applications/me'?Promise.resolve({data:{application}}):new Promise((_r,reject)=>rejectProfile=reject));render(<MemoryRouter><Page/></MemoryRouter>);expect(await screen.findByRole('heading',{name:'Application details'})).toBeInTheDocument();rejectProfile(new Error('reset'));expect(await screen.findByText(/Your profile settings could not be loaded/)).toBeInTheDocument();expect(screen.queryByText('No current application')).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Not looking for opportunities'})).not.toBeInTheDocument();api.get.mockResolvedValue({data:{profile:{availabilityStatus:'AVAILABLE'}}});await userEvent.click(screen.getByRole('button',{name:'Retry profile settings'}));expect(await screen.findByRole('button',{name:'Not looking for opportunities'})).toBeInTheDocument();});
it('failed application load shows retry, never no-application; retry can then show the stored application',async()=>{api.get.mockImplementation(url=>url==='/profile'?Promise.resolve({data:{profile:{}}}):Promise.reject(new Error('reset')));render(<MemoryRouter><Page/></MemoryRouter>);expect(await screen.findByRole('heading',{name:'Unable to load your application'})).toBeInTheDocument();expect(screen.queryByText('No current application')).not.toBeInTheDocument();api.get.mockResolvedValue({data:{application}});await userEvent.click(screen.getByRole('button',{name:'Try again'}));expect(await screen.findByRole('heading',{name:'Application details'})).toBeInTheDocument();});
it('only a successful empty application response shows the genuine empty state',async()=>{api.get.mockResolvedValue({data:{application:null,profile:{}}});render(<MemoryRouter><Page/></MemoryRouter>);expect(await screen.findByRole('heading',{name:'No current application'})).toBeInTheDocument();expect(screen.queryByText('Unable to load your application')).not.toBeInTheDocument();});

it('closes job searching without claiming to hide submitted applications',async()=>{
 const profile={availabilityStatus:'AVAILABLE',phoneNumber:'81234567'};
 api.get.mockImplementation(url=>Promise.resolve({data:url==='/profile'?{profile}:{application}}));
 api.put.mockResolvedValue({data:{profile:{...profile,availabilityStatus:'CLOSED'}}});
 render(<MemoryRouter><Page/></MemoryRouter>);
 await userEvent.click(await screen.findByRole('button',{name:'Not looking for opportunities'}));
 expect(api.put).toHaveBeenCalledWith('/profile',{...profile,availabilityStatus:'CLOSED'});
 expect(await screen.findByText('Your job-search status has been updated. HR can still view your submitted applications.')).toBeInTheDocument();
 expect(screen.getByRole('heading',{name:'Application details'})).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Not looking for opportunities'})).not.toBeInTheDocument();
});