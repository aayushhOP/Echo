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
  });
});
