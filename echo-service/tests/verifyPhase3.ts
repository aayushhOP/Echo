import http from "http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { io as Client, Socket as ClientSocket } from "socket.io-client";
import { createApp } from "../dist/app";
import { initSocketServer } from "../dist/sockets";
import User from "../dist/models/User";
import Conversation from "../dist/models/Conversation";
import Message from "../dist/models/Message";
import { ENV } from "../dist/config/env";

const TEST_DB_URI = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017/echo_test_phase3";
const PORT = 5055;

async function runTests() {
  console.log("Connecting to test MongoDB...");
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
    // Reset database
    await User.deleteMany({});
    await Conversation.deleteMany({});
    await Message.deleteMany({});

    // Create 2 test users
    const aliceUser = await User.create({
      username: "alice",
      email: "alice@test.com",
      passwordHash: "hash123",
    });

    const bobUser = await User.create({
      username: "bob",
      email: "bob@test.com",
      passwordHash: "hash123",
    });

    const aliceToken = jwt.sign({ userId: aliceUser._id.toString() }, ENV.JWT_SECRET, { expiresIn: "1h" });
    const bobToken = jwt.sign({ userId: bobUser._id.toString() }, ENV.JWT_SECRET, { expiresIn: "1h" });
    const invalidToken = "invalid.token.here";

    // Create conversation between Alice and Bob
    const conversation = await Conversation.create({
      type: "direct",
      participants: [aliceUser._id, bobUser._id],
    });
    const conversationId = conversation._id.toString();

    console.log("\n--- Step 3.1: Socket Auth Middleware & Connection Verification ---");

    // 1. Connection without token should fail
    await new Promise<void>((resolve, reject) => {
      const client = Client(serverUrl, {
        autoConnect: true,
        reconnection: false,
      });
      client.on("connect_error", (err) => {
        console.assert(err.message === "No token provided", `Expected 'No token provided', got '${err.message}'`);
        console.log("✔ Connection with missing token rejected with 'No token provided'");
        client.disconnect();
        resolve();
      });
      client.on("connect", () => {
        client.disconnect();
        reject(new Error("Socket connected without token!"));
      });
    });

    // 2. Connection with invalid token should fail
    await new Promise<void>((resolve, reject) => {
      const client = Client(serverUrl, {
        auth: { token: invalidToken },
        autoConnect: true,
        reconnection: false,
      });
      client.on("connect_error", (err) => {
        console.assert(err.message === "Invalid token", `Expected 'Invalid token', got '${err.message}'`);
        console.log("✔ Connection with invalid token rejected with 'Invalid token'");
        client.disconnect();
        resolve();
      });
      client.on("connect", () => {
        client.disconnect();
        reject(new Error("Socket connected with invalid token!"));
      });
    });

    // 3. Connection with valid token should succeed
    const clientAlice: ClientSocket = Client(serverUrl, {
      auth: { token: aliceToken },
      autoConnect: true,
      reconnection: false,
    });

    await new Promise<void>((resolve, reject) => {
      clientAlice.on("connect", () => {
        console.log("✔ Alice connected successfully with valid token");
        resolve();
      });
      clientAlice.on("connect_error", (err) => {
        reject(new Error(`Alice failed to connect: ${err.message}`));
      });
    });

    const clientBob: ClientSocket = Client(serverUrl, {
      auth: { token: bobToken },
      autoConnect: true,
      reconnection: false,
    });

    await new Promise<void>((resolve, reject) => {
      clientBob.on("connect", () => {
        console.log("✔ Bob connected successfully with valid token");
        resolve();
      });
      clientBob.on("connect_error", (err) => {
        reject(new Error(`Bob failed to connect: ${err.message}`));
      });
    });

    // Wait a brief moment for both sockets to auto-join their rooms
    await new Promise((r) => setTimeout(r, 200));

    console.log("\n--- Step 3.2: Message Send & Broadcast Verification ---");

    // Alice sends a message, Bob and Alice should both receive `message:new`
    let bobReceivedMessage: any = null;
    let aliceReceivedMessage: any = null;

    const bobPromise = new Promise<void>((resolve) => {
      clientBob.on("message:new", (data) => {
        bobReceivedMessage = data.message;
        resolve();
      });
    });

    const alicePromise = new Promise<void>((resolve) => {
      clientAlice.on("message:new", (data) => {
        aliceReceivedMessage = data.message;
        resolve();
      });
    });

    clientAlice.emit("message:send", {
      conversationId,
      content: "Hello Bob from real-time!",
      type: "text",
    });

    await Promise.all([bobPromise, alicePromise]);

    console.assert(bobReceivedMessage !== null, "Bob did not receive message:new");
    console.assert(aliceReceivedMessage !== null, "Alice did not receive message:new");
    console.assert(bobReceivedMessage.content === "Hello Bob from real-time!", "Message content mismatch");
    console.assert(bobReceivedMessage._id === aliceReceivedMessage._id, "Message IDs mismatch between recipients");
    console.assert(bobReceivedMessage.senderId._id === aliceUser._id.toString(), "Sender ID mismatch");

    // Check message persisted in MongoDB
    const dbMessage = await Message.findById(bobReceivedMessage._id);
    console.assert(dbMessage !== null, "Message not persisted in database");
    console.assert(dbMessage?.content === "Hello Bob from real-time!", "Database content mismatch");

    // Check conversation lastMessage updated
    const updatedConv = await Conversation.findById(conversationId);
    console.assert(
      updatedConv?.lastMessage?.toString() === dbMessage?._id.toString(),
      "Conversation lastMessage reference not updated"
    );

    console.log("✔ message:send persisted to DB and broadcast via message:new to room");

    console.log("\n--- Step 3.3: Read Receipts Verification ---");

    let aliceReceivedReadUpdate: any = null;
    const readUpdatePromise = new Promise<void>((resolve) => {
      clientAlice.on("message:read:update", (data) => {
        aliceReceivedReadUpdate = data;
        resolve();
      });
    });

    // Bob marks message as read
    clientBob.emit("message:read", {
      conversationId,
      messageIds: [bobReceivedMessage._id],
    });

    await readUpdatePromise;

    console.assert(aliceReceivedReadUpdate !== null, "Alice did not receive message:read:update");
    console.assert(aliceReceivedReadUpdate.conversationId === conversationId, "Read update conversationId mismatch");
    console.assert(aliceReceivedReadUpdate.messageIds[0] === bobReceivedMessage._id, "Read update messageId mismatch");
    console.assert(aliceReceivedReadUpdate.readerId === bobUser._id.toString(), "Read update readerId mismatch");

    // Verify DB updated
    const readDbMessage = await Message.findById(bobReceivedMessage._id);
    console.assert(readDbMessage?.status === "read", `Expected status 'read', got '${readDbMessage?.status}'`);
    const readByStrings = readDbMessage?.readBy.map((id) => id.toString());
    console.assert(readByStrings?.includes(bobUser._id.toString()), "Bob not in readBy array");

    console.log("✔ message:read updated readBy/status and broadcast message:read:update");

    // Disconnect clients
    clientAlice.disconnect();
    clientBob.disconnect();

    console.log("\n=================================");
    console.log("🎉 ALL PHASE 3 TESTS PASSED!");
    console.log("=================================\n");
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
