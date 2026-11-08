import {expect,it,vi,afterEach} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import {PersonalProfileFields,CandidatePersonalInformation} from '../../pages/applications/PersonalInformation';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('retains certificate issue dates and combined reading/writing information',()=>{
 render(<PersonalProfileFields profile={{name:'Alex',email:'alex@example.test',certifications:[{name:'Cloud Certificate',issue:'2025-02',noExpiry:true}],languages:[{name:'English',reading:true,writing:false},{name:'Chinese',reading:false,writing:true}]}}/>);
 expect(screen.getByText('Issued 02 2025 · No expiry')).toBeVisible();expect(screen.getByText('Reading: English')).toBeVisible();expect(screen.getByText('Writing: Chinese')).toBeVisible();
});
it('shows the immutable application snapshot rather than current profile data',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({currentProfile:{name:'Current Alex',summary:'Changed after applying'},applications:[{id:'app-1',profileDetails:{name:'Submitted Alex',summary:'Original submission'}}]}),{status:200})));
 render(<CandidatePersonalInformation person={{id:'c-1',profileSource:'applicant'}} application={{id:'app-1'}}/>);
 expect(await screen.findByText('Original submission')).toBeInTheDocument();expect(screen.queryByText('Changed after applying')).not.toBeInTheDocument();
});
