import { Component } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth";
import { WorkspaceLayout } from "./layout/WorkspaceLayout";
import { workspaceLinks } from "./layout/navigation";
import { Logs } from "./pages/Logs";
import { Notifications } from "./pages/Notifications";
import { EditProfile, Profile } from "./pages/Profile";
import { Templates } from "./pages/Templates";

class PageBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="alert alert-danger" role="alert">This page could not be displayed. <button className="btn btn-outline-danger" onClick={() => location.reload()}>Reload workspace</button></div> : this.props.children;
  }
}

function TeamWorkspacePlaceholder({ title }) {
  return <section className="surface team-workspace-placeholder"><p className="eyebrow">JRS WORKSPACE</p><h1>{title}</h1><p className="subtle mb-0">This area is ready for the recruitment team module.</p></section>;
}

const page = (content) => <PageBoundary>{content}</PageBoundary>;

export function App() {
  return <AuthProvider><Routes><Route element={<WorkspaceLayout />}>
    <Route index element={<Navigate to="/notifications" replace />} />
    {workspaceLinks.map(([path, name]) => <Route key={path} path={path.slice(1)} element={page(<TeamWorkspacePlaceholder title={name} />)} />)}
    <Route path="notifications" element={page(<Notifications />)} />
    <Route path="templates" element={page(<Templates />)} />
    <Route path="logs" element={page(<Logs />)} />
    <Route path="profile" element={page(<Profile />)} />
    <Route path="profile/edit" element={page(<EditProfile />)} />
    <Route path="*" element={<div className="empty-state"><h1>Page not found</h1><Link to="/notifications">Return to Notifications</Link></div>} />
  </Route></Routes></AuthProvider>;
}
