import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../src/app";
import User from "../src/models/User";
import Conversation from "../src/models/Conversation";
import Message from "../src/models/Message";

let mongoServer: MongoMemoryServer;
const app = createApp();

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Conversation.deleteMany({});
  await Message.deleteMany({});
});

describe("Phase 2 Core Chat REST APIs", () => {
  const registerUser = async (username: string, email: string) => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ username, email, password: "password123" });
    return {
      token: res.body.data.accessToken,
      user: res.body.data.user,
    };
  };

  describe("User routes", () => {
    it("GET /api/users/me returns authenticated user profile", async () => {
      const { token, user } = await registerUser("alice", "alice@test.com");

      const res = await request(app)
        .get("/api/users/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(user.id);
      expect(res.body.data.username).toBe("alice");
      expect(res.body.data.email).toBe("alice@test.com");
    });

    it("PATCH /api/users/me updates status and avatarUrl", async () => {
      const { token } = await registerUser("alice", "alice@test.com");

      const res = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({
          status: "Available now",
          avatarUrl: "https://example.com/avatar.png",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("Available now");
      expect(res.body.data.avatarUrl).toBe("https://example.com/avatar.png");
    });

    it("PATCH /api/users/me rejects editing unauthorized fields", async () => {
      const { token } = await registerUser("alice", "alice@test.com");

      const res = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({
          username: "alice_hacked",
        });

      expect(res.status).toBe(400);
    });

    it("GET /api/users/search returns matching users by username", async () => {
      const { token } = await registerUser("alice", "alice@test.com");
      await registerUser("bob_ross", "bob@test.com");
      await registerUser("bobby", "bobby@test.com");
      await registerUser("charlie", "charlie@test.com");

      const res = await request(app)
        .get("/api/users/search?q=bob")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data.map((u: any) => u.username).sort()).toEqual(["bob_ross", "bobby"]);
    });
  });

  describe("Conversation routes", () => {
    it("POST /api/conversations direct conversation returns existing on duplicate", async () => {
      const userA = await registerUser("userA", "usera@test.com");
      const userB = await registerUser("userB", "userb@test.com");

      // First creation
      const res1 = await request(app)
        .post("/api/conversations")
        .set("Authorization", `Bearer ${userA.token}`)
        .send({
          type: "direct",
          participantId: userB.user.id,
        });

      expect(res1.status).toBe(201);
      const conversationId1 = res1.body.data._id;

      // Second creation by User A
      const res2 = await request(app)
        .post("/api/conversations")
        .set("Authorization", `Bearer ${userA.token}`)
        .send({
          type: "direct",
          participantId: userB.user.id,
        });

      expect(res2.status).toBe(200);
      expect(res2.body.data._id).toBe(conversationId1);

      // Third creation by User B
      const res3 = await request(app)
        .post("/api/conversations")
        .set("Authorization", `Bearer ${userB.token}`)
        .send({
          type: "direct",
          participantId: userA.user.id,
        });

      expect(res3.status).toBe(200);
      expect(res3.body.data._id).toBe(conversationId1);
    });

    it("POST /api/conversations creates a group conversation and PATCH updates it", async () => {
      const admin = await registerUser("admin", "admin@test.com");
      const member1 = await registerUser("member1", "member1@test.com");
      const member2 = await registerUser("member2", "member2@test.com");

      const createRes = await request(app)
        .post("/api/conversations")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          type: "group",
          groupName: "Study Group",
          participantIds: [member1.user.id],
        });

      expect(createRes.status).toBe(201);
      const convoId = createRes.body.data._id;
      expect(createRes.body.data.groupName).toBe("Study Group");
      expect(createRes.body.data.participants.length).toBe(2);

      // Update group (rename and add member2)
      const patchRes = await request(app)
        .patch(`/api/conversations/${convoId}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
          groupName: "Study Group Advanced",
          addParticipantIds: [member2.user.id],
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.groupName).toBe("Study Group Advanced");
      expect(patchRes.body.data.participants.length).toBe(3);
    });

    it("Non-participants get 403 on GET /api/conversations/:id", async () => {
      const userA = await registerUser("userA", "usera@test.com");
      const userB = await registerUser("userB", "userb@test.com");
      const outsider = await registerUser("outsider", "outsider@test.com");

      const convoRes = await request(app)
        .post("/api/conversations")
        .set("Authorization", `Bearer ${userA.token}`)
        .send({
          type: "direct",
          participantId: userB.user.id,
        });

      const convoId = convoRes.body.data._id;

      const res = await request(app)
        .get(`/api/conversations/${convoId}`)
        .set("Authorization", `Bearer ${outsider.token}`);

      expect(res.status).toBe(403);
    });
  });

  describe("Message history route", () => {
    it("paginates 40 messages: 30 default, next page via cursor, 403 for non-participants", async () => {
      const userA = await registerUser("userA", "usera@test.com");
      const userB = await registerUser("userB", "userb@test.com");
      const outsider = await registerUser("outsider", "outsider@test.com");

      const convoRes = await request(app)
        .post("/api/conversations")
        .set("Authorization", `Bearer ${userA.token}`)
        .send({
          type: "direct",
          participantId: userB.user.id,
        });

      const convoId = convoRes.body.data._id;

      // Seed 40 messages with staggered createdAts
      const now = Date.now();
      const messageDocs = [];
      for (let i = 1; i <= 40; i++) {
        messageDocs.push({
          conversationId: convoId,
          senderId: userA.user.id,
          content: `Message ${i}`,
          createdAt: new Date(now + i * 1000),
          updatedAt: new Date(now + i * 1000),
        });
      }
      await Message.insertMany(messageDocs);

      // Page 1: default limit 30
      const page1Res = await request(app)
        .get(`/api/conversations/${convoId}/messages`)
        .set("Authorization", `Bearer ${userA.token}`);

      expect(page1Res.status).toBe(200);
      expect(page1Res.body.data.length).toBe(30);
      expect(page1Res.body.pagination.hasMore).toBe(true);
      expect(page1Res.body.pagination.nextCursor).toBeDefined();
      // Newest first -> first should be Message 40
      expect(page1Res.body.data[0].content).toBe("Message 40");
      expect(page1Res.body.data[29].content).toBe("Message 11");

      const cursor = page1Res.body.pagination.nextCursor;

      // Page 2: with before cursor
      const page2Res = await request(app)
        .get(`/api/conversations/${convoId}/messages?before=${cursor}`)
        .set("Authorization", `Bearer ${userB.token}`);

      expect(page2Res.status).toBe(200);
      expect(page2Res.body.data.length).toBe(10);
      expect(page2Res.body.pagination.hasMore).toBe(false);
      expect(page2Res.body.data[0].content).toBe("Message 10");
      expect(page2Res.body.data[9].content).toBe("Message 1");

      // Non-participant forbidden
      const forbiddenRes = await request(app)
        .get(`/api/conversations/${convoId}/messages`)
        .set("Authorization", `Bearer ${outsider.token}`);

      expect(forbiddenRes.status).toBe(403);
    });
  });
});
