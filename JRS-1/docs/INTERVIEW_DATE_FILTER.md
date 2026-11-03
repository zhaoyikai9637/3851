# Interview date filter and candidate controls

## Date field fix - 3 November 2026

The date adapter changes native date inputs to text controls to display DD MM YYYY. The shared workspace selector previously styled selects and another date-control class, leaving the converted input with browser-default borders and height. Add the converted date filters to the existing common 40px control scale, align the inline label, reserve space for the calendar trigger, and render a calendar SVG.

Edge headless checks with the real native styles and page renderer passed at 1280x720 and 390x844: search, status, date and clear controls measured 40px; the trigger stayed inside the input; the calendar opened; no horizontal overflow occurred. Existing date validation, ISO hidden values and filter change tests passed. Full project validation passed 734 tests, both frontend builds and the English check.

The login/profile Jest configuration now disables the global-property cleanup optimization because manually created JSDOM VM windows could lose built-in objects across tests under Jest 30. Assertions and test selection remain intact.

## Candidate controls provenance and ownership

The preserved original JRS/JRS HR source already contains the candidate-edit and resume-upload buttons and their backend handlers. They were not added by the unified test command.

candidate-save writes recruiting candidate details; the integrated bridge copies changed name/email/phone/location into canonical candidate contact fields. It does not change the login account email. The HR resume endpoint stores its PDF in the recruiting resume record, separately from applicant-managed resume files and submitted application snapshots.

A future permission change should distinguish self-registered applicants from HR-entered candidates. Self-registered profile/resume ownership and HR recruitment notes should remain clear. This change only fixes date presentation; candidate edit and upload permissions are retained pending a product decision.
