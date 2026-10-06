import { ArrowLeft, CheckCircle2, FileText, FolderOpen, Trash2, UploadCloud, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api, { getApiError } from "../../api/client";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = new Set(["pdf", "doc", "docx"]);
const ACCEPTED_FILES = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file) {
  if (!file) return "Choose a resume file to continue.";
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.has(extension)) return "Choose a PDF, DOC, or DOCX resume.";
  if (file.size > MAX_FILE_SIZE) return "The resume must be 5 MB or smaller.";
  if (file.name.length > 180) return "The file name must be 180 characters or fewer.";
  return "";
}

function safeReturnPath(value) {
  return value?.startsWith("/applicant/") ? value : "";
}

export default function ResumeUploadPage() {
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnPath(searchParams.get("returnTo"));
  const fileInputRef = useRef(null);
  const [resumes, setResumes] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.get("/resumes")
      .then(({ data }) => setResumes(data.resumes))
      .catch((requestError) => setMessage({ type: "danger", text: getApiError(requestError, "Unable to load your resume files.") }))
      .finally(() => setLoading(false));
  }, []);

  function chooseFile(file) {
    const validationError = validateFile(file);
    if (validationError) {
      setSelectedFile(null);
      setMessage({ type: "danger", text: validationError });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setSelectedFile(file);
    setMessage(null);
    setProgress(0);
  }

  function clearSelection() {
    setSelectedFile(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDrag(event) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(event.type === "dragenter" || event.type === "dragover");
  }

  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    chooseFile(event.dataTransfer.files?.[0]);
  }

  async function uploadResume(event) {
    event.preventDefault();
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setMessage({ type: "danger", text: validationError });
      return;
    }

    setUploading(true);
    setProgress(0);
    setMessage(null);
    try {
      const payload = new FormData();
      payload.append("resume", selectedFile);
      const { data } = await api.post("/resumes", payload, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: ({ loaded, total }) => {
          if (total) setProgress(Math.round((loaded / total) * 100));
        },
      });
      setResumes((current) => [data.resume, ...current]);
      clearSelection();
      setProgress(100);
      setMessage({ type: "success", text: `${data.resume.originalName} was uploaded successfully.` });
    } catch (requestError) {
      setProgress(0);
      setMessage({ type: "danger", text: getApiError(requestError, "Unable to upload this resume.") });
    } finally {
      setUploading(false);
    }
  }

  async function deleteResume(resume) {
    if (!window.confirm(`Remove ${resume.originalName} from your account?`)) return;
    setMessage(null);
    try {
      await api.delete(`/resumes/${resume.id}`);
      setResumes((current) => current.filter((item) => item.id !== resume.id));
      setMessage({ type: "success", text: "Resume removed." });
    } catch (requestError) {
      setMessage({ type: "danger", text: getApiError(requestError, "Unable to remove this resume.") });
    }
  }

  return (
    <div className="page-stack resume-upload-page">
      <Link className="back-link" to={returnTo || "/applicant/resume"}>
        <ArrowLeft size={20} />{returnTo ? "Back to application" : "Back to resume and profile"}
      </Link>

      {message && <div className={`alert alert-${message.type} mb-0`} role="alert">{message.text}</div>}

      <section className="surface resume-upload-intro">
        <div className="resume-upload-icon" aria-hidden="true"><UploadCloud size={34} /></div>
        <div>
          <p className="eyebrow text-primary">RESUME DOCUMENT</p>
          <h2>Upload a resume for your application</h2>
          <p>Choose the version that best matches the position. You can keep more than one resume for future vacancies.</p>
        </div>
        <div className="upload-rules" aria-label="Upload requirements">
          <span>PDF, DOC, DOCX</span>
          <span>Maximum 5 MB</span>
        </div>
      </section>

      <section className="surface upload-workspace">
        <div className="section-heading">
          <h2>Select your file</h2>
          <p>Upload one file at a time. Clear file names help recruiters identify the correct resume.</p>
        </div>

        <form className="resume-upload-form" onSubmit={uploadResume}>
          <label
            className={`resume-dropzone ${dragActive ? "drag-active" : ""} ${selectedFile ? "has-file" : ""}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILES}
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
            <FolderOpen size={38} aria-hidden="true" />
            <strong>{selectedFile ? selectedFile.name : "Drag your resume here"}</strong>
            <span>{selectedFile ? `${formatFileSize(selectedFile.size)} selected` : "or choose a file from your computer"}</span>
            <span className="btn btn-outline-primary resume-browse-button">Choose file</span>
          </label>

          {selectedFile && (
            <div className="selected-resume-row">
              <FileText size={25} aria-hidden="true" />
              <div>
                <strong>{selectedFile.name}</strong>
                <span>{formatFileSize(selectedFile.size)} - Ready to upload</span>
              </div>
              <button className="icon-button" type="button" onClick={clearSelection} aria-label="Clear selected resume" disabled={uploading}>
                <X size={21} />
              </button>
            </div>
          )}

          {uploading && (
            <div className="upload-progress" aria-live="polite">
              <div className="upload-progress-copy"><span>Uploading resume</span><strong>{progress}%</strong></div>
              <div className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
                <div className="progress-bar" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <button className="btn btn-primary btn-lg upload-submit-button" type="submit" disabled={!selectedFile || uploading}>
            <UploadCloud size={21} />{uploading ? "Uploading..." : "Upload resume"}
          </button>
        </form>
      </section>

      <section className="surface form-section uploaded-resumes-section">
        <div className="section-heading with-action">
          <div>
            <h2>Your uploaded resumes</h2>
            <p>Select one of these files when completing a job application.</p>
          </div>
          {!loading && resumes.length > 0 && <span className="resume-count">{resumes.length} file{resumes.length === 1 ? "" : "s"}</span>}
        </div>

        {loading ? (
          <div className="resume-list-loading"><div className="spinner-border spinner-border-sm text-primary" /><span>Loading files...</span></div>
        ) : (
          <div className="resume-list">
            {resumes.length === 0 && <div className="empty-inline"><FileText size={25} /><span>No resume files uploaded yet.</span></div>}
            {resumes.map((resume, index) => (
              <div className="resume-row" key={resume.id}>
                <FileText size={24} aria-hidden="true" />
                <div>
                  <strong>{resume.originalName}</strong>
                  <small>Uploaded {new Date(resume.createdAt).toLocaleDateString("en-SG")}</small>
                </div>
                {index === 0 && <span className="latest-file-label"><CheckCircle2 size={16} />Latest</span>}
                <button className="icon-button danger" type="button" onClick={() => deleteResume(resume)} aria-label={`Delete ${resume.originalName}`}>
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="resume-upload-actions">
        <Link className="btn btn-outline-secondary btn-lg" to="/applicant/resume">Manage profile</Link>
        <Link className="btn btn-primary btn-lg" to={returnTo || "/applicant/jobs"}>{returnTo ? "Return to application" : "View available jobs"}</Link>
      </div>
    </div>
  );
}
