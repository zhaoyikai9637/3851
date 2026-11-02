# Lists sized to the available viewport

Applications (all stages), Interviews, Reports job performance/follow-up tasks,
Candidates and Job Postings now fit their page size to the available vertical space. The
maximum remains ten records; fewer records are shown when controls or wrapped
phone rows need more room. Overflow records remain on later pages in the same
order. A very short viewport still shows one complete record and allows normal
browser scrolling, so nothing is clipped.

The React shell subtracts the frame's document position, main bottom padding and
workspace footer from the browser viewport height. It sends that independent
budget through the existing same-origin, parent-source checked viewport message.
Frame content height is never the pagination budget. Scrolling the outer page
does not change it.

The list measures actual row heights and subtracts its tabs, filters, headings and
pagination from the budget. It retains the tallest observed row for the current
route/section/width to avoid oscillation on shorter pages. Width and real viewport
changes trigger recalculation. Embedded frame height changes alone do not rebuild
content. Search value, focus and selection are restored if fitting changes the
page size; IME composition finishes before fitting can replace its input.

Job Postings and Candidates use the same measurement helper through a React hook;
their page range and navigation use the calculated size as well. Candidates sends
the limit to its existing server pagination API and retains page size, filters and
the loaded list when opening a profile, so returning does not jump to page one.
This is pagination adaptation,
not the separately queued Job Postings UI redesign. Other document/detail pages,
Dashboard and communication modules retain their existing scrolling behavior.

Checks cover desktop and phone-sized row measurements, stable repeated fitting,
all records remaining in later pages, next-page navigation, trusted host budgets,
search focus, IME composition and Job Information expansion.

Edge browser acceptance after restarting Codex:

| View | Viewport | Records per page | Document height |
| --- | --- | --- | --- |
| Applications | 1699 x 934 | 7 | 934 |
| Applications | 1366 x 768 | 4 | 768 |
| Applications | 390 x 844 | 1 | 877 |
| Candidates | 1366 x 768 | 4 | 768 |
| Candidates | 390 x 844 | 4 | 844 |
| Candidates | 320 x 740 | 3 | 740 |
| Job Postings | 1366 x 768 | 4 | 768 |
| Reports / Job performance | 1366 x 768 | 5 | 768 |
| Reports / Follow-up tasks | 1366 x 768 | 5 | 768 |

Applications on the phone retains a small amount of necessary scrolling for its
single complete card and workspace footer; pagination itself remains visible.
Candidate tables retain horizontal table scrolling on phones, while the document
does not overflow horizontally. Desktop and phone next-page navigation, continuous
search input and returning from candidate details were checked. Temporary viewport
overrides were reset after acceptance. Screenshots remain in ignored local storage.

Final verification passed: 117 integrated unit tests, 126 React tests, 112 native HR
tests, 183 communication backend/API tests and 12 dedicated MySQL tests (550 total).
Both production clients built successfully in release and runtime checkouts.
