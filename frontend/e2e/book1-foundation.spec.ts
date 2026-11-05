import { expect, test } from "@playwright/test";

test("Book 1 lesson survives refresh and offline use", async ({ page, context }) => {
  // Headless media playback varies by host; fetch the selected clip when play is called.
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = function () {
      if (this.src) void fetch(this.src);
      return Promise.resolve();
    };
  });
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("./");

  await expect(page.locator(".onboarding-modal-card")).toBeVisible();
  await page.locator(".onboard-custom-input").fill("測試學生");
  await page.getByRole("button", { name: /下一步：選擇學習字體/ }).click();
  await page.getByRole("button", { name: /完成設定/ }).click();
  await expect(page.locator(".hanzi-writer-svg-layer svg")).toBeVisible();
  await page.locator(".classroom-back-btn[title='退出教室']").click();

  await expect(page.getByText("測試學生").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /開始今天的練習/ })).toBeVisible();
  await page.getByRole("button", { name: /開始今天的練習/ }).click();
  await expect(page.locator(".tx-lesson-text")).toBeVisible();
  await page.locator(".tx-lesson-line-button").first().click();
  await expect.poll(() => requests.some((url) => /\/audio\/book1\/.*\.mp3/.test(url))).toBe(true);

  await page.getByRole("button", { name: "開始學生字" }).evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.locator(".hanzi-writer-svg-layer svg")).toBeVisible();
  await expect.poll(() => requests.some((url) => /\/hanzi\/.*\.json/.test(url))).toBe(true);
  expect(requests.some((url) => url.includes("jsdelivr"))).toBe(false);

  for (let index = 0; index < 6; index += 1) {
    await page.locator(".classroom-footer .next-btn").evaluate((button: HTMLButtonElement) => button.click());
  }
  await expect(page.locator(".quiz-container-full")).toBeVisible();
  await page.locator(".classroom-sound-toggle-btn").click();
  const count = await page.locator(".quiz-q-num").first().textContent();
  expect(count).toContain("第 1 題");
  for (let index = 0; index < 20; index += 1) {
    await page.locator(".quiz-option-btn").first().click();
    if (index === 0) {
      await expect.poll(() => requests.some((url) => /\/audio\/feedback\/.*\.mp3/.test(url))).toBe(true);
    }
    const finish = page.locator(".quiz-finish-btn");
    if (await finish.count()) { await finish.click(); break; }
    await page.locator(".quiz-next-q-btn").click();
  }
  await expect(page.locator(".classroom-finish-screen")).toBeVisible();
  await page.locator(".finish-return-btn").click();
  await expect(page.getByText(/已完成 1 \/ \d+ 關/)).toBeVisible();

  await page.reload();
  await expect(page.getByText(/已完成 1 \/ \d+ 關/)).toBeVisible();
  await expect(page.getByText("第 2 關").first()).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/已完成 1 \/ \d+ 關/)).toBeVisible();
});
