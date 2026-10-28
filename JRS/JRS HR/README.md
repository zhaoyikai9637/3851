# JRS HR recruitment module

Version 2.6.2, synchronized from Shen Junye's 2026-10-22 update.

In the integrated project, use the parent README, root build/start commands and
shared sign-in on port 3100. Do not start this module's standalone password login
or initialize a second set of tables in the shared database.

Pending Review uses one booking form to move an application to Interview and
schedule it in one transaction. New appointments begin with blank date, time,
interviewer and location fields. More options contains duration, format and notes.
Review/result shortcuts and rejection status diagrams are removed. Saves remain
on the current page, with inline confirmation and existing records preserved.
Visible dates use DD MM YYYY and an English calendar; storage remains ISO.

See [workflow changes](docs/SIMPLE_WORKFLOW_v2.6.md), [API](docs/API.md) and
[team setup](docs/TEAM_SETUP.md). Standalone scripts remain available for the
module owner; they are not the integrated database setup procedure.
