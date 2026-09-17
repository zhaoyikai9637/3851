export function MarkAllReadToast({ busy, onUndo }) {
  return (
    <div className="mark-all-toast" role="status" aria-live="polite">
      <span>All notifications marked as read.</span>
      <button type="button" disabled={busy} onClick={onUndo}>
        Undo
      </button>
    </div>
  );
}
