# PHASE 5 — Group Chat

> Give this whole file to the AI agent as context. Phases 1–4 must already be done and working.

## Goal
Extend the existing conversation system to support groups: creation, membership management, and confirm messaging/sockets already work unchanged for groups.

## Key fact to remember
A group is just a `Conversation` document with `type: "group"`, a `groupName`, and multiple `participants`. Messages key off `conversationId` only — they do not care whether the conversation is direct or group. This means Phase 3's `message:send`/`message:new` handlers should need **no changes** here.

## Steps

### Step 5.1 — Group creation and membership
Task: Extend `conversationService.ts` and `conversationController.ts` to support:
- Creating a group: `POST /api/conversations` with `{ type: "group", groupName, participants: [...] }`. The creator is automatically added to `admins`.
- Add/remove member endpoint, restricted to users present in the conversation's `admins` array — reject with 403 if the caller is not an admin.

Verify: create a group with 3 users. Add a 4th user. Remove one user. Confirm `participants` updates correctly each time, and a non-admin attempting to add/remove gets 403.

### Step 5.2 — Group messaging
Task: Confirm (write a test, don't rewrite the handlers) that the existing `message:send` / `message:new` handlers from Phase 3 work unchanged for group conversations, since they only depend on `conversationId`. Add an automated or manual test for a 3-person group broadcast.

Verify: a message sent in a group conversation reaches all connected group members via `message:new`.

## Done condition for Phase 5
- [ ] Groups can be created with 2+ participants
- [ ] Only admins can add/remove members
- [ ] `participants` array stays correct after add/remove
- [ ] A message in a group conversation reaches every connected member
- [ ] No changes were needed in `messageHandlers.ts` to support groups

Next file: `PHASE_6_FRONTEND.md`
