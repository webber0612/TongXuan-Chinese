// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChildPortalPage } from "../../pages/ChildPortalPage";
import { loadDialogueDone, markDialogueDone } from "./dialogueLessons";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;

async function renderStaticHome(onOpenDialogueLesson = vi.fn()) {
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById("root")!);
  await act(async () => {
    root.render(
      <ChildPortalPage runtime="static" activeChildId={null} onOpenCurriculum={() => undefined} onOpenDialogueLesson={onOpenDialogueLesson} />,
    );
  });
  return onOpenDialogueLesson;
}

function click(element: Element | null | undefined) {
  if (!element) throw new Error("element to click was not found");
  return act(async () => { (element as HTMLElement).click(); });
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
});

describe("static home", () => {
  it("shows exactly one primary action and no backend lesson hero", async () => {
    await renderStaticHome();
    expect(document.querySelectorAll(".tx-button-primary")).toHaveLength(1);
    expect(document.querySelector(".tx-button-primary")?.textContent).toContain("開始今天的練習");
    expect(document.querySelector(".official-lesson-hero")).toBeNull();
    expect(document.querySelector(".tx-hero-level-title")?.textContent).toBeTruthy();
  });

  it("starts a new learner from zero stars and no streak", async () => {
    await renderStaticHome();
    expect(document.querySelector(".tx-stat-stars")?.textContent).toBe("0");
    expect(document.querySelector(".tx-stat-streak")?.textContent).toBe("0");
  });

  it("unlocks only the first stop of the path for a new learner", async () => {
    await renderStaticHome();
    const stops = Array.from(document.querySelectorAll<HTMLButtonElement>(".tx-stop"));
    expect(stops.length).toBeGreaterThan(1);
    expect(stops[0].disabled).toBe(false);
    expect(stops.slice(1).every((stop) => stop.disabled)).toBe(true);
  });

  it("opens the classroom from the primary action", async () => {
    await renderStaticHome();
    await click(document.querySelector(".tx-button-primary"));
    expect(document.querySelector(".tx-home")).toBeNull();
    expect(document.body.textContent).toContain("下一個生字");
  });

  it("opens the menu as a dialog and closes it again", async () => {
    await renderStaticHome();
    await click(document.querySelector(".tx-avatar-button"));
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.querySelectorAll(".tx-segment-option[aria-pressed='true']").length).toBeGreaterThanOrEqual(3);
    await click(dialog?.querySelector(".tx-icon-button"));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("lists conversation lessons and hands the chosen lesson to the shell", async () => {
    const onOpenDialogueLesson = await renderStaticHome();
    await click(document.querySelector(".tx-mode-dialogue"));
    const rows = document.querySelectorAll(".tx-lesson-row");
    expect(rows.length).toBeGreaterThan(0);
    await click(rows[0]);
    expect(onOpenDialogueLesson).toHaveBeenCalledWith("starter-l01");
  });
});

describe("conversation lesson progress", () => {
  it("is stored per learner and ignores duplicates and corrupt data", () => {
    expect(markDialogueDone("learner-1", "starter-l01")).toEqual(["starter-l01"]);
    expect(markDialogueDone("learner-1", "starter-l01")).toEqual(["starter-l01"]);
    expect(loadDialogueDone("learner-2")).toEqual([]);
    localStorage.setItem("tongxuan_dialogue_done:learner-3", "{not json");
    expect(loadDialogueDone("learner-3")).toEqual([]);
  });
});
