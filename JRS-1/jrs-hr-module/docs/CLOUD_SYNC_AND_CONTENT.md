# Cloud Profiles and Original Content

Cloud inspection and profile import require verified TLS and an explicitly reviewed target.
Read cloud records inside a read-only transaction.
Exclude account credentials, password hashes, sessions, private photos and unrelated personal data.

The earlier business-table inspection found no useful records to import.
A later authorized import applied the two active HR profile records as the local source of truth.
These are team test profiles, not independently verified staff identities.
Do not fabricate notifications or claim new cloud writes based on that historical import.

Original English template content lives in server/data/original-content.json.
Its installer is local-only and idempotent: existing names/content and sent-message snapshots are retained.
Select an actual active HR ID after confirming the development target.
Installing content does not send email or establish a team login adapter.
Private inspection exports stay outside Git.
