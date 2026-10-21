import { Component } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth";
import { WorkspaceLayout } from "./layout/WorkspaceLayout";
import { workspaceLinks } from "./layout/navigation";
import { Logs } from "../pages/logs/Logs";
import { Notifications } from "../pages/notifications/Notifications";
import { EditProfile, Profile } from "../pages/profile/Profile";
import { Templates } from "../pages/templates/Templates";
import { Recruitment } from '../pages/recruitment/Recruitment';
import { JobPostings } from '../pages/jobs/JobPostings';

class PageBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="alert alert-danger" role="alert">This page could not be displayed. <button className="btn btn-outline-danger" onClick={() => location.reload()}>Reload workspace</button></div> : this.props.children;
  }
}

const page = (content) => <PageBoundary>{content}</PageBoundary>;

export function App() {
  return <AuthProvider><Routes><Route element={<WorkspaceLayout />}>
    <Route index element={<Navigate to="/notifications" replace />} />
    {workspaceLinks.map(([path, name]) => <Route key={path} path={path.slice(1)} element={page(path === '/job-postings' ? <JobPostings/> : <Recruitment key={path} page={path.slice(1)} title={name} />)} />)}
    <Route path="outbox" element={<Navigate to="/applications" replace />} />
    <Route path="notifications" element={page(<Notifications />)} />
    <Route path="templates" element={page(<Templates />)} />
    <Route path="logs" element={page(<Logs />)} />
    <Route path="profile" element={page(<Profile />)} />
    <Route path="profile/edit" element={page(<EditProfile />)} />
    <Route path="*" element={<div className="empty-state"><h1>Page not found</h1><Link to="/notifications">Return to Notifications</Link></div>} />
  </Route></Routes></AuthProvider>;
}
