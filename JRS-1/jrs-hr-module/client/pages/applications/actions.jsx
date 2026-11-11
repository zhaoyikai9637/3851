import {saveWithEmail} from "../recruitment/workspaceClient";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { CancelForm, DetailsDialog, download, FeedbackForm, interviewCalendar, ScheduleForm } from "../recruitment/dialogs";
import {
  ApplicationDetails, CandidateForm, draftFile, MessageForm, MessageView, NoteForm, OfferForm, OfferReview,
  ReceiveForm, RejectForm, SendEmail, TaskForm, UploadResume,
} from "./dialogs";

// Every application dialog in one place, shared by the Applications list and the
// resume review page. Each submit sends the same workspace command as the
// embedded workspace, then shows the same confirmation message.
export function useApplicationActions({ workspace, onCreated }) {
  const { db, commit, request, upload, send } = workspace;
  const navigate = useNavigate();
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(timer);
  }, [toast]);

  const close = () => setDialog(null);
  async function run(command, payload, message, after) {
    const {result,notice} = await saveWithEmail(workspace,command,payload);
    setDialog(null);
    setToast(message+(notice?" "+notice:""));
    after?.(result);
  }

  // "Review" opens whatever fits the application's current stage.
  function review(application) {
    if (application.stage === "Offer") return setDialog({ kind: "offer-review", id: application.id });
    if (application.stage === "Rejected") return setDialog({ kind: "application", id: application.id });
    if (application.stage === "Interview") {
      const meeting = db.interviews.find((interview) => interview.applicationId === application.id && interview.status === "Scheduled");
      return setDialog(meeting ? { kind: "details", interview: meeting } : { kind: "schedule", id: application.id });
    }
    setDialog({ kind: "application", id: application.id });
  }

  function act(kind, target, options={}) {
    if(kind==="candidate-edit"&&target.canEditProfile===false)return setToast("Applicant profiles are maintained by the applicant.");
    if(kind==="resume-upload"&&db.candidates.find(c=>c.id===target)?.canUploadResume===false)return setToast("Applicant resumes are maintained by the applicant.");
    switch (kind) {
      case "review":
        return review(target);
      case "interview":
        return setDialog({ kind: "details", interview: target });
      case "message-edit":
        return setDialog(target.status === "Draft" ? { kind: "message", id: target.applicationId, notification: target } : { kind: "message-view", notification: target });
      case "mail-send":
        return setDialog({ kind: "mail-send", notification: target });
      case "resume-upload":
        return setDialog({ kind: "resume-upload", candidateId: target });
      case "receive":
        return setDialog({ kind: "receive" });
      case "candidate-edit":
        return setDialog({ kind: "candidate-edit", candidate: target });
      case "task-complete":
        commit("complete-task", { id: target.id }).then(() => setToast("Task completed.")).catch((commandError) => setToast(commandError.message));
        return undefined;
      default:
        return setDialog({ kind, id: target.id, ...options });
    }
  }

  function interviewAction(kind, interview) {
    if (kind === "calendar") return download(interviewCalendar(db, interview), "JRS-Interview.ics", "text/calendar;charset=utf-8");
    if(kind === "feedback") {setDialog(null);navigate(`/interviews?feedback=${encodeURIComponent(interview.id)}`);return;}
    setDialog({ kind, interview });
  }

  function offerAction(kind, application) {
    if (kind === "approve-offer") {
      setDialog({ kind: "offer-review", id: application.id, busy: true });
      commit("approve-offer", { applicationId: application.id })
        .then(() => setDialog({ kind: "offer-review", id: application.id }))
        .catch((commandError) => {
          setDialog({ kind: "offer-review", id: application.id });
          setToast(commandError.message);
        });
      return;
    }
    if (kind === "offer-message") {
      run("offer-message",{applicationId:application.id,notify:true},"Offer saved.").catch(error=>setToast(error.message));
      return;
    }
    setDialog({ kind, id: application.id });
  }

  const target = db && dialog?.id ? db.applications.find((application) => application.id === dialog.id) : null;
  const kind = dialog?.kind;
  const elements = db && (
    <>
      {kind === "receive" && (
        <ReceiveForm db={db} onClose={close} onSubmit={(payload) => run("application-create", payload, "Application received.", (result) => onCreated?.(result.application))} />
      )}
      {kind === "reject" && target && (
        <RejectForm db={db} application={target} onClose={close} onSubmit={(payload) => run("reject", payload, "Application rejected.")} />
      )}
      {(kind === "move-interview" || kind === "schedule") && target && (
        <ScheduleForm
          db={db}
          application={target}
          interview={null}
          title={kind === "move-interview" ? "Arrange interview" : undefined}
          onClose={close}
          onSubmit={(payload) => (kind === "move-interview"
            ? run("move-interview", payload, "Interview scheduled. The application is now in Interview.")
            : run("schedule", payload, "Interview schedule saved."))}
        />
      )}
      {kind === "details" && (
        <DetailsDialog db={db} interview={db.interviews.find((item) => item.id === dialog.interview.id) || dialog.interview} onAction={interviewAction} onClose={close} />
      )}
      {kind === "reschedule" && (
        <ScheduleForm db={db} application={db.applications.find((item) => item.id === dialog.interview.applicationId)} interview={dialog.interview} onClose={close} onSubmit={(payload) => run("schedule", payload, "Interview schedule saved.")} />
      )}
      {kind === "cancel" && (
        <CancelForm db={db} interview={dialog.interview} onClose={close} onSubmit={(payload) => run("cancel-interview", payload, "Interview cancelled.")} />
      )}

      {kind === "offer-edit" && target && (
        <OfferForm db={db} application={target} onClose={close} onSubmit={(payload) => run("offer", payload, "Offer saved. Review and approve it before sending.")} />
      )}
      {kind === "offer-review" && target?.offer && (
        <OfferReview db={db} application={target} busy={dialog.busy} onClose={close} onAction={(next) => offerAction(next, target)} />
      )}
      {kind === "message" && target && (
        <MessageForm
          db={db}
          application={target}
          notification={dialog.notification}
          initialTemplateId={dialog.templateId}
          request={request}
          onClose={close}
          onDownload={(notification) => download(draftFile(notification), "JRS-Email-Draft.eml", "message/rfc822")}
          onSubmit={(payload) => run("message", payload, "Email draft saved. No email has been sent.")}
        />
      )}
      {kind === "message-view" && <MessageView notification={dialog.notification} onClose={close} />}
      {kind === "mail-send" && (
        <SendEmail
          db={db}
          notification={dialog.notification}
          onClose={close}
          onSubmit={async ({ id, attachResume }) => {
            await send(id, attachResume);
            setDialog(null);
            setToast("The email server accepted the message.");
          }}
        />
      )}
      {kind === "resume-upload" && (
        <UploadResume
          onClose={close}
          onSubmit={async (file) => {
            await upload(dialog.candidateId, file);
            setDialog(null);
            setToast("Resume uploaded.");
          }}
        />
      )}
      {kind === "candidate-edit" && (
        <CandidateForm candidate={dialog.candidate} onClose={close} onSubmit={(payload) => run("candidate-save", payload, "Changes saved.")} />
      )}
      {kind === "candidate-notes" && target && (
        <NoteForm db={db} application={target} onClose={close} onSubmit={(payload) => run("candidate-notes", payload, "Changes saved.")} />
      )}
      {kind === "task" && target && (
        <TaskForm db={db} application={target} onClose={close} onSubmit={(payload) => run("task", payload, "Changes saved.")} />
      )}
      {kind === "application" && target && (
        <ApplicationDetails db={db} application={target} onClose={close} onInterview={(interview) => setDialog({ kind: "details", interview })} />
      )}
    </>
  );

  return { act, elements, toast, setToast };
}

export function Toast({ message }) {
  return <div className="applications-toast" role="status" hidden={!message}>{message}</div>;
}
