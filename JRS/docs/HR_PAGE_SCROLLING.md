# HR browser page scrolling

The Job Postings reference uses the browser's outer vertical scrollbar. Dashboard,
all Applications stages, Interviews and Reports now use that same page-scrolling
model. This supersedes the earlier fixed-viewport iframe implementation.

## Behavior and implementation

- Embedded content reports its natural `#content` height through a ResizeObserver.
  The parent validates message origin, source and finite positive height before
  updating the frame. Sizing messages cannot navigate the workspace.
- Height measurement excludes root/body viewport scrollHeight. Hidden loading
  content does not collapse the frame. Unchanged heights do not emit new messages.
- Embedded roots use natural height; wheel chaining is enabled for the document,
  main content and tables. There is no embedded vertical scrollbar or containment
  that swallows the wheel over Interviews rows.
- Workspace responsive layout depends on width, not the iframe's own content
  height. Removing the 620px height breakpoint prevents Reports oscillating
  between compact and expanded layouts.
- Dialogs retain independent form scrolling. Their height is bounded by the actual
  browser viewport reported by the parent. Opening a dialog brings the frame to
  the top of the browser viewport so its actions remain reachable.
- Existing shared scrollbar styling from the runtime checkout is included in both
  HR documents and the React shell. Browser/user zoom is preserved; no CSS zoom or
  scaling transform was introduced.
- At phone widths the Applications card table no longer keeps a 760px minimum.
  Long addresses wrap, pagination stays in document flow, and the 320px header
  uses smaller spacing/avatar dimensions so Dashboard remains readable.

## Verification on 21 October 2026

Real Edge browser checks used the existing authenticated local development
session. No recruitment decision, interview scheduling or task completion was
submitted. The browser viewport override was reset after responsive checks.

- Desktop: Dashboard, all seven Applications stages, Interviews and Reports were
  inspected. Applications retained scale 1 across stage changes. Reports overview,
  job performance and follow-up tasks resize naturally; the last task page shrinks
  from ten rows to three without a resize loop.
- Interviews: wheel input over actual table content moved the outer browser from
  scrollY 0 to 436 on desktop. At 390px the same check moved it to scrollY 1688.
  The page scrollbar is at the browser edge, and pagination is reachable.
- Phones: 390x844 checks covered Dashboard, Applications, Interviews and Reports.
  No document-wide horizontal overflow was measured. Interviews cards and the
  candidate chooser were inspected. Long Applications email addresses wrap.
  At 320x740 Dashboard's title and account controls fit. Responsive checks use
  browser viewport emulation, not physical-phone hardware.
- Regression tests cover trusted size messages, invalid sizes, intrinsic content
  growth/shrink, hidden loading states, viewport message validation, dialog
  placement and wheel chaining. Production builds succeeded for both clients in
  release and runtime directories. Existing applicant bundle-size warning remains.

The release suites passed: root 106, HR frontend 122, HR backend/API 183 and native
recruitment 111. The English check and `git diff --check` passed. Runtime-only
additional tests remain separate and were not added wholesale to the release.
