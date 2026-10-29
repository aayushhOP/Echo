# Build Phases — Index

This project is split into 8 self-contained phase files. Give **one file at a time** to Gemini Flash (or any coding agent) as its context — each file already includes the schemas, endpoint tables, and event tables it needs, so the agent doesn't have to cross-reference other documents.

Work strictly in order. Don't start a phase until the previous one's "Done condition" checklist is fully checked.

| # | File | What gets built |
|---|---|---|
| 0 | `PHASE_0_SETUP.md` | Repo skeleton, `.gitignore`, `.env.example` |
| 1 | `PHASE_1_BACKEND_AUTH.md` | Backend scaffold, DB models, JWT register/login/refresh/logout |
| 2 | `PHASE_2_CORE_REST_API.md` | User profile/search, conversations, paginated message history |
| 3 | `PHASE_3_REALTIME.md` | Socket.IO auth, `message:send`/`message:new`, read receipts |
| 4 | `PHASE_4_PRESENCE_TYPING.md` | Typing indicator, online/offline presence |
| 5 | `PHASE_5_GROUP_CHAT.md` | Group creation, membership, group messaging |
| 6 | `PHASE_6_FRONTEND.md` | React client: auth pages, socket hook, chat UI, typing/presence UI |
| 7 | `PHASE_7_POLISH_TESTING_DEPLOYMENT.md` | Validation, error handling, tests, Docker, deployment |

## How to run each phase with Gemini Flash
1. Open a fresh chat/session for the phase.
2. Paste the entire phase `.md` file as the first message (or attach it).
3. Tell it to work step by step, in order, and to stop and show you the result after each "Verify" line before continuing.
4. Once all boxes in that phase's "Done condition" are checked, move to the next file.

## Why split this way (vs. one long prompt file)
- Each file is small enough to fit comfortably in context without drift.
- Each file only contains the schema/contract pieces relevant to that phase — less chance of a smaller model hallucinating or mixing up unrelated details.
- Natural checkpoints: if something breaks, you know exactly which phase introduced it.

## Full reference docs (keep these, but you shouldn't need them mid-phase)
- `ARCHITECTURE.md` — full system design, kept as the source of truth these phase files were generated from
- `AGENTS.md` — persistent coding conventions (also repeated inline where relevant in each phase file)
- `GIT_WORKFLOW.md` — branching/PR workflow, unchanged
- `SDLC.md` — overall project timeline and team roles, unchanged
