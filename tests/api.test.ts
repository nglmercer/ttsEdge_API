import { describe, it, expect, beforeEach, beforeAll, afterAll } from "bun:test";
import { mkdtemp, mkdir } from "fs/promises";
import path from "path";
import { tmpdir } from "os";

let app: any;
let originalCwd: string;

function sampleMsg(overrides: Partial<any> = {}) {
  return {
    content: "Hello",
    text: "Hello",
    nickname: "nick",
    displayName: "Nick",
    username: "user1",
    uniqueId: "u1",
    ...overrides,
  } as any;
}

async function json(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  return await res.text();
}

describe("HTTP API (Hono)", () => {
  beforeAll(async () => {
    // Isolate filesystem writes from other tests by changing CWD to a temp dir
    originalCwd = process.cwd();
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ttsapi-"));
    process.chdir(tempRoot);
    await mkdir(path.join(tempRoot, "temp", "data"), { recursive: true });

    // Import the app AFTER changing CWD so messageQueue writes to the isolated path
    const mod = await import("../src/index");
    app = (mod as any).default;
  });

  afterAll(() => {
    if (originalCwd) process.chdir(originalCwd);
  });

  beforeEach(async () => {
    // Ensure clean state for each test
    const res = await app.request("/messages", { method: "DELETE" });
    expect(res.status).toBe(200);
  });

  it("GET / returns Hello Hono!", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("Hello Hono!");
  });

  it("POST /messages creates a message and updates size/unread", async () => {
    const resCreate = await app.request("/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sampleMsg({ content: "World" })),
    });
    expect(resCreate.status).toBe(201);
    const created = await resCreate.json();
    expect(created.id).toBeString();
    expect(created.isRead).toBeFalse();

    const resSize = await app.request("/messages/size");
    const size = await resSize.json();
    expect(size.size).toBe(1);
    expect(size.unread).toBe(1);
  });

  it("GET /messages returns all and respects isRead filter", async () => {
    const a = await app.request("/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sampleMsg({ content: "A" })),
    });
    const b = await app.request("/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sampleMsg({ content: "B" })),
    });
    const aMsg = await a.json();

    // mark one as read
    const resMark = await app.request(`/messages/${aMsg.id}/read`, { method: "PATCH" });
    expect(resMark.status).toBe(200);

    const resAll = await app.request("/messages");
    const all = await resAll.json();
    expect(Array.isArray(all)).toBeTrue();
    expect(all.length).toBe(2);

    const resRead = await app.request("/messages?isRead=true");
    const read = await resRead.json();
    expect(read.length).toBe(1);

    const resUnread = await app.request("/messages?isRead=false");
    const unread = await resUnread.json();
    expect(unread.length).toBe(1);
  });

  it("GET /messages/next returns first unread and marks read by default", async () => {
    await app.request("/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sampleMsg({ content: "A" })),
    });
    await app.request("/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sampleMsg({ content: "B" })),
    });

    const resNext = await app.request("/messages/next");
    expect(resNext.status).toBe(200);
    const next = await resNext.json();
    expect(next).toBeDefined();
    expect(next.isRead).toBeTrue();

    const resSize = await app.request("/messages/size");
    const size = await resSize.json();
    expect(size.unread).toBe(1);
  });

  it("GET /messages/next?markAsRead=false leaves it unread", async () => {
    await app.request("/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sampleMsg({ content: "A" })),
    });

    const resNext = await app.request("/messages/next?markAsRead=false");
    expect(resNext.status).toBe(200);
    const next = await resNext.json();
    expect(next.isRead).toBeFalse();

    const resSize = await app.request("/messages/size");
    const size = await resSize.json();
    expect(size.unread).toBe(1);
  });

  it("PATCH /messages/read-all marks all unread and returns count", async () => {
    await app.request("/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sampleMsg()),
    });
    await app.request("/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sampleMsg()),
    });

    const resReadAll = await app.request("/messages/read-all", { method: "PATCH" });
    expect(resReadAll.status).toBe(200);
    const payload = await resReadAll.json();
    expect(payload.ok).toBeTrue();
    expect(payload.count).toBe(2);

    const resSize = await app.request("/messages/size");
    const size = await resSize.json();
    expect(size.unread).toBe(0);
  });

  it("GET /messages/unread returns only unread messages", async () => {
    const a = await app.request("/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sampleMsg({ content: "A" })),
    });
    const aMsg = await a.json();

    // Mark it as read to ensure 0 unread
    await app.request(`/messages/${aMsg.id}/read`, { method: "PATCH" });

    // Add another unread
    await app.request("/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sampleMsg({ content: "B" })),
    });

    const resUnread = await app.request("/messages/unread");
    expect(resUnread.status).toBe(200);
    const unread = await resUnread.json();
    expect(Array.isArray(unread)).toBeTrue();
    expect(unread.length).toBe(1);
    expect(unread[0].isRead).toBeFalse();
  });
});