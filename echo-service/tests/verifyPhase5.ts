import http from "http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import request from "supertest";
import { io as Client, Socket as ClientSocket } from "socket.io-client";
import { createApp } from "../dist/app";
import { initSocketServer } from "../dist/sockets";
import User from "../dist/models/User";
import Conversation from "../dist/models/Conversation";
import Message from "../dist/models/Message";
import { ENV } from "../dist/config/env";

const TEST_DB_URI = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017/echo_test_phase5";
const PORT = 5057;

async function runPhase5Verification() {
  console.log("Connecting to test MongoDB for Phase 5...");
  await mongoose.connect(TEST_DB_URI);
  console.log("Connected to MongoDB!");

  const app = createApp();
  const server = http.createServer(app);
  initSocketServer(server);

  await new Promise<void>((resolve) => {
    server.listen(PORT, () => {
      console.log(`Test server running on port ${PORT}`);
      resolve();
    });
  });

  const serverUrl = `http://localhost:${PORT}`;

  try {
    // 1. Reset database
    await User.deleteMany({});
    await Conversation.deleteMany({});
    await Message.deleteMany({});

    // 2. Create 4 test users: Alice, Bob, Charlie, Dave
    const alice = await User.create({
      username: "alice",
      email: "alice@test.com",
      passwordHash: "hash123",
    });
    const bob = await User.create({
      username: "bob",
      email: "bob@test.com",
      passwordHash: "hash123",
    });
    const charlie = await User.create({
      username: "charlie",
      email: "charlie@test.com",
      passwordHash: "hash123",
    });
    const dave = await User.create({
      username: "dave",
      email: "dave@test.com",
      passwordHash: "hash123",
    });

    const aliceToken = jwt.sign({ userId: alice._id.toString() }, ENV.JWT_SECRET, { expiresIn: "1h" });
    const bobToken = jwt.sign({ userId: bob._id.toString() }, ENV.JWT_SECRET, { expiresIn: "1h" });
    const charlieToken = jwt.sign({ userId: charlie._id.toString() }, ENV.JWT_SECRET, { expiresIn: "1h" });
    const daveToken = jwt.sign({ userId: dave._id.toString() }, ENV.JWT_SECRET, { expiresIn: "1h" });

    console.log("\n--- Step 5.1: Group creation and membership tests ---");

    // Test 5.1.1: Create group with 3 users (Alice as creator/admin + Bob + Charlie)
    const createGroupRes = await request(app)
      .post("/api/conversations")
      .set("Authorization", `Bearer ${aliceToken}`)
      .send({
        type: "group",
        groupName: "Study Group",
        participants: [bob._id.toString(), charlie._id.toString()],
      });

    console.assert(createGroupRes.status === 201, `Expected 201, got ${createGroupRes.status}`);
    const group = createGroupRes.body.data;
    const groupId = group._id;
    console.assert(group.type === "group", "Expected type to be 'group'");
    console.assert(group.groupName === "Study Group", "Expected groupName to match");
    console.assert(group.participants.length === 3, `Expected 3 participants, got ${group.participants.length}`);

    // Verify creator is in admins
    const adminIds = group.admins.map((a: any) => a._id?.toString() || a.toString());
    console.assert(adminIds.includes(alice._id.toString()), "Expected creator Alice to be an admin");
    console.log("✔ Group created with 3 users; creator Alice is in admins array");

    // Test 5.1.2: Non-admin (Bob) attempting to add Dave should be rejected with 403
    const nonAdminAddRes = await request(app)
      .patch(`/api/conversations/${groupId}`)
      .set("Authorization", `Bearer ${bobToken}`)
      .send({
        addParticipants: [dave._id.toString()],
      });

    console.assert(nonAdminAddRes.status === 403, `Expected 403 for non-admin, got ${nonAdminAddRes.status}`);
    console.log("✔ Non-admin (Bob) attempting to add member rejected with 403");

    // Test 5.1.3: Admin (Alice) adds a 4th user (Dave)
    const adminAddRes = await request(app)
      .patch(`/api/conversations/${groupId}`)
      .set("Authorization", `Bearer ${aliceToken}`)
      .send({
        addParticipants: [dave._id.toString()],
      });

    console.assert(adminAddRes.status === 200, `Expected 200, got ${adminAddRes.status}`);
    const updatedParticipants = adminAddRes.body.data.participants.map((p: any) => p._id.toString());
    console.assert(updatedParticipants.length === 4, `Expected 4 participants, got ${updatedParticipants.length}`);
    console.assert(updatedParticipants.includes(dave._id.toString()), "Expected Dave to be in participants");
    console.log("✔ Admin (Alice) successfully added 4th user (Dave)");

    // Test 5.1.4: Non-admin (Charlie) attempting to remove Dave should be rejected with 403
    const nonAdminRemoveRes = await request(app)
      .patch(`/api/conversations/${groupId}`)
      .set("Authorization", `Bearer ${charlieToken}`)
      .send({
        removeParticipants: [dave._id.toString()],
      });

    console.assert(nonAdminRemoveRes.status === 403, `Expected 403 for non-admin removal, got ${nonAdminRemoveRes.status}`);
    console.log("✔ Non-admin (Charlie) attempting to remove member rejected with 403");

    // Test 5.1.5: Admin (Alice) removes Charlie
    const adminRemoveRes = await request(app)
      .patch(`/api/conversations/${groupId}`)
      .set("Authorization", `Bearer ${aliceToken}`)
      .send({
        removeParticipants: [charlie._id.toString()],
      });

    console.assert(adminRemoveRes.status === 200, `Expected 200, got ${adminRemoveRes.status}`);
    const afterRemoveParticipants = adminRemoveRes.body.data.participants.map((p: any) => p._id.toString());
    console.assert(afterRemoveParticipants.length === 3, `Expected 3 participants, got ${afterRemoveParticipants.length}`);
    console.assert(!afterRemoveParticipants.includes(charlie._id.toString()), "Charlie should no longer be a participant");
    console.log("✔ Admin (Alice) successfully removed Charlie; participants updated correctly");

    console.log("\n--- Step 5.2: Group messaging & real-time broadcast tests ---");

    // We connect 3 sockets: Alice, Bob, and Dave (the 3 current members of Study Group)
    // When they connect, their sockets automatically join conversation:<groupId>
    const connectClient = (token: string): Promise<ClientSocket> => {
      return new Promise((resolve, reject) => {
        const client = Client(serverUrl, {
          auth: { token },
          autoConnect: true,
          reconnection: false,
        });
        client.on("connect", () => resolve(client));
        client.on("connect_error", (err) => reject(err));
      });
    };

    const aliceSocket = await connectClient(aliceToken);
    const bobSocket = await connectClient(bobToken);
    const daveSocket = await connectClient(daveToken);

    // Wait 100ms for room joins to complete
    await new Promise((r) => setTimeout(r, 100));

    // Prepare promises for message:new on all 3 clients
    const receivePromises = [
      new Promise<any>((resolve) => aliceSocket.once("message:new", resolve)),
      new Promise<any>((resolve) => bobSocket.once("message:new", resolve)),
      new Promise<any>((resolve) => daveSocket.once("message:new", resolve)),
    ];

    // Alice sends a message in the group conversation
    const groupMessageContent = "Hello everyone in the study group!";
    aliceSocket.emit("message:send", {
      conversationId: groupId,
      content: groupMessageContent,
      type: "text",
    });

    const [aliceReceived, bobReceived, daveReceived] = await Promise.all(receivePromises);

    console.assert(aliceReceived.message.content === groupMessageContent, "Alice received group message");
    console.assert(bobReceived.message.content === groupMessageContent, "Bob received group message");
    console.assert(daveReceived.message.content === groupMessageContent, "Dave received group message");
    console.assert(aliceReceived.message.conversationId.toString() === groupId, "Conversation ID matches");

    console.log("✔ Message in group conversation was received by Alice, Bob, and Dave via message:new");

    // Verify Bob can also send a message in the group
    const bobReceivePromises = [
      new Promise<any>((resolve) => aliceSocket.once("message:new", resolve)),
      new Promise<any>((resolve) => bobSocket.once("message:new", resolve)),
      new Promise<any>((resolve) => daveSocket.once("message:new", resolve)),
    ];

    bobSocket.emit("message:send", {
      conversationId: groupId,
      content: "Hey Alice and Dave!",
      type: "text",
    });

    const [aliceBobMsg, bobBobMsg, daveBobMsg] = await Promise.all(bobReceivePromises);
    console.assert(aliceBobMsg.message.content === "Hey Alice and Dave!", "Alice received Bob's message");
    console.assert(bobBobMsg.message.content === "Hey Alice and Dave!", "Bob received Bob's message");
    console.assert(daveBobMsg.message.content === "Hey Alice and Dave!", "Dave received Bob's message");

    console.log("✔ Bob's group message reached all connected members");

    // Verify messages saved in database
    const dbMessages = await Message.find({ conversationId: groupId });
    console.assert(dbMessages.length === 2, `Expected 2 messages in db, found ${dbMessages.length}`);
    console.log("✔ Database contains all sent group messages");

    // Cleanup sockets
    aliceSocket.disconnect();
    bobSocket.disconnect();
    daveSocket.disconnect();

    console.log("\nALL PHASE 5 TESTS PASSED SUCCESSFULLY! 🎉");
  } finally {
    await mongoose.disconnect();
    server.close();
  }
}

runPhase5Verification().catch((err) => {
  console.error("Phase 5 Test Failure:", err);
  process.exit(1);
});
