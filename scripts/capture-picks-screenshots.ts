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

async function capturePicks(
  browser: Browser,
  baseUrl: string,
  fileName: string,
  openFilters: boolean
): Promise<void> {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page
    .waitForFunction(() => !document.body.innerText.includes("Loading…"), undefined, {
      timeout: 20000,
    })
    .catch(() => undefined);
  await page.getByRole("button", { name: "Picks" }).click();
  await page.waitForTimeout(600);
  await page.getByTestId("picks-filters").waitFor({ state: "visible", timeout: 15000 });
  if (openFilters) {
    await page.getByTestId("picks-filter-show").selectOption("all");
    await page.getByTestId("picks-filter-sort").selectOption("prob");
    await page.waitForTimeout(300);
  }
  const firstRow = page.getByTestId("pick-leg-row").first();
  await firstRow.waitFor({ state: "visible", timeout: 15000 }).catch(() => undefined);
  await page.screenshot({ path: path.join(outDir, fileName), fullPage: true });
  await page.close();
}

async function main(): Promise<void> {
  fs.mkdirSync(outDir, { recursive: true });
  await withPreview(async (baseUrl, browser) => {
    await capturePicks(browser, baseUrl, "picks-390x844.png", false);
    await capturePicks(browser, baseUrl, "picks-filters-390x844.png", true);
  });
  console.log(`Picks screenshots saved under ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});