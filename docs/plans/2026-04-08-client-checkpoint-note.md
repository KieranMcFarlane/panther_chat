# Client Checkpoint Note

Date: 2026-04-08

## Purpose

This note is the client-facing checkpoint summary for the production cockpit demo at:

- https://panther-chat.vercel.app

It should be used to frame the current delivery as a working product checkpoint: authenticated app access, entity browser, UUID-backed dossier pages, homepage cockpit, notifications, and daily digest plumbing are now deployed and verified.

## What Is Ready To Show

The current production app is suitable for client review of the product experience:

- sign-in and sign-up are working on production
- homepage cockpit/feed renders after authentication
- entity browser renders the five pinned smoke entities
- each pinned entity links to a stable UUID-backed dossier route
- dossier pages render question-first dossier content signals
- authenticated Graphiti notifications API returns notifications
- notification links resolve back into dossier pages
- cron routes are protected by `CRON_SECRET`
- daily sales digest generation and send path has been verified

Verified pinned smoke entities:

- Arsenal
- Coventry City
- Zimbabwe Cricket
- Major League Cricket
- Zimbabwe Handball Federation

## What To Tell The Client

Subject: First Delivery Checkpoint Ready For Review

Hi [Name],

The first client-visible checkpoint is now ready to review.

The app is deployed here:

https://panther-chat.vercel.app

At this checkpoint you can log in, open the homepage cockpit, browse the pinned entities, and open the generated dossier pages from the entity browser. Each dossier is linked through a stable UUID-backed route and renders the question-first dossier content inside the app rather than as a disconnected file.

What is working now:

- authenticated app access
- homepage cockpit/feed
- entity browser
- UUID-backed dossier links
- tabbed dossier pages
- notification-to-dossier routing
- daily sales digest generation and send path
- protected production cron routes for refresh/materialization/digest jobs

The important distinction is that this is the product checkpoint: the app path is live and reviewable. The remaining work is ongoing tuning of the research pipeline at larger scale, including regenerating more real canonical dossier artifacts and improving weaker `q3/q4` answer quality. That tuning work should continue behind the scenes and does not need to block review of the product surface.

Recommended review path:

1. sign in
2. open the homepage cockpit
3. open the entity browser
4. open the five pinned dossier pages
5. follow a notification back into a dossier

Once you have reviewed that flow, we can treat this as the first delivery checkpoint and continue the quality/scale tuning as the next phase.

Best,
[Your Name]

## Internal Notes

Do not lead with internal debugging details in the client note.

Do not mention:

- Chrome MCP local tooling timeout
- `timeout_salvage`
- OpenCode runtime cache repair
- raw `/tmp` artifact loss

Mention only if asked:

- current pinned dossier set uses tracked demo seed dossiers where full real canonical artifacts are not yet available
- only one ready real canonical artifact was recovered from the SSOT worktree for Major League Cricket
- broader artifact regeneration remains a follow-up task

## Remaining Engineering Work

After client review, continue with:

1. regenerate or recover real `status: ready` canonical artifacts for the five pinned entities
2. replace demo seed dossiers only when each real artifact is ready and verified
3. continue `q3/q4` quality hardening using retained execution traces and internal salvage metadata
4. keep broad scale reruns paused until artifact durability and weak-surface diagnosis are stronger
5. retry Chrome MCP only after local macOS Chrome permissions are fixed

## Evidence References

Production smoke evidence is recorded in:

- `docs/plans/2026-04-08-production-cockpit-handover.md`

Relevant pushed commits:

- `92143ea9` `fix(app): prevent auth background click interception`
- `8a33120b` `docs(app): record authenticated client smoke`
- `054245d9` `docs(app): record sales digest send smoke`
