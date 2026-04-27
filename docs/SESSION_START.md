# SESSION_START — Paste this at the start of every Claude session

Copy everything inside the fenced block below and paste it as your first message.

---

```
Get back in sync with this project before doing anything else. Follow these steps in order:

1. Read `CLAUDE.md` (project root) end-to-end.
2. Read `docs/PROGRESS.md` and find the most recent entry (top of file).
3. Run `git status` and `git log --oneline -5` so you know what's modified and what just shipped.
4. Cross-check the latest PROGRESS entry against `git status`:
   - If files in "In progress" are no longer modified, they may have been committed — check `git log` to confirm.
   - If new files are modified that aren't in PROGRESS, flag them.
5. Produce a 6–10 line state summary covering:
   - What's working
   - What's in progress (with uncommitted-files list)
   - What's next per the latest PROGRESS entry
   - Any drift between PROGRESS and `git status`
6. List every "Open question" from the latest PROGRESS entry. Ask me to resolve them before code work starts.
7. If the latest PROGRESS entry's date is older than today, ask whether to log a new entry for this session before we start.

STOP after step 7. Do not edit code, run builds, or make assumptions about what I want next. Wait for me to confirm the summary and answer the open questions.
```

---

## Notes for the user (not part of the prompt)

- **When to update `docs/PROGRESS.md`:** at the end of any session that produced commits, made decisions, or surfaced blockers. Append a new entry to the **top** of the file so the latest is always first.
- **If a session was trivial** (one-line fix, doc tweak), it's fine to skip PROGRESS — but mention that in the closing message so future-you isn't confused.
- **If the open-questions list grows long,** triage it: questions answered get folded into `CLAUDE.md` permanently; questions that are stale get deleted; only live questions stay.
- **CLAUDE.md is the stable doc; PROGRESS.md is the moving doc.** Don't dump dated facts into CLAUDE.md — they go in PROGRESS. Don't dump architectural decisions into PROGRESS — they go in CLAUDE.md or `docs/architecture-decisions.md`.