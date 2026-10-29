# Git & GitHub Team Workflow

A guide for pushing this project to GitHub and working on it as a team — cloning, branching, fixing issues, and merging via pull requests.

---

## 1. Initialize git locally

From the project root (containing `client/`, `server/`, `ARCHITECTURE.md`, `AGENTS.md`, `PROMPTS.md`):

```bash
git init
git add .
git commit -m "Initial commit: project scaffolding and docs"
```

Your `.gitignore` (from Phase 0 in `PROMPTS.md`) already excludes `node_modules` and `.env`. Before committing, run `git status` once and confirm `.env` is **not** in the list of files to be committed — only `.env.example` (placeholders, no real secrets) should ever be tracked.

---

## 2. Create the GitHub repo and push

1. On github.com, create a new **empty** repository — don't check "Add a README," since you already have a local commit.
2. Copy the repo's URL.
3. Push your local commit:

```bash
git remote add origin <repo-url>
git branch -M main
git push -u origin main
```

If you have the [GitHub CLI](https://cli.github.com/) installed, this collapses into one command:

```bash
gh repo create chatapp --private --source=. --remote=origin --push
```

---

## 3. Add teammates as collaborators

Repo page → **Settings** → **Collaborators and teams** → **Add people** → enter each teammate's GitHub username. They'll receive an email invite to accept.

For a small trusted team, a personal repo with collaborators added is simpler than setting up a GitHub Organization — no need for that overhead on a college project.

---

## 4. Protect the main branch

Do this **before** anyone else clones, so the workflow is enforced from day one, not just agreed upon informally.

**Settings** → **Branches** → **Add branch protection rule** → apply to `main` → enable:
- **Require a pull request before merging**
- Optionally, **Require approvals: 1** so a teammate reviews before merge

This means nobody — including you — can push directly to `main`. Every change goes through a PR.

---

## 5. Log work as GitHub Issues

Repo → **Issues** tab → **New issue**, one per bug or task. Example: *"Typing indicator doesn't clear on blur."*

- Gives each PR something concrete to reference.
- Writing `Fixes #12` in a PR description auto-closes issue #12 when the PR merges.
- Doubles as a visible record of who fixed what — useful for your project report and viva.

---

## 6. Teammates clone and branch

**Clone and install:**
```bash
git clone <repo-url>
cd chatapp
cd client && npm install && cd ..
cd server && npm install && cd ..
```

**Before starting any task**, always sync with the latest `main`:
```bash
git checkout main
git pull
```

**Create a branch per task:**
```bash
git checkout -b fix/12-typing-indicator
```

### Branch naming convention

| Prefix | Use for |
|---|---|
| `fix/` | Bug fixes |
| `feature/` | New functionality |
| `chore/` | Config, tooling, dependency updates |
| `docs/` | Documentation-only changes |

Include the issue number where possible: `fix/12-typing-indicator`, `feature/9-group-chat`. This keeps branches traceable back to the issue they resolve.

---

## 7. Commit, push, open a PR

```bash
git add .
git commit -m "Fix typing indicator not clearing on blur"
git push -u origin fix/12-typing-indicator
```

On GitHub, a **"Compare & pull request"** banner appears on the repo page — click it, write a short description, and add `Fixes #12` so the linked issue auto-closes on merge.

Or, from the terminal with GitHub CLI:
```bash
gh pr create --fill
```

### Good commit messages
Keep them short, imperative, and specific:
- ✅ `Fix typing indicator not clearing on blur`
- ✅ `Add read-receipt broadcast on message:read`
- ❌ `updates`
- ❌ `fixed stuff`

---

## 8. Review, merge, and sync

1. A teammate reviews the PR's diff on GitHub — comments, requests changes, or approves.
2. Once approved, use **Squash and merge** — it collapses the branch's commits into a single clean commit on `main`, keeping history readable.
3. Delete the branch (GitHub shows a one-click button after merge).
4. Everyone else syncs before starting their next task:
   ```bash
   git checkout main
   git pull
   ```

---

## Handling merge conflicts

If two people edit the same file on different branches, you'll hit a conflict when opening or updating a PR. To resolve it on your branch:

```bash
git checkout fix/12-typing-indicator
git pull origin main
```

Git will mark the conflicting sections in the affected files with `<<<<<<<`, `=======`, `>>>>>>>` markers. Edit the file to keep the correct code, then:

```bash
git add <resolved-file>
git commit -m "Resolve merge conflict with main"
git push
```

---

## PR best practices

- **Keep PRs small and scoped to one issue.** A PR fixing one bug is reviewable in minutes; a PR touching ten files across three features rarely gets a real review — it just gets rubber-stamped, which defeats the purpose of reviewing at all.
- **Write a one-line description of what changed and why**, even if the code seems self-explanatory to you — it won't be to whoever's reviewing it three weeks later.
- **Never commit `.env` files** or any real secrets (JWT keys, DB URIs, API keys). Only `.env.example` with placeholders belongs in git.
- **Pull `main` into your branch periodically** if your task is taking more than a day or two, so you're not resolving a huge conflict at the end.

---

## Quick command reference

```bash
# Starting a new task
git checkout main
git pull
git checkout -b fix/13-something

# Saving work
git add .
git commit -m "Short, specific description"
git push -u origin fix/13-something   # first push on this branch
git push                              # subsequent pushes

# Opening a PR (GitHub CLI)
gh pr create --fill

# After your PR is merged
git checkout main
git pull
git branch -d fix/13-something        # delete local branch
```
