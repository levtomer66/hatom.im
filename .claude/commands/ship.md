---
description: Review, fix, lint, build, commit, and push pending work
---

Orchestrate the full "ship it" workflow for this repo:

## 1. Understand the state

Run `git status --short --untracked-files=all` and `git log --oneline origin/main..HEAD` to answer:

- **Case A — uncommitted changes in the working tree**: stage them with targeted `git add <paths>` (never `git add -A` without checking for secrets) so Codex has something to review.
- **Case B — working tree clean, but HEAD is ahead of origin**: the review target is already committed. Soft-reset once (`git reset --soft HEAD^` if only one commit is ahead, or equivalent) so the diff becomes staged and Codex can review it. Remember the commit message so you can restore it later.
- **Case C — nothing to ship**: tell the user the working tree is clean and `origin/main` is up to date, and stop.

## 2. Run Codex review

Invoke `/codex:review` via the Skill tool. When the review size is non-trivial (roughly more than 1-2 files), prefer background mode; wait for the monitor notification that it completed, then read the output file.

## 3. Apply findings

Read the Codex output carefully and address each finding:

- **P0 / P1**: must fix before shipping.
- **P2 / P3**: fix if the change is small and obviously correct; otherwise call them out to the user and ask whether to defer.
- If Codex raises architectural concerns beyond the scope of the current change, flag them and ask the user before re-architecting.

## 4. Verify

Run, in order, until each one passes:

- `npx tsc --noEmit --incremental false --pretty false`
- `npm run lint`
- `npm run build`

If any step fails, fix the root cause (do not suppress warnings) and re-run.

## 5. Commit

- **Case A**: stage any final tweaks, then create a single commit. Use the user's `$ARGUMENTS` as the commit subject when provided; otherwise write a descriptive subject + body that explains the change and why.
- **Case B**: `git commit` the restored staged state (possibly `--reuse-message=ORIG_HEAD` via the reflog if you kept the original message, or write a fresh one that also summarises the review fixes).

Always append the standard `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer. Never amend a commit that is already on `origin`; make a follow-up commit instead.

## 6. Push

`git push`. If this would require a force push (Case B diverged from origin), pause and ask the user before force-pushing — don't do it autonomously. The non-destructive alternative is usually a rebase onto `origin/main` so the fix becomes a fast-forward commit.

## 7. Report

Summarise for the user: commit SHA(s) pushed, Codex findings addressed, and anything you deferred. Mention the Vercel URL (`https://www.hatom.im`) as the place the change will land after the auto-deploy.

## Notes

- This repo has a `husky` pre-commit hook that runs `next build`; a failing build will block the commit. Fix and re-try.
- Default branch is `main`, not `master`.
- Never skip hooks (`--no-verify`) unless the user explicitly asks.
- Never share staged secrets: if `git diff --cached` contains anything that looks like a credential, stop and ask.

$ARGUMENTS
