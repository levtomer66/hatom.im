---
description: Review, fix, lint, build, commit, and push pending work
---

Orchestrate the full "ship it" workflow for this repo:

## 1. Understand the state

Run `git status --short --untracked-files=all` and `git log --oneline origin/main..HEAD` to answer:

- **Case A — uncommitted changes in the working tree**: they'll be verified and committed below; the review then runs against the committed diff.
- **Case B — working tree clean, but HEAD is ahead of origin**: the pending commits are already the review target — nothing to stage or reset, go straight to verification.
- **Case C — nothing to ship**: tell the user the working tree is clean and `origin/main` is up to date, and stop.

## 2. Verify

Run, in order, until each one passes:

- `npx tsc --noEmit --incremental false --pretty false`
- `npm run lint`
- `npm run build`

If any step fails, fix the root cause (do not suppress warnings) and re-run. (Husky also runs `next build` on commit, so a green build here means the commit won't be blocked.)

## 3. Commit the pending work

The `/code-review` skill reviews a **committed** diff, so land the work first (this is the key difference from the old Codex flow, which reviewed the staged/working tree):

- **Case A**: stage with targeted `git add <paths>` (never `git add -A` without checking for secrets — if `git diff --cached` shows anything credential-like, stop and ask), then create a single commit. Use the user's `$ARGUMENTS` as the subject when provided; otherwise write a descriptive subject + body that explains the change and why.
- **Case B**: already committed — skip.

Always append the standard `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer. Never amend a commit that is already on `origin`.

## 4. Run the code review

Invoke the `/code-review` skill via the Skill tool with **`origin/main`** as the fixed point — it reviews `git diff origin/main...HEAD`, i.e. every pending commit. It runs two parallel sub-agents and reports their findings under `## Standards` (does the diff follow this repo's conventions + the Fowler smell baseline?) and `## Spec` (does it match the originating issue/PRD?) headings. There is **no P0–P3 severity labelling** — you triage severity yourself (see §5). A ship usually has no formal spec/issue, so the Spec axis may report "no spec available" — that's expected and fine.

For a large diff the skill runs its two axes in parallel sub-agents already; wait for it to return both reports, then read them.

## 5. Apply findings

Read both axes and address each finding, judging severity yourself:

- **Correctness / security / real bugs / spec violations**: must fix before shipping.
- **Style, naming, minor smells, judgement-call nits**: fix if the change is small and obviously correct; otherwise call them out to the user and ask whether to defer.
- If the review raises architectural concerns beyond the scope of the current change, flag them and ask the user before re-architecting.

After applying fixes, **re-run Verify (§2)**, then fold the fixes into the pending work:

- A single unpushed commit → `git commit --amend` (keeps history clean — safe because it isn't on `origin` yet).
- Several pending commits, or when you'd rather keep the trail → a follow-up `fix:` commit.

## 6. Push

`git push` (fast-forward only). If this would require a force push, pause and ask the user before force-pushing — don't do it autonomously. The non-destructive alternative is usually a rebase onto `origin/main` so the change becomes a fast-forward.

## 7. Report

Summarise for the user: commit SHA(s) pushed, the review findings you addressed (grouped by the Standards / Spec axes), and anything you deferred. Mention the Vercel URL (`https://www.hatom.im`) as the place the change will land after the auto-deploy.

## Notes

- This repo has a `husky` pre-commit hook that runs `next build`; a failing build will block the commit. Fix and re-try.
- Default branch is `main`, not `master`.
- Never skip hooks (`--no-verify`) unless the user explicitly asks.
- Never share staged secrets: if `git diff --cached` contains anything that looks like a credential, stop and ask.

$ARGUMENTS
