import request from "supertest";
import { createApp } from "../src/app";

describe("GET /api/health", () => {
  const app = createApp();

  it("should return status healthy with uptime and timestamp without hitting DB", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(typeof res.body.uptime).toBe("number");
    expect(typeof res.body.timestamp).toBe("string");
  });

  it("should also respond on /health", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(typeof res.body.uptime).toBe("number");
  });
});
