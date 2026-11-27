import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium, type Browser } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "docs", "screenshots");

function waitForServer(url: string, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) return resolve();
      } catch {
        /* retry */
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Server not ready: ${url}`));
        return;
      }
      setTimeout(tick, 400);
    };
    tick();
  });
}

async function withPreview(
  fn: (baseUrl: string, browser: Browser) => Promise<void>
): Promise<void> {
  const preview = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4173"], {
    cwd: root,
    stdio: "ignore",
    env: { ...process.env, BROWSER: "none" },
  });
  const baseUrl = "http://127.0.0.1:4173/nba-edge/";
  try {
    await waitForServer(baseUrl);
    const browser = await chromium.launch({ headless: true });
    try {
      await fn(baseUrl, browser);
    } finally {
      await browser.close();
    }
  } finally {
    preview.kill("SIGTERM");
  }
}

async function openLegSheet(
  browser: Browser,
  baseUrl: string,
  viewport: { width: number; height: number },
  tab: "today" | "games",
  fileName: string
): Promise<void> {
  const page = await browser.newPage({ viewport });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(
    () => !document.body.innerText.includes("Loading…"),
    undefined,
    { timeout: 20000 }
  ).catch(() => undefined);
  if (tab === "games") {
    await page.getByRole("button", { name: "SGMs" }).click();
    await page.waitForTimeout(800);
  }
  const firstLeg = page.getByTestId("leg-row").first();
  await firstLeg.waitFor({ state: "visible", timeout: 20000 });
  await firstLeg.scrollIntoViewIfNeeded();
  await firstLeg.click();
  await page.getByTestId("leg-sheet").waitFor({ state: "visible", timeout: 10000 });
  await page.getByText("Value verdict", { exact: false }).first().waitFor({ timeout: 5000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, fileName), fullPage: false });
  await page.close();
}

async function openLegSheetPicks(
  browser: Browser,
  baseUrl: string,
  fileName: string
): Promise<void> {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(
    () => !document.body.innerText.includes("Loading…"),
    undefined,
    { timeout: 20000 }
  ).catch(() => undefined);
  await page.getByRole("button", { name: "Picks" }).click();
  await page.waitForTimeout(600);
  await page.getByTestId("pick-leg-row").first().waitFor({ state: "visible", timeout: 20000 });
  await page.getByTestId("pick-leg-row").first().click();
  await page.getByTestId("leg-sheet").waitFor({ state: "visible", timeout: 10000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, fileName), fullPage: false });
  await page.close();
}

async function main(): Promise<void> {
  fs.mkdirSync(outDir, { recursive: true });
  await withPreview(async (baseUrl, browser) => {
    await openLegSheet(browser, baseUrl, { width: 390, height: 844 }, "today", "leg-sheet-today-390x844.png");
    await openLegSheet(browser, baseUrl, { width: 390, height: 844 }, "games", "leg-sheet-games-390x844.png");
    await openLegSheetPicks(browser, baseUrl, "leg-sheet-picks-390x844.png");
  });
  console.log(`Leg sheet screenshots saved under ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});