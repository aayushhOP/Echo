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
import { isUserOnline } from "../dist/services/presenceService";

const TEST_DB_URI = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017/echo_test_phase4";
const PORT = 5056;

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
      isOnline: false,
    });

    const bobUser = await User.create({
      username: "bob",
      email: "bob@test.com",
      passwordHash: "hash123",
      isOnline: false,
    });

    const conversation = await Conversation.create({
      type: "direct",
      participants: [aliceUser._id, bobUser._id],
    });

    const aliceToken = jwt.sign({ userId: aliceUser._id.toString() }, ENV.JWT_SECRET, {
      expiresIn: "15m",
    });
    const bobToken = jwt.sign({ userId: bobUser._id.toString() }, ENV.JWT_SECRET, {
      expiresIn: "15m",
    });

    console.log("\n--- TEST 1: Presence Online on Connect ---");
    let bobReceivedOnlineForAlice: any = null;

    const bobClient: ClientSocket = Client(serverUrl, {
      auth: { token: bobToken },
      transports: ["websocket"],
    });

    await new Promise<void>((resolve) => {
      bobClient.on("connect", () => {
        console.log("Bob connected!");
        bobClient.on("presence:online", (payload) => {
          console.log("Bob received presence:online:", payload);
          bobReceivedOnlineForAlice = payload;
        });
        resolve();
      });
    });

    // Now Alice connects Tab 1
    const aliceClientTab1: ClientSocket = Client(serverUrl, {
      auth: { token: aliceToken },
      transports: ["websocket"],
    });

    await new Promise<void>((resolve) => {
      aliceClientTab1.on("connect", () => {
        console.log("Alice Tab 1 connected!");
        resolve();
      });
    });

    // Allow presence event to propagate
    await new Promise((r) => setTimeout(r, 200));

    if (
      bobReceivedOnlineForAlice &&
      bobReceivedOnlineForAlice.userId === aliceUser._id.toString()
    ) {
      console.log("PASS: Bob received presence:online for Alice");
    } else {
      throw new Error(`FAIL: Bob did not receive presence:online for Alice: ${JSON.stringify(bobReceivedOnlineForAlice)}`);
    }

    const aliceOnline = await isUserOnline(aliceUser._id.toString());
    if (aliceOnline) {
      console.log("PASS: isUserOnline indicates Alice is online");
    } else {
      throw new Error("FAIL: isUserOnline returned false for Alice");
    }

    console.log("\n--- TEST 2: Typing Indicators ---");
    let bobReceivedTypingStart: any = null;
    let bobReceivedTypingStop: any = null;
    let aliceReceivedTypingStart = false;

    bobClient.on("typing:update", (payload) => {
      console.log("Bob received typing:update:", payload);
      if (payload.isTyping) {
        bobReceivedTypingStart = payload;
      } else {
        bobReceivedTypingStop = payload;
      }
    });

    aliceClientTab1.on("typing:update", (_payload) => {
      console.log("Alice received typing:update! (SHOULD NOT HAPPEN FOR SENDER)");
      aliceReceivedTypingStart = true;
    });

    aliceClientTab1.emit("typing:start", {
      conversationId: conversation._id.toString(),
    });

    await new Promise((r) => setTimeout(r, 200));

    if (
      bobReceivedTypingStart &&
      bobReceivedTypingStart.userId === aliceUser._id.toString() &&
      bobReceivedTypingStart.conversationId === conversation._id.toString() &&
      bobReceivedTypingStart.isTyping === true
    ) {
      console.log("PASS: Bob received typing:start correctly");
    } else {
      throw new Error("FAIL: Bob did not receive typing:start correctly");
    }

    if (!aliceReceivedTypingStart) {
      console.log("PASS: Alice (sender) did NOT receive typing:update");
    } else {
      throw new Error("FAIL: Sender Alice received typing:update");
    }

    aliceClientTab1.emit("typing:stop", {
      conversationId: conversation._id.toString(),
    });

    await new Promise((r) => setTimeout(r, 200));

    if (
      bobReceivedTypingStop &&
      bobReceivedTypingStop.userId === aliceUser._id.toString() &&
      bobReceivedTypingStop.isTyping === false
    ) {
      console.log("PASS: Bob received typing:stop correctly");
    } else {
      throw new Error("FAIL: Bob did not receive typing:stop correctly");
    }

    console.log("\n--- TEST 3: Multi-tab Presence & Disconnect ---");
    // Connect Alice Tab 2
    const aliceClientTab2: ClientSocket = Client(serverUrl, {
      auth: { token: aliceToken },
      transports: ["websocket"],
    });

    await new Promise<void>((resolve) => {
      aliceClientTab2.on("connect", () => {
        console.log("Alice Tab 2 connected!");
        resolve();
      });
    });

    let bobReceivedOfflineEvent: any = null;
    bobClient.on("presence:offline", (payload) => {
      console.log("Bob received presence:offline:", payload);
      bobReceivedOfflineEvent = payload;
    });

    // Close Alice Tab 1
    console.log("Disconnecting Alice Tab 1 (Tab 2 still open)...");
    aliceClientTab1.disconnect();
    await new Promise((r) => setTimeout(r, 300));

    if (bobReceivedOfflineEvent === null) {
      console.log("PASS: Bob did NOT receive presence:offline when Alice only closed 1 of 2 tabs");
    } else {
      throw new Error("FAIL: Bob received presence:offline while Alice still had Tab 2 open");
    }

    const aliceStillOnline = await isUserOnline(aliceUser._id.toString());
    if (aliceStillOnline) {
      console.log("PASS: Alice is still online in presence tracking");
    } else {
      throw new Error("FAIL: Alice marked offline prematurely");
    }

    // Now disconnect Alice Tab 2 (last remaining tab)
    console.log("Disconnecting Alice Tab 2 (last tab)...");
    aliceClientTab2.disconnect();
    await new Promise((r) => setTimeout(r, 500));

    if (
      bobReceivedOfflineEvent &&
      bobReceivedOfflineEvent.userId === aliceUser._id.toString() &&
      bobReceivedOfflineEvent.lastSeen
    ) {
      console.log("PASS: Bob received presence:offline with valid lastSeen:", bobReceivedOfflineEvent.lastSeen);
    } else {
      throw new Error(`FAIL: Bob did not receive presence:offline after last tab closed: ${JSON.stringify(bobReceivedOfflineEvent)}`);
    }

    const aliceFinallyOffline = await isUserOnline(aliceUser._id.toString());
    if (!aliceFinallyOffline) {
      console.log("PASS: Alice is now offline in presence tracking");
    } else {
      throw new Error("FAIL: Alice still online after all tabs disconnected");
    }

    const updatedAliceUser = await User.findById(aliceUser._id);
    if (!updatedAliceUser?.isOnline && updatedAliceUser?.lastSeen) {
      console.log("PASS: MongoDB User record updated with isOnline: false and lastSeen");
    } else {
      throw new Error("FAIL: MongoDB User record was not updated correctly");
    }

    bobClient.disconnect();
    console.log("\nALL PHASE 4 TESTS PASSED SUCCESSFULLY! 🎉\n");
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
