import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import path from "path";
import { mkdir, rm, stat } from "fs/promises";
import { MessageQueue } from "../src/services/messageQueue";

const storageDir = path.join(process.cwd(), "temp", "data");
const storageFile = path.join(storageDir, "messages.json");

describe("MessageQueue", () => {
  let q: MessageQueue;

  beforeAll(async () => {
    await mkdir(storageDir, { recursive: true });
    await rm(storageFile, { force: true });
  });

  afterAll(async () => {
    // Cleanup persisted file to not leak state between runs
    await rm(storageFile, { force: true });
  });

  beforeEach(() => {
    q = new MessageQueue();
    q.clear();
  });

  function sampleMsg(overrides: Partial<any> = {}) {
    return {
      comment: "",
      content: "Hello",
      message: "",
      msg: "",
      text: "Hello",
      nickname: "nick",
      displayName: "Nick",
      username: "user1",
      uniqueId: "u1",
      ...overrides,
    } as any;
  }

  it("adds messages and increments size/unreadSize", () => {
    expect(q.size()).toBe(0);
    const m1 = q.add(sampleMsg());
    const m2 = q.add(sampleMsg({ content: "World" }));

    expect(m1.id).toBeString();
    expect(m2.id).toBeString();
    expect(q.size()).toBe(2);
    expect(q.unreadSize()).toBe(2);

    const snap = q.snapshot();
    expect(snap.length).toBe(2);
  });

  it("getNextUnread returns the first unread and marks it read by default", () => {
    q.add(sampleMsg({ content: "A" }));
    q.add(sampleMsg({ content: "B" }));

    const first = q.getNextUnread();
    expect(first).toBeDefined();
    expect(first!.isRead).toBeTrue();
    expect(q.unreadSize()).toBe(1);
  });

  it("getNextUnread can leave message unread when isRed=false", () => {
    q.add(sampleMsg({ content: "A" }));

    const first = q.getNextUnread(false);
    expect(first).toBeDefined();
    expect(first!.isRead).toBeFalse();
    expect(q.unreadSize()).toBe(1);
  });

  it("markAsRead marks a message by id", () => {
    const created = q.add(sampleMsg());
    const ok = q.markAsRead(created.id);
    expect(ok).toBeTrue();
    expect(q.unreadSize()).toBe(0);
  });

  it("markAllAsRead marks all and returns the count", () => {
    q.add(sampleMsg());
    q.add(sampleMsg());
    q.add(sampleMsg());

    const count = q.markAllAsRead();
    expect(count).toBe(3);
    expect(q.unreadSize()).toBe(0);
  });

  it("getAll returns all or filtered by isRead", () => {
    const a = q.add(sampleMsg());
    const b = q.add(sampleMsg());

    q.markAsRead(a.id);

    expect(q.getAll().length).toBe(2);
    expect(q.getAll(true).length).toBe(1);
    expect(q.getAll(false).length).toBe(1);
  });

  it("clear empties the queue", () => {
    q.add(sampleMsg());
    expect(q.size()).toBe(1);

    q.clear();
    expect(q.size()).toBe(0);
    expect(q.unreadSize()).toBe(0);
  });

  it("persists to disk and loadBackup loads saved state (new instance)", async () => {
    // Arrange: create data (this triggers a write via dataStorage)
    q.add(sampleMsg({ content: "Persist Me" }));

    // Act: new queue instance should start empty and then load from backup
    const freshQueue = new MessageQueue();
    expect(freshQueue.size()).toBe(0);
    await freshQueue.loadBackup();

    // Assert: data was successfully loaded from persisted storage
    expect(freshQueue.size()).toBe(1);
    const msg = freshQueue.getNextUnread(false);
    expect(msg?.content ?? msg?.text).toBeDefined();
  });
});