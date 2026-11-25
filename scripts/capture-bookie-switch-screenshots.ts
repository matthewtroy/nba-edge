import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium, type Browser, type Page } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "docs", "screenshots");

function waitForServer(url: string, timeoutMs = 45000): Promise<void> {
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

async function withPreview(fn: (baseUrl: string, browser: Browser) => Promise<void>): Promise<void> {
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

async function ready(page: Page, baseUrl: string): Promise<void> {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page
    .waitForFunction(() => !document.body.innerText.includes("Loading…"), undefined, {
      timeout: 25000,
    })
    .catch(() => undefined);
}

async function selectBookie(page: Page, bookie: string): Promise<void> {
  const sel = page.locator("section select").first();
  await sel.waitFor({ state: "visible", timeout: 15000 });
  await sel.selectOption(bookie);
  await page.waitForTimeout(600);
}

async function main(): Promise<void> {
  fs.mkdirSync(outDir, { recursive: true });
  const sequence = ["Unibet", "Ladbrokes", "Unibet"] as const;
  await withPreview(async (baseUrl, browser) => {
    for (const bookie of sequence) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await ready(page, baseUrl);
      await selectBookie(page, bookie);
      await page.screenshot({
        path: path.join(outDir, `main-play-bookie-${bookie.toLowerCase()}-390x844.png`),
        fullPage: true,
      });
      await page.close();
    }

    for (const bookie of sequence) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await ready(page, baseUrl);
      await page.getByRole("button", { name: "Games" }).click();
      await page.waitForTimeout(800);
      const sel = page.locator("section select").first();
      if (await sel.isVisible().catch(() => false)) {
        await selectBookie(page, bookie);
      }
      await page.screenshot({
        path: path.join(outDir, `games-sgm-bookie-${bookie.toLowerCase()}-390x844.png`),
        fullPage: true,
      });
      await page.close();
    }
  });
  console.log(`Bookie switch screenshots under ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});