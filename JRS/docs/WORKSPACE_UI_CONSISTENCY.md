# HR list and control consistency - 2026-10-22

The React HR shell and embedded recruitment document both load
`JRS HR/dist/workspace-ui.css`. This is the shared presentation layer for
Applications, Candidates, Job Postings, Interviews and Notifications.

- Search controls: white surface, existing search icon, 40px height, 8px radius,
  13px input text and a visible focus-within outline.
- Buttons: 40px height, 8px radius and 13px text. Creation actions remain blue;
  row views, filters and supplementary actions use a neutral outline. Destructive
  actions retain their warning color. Pagination uses 36px text buttons.
- Tables: 44px pale headers, 11px uppercase header text, 13px body text,
  16px by 20px cell padding, 80px minimum desktop rows, consistent dividers and
  a quiet hover background. Content wrapping may increase the row height.
- Table panels use a 14px radius; footers share padding, borders and the
  `Page n of m` wording with Previous and Next buttons.
- Notifications retain time groups, unread markers and their existing row
  interactions. Their search and detail affordances use the shared control scale.
- Existing responsive recruitment cards and horizontally scrollable React tables
  remain available on phones. Mobile card cells do not inherit desktop heights.

No database schema, API, record ordering, authorization, workflow or mail behavior
was changed. No dependency was added.

## Verification

- Root `npm.cmd test`: 130 passed.
- Native HR `npm.cmd test`: 112 passed.
- Communication server `npm.cmd test`: 183 passed.
- Communication server `npm.cmd run test:mysql`: 12 passed, using only
  `127.0.0.1:3307/jrs_hr_module_test_integrated_20261019`.
- Root `npm.cmd run build`: both clients built; the existing applicant bundle size
  warning remains.
- After final CSS adjustments, targeted embedded-navigation, viewport-pagination
  and workspace-layout tests: 9 passed.
- Full React suite: 108 passed and 20 failed. Temporarily restoring only this
  change's three modified page/component files produced 109 passed and 19 failed:
  the same navigation/heading and old job-editor assertions. The additional
  outbox-navigation failure passed when run alone. The suite is not fully green;
  no unrelated navigation or job-editor behavior was changed to satisfy it.
- Edge desktop measurements confirmed 40px search controls and row buttons,
  44px headers and matching cell padding across the four table screens. Candidate,
  application and job rows measured 80px; interview rows expanded for their
  additional content.
- All five screens were inspected at 390 by 844. No outer-document horizontal
  overflow was detected. Viewport overrides were cleared.
- Browser checks confirmed candidate search, interview next-page navigation and
  opening the application-filter dialog. No business operation was submitted.

Private screenshots and baseline/current test reports remain in ignored
`work/ui-consistency/` and are excluded from publication.
