---
name: easy-wins
description: "Use Easy Wins as project-local agent workflow memory. Use at the start of a coding session, when the user types /easy-wins, asks what to work on today, or finishes with /easy-wins done. Reads .easywins metadata when present, refreshes through the Easy Wins API when needed, consults GitNexus for impact, presents one focused win, and records session outcomes."
---

# Easy Wins - Agent Workflow

Use Easy Wins as the repo-local "what is the next small useful thing?" memory layer. Keep the user and agent focused on exactly one win, then record what happened.

## Critical Rules

- NEVER present more than one win at a time.
- NEVER show a menu of options when presenting the win.
- Keep the user-facing response short: win, why, time/difficulty, and one starting point.
- Prefer `.easywins/metadata.json` before calling the API.
- If the server is needed but not running, say so in one sentence and stop.

## Session Start

1. Determine the project path from the current working directory.
2. Read `.easywins/metadata.json` at that project root if it exists.
3. Use the metadata if `analysis.analyzedAt` is less than 24 hours old.
4. If metadata is missing, unreadable, or stale, run **Refresh Analysis**.
5. Select one active win:
   - Prefer `activeWin` from metadata.
   - Otherwise use the first `nextEasyWins` item with `difficulty: "Easy"`.
   - Otherwise use `nextEasyWins[0]`.
   - Otherwise use `todayPlan[0]`.
6. Consult GitNexus for impact context using the first file on the selected win when available.
7. Present the win using **Output Format**.

## Refresh Analysis

Health check:

```bash
curl -s http://localhost:3001/api/health
```

If the response contains `"status":"ok"`, continue.

If it fails or times out, respond with exactly:
> "The Easy Wins server isn't running. Start it with `npm run dev:server` inside the `app/` folder, then try `/easy-wins` again."

Then stop.

Analyze the project:

```bash
curl -s -X POST http://localhost:3001/api/analyze \
  -H "Content-Type: application/json" \
  -d "{\"projectPath\": \"<ABSOLUTE_PROJECT_PATH>\"}"
```

The API writes:
- `.easywins/metadata.json`
- `.easywins/history.jsonl`
- `.easywins/agent-notes.md`

Use the response or the newly written metadata to pick the active win.

## GitNexus Impact

For the chosen win, take the first filename from `filesLikelyInvolved` or `filesToOpen`. Run:

```text
mcp__gitnexus__impact({ target: "<filename_or_symbol>", direction: "downstream" })
```

If this returns downstream relationships, note how many areas completing this win would unblock. Add that to the "why it matters" text.

If GitNexus returns nothing, the index is stale, or the file is not indexed, skip this silently.

## Output Format

Output exactly this format and nothing before or after:

---

**Your win for today:**

[TASK - bold, one sentence, direct]

**Why it matters:** [whyItMatters or successLooksLike. If GitNexus returned downstream data, append: "Completing this unblocks [N] connected areas in your codebase."]

**Time:** [estimatedTime or "Today"] - **Difficulty:** [difficulty or "Easy"]

**Start here:** `[first file from filesLikelyInvolved/filesToOpen, or "open your terminal"]`

---

[ONE encouraging closing line, varied by context]

> Type `/easy-wins done` after you've finished to log it.

## Mark Complete

When the user types `/easy-wins done` or the argument is `done`:

1. Run detect_changes to see what changed:

```text
mcp__gitnexus__detect_changes()
```

2. Append one JSON line to `.easywins/history.jsonl`:

```json
{"timestamp":"<ISO timestamp>","event":"session-complete","summary":"<one sentence outcome>","activeWin":"<task if known>","changedFiles":["<changed file>"]}
```

3. If the Easy Wins server is running, refresh analysis to update `.easywins/metadata.json` and `.easywins/agent-notes.md`. If not, update only `history.jsonl`.

4. Respond with:
> "Done! [If changes detected: GitNexus shows [N] files changed - nice work.] [If no changes: No file changes detected yet - that's okay, sometimes wins are research or planning.]"

## Error Responses

| Situation | Response |
|-----------|----------|
| Server not running | "The Easy Wins server isn't running - start it with `npm run dev:server` in `app/`." |
| No wins in metadata/report | "Nothing flagged as Easy right now - your project is in strong shape. Check Medium-difficulty items in the tracker." |
| Network/parse error | "Couldn't reach the Easy Wins server right now - check that it's running on port 3001." |
| GitNexus index stale | Skip silently, continue without impact data. |
