// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { getLocalProgressPayload, performFullDriveSync, getDriveSyncStatus, type GoogleDriveAuth } from "./googleDriveSync";
import { setLearners } from "./storage";
import type { ChildLearner } from "../features/childPortal/types";

const auth: GoogleDriveAuth = { accessToken: "test-token", email: "parent@example.test", name: "Parent", expiresAt: Date.now() + 3600000 };
const at = "2026-10-01T00:00:00.000Z";
const later = "2026-10-02T00:00:00.000Z";

function learner(progress: Array<{ levelNumber: number; status: "completed" | "current" }>): ChildLearner {
  return {
    id: "child-1", name: "Child", avatar: "🐼", scriptMode: "dual", phoneticAssist: "zhuyin", handMode: "right",
    points: { coins: 10, stars: 2 }, levelsProgress: [], redemptions: [], totalMinutesLearned: 0, streakDays: 0,
    updatedAt: at,
    book1Progress: progress.map(({ levelNumber, status }) => ({ levelNumber, status, completedAt: status === "completed" ? at : null, starsEarned: status === "completed" ? 3 : 0, score: status === "completed" ? 95 : null, masteryStatus: status === "completed" ? "PRACTICED" : "IN_PROGRESS", softUnlocked: true, updatedAt: at })),
  };
}

const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;
beforeEach(() => { localStorage.clear(); setLearners([learner([{ levelNumber: 1, status: "completed" }])]); });
afterEach(() => vi.unstubAllGlobals());

describe("Drive sync transaction", () => {
  it("uploads a version 2 snapshot when Drive has no file", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method || "GET"} ${url}`);
      return url.includes("/upload/") ? response({ id: "new-file" }) : response({ files: [] });
    }));
    const result = await performFullDriveSync(auth);
    expect(result.action).toBe("uploaded");
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("/drive/v3/files?");
    expect(calls[1]).toContain("POST https://www.googleapis.com/upload/");
    expect(getDriveSyncStatus().state).toBe("synced");
  });

  it("downloads newer progress, merges per level, persists, then uploads", async () => {
    const remote = getLocalProgressPayload();
    remote.updatedAt = later;
    remote.learners[0].updatedAt = later;
    remote.learners[0].book1Progress = learner([{ levelNumber: 2, status: "completed" }]).book1Progress!.map((entry) => ({ ...entry, updatedAt: later }));
    let uploadBody = "";
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method || "GET"} ${url}`);
      if (url.includes("?spaces=appDataFolder")) return response({ files: [{ id: "existing" }] });
      if (url.includes("?alt=media")) return response(remote);
      uploadBody = String(init?.body);
      return response({ id: "existing" });
    }));
    const result = await performFullDriveSync(auth);
    expect(result.action).toBe("downloaded");
    expect(calls.map((call) => call.split(" ")[0])).toEqual(["GET", "GET", "PATCH"]);
    expect(getLocalProgressPayload().learners[0].book1Progress?.map((entry) => entry.levelNumber)).toEqual([1, 2]);
    expect(JSON.parse(uploadBody).learners[0].book1Progress).toHaveLength(2);
  });

  it("keeps merged local data when upload fails", async () => {
    const remote = getLocalProgressPayload();
    remote.updatedAt = later;
    remote.learners[0].book1Progress = learner([{ levelNumber: 2, status: "completed" }]).book1Progress!.map((entry) => ({ ...entry, updatedAt: later }));
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("?spaces=appDataFolder")) return response({ files: [{ id: "existing" }] });
      if (url.includes("?alt=media")) return response(remote);
      return response({}, 500);
    }));
    await expect(performFullDriveSync(auth)).rejects.toThrow("update_drive_failed_500");
    expect(getLocalProgressPayload().learners[0].book1Progress?.map((entry) => entry.levelNumber)).toEqual([1, 2]);
    expect(getDriveSyncStatus().state).toBe("error");
  });
});
