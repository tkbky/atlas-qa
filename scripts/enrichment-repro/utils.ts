import "dotenv/config";
import { Stagehand } from "@browserbasehq/stagehand";
import { collectFieldInfo } from "../../src/browser/enrichment.js";

export type ReproConfig = {
  targetUrl: string;
  selectors: string[];
  waitUntil?: "load" | "domcontentloaded";
};

export async function runCollectFieldInfoRepro(name: string, config: ReproConfig) {
  const stagehand = new Stagehand({ env: "LOCAL", experimental: true });
  try {
    await stagehand.init();
    const page = stagehand.context.pages()[0];
    await page.goto(config.targetUrl, {
      waitUntil: config.waitUntil ?? "domcontentloaded",
    });
    console.log(`[${name}] Loaded ${config.targetUrl}`);

    const basic = await page.evaluate(() => {
      const el = document.querySelector("input, textarea, select");
      return el ? el.outerHTML.slice(0, 160) : null;
    });
    console.log(`[${name}] Basic evaluate result:`, basic);

    for (const selector of config.selectors) {
      try {
        const info = await collectFieldInfo(page, selector);
        console.log(`[${name}] SUCCESS ${selector}:`, info);
      } catch (error) {
        console.error(`[${name}] ERROR   ${selector}:`, error);
      }
    }
  } finally {
    await stagehand.close().catch(() => {});
  }
}
