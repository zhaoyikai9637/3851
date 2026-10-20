import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { pageName } from './navigation';

export function WorkspacePath({ pathname, trail }) {
  const embedded = trail;
  const items = embedded?.items || (pathname === '/profile/edit'
    ? [{ label: 'My Profile', to: '/profile' }, { label: 'Edit Profile' }]
    : [{ label: pageName(pathname) }]);
  return <nav className="workspace-location" aria-label="Current location">
    <ol>
      <li><Link to="/dashboard">HR Workspace</Link></li>
      {items.map((item, index) => <Fragment key={`${index}-${item.label}`}>
        <li className="path-separator" aria-hidden="true">/</li>
        <li>{index === items.length - 1 ? <span aria-current="page">{item.label}</span>
          : item.to ? <Link to={item.to}>{item.label}</Link>
          : <button type="button" onClick={() => embedded?.open(item.route)}>{item.label}</button>}</li>
      </Fragment>)}
    </ol>
  </nav>;
}
