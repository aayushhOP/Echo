import { createServer, Server as HttpServer } from "http";
import { Server, Socket as ServerSocket } from "socket.io";
import { io as ClientIO, Socket as ClientSocket } from "socket.io-client";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { registerPresenceHandlers } from "../src/sockets/handlers/presenceHandlers";
import User from "../src/models/User";

describe("Socket Presence & Multi-Tab Behavior", () => {
  let mongoServer: MongoMemoryServer;
  let httpServer: HttpServer;
  let io: Server;
  let port: number;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    httpServer = createServer();
    io = new Server(httpServer, {
      cors: { origin: "*" },
    });

    // Mock socket middleware assigning socket.data.userId from auth token or query
    io.use((socket, next) => {
      const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;
      if (userId) {
        socket.data.userId = userId;
        return next();
      }
      next(new Error("Unauthorized"));
    });

    io.on("connection", (socket) => {
      registerPresenceHandlers(io, socket);
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        if (typeof addr === "object" && addr) {
          port = addr.port;
        }
        resolve();
      });
    });
  }, 60000);

  afterAll(async () => {
    io.close();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  }, 60000);

  beforeEach(async () => {
    await User.deleteMany({});
  });

  const createClientSocket = (userId: string): Promise<ClientSocket> => {
    return new Promise((resolve, reject) => {
      const client = ClientIO(`http://localhost:${port}`, {
        auth: { userId },
        transports: ["websocket"],
        forceNew: true,
      });

      client.on("connect", () => resolve(client));
      client.on("connect_error", (err) => reject(err));
    });
  };

  it("should broadcast presence:online when user connects first tab", async () => {
    const userA = await User.create({
      username: "userA",
      email: "usera@example.com",
      passwordHash: "hash123",
    });

    const observer = await User.create({
      username: "observer",
      email: "obs@example.com",
      passwordHash: "hash123",
    });

    const observerClient = await createClientSocket(observer._id.toString());

    const onlinePromise = new Promise<{ userId: string }>((resolve) => {
      observerClient.on("presence:online", (data) => {
        resolve(data);
      });
    });

    const userAClient1 = await createClientSocket(userA._id.toString());
    const data = await onlinePromise;

    expect(data.userId).toBe(userA._id.toString());

    userAClient1.disconnect();
    observerClient.disconnect();
  });

  it("should NOT broadcast presence:online when user opens a second tab", async () => {
    const userB = await User.create({
      username: "userB",
      email: "userb@example.com",
      passwordHash: "hash123",
    });

    const observer = await User.create({
      username: "observer2",
      email: "obs2@example.com",
      passwordHash: "hash123",
    });

    const observerClient = await createClientSocket(observer._id.toString());

    // Connect first tab
    const userBClient1 = await createClientSocket(userB._id.toString());

    // Give time to ensure first event is processed
    await new Promise((r) => setTimeout(r, 100));

    let secondOnlineBroadcast = false;
    observerClient.on("presence:online", (data) => {
      if (data.userId === userB._id.toString()) {
        secondOnlineBroadcast = true;
      }
    });

    // Connect second tab for same userB
    const userBClient2 = await createClientSocket(userB._id.toString());
    await new Promise((r) => setTimeout(r, 200));

    expect(secondOnlineBroadcast).toBe(false);

    userBClient1.disconnect();
    userBClient2.disconnect();
    observerClient.disconnect();
  });

  it("should NOT broadcast presence:offline when closing 1 of 2 tabs", async () => {
    const userC = await User.create({
      username: "userC",
      email: "userc@example.com",
      passwordHash: "hash123",
    });

    const observer = await User.create({
      username: "observer3",
      email: "obs3@example.com",
      passwordHash: "hash123",
    });

    const observerClient = await createClientSocket(observer._id.toString());

    const userCClient1 = await createClientSocket(userC._id.toString());
    const userCClient2 = await createClientSocket(userC._id.toString());

    await new Promise((r) => setTimeout(r, 100));

    let offlineBroadcast = false;
    observerClient.on("presence:offline", (data) => {
      if (data.userId === userC._id.toString()) {
        offlineBroadcast = true;
      }
    });

    // Disconnect tab 1 only
    userCClient1.disconnect();
    await new Promise((r) => setTimeout(r, 300));

    // Should NOT have broadcasted offline because tab 2 is still connected
    expect(offlineBroadcast).toBe(false);

    // Disconnect tab 2
    const offlinePromise = new Promise<{ userId: string; lastSeen: string }>((resolve) => {
      observerClient.on("presence:offline", (data) => {
        if (data.userId === userC._id.toString()) {
          resolve(data);
        }
      });
    });

    userCClient2.disconnect();
    const offlineData = await offlinePromise;

    expect(offlineData.userId).toBe(userC._id.toString());
    expect(offlineData.lastSeen).toBeDefined();

    // Check DB update
    const updatedUserC = await User.findById(userC._id);
    expect(updatedUserC?.isOnline).toBe(false);
    expect(updatedUserC?.lastSeen).toBeDefined();

    observerClient.disconnect();
  });

  it("should handle presence:request_sync to return active users", async () => {
    const userD = await User.create({
      username: "userD",
      email: "userd@example.com",
      passwordHash: "hash123",
    });

    const userE = await User.create({
      username: "userE",
      email: "usere@example.com",
      passwordHash: "hash123",
    });

    const requester = await User.create({
      username: "requester",
      email: "req@example.com",
      passwordHash: "hash123",
    });

    // Connect userD only
    const userDClient = await createClientSocket(userD._id.toString());
    const requesterClient = await createClientSocket(requester._id.toString());

    await new Promise((r) => setTimeout(r, 100));

    const syncPromise = new Promise<{ onlineUsers: string[] }>((resolve) => {
      requesterClient.on("presence:sync", (data) => {
        resolve(data);
      });
    });

    requesterClient.emit("presence:request_sync", [
      userD._id.toString(),
      userE._id.toString(),
    ]);

    const syncData = await syncPromise;
    expect(syncData.onlineUsers).toContain(userD._id.toString());
    expect(syncData.onlineUsers).not.toContain(userE._id.toString());

    userDClient.disconnect();
    requesterClient.disconnect();
  });
});
