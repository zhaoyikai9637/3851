# Applicant button consistency - 2026-10-22

The applicant React entry and all eight native applicant/account HTML pages load
`JRS Login and profile/client/assets/css/buttons.css` after their existing styles.
The stylesheet uses the HR button scale: 40px minimum height, 8px radius,
13px text, weight 600 and matching blue/neutral colors. Primary actions use solid
blue; secondary actions use a neutral outline; destructive actions retain red.
Login no longer uses a gradient. Text links, navigation, skill chips and workflow
step controls retain their specialized roles. Existing button widths remain.

Buttons can grow if mobile labels wrap. Aligning buttons independently prevents
the 54px job-search input from stretching its adjacent button. Icon actions use a
40px square target. Focus outlines and disabled states remain visible.

No authentication, form submission, upload, application or persistence behavior
was changed. No dependencies were added.

## Verification

- Root `npm.cmd test`: 130 passed. The three existing recovery-layout assertions
  now check the shared 40px minimum and flexible height instead of the old fixed
  44px height.
- Login/profile `node --experimental-vm-modules ../node_modules/jest/bin/jest.js
  --runInBand`: 69 passed. Running without the package's required VM flag first
  produced a dynamic-import failure; the correctly configured run passed.
- Applicant server `node --test test/*.test.js`: 24 passed.
- Root `npm.cmd run build`: both clients built; the existing applicant bundle size
  warning remains.
- Edge measured the search, apply, login, register, reset-link, edit-materials and
  add-summary buttons at 40px high, with 8px radius and 13px text.
- Job browsing and password recovery were checked at 390 by 844 without outer
  horizontal overflow. Viewport overrides were cleared.
- The existing browser session belongs to HR. Candidate profile controls were
  measured in their disabled access-denied state; authenticated applicant saves,
  uploads and submissions were not performed. Their existing automated tests
  passed. No password reset or email was sent.
- Screenshots remain private in ignored `work/applicant-buttons/`.
