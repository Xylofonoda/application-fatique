TEST PLAN TOMMOROW !


Test Plan — April 19
Prerequisites (do first)
Dev server running: npm run dev
.env loaded with OPENAI_API_KEY and DATABASE_URL
User profile + CV uploaded in Settings (required for auto-apply)
Role profiles seeded (already done ✅)
1 — Intent Engine + Domain Boundary (10 min)
Run three searches from the dashboard and verify results are domain-scoped:

Search	Expected to appear	Expected to NOT appear
React	React, Next.js, Frontend roles	Java, PHP, DevOps, QA, Backend-only
Backend	Node.js, Python, API developer	React-only UI, Flutter, iOS
Fullstack	Frontend + Backend + Fullstack roles	DevOps-only, QA-only, iOS, Android
Open browser DevTools → Network → find the SSE stream. Confirm the progress event shows "Generating search embedding…" — that means the intent + RAG path ran. Also check the server console for any [scrape] errors.

2 — Negative Scoring is Working (5 min)
After a React search, sort results by similarity score (UI or DevTools). Confirm:

No Backend-heavy job is scoring above 0.6
Jobs with "Node.js backend API" in the description appear lower than pure React roles at similar seniority
This was broken before (args were swapped) — if you see Backend jobs outscoring React jobs, something is still wrong.

3 — NoFluffJobs Pagination + Slug URL (5 min)
Add a console.log temporarily in nofluffjobs.ts to print the resolved URL, OR just check the server log during a React search. Confirm:

URL contains /cz/jobs/react (slug) not ?query=React (keyword fallback)
At least 3 progress events come from NoFluffJobs (indicating multiple pages scraped)
More than ~10 NoFluff results appear in the UI
4 — SSE Dedup + scrapersDone Event (5 min)
In DevTools → Network → SSE stream, confirm:

No two job events share the same sourceUrl
Event sequence ends with: scrapersDone → cache progress → complete (not two complete events back to back)
Stale cached results appear after fresh ones, with isStale: true in the SSE payload
5 — Cached Results via pgvector (5 min)
Run any search twice. On the second run:

The progress event "Loading cached results…" should appear
Jobs from previous scraped runs should appear with isStale: true
Server should NOT log any Cache surfacing failed errors (confirms ORDER BY embedding <=> ...::vector syntax is working against Neon)
6 — Auto-Apply (15 min)
Setup: Find a real StartupJobs.cz job in your dashboard that you could apply to (or use a test posting). Note the applicationId from the DB or via GraphQL.

Step 1 — Happy path (dev only):

Expected: Chromium opens visibly, navigates to the job, clicks Apply, attempts to fill the form. Response: { "status": "APPLIED" | "MANUAL_REQUIRED" | "FAILED" }.

Check the DB: application.status should be updated accordingly.

Step 2 — External ATS detection:
Use a job that links out to Greenhouse/Lever/Workday. Expect { "status": "MANUAL_REQUIRED" } returned immediately without form-filling attempt.

Step 3 — Production guard:

Or deploy to Netlify preview — must return 501.

Step 4 — Invalid applicationId:

Expected: 400 Missing or invalid applicationId (not a Prisma error).

7 — Error Logging in Form Fill (5 min)
During an auto-apply attempt, watch the server terminal. If any form field fails to fill (wrong selector, detached element), you should see [aaf] fill idx=N failed: ... warnings — not silent failures. Confirm at least the attempt is visible in logs even on a successful apply.

Acceptance Criteria Summary
#	Check	Pass condition
1	Domain boundary	React search has no Backend/DevOps results above 0.5
2	Negative scoring	High anti-domain jobs penalised
3	NoFluffJobs slug	/cz/jobs/react URL used, ≥3 pages scraped
4	SSE dedup	No duplicate cards, scrapersDone before complete
5	pgvector cache	No JS errors, stale results appear on 2nd search
6	Auto-apply	Status updated in DB, Chromium visible in dev
7	Error logging	[aaf] warnings visible on field failures
