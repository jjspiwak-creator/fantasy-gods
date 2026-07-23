# Data Retention & Account Deletion

Account deletion (DELETE /api/auth/account) immediately and
permanently removes from the live database: the account row (email,
password hash, preferences), all saved trades linked to the
account, and — when the request presents the browser's session —
that session's encrypted ESPN credentials and its saved trades.

Shared league content is de-identified, not destroyed: teams the
deleted manager owned remain in their leagues, unowned and flagged,
displayed as "Deleted Manager", so league state survives for other
members. Leagues created by the deleted user in which no other
member has claimed a team are deleted entirely. Manual leagues
currently store no shared trade history; saved trades are private
simulations and are purged with the identity that owns them.

Backups: the production database is Replit's managed Postgres
(Neon-backed) with platform point-in-time restore. Restore history
is retained up to 7 days on the Core plan and up to 28 days on
Pro/Teams plans (source: docs.replit.com, production databases,
checked 2026-07-23). Deleted data ages out of restore history
within the applicable window; no application-managed backups exist.

Logs: the application stores no security or audit logs in its
database. Platform request logs are retained per Replit's policies.
A stated security-log retention period will be added with the
privacy policy (number supplied by Legal).

ESPN sessions expire 7 days after creation; expired rows are purged
by a sweep at server boot.
