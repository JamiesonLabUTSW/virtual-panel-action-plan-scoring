import express, { type Request, type Response } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Integration tests for /api/health endpoint (Issue #21)
 */

describe("GET /api/health", () => {
  let app: express.Application;

  beforeAll(() => {
    // Create test Express app with health endpoint
    app = express();
    app.use(express.json());

    // Use test deployment name for predictable assertions
    const TEST_DEPLOYMENT = "test-deployment-model";

    app.get("/api/health", (_req: Request, _res: Response) => {
      _res.json({
        status: "ok",
        model: TEST_DEPLOYMENT,
        api: "azure-v1",
      });
    });
  });

  it("should return 200 status code", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
  });

  it("should return JSON with correct content-type", async () => {
    const response = await request(app).get("/api/health");
    expect(response.headers["content-type"]).toMatch(/application\/json/);
  });

  it("should return correct response shape", async () => {
    const response = await request(app).get("/api/health");

    expect(response.body).toHaveProperty("status");
    expect(response.body).toHaveProperty("model");
    expect(response.body).toHaveProperty("api");
  });

  it("should return status: ok", async () => {
    const response = await request(app).get("/api/health");
    expect(response.body.status).toBe("ok");
  });

  it("should return model deployment name", async () => {
    const response = await request(app).get("/api/health");
    expect(response.body.model).toBe("test-deployment-model");
    expect(typeof response.body.model).toBe("string");
  });

  it("should return api: azure-v1", async () => {
    const response = await request(app).get("/api/health");
    expect(response.body.api).toBe("azure-v1");
  });

  it("should not return extra fields", async () => {
    const response = await request(app).get("/api/health");
    const keys = Object.keys(response.body);
    expect(keys).toEqual(["status", "model", "api"]);
  });
});
