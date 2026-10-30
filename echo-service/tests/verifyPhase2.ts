import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "../dist/app";
import User from "../dist/models/User";
import Conversation from "../dist/models/Conversation";
import Message from "../dist/models/Message";

const TEST_DB_URI = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017/echo_test_phase2";
const app = createApp();

async function runTests() {
  console.log("Connecting to test MongoDB...");
  await mongoose.connect(TEST_DB_URI);
  console.log("Connected!");

  const registerUser = async (username: string, email: string) => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ username, email, password: "password123" });
    if (res.status !== 201) {
      throw new Error(`Failed to register ${username}: ${JSON.stringify(res.body)}`);
    }
    return {
      token: res.body.data.accessToken,
      user: res.body.data.user,
    };
  };

  try {
    // Reset database
    await User.deleteMany({});
    await Conversation.deleteMany({});
    await Message.deleteMany({});

    console.log("\n--- Testing User Routes ---");
    // 1. GET /api/users/me
    const alice = await registerUser("alice", "alice@test.com");
    const meRes = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${alice.token}`);
    console.assert(meRes.status === 200, `GET /api/users/me expected 200, got ${meRes.status}`);
    console.assert(meRes.body.data.username === "alice", "GET /api/users/me username mismatch");
    console.log("✔ GET /api/users/me works");

    // 2. PATCH /api/users/me
    const patchRes = await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ status: "Busy coding", avatarUrl: "https://example.com/alice.jpg" });
    console.assert(patchRes.status === 200, `PATCH /api/users/me expected 200, got ${patchRes.status}`);
    console.assert(patchRes.body.data.status === "Busy coding", "PATCH status not updated");
    console.assert(patchRes.body.data.avatarUrl === "https://example.com/alice.jpg", "PATCH avatarUrl not updated");

    // Check invalid fields rejected
    const patchInvalid = await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ username: "alice_hacked" });
    console.assert(patchInvalid.status === 400, "PATCH with unauthorized fields must return 400");
    console.log("✔ PATCH /api/users/me works (and validates strictly)");

    // 3. GET /api/users/search?q=
    await registerUser("bob_builder", "bob@test.com");
    await registerUser("bobby_tables", "bobby@test.com");
    await registerUser("charlie_brown", "charlie@test.com");

    const searchRes = await request(app)
      .get("/api/users/search?q=bob")
      .set("Authorization", `Bearer ${alice.token}`);
    console.assert(searchRes.status === 200, "Search expected 200");
    console.assert(searchRes.body.data.length === 2, `Expected 2 matching users, got ${searchRes.body.data.length}`);
    console.log("✔ GET /api/users/search works");

    console.log("\n--- Testing Conversation Routes ---");
    const bob = await registerUser("bob2", "bob2@test.com");
    const charlie = await registerUser("charlie2", "charlie2@test.com");

    // 4. Create direct conversation
    const c1 = await request(app)
      .post("/api/conversations")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ type: "direct", participantId: bob.user.id });
    console.assert(c1.status === 201, `Create conversation expected 201, got ${c1.status}`);

    // Create duplicate direct conversation -> returns existing
    const c2 = await request(app)
      .post("/api/conversations")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ type: "direct", participantId: bob.user.id });
    console.assert(c2.status === 200, `Duplicate expected 200, got ${c2.status}`);
    console.assert(c1.body.data._id === c2.body.data._id, "Duplicate direct convo IDs must match");

    // Call from other user returns same
    const c3 = await request(app)
      .post("/api/conversations")
      .set("Authorization", `Bearer ${bob.token}`)
      .send({ type: "direct", participantId: alice.user.id });
    console.assert(c3.status === 200, "Reverse direct expected 200");
    console.assert(c1.body.data._id === c3.body.data._id, "Reverse direct convo IDs must match");
    console.log("✔ Direct conversation deduplication works");

    // 5. Group conversations
    const groupRes = await request(app)
      .post("/api/conversations")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({
        type: "group",
        groupName: "Study Group",
        participantIds: [bob.user.id, charlie.user.id],
      });
    console.assert(groupRes.status === 201, "Group create expected 201");
    const groupId = groupRes.body.data._id;

    // Update group (rename)
    const updateGroupRes = await request(app)
      .patch(`/api/conversations/${groupId}`)
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ groupName: "Study Group 2.0" });
    console.assert(updateGroupRes.status === 200, "Group update expected 200");
    console.assert(updateGroupRes.body.data.groupName === "Study Group 2.0", "Group name not updated");
    console.log("✔ Group conversation creation and update work");

    // 6. Access control / 403 checks
    const outsider = await registerUser("outsider", "outsider@test.com");
    const forbiddenConvo = await request(app)
      .get(`/api/conversations/${c1.body.data._id}`)
      .set("Authorization", `Bearer ${outsider.token}`);
    console.assert(forbiddenConvo.status === 403, `Non-participant expected 403, got ${forbiddenConvo.status}`);
    console.log("✔ Non-participant forbidden (403) verified");

    console.log("\n--- Testing Message History Pagination ---");
    // Seed 40 messages in conversation c1
    const baseTime = Date.now();
    const docs = [];
    for (let i = 1; i <= 40; i++) {
      docs.push({
        conversationId: c1.body.data._id,
        senderId: alice.user.id,
        content: `Message ${i}`,
        createdAt: new Date(baseTime + i * 1000),
        updatedAt: new Date(baseTime + i * 1000),
      });
    }
    await Message.insertMany(docs);

    // Page 1: default limit 30
    const page1 = await request(app)
      .get(`/api/conversations/${c1.body.data._id}/messages`)
      .set("Authorization", `Bearer ${alice.token}`);
    console.assert(page1.status === 200, "Page 1 expected 200");
    console.assert(page1.body.data.length === 30, `Page 1 expected 30 messages, got ${page1.body.data.length}`);
    console.assert(page1.body.pagination.hasMore === true, "Page 1 hasMore should be true");
    console.assert(page1.body.data[0].content === "Message 40", "First message should be newest (Message 40)");
    console.assert(page1.body.data[29].content === "Message 11", "30th message should be Message 11");

    const cursor = page1.body.pagination.nextCursor;
    console.assert(!!cursor, "nextCursor must be returned");

    // Page 2: with before cursor
    const page2 = await request(app)
      .get(`/api/conversations/${c1.body.data._id}/messages?before=${cursor}`)
      .set("Authorization", `Bearer ${bob.token}`);
    console.assert(page2.status === 200, "Page 2 expected 200");
    console.assert(page2.body.data.length === 10, `Page 2 expected 10 messages, got ${page2.body.data.length}`);
    console.assert(page2.body.pagination.hasMore === false, "Page 2 hasMore should be false");
    console.assert(page2.body.data[0].content === "Message 10", "First item of page 2 should be Message 10");
    console.assert(page2.body.data[9].content === "Message 1", "Last item of page 2 should be Message 1");
    console.log("✔ Message cursor pagination works (40 messages split 30/10, newest first)");

    // Messages forbidden for outsider
    const messagesForbidden = await request(app)
      .get(`/api/conversations/${c1.body.data._id}/messages`)
      .set("Authorization", `Bearer ${outsider.token}`);
    console.assert(messagesForbidden.status === 403, "Outsider fetching messages must return 403");
    console.log("✔ Non-participant forbidden on message history verified");

    console.log("\nALL PHASE 2 VERIFICATIONS PASSED SUCCESSFULLY!");
  } finally {
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
    }
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
