import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { pageName } from './navigation';

export function WorkspacePath({ pathname, trail }) {
  const {search}=useLocation(),view=new URLSearchParams(search).get('view')||'';
  const applicationItems=pathname==='/applications'?(/^(review|results)\//.test(view)||new URLSearchParams(search).has('application')?[{label:'Applications',to:'/applications'},{label:'Assess application'}]:view.startsWith('candidate/')?[{label:'Applications',to:'/applications'},{label:'Candidate profile'}]:[{label:'Applications'}]):null;
  const embedded = trail;
  const items = applicationItems || embedded?.items || (pathname === '/profile/edit'
    ? [{ label: 'My Profile', to: '/profile' }, { label: 'Edit Profile' }]
    : [{ label: pageName(pathname) }]);
  return <nav className="workspace-location" aria-label="Current location">
    <ol>
      {items.map((item, index) => <Fragment key={`${index}-${item.label}`}>
        {index > 0 && <li className="path-separator" aria-hidden="true">/</li>}
        <li>{index === items.length - 1 ? <h1 id="workspace-page-title" aria-current="page">{item.label}</h1>
          : item.to ? <Link to={item.to}>{item.label}</Link>
          : <button type="button" onClick={() => embedded?.open(item.route)}>{item.label}</button>}</li>
      </Fragment>)}
    </ol>
  </nav>;
}
