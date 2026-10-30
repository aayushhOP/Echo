import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../src/app";
import User from "../src/models/User";
import Conversation from "../src/models/Conversation";
import Message from "../src/models/Message";
import * as messageService from "../src/services/messageService";

describe("Backend Test Suite (Auth Routes & Message Service)", () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  }, 60000);

  beforeEach(async () => {
    await User.deleteMany({});
    await Conversation.deleteMany({});
    await Message.deleteMany({});
  });

  describe("Auth Routes", () => {
    describe("POST /api/auth/register", () => {
      it("should register a new user successfully (happy path)", async () => {
        const res = await request(app)
          .post("/api/auth/register")
          .send({
            username: "testuser",
            email: "test@example.com",
            password: "password123",
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty("accessToken");
        expect(res.body.data.user).toMatchObject({
          username: "testuser",
          email: "test@example.com",
        });
        expect(res.headers["set-cookie"]).toBeDefined();
      });

      it("should reject registration with invalid email or missing fields (failure case)", async () => {
        const res = await request(app)
          .post("/api/auth/register")
          .send({
            username: "tu",
            email: "not-an-email",
            password: "123",
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
        expect(typeof res.body.error.message).toBe("string");
      });

      it("should reject duplicate email registration (failure case)", async () => {
        await request(app)
          .post("/api/auth/register")
          .send({
            username: "userone",
            email: "duplicate@example.com",
            password: "password123",
          });

        const res = await request(app)
          .post("/api/auth/register")
          .send({
            username: "usertwo",
            email: "duplicate@example.com",
            password: "password123",
          });

        expect(res.status).toBe(409);
        expect(res.body.error).toBeDefined();
        expect(res.body.error.code).toBe("CONFLICT");
      });
    });

    describe("POST /api/auth/login", () => {
      beforeEach(async () => {
        await request(app)
          .post("/api/auth/register")
          .send({
            username: "loginuser",
            email: "login@example.com",
            password: "password123",
          });
      });

      it("should login successfully with valid credentials (happy path)", async () => {
        const res = await request(app)
          .post("/api/auth/login")
          .send({
            email: "login@example.com",
            password: "password123",
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty("accessToken");
        expect(res.body.data.user.username).toBe("loginuser");
      });

      it("should reject login with wrong password (failure case)", async () => {
        const res = await request(app)
          .post("/api/auth/login")
          .send({
            email: "login@example.com",
            password: "wrongpassword",
          });

        expect(res.status).toBe(401);
        expect(res.body.error).toBeDefined();
        expect(res.body.error.code).toBe("UNAUTHORIZED");
      });
    });

    describe("POST /api/auth/refresh", () => {
      it("should refresh accessToken using valid refresh token cookie (happy path)", async () => {
        const regRes = await request(app)
          .post("/api/auth/register")
          .send({
            username: "refreshuser",
            email: "refresh@example.com",
            password: "password123",
          });

        const cookies = regRes.headers["set-cookie"];

        const res = await request(app)
          .post("/api/auth/refresh")
          .set("Cookie", cookies);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty("accessToken");
      });

      it("should reject refresh when refresh token is missing (failure case)", async () => {
        const res = await request(app).post("/api/auth/refresh");

        expect(res.status).toBe(401);
        expect(res.body.error).toBeDefined();
        expect(res.body.error.code).toBe("UNAUTHORIZED");
      });
    });
  });

  describe("messageService", () => {
    let userAId: string;
    let userBId: string;
    let conversationId: string;

    beforeEach(async () => {
      const userA = await User.create({
        username: "userA",
        email: "usera@example.com",
        passwordHash: "hashA",
      });
      const userB = await User.create({
        username: "userB",
        email: "userb@example.com",
        passwordHash: "hashB",
      });

      userAId = userA._id.toString();
      userBId = userB._id.toString();

      const conv = await Conversation.create({
        type: "direct",
        participants: [userA._id, userB._id],
      });

      conversationId = conv._id.toString();
    });

    it("should create a message successfully for a participant (happy path)", async () => {
      const msg = await messageService.createMessage(userAId, {
        conversationId,
        content: "Hello from User A",
        type: "text",
      });

      expect(msg).toBeDefined();
      expect(msg.content).toBe("Hello from User A");
      expect(msg.conversationId.toString()).toBe(conversationId);
      expect((msg.senderId as any)._id.toString()).toBe(userAId);
      expect(msg.readBy.map((id) => id.toString())).toContain(userAId);

      const convInDb = await Conversation.findById(conversationId);
      expect(convInDb?.lastMessage?.toString()).toBe(msg._id.toString());
    });

    it("should reject message creation from a non-participant (failure case)", async () => {
      const outsider = await User.create({
        username: "outsider",
        email: "outsider@example.com",
        passwordHash: "hashOut",
      });

      await expect(
        messageService.createMessage(outsider._id.toString(), {
          conversationId,
          content: "I am trespassing",
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "FORBIDDEN",
      });
    });

    it("should reject message creation with empty content (failure case)", async () => {
      await expect(
        messageService.createMessage(userAId, {
          conversationId,
          content: "   ",
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "BAD_REQUEST",
      });
    });

    it("should mark messages as read successfully (happy path)", async () => {
      const msg = await messageService.createMessage(userAId, {
        conversationId,
        content: "Please read this",
      });

      const updatedIds = await messageService.markMessagesAsRead(
        userBId,
        conversationId,
        [msg._id.toString()]
      );

      expect(updatedIds).toHaveLength(1);
      expect(updatedIds[0]).toBe(msg._id.toString());

      const updatedMsg = await Message.findById(msg._id);
      expect(updatedMsg?.readBy.map((id) => id.toString())).toContain(userBId);
      expect(updatedMsg?.status).toBe("read");
    });

    it("should toggle reactions properly (add, remove, multiple users)", async () => {
      const msg = await messageService.createMessage(userAId, {
        conversationId,
        content: "Check this reaction",
      });

      // User A reacts with heart
      let updated = await messageService.toggleReaction(msg._id.toString(), userAId, "❤️");
      expect(updated.reactions).toHaveLength(1);
      expect(updated.reactions[0].emoji).toBe("❤️");
      expect(updated.reactions[0].users.map((u: any) => (u._id || u).toString())).toContain(userAId);

      // User B also reacts with heart
      updated = await messageService.toggleReaction(msg._id.toString(), userBId, "❤️");
      expect(updated.reactions).toHaveLength(1);
      expect(updated.reactions[0].users).toHaveLength(2);

      // User A removes reaction by toggling heart again
      updated = await messageService.toggleReaction(msg._id.toString(), userAId, "❤️");
      expect(updated.reactions).toHaveLength(1);
      expect(updated.reactions[0].users).toHaveLength(1);
      expect((updated.reactions[0].users[0] as any)._id.toString()).toBe(userBId);

      // User B removes reaction -> emoji array should now be empty
      updated = await messageService.toggleReaction(msg._id.toString(), userBId, "❤️");
      expect(updated.reactions).toHaveLength(0);
    });

    it("should support message replies and media fields", async () => {
      const parent = await messageService.createMessage(userAId, {
        conversationId,
        content: "Original question",
      });

      const reply = await messageService.createMessage(userBId, {
        conversationId,
        content: "Answering the question",
        replyTo: parent._id.toString(),
        mediaUrl: "https://example.com/attachment.pdf",
        fileName: "attachment.pdf",
        fileSize: 1024,
        type: "file",
      });

      expect(reply.replyTo).toBeDefined();
      expect((reply.replyTo as any)._id.toString()).toBe(parent._id.toString());
      expect(reply.mediaUrl).toBe("https://example.com/attachment.pdf");
      expect(reply.fileName).toBe("attachment.pdf");
      expect(reply.fileSize).toBe(1024);
      expect(reply.type).toBe("file");
    });
  });

  describe("New REST Endpoints", () => {
    let token: string;
    let userId: string;
    let otherId: string;
    let conversationId: string;

    beforeEach(async () => {
      const regRes = await request(app)
        .post("/api/auth/register")
        .send({
          username: "tester1",
          email: "tester1@example.com",
          password: "password123",
        });

      token = regRes.body.data.accessToken;
      userId = regRes.body.data.user.id;

      const user2 = await User.create({
        username: "tester2",
        email: "tester2@example.com",
        passwordHash: "hash2",
      });
      otherId = user2._id.toString();

      const conv = await Conversation.create({
        type: "direct",
        participants: [userId, otherId],
      });
      conversationId = conv._id.toString();
    });

    describe("PATCH /api/users/me/preferences", () => {
      it("should update soundEnabled, theme and bio", async () => {
        const res = await request(app)
          .patch("/api/users/me/preferences")
          .set("Authorization", `Bearer ${token}`)
          .send({
            soundEnabled: false,
            theme: "synthwave-dark",
            bio: "Full stack developer",
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.bio).toBe("Full stack developer");
        expect(res.body.data.preferences).toMatchObject({
          soundEnabled: false,
          theme: "synthwave-dark",
        });
      });
    });

    describe("POST /api/messages/upload", () => {
      it("should accept file upload and return file details", async () => {
        const res = await request(app)
          .post("/api/messages/upload")
          .set("Authorization", `Bearer ${token}`)
          .attach("file", Buffer.from("dummy test file content"), "test-doc.txt");

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("url");
        expect(res.body.fileName).toBe("test-doc.txt");
        expect(res.body.type).toBe("file");
        expect(res.body.fileSize).toBeGreaterThan(0);
      });
    });

    describe("GET /api/conversations/:id/media", () => {
      it("should fetch media items in a conversation", async () => {
        await messageService.createMessage(userId, {
          conversationId,
          content: "Image 1",
          type: "image",
          mediaUrl: "https://example.com/test.png",
          fileName: "test.png",
          fileSize: 500,
        });

        await messageService.createMessage(userId, {
          conversationId,
          content: "File 1",
          type: "file",
          mediaUrl: "https://example.com/doc.pdf",
          fileName: "doc.pdf",
          fileSize: 1200,
        });

        const res = await request(app)
          .get(`/api/conversations/${conversationId}/media`)
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(2);
        expect(res.body.items[0]).toHaveProperty("mediaUrl");
        expect(res.body.items[0]).toHaveProperty("fileName");
      });
    });

    describe("GET /api/users/online", () => {
      it("should return onlineUserIds", async () => {
        const res = await request(app)
          .get("/api/users/online")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("onlineUserIds");
        expect(Array.isArray(res.body.onlineUserIds)).toBe(true);
      });
    });

    describe("Enhanced Conversation & Pin/Mute Toggles", () => {
      it("should return unreadCount, isPinned, and isMuted on GET /api/conversations", async () => {
        // Create an unread message from tester2 to tester1
        await messageService.createMessage(otherId, {
          conversationId,
          content: "Hey tester1!",
        });

        const res = await request(app)
          .get("/api/conversations")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        const conv = res.body.data.find((c: any) => c._id.toString() === conversationId);
        expect(conv).toBeDefined();
        expect(conv.unreadCount).toBe(1);
        expect(conv.isPinned).toBe(false);
        expect(conv.isMuted).toBe(false);
      });

      it("should toggle pin status on PATCH /api/conversations/:id/pin", async () => {
        const pinRes = await request(app)
          .patch(`/api/conversations/${conversationId}/pin`)
          .set("Authorization", `Bearer ${token}`);

        expect(pinRes.status).toBe(200);
        expect(pinRes.body.isPinned).toBe(true);

        const unpinRes = await request(app)
          .patch(`/api/conversations/${conversationId}/pin`)
          .set("Authorization", `Bearer ${token}`);

        expect(unpinRes.status).toBe(200);
        expect(unpinRes.body.isPinned).toBe(false);
      });

      it("should toggle mute status on PATCH /api/conversations/:id/mute", async () => {
        const muteRes = await request(app)
          .patch(`/api/conversations/${conversationId}/mute`)
          .set("Authorization", `Bearer ${token}`);

        expect(muteRes.status).toBe(200);
        expect(muteRes.body.isMuted).toBe(true);

        const unmuteRes = await request(app)
          .patch(`/api/conversations/${conversationId}/mute`)
          .set("Authorization", `Bearer ${token}`);

        expect(unmuteRes.status).toBe(200);
        expect(unmuteRes.body.isMuted).toBe(false);
      });
    });
  });
});
