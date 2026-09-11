import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  Avatar,
  dateTime,
  ErrorBox,
  Field,
  Loading,
  PageHeading,
  useLoad,
} from "../shared";

export function Profile() {
  const load = useLoad("/api/hr/profile");
  return (
    <>
      <PageHeading
        title="My Profile"
        description="Your personal details and HR workspace information."
        action={
          <Link className="btn btn-primary" to="/profile/edit">
            Edit profile
          </Link>
        }
      />
      {load.busy ? (
        <Loading />
      ) : load.error ? (
        <ErrorBox error={load.error} retry={load.reload} />
      ) : (
        <div className="profile-grid">
          <section className="surface profile-card">
            <Avatar user={load.data} large />
            <h2>{load.data.fullName}</h2>
            <p>{load.data.role}</p>
            <span className="badge-soft green">{load.data.accountStatus}</span>
            <div className="profile-card-divider" />
            <p className="small subtle">{load.data.department}</p>
            <p className="small subtle">{load.data.email}</p>
          </section>
          <section className="surface">
            <div className="section-heading">
              <h2>Personal information</h2>
              <span className="subtle small">HR account</span>
            </div>
            <dl className="detail-grid profile-details">
              {[
                ["Employee ID", load.data.employeeId],
                ["Department", load.data.department],
                ["Email address", load.data.email],
                ["Phone number", load.data.phone],
                ["Office location", load.data.officeLocation],
                ["Last login (UTC+08:00)", dateTime(load.data.lastLoginAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value || "Not provided"}</dd>
                </div>
              ))}
            </dl>
            <div className="profile-note">
              To update your role, email or employee details, contact your
              account administrator.
            </div>
          </section>
        </div>
      )}
    </>
  );
}
export function EditProfile() {
  const load = useLoad("/api/hr/profile");
  return (
    <>
      <PageHeading
        title="Edit Profile"
        description="Keep your contact details up to date."
      />
      {load.busy ? (
        <Loading />
      ) : load.error ? (
        <ErrorBox error={load.error} retry={load.reload} />
      ) : (
        <ProfileForm initial={load.data} />
      )}
    </>
  );
}
function ProfileForm({ initial }) {
  const { setUser } = useAuth();
  const [profile, setProfile] = useState(initial),
    [form, setForm] = useState({
      fullName: initial.fullName,
      phone: initial.phone,
      officeLocation: initial.officeLocation,
    });
  const [error, setError] = useState(null),
    [photoError, setPhotoError] = useState(null),
    [message, setMessage] = useState(""),
    [photoMessage, setPhotoMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [file, setFile] = useState(null),
    [preview, setPreview] = useState(null);
  const fileRef = useRef(null);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function choose(e) {
    setPhotoError(null);
    setPhotoMessage("");
    const next = e.target.files?.[0];
    if (!next) return;
    if (
      !["image/jpeg", "image/png"].includes(next.type) ||
      next.size > 2 * 1024 * 1024
    ) {
      setFile(null);
      e.target.value = "";
      setPhotoError(
        new Error("Choose one JPEG or PNG image, no larger than 2 MB."),
      );
      return;
    }
    setFile(next);
  }
  async function upload() {
    setUploading(true);
    setPhotoError(null);
    setPhotoMessage("");
    const body = new FormData();
    body.append("photo", file);
    try {
      const result = await api.request("/api/hr/profile/photo", {
        method: "POST",
        body,
      });
      const next = {
        ...result,
        photoUrl: `${result.photoUrl}?v=${Date.now()}`,
      };
      setProfile(next);
      setUser(next);
      setFile(null);
      fileRef.current.value = "";
      setPhotoMessage("Profile photo updated.");
    } catch (e) {
      setPhotoError(e);
    } finally {
      setUploading(false);
    }
  }
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const result = await api.request("/api/hr/profile", {
        method: "PATCH",
        body: form,
      });
      const next = { ...result, photoUrl: profile.photoUrl };
      setProfile(next);
      setUser(next);
      setForm({
        fullName: result.fullName,
        phone: result.phone,
        officeLocation: result.officeLocation,
      });
      setMessage("Profile changes saved.");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="profile-edit-grid">
      <section className="surface photo-panel">
        <h2>Profile photo</h2>
        <Avatar
          user={{ ...profile, photoUrl: preview || profile.photoUrl }}
          large
        />
        <p className="subtle small">
          {preview
            ? "Selected photo preview"
            : "Make your profile recognizable."}
        </p>
        <label className="form-label" htmlFor="profile-photo">
          Choose a photo
        </label>
        <input
          ref={fileRef}
          id="profile-photo"
          type="file"
          accept="image/jpeg,image/png"
          className="form-control"
          disabled={uploading || busy}
          onChange={choose}
        />
        <p className="photo-help">
          JPEG or PNG · Up to 2 MB
          <br />
          Maximum 16 megapixels. Cropped to a square.
        </p>
        <ErrorBox error={photoError} />
        <p className="success-message" role="status">
          {photoMessage}
        </p>
        <div className="d-flex gap-2 justify-content-center">
          <button
            className="btn btn-primary"
            disabled={!file || uploading || busy}
            onClick={upload}
          >
            {uploading ? "Uploading…" : "Upload photo"}
          </button>
          {file && (
            <button
              className="btn btn-light"
              disabled={uploading}
              onClick={() => {
                setFile(null);
                fileRef.current.value = "";
              }}
            >
              Cancel photo
            </button>
          )}
        </div>
      </section>
      <section className="surface">
        <div className="section-heading">
          <h2>Personal details</h2>
        </div>
        <form className="editor-form" onSubmit={save}>
          <ErrorBox error={error} />
          <p className="success-message" role="status">
            {message}
          </p>
          <fieldset disabled={busy || uploading}>
            <Field label="Full name">
              {(id) => (
                <input
                  id={id}
                  className="form-control"
                  autoComplete="name"
                  required
                  maxLength={100}
                  value={form.fullName}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, fullName: e.target.value }))
                  }
                />
              )}
            </Field>
            <div className="two-fields">
              <Field label="Phone number">
                {(id) => (
                  <input
                    id={id}
                    type="tel"
                    className="form-control"
                    autoComplete="tel"
                    maxLength={20}
                    value={form.phone}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, phone: e.target.value }))
                    }
                  />
                )}
              </Field>
              <Field label="Office location">
                {(id) => (
                  <input
                    id={id}
                    className="form-control"
                    maxLength={100}
                    value={form.officeLocation}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, officeLocation: e.target.value }))
                    }
                  />
                )}
              </Field>
            </div>
            <div className="readonly-panel">
              <h3>Account details</h3>
              <p className="subtle small">
                These details are managed by your administrator.
              </p>
              <dl className="detail-grid">
                {[
                  ["Employee ID", profile.employeeId],
                  ["Email", profile.email],
                  ["Role", profile.role],
                  ["Department", profile.department],
                  ["Account status", profile.accountStatus],
                ].map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </fieldset>
          <div className="editor-actions justify-content-end">
            <Link
              to="/profile"
              className={`btn btn-outline-secondary ${busy || uploading ? "disabled" : ""}`}
            >
              Cancel
            </Link>
            <button className="btn btn-primary" disabled={busy || uploading}>
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
