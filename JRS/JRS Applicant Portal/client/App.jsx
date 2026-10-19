import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicLayout from "./components/PublicLayout";
import ApplicationPage from "./pages/application/ApplicationPage";
import ApplicationStatusPage from "./pages/application/ApplicationStatusPage";
import AuthCallbackPage from "./pages/auth/AuthCallbackPage";
import AuthConnectPage from "./pages/auth/AuthConnectPage";
import JobDetailsPage from "./pages/jobs/JobDetailsPage";
import JobsPage from "./pages/jobs/JobsPage";
import NotFoundPage from "./pages/not-found/NotFoundPage";
import ResumePage from "./pages/resume/ResumePage";
import ResumeUploadPage from "./pages/resume/ResumeUploadPage";

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Navigate to="/jobs" replace />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/:jobId" element={<JobDetailsPage />} />
        <Route path="/connect" element={<AuthConnectPage />} />
        <Route path="/auth/complete" element={<AuthCallbackPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/applicant" element={<Navigate to="/applicant/jobs" replace />} />
          <Route path="/applicant/jobs" element={<JobsPage authenticated />} />
          <Route path="/applicant/jobs/:jobId" element={<JobDetailsPage authenticated />} />
          <Route path="/applicant/apply/:jobId" element={<ApplicationPage />} />
          <Route path="/applicant/resume" element={<ResumePage />} />
          <Route path="/applicant/resume/upload" element={<ResumeUploadPage />} />
          <Route path="/applicant/status" element={<ApplicationStatusPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
