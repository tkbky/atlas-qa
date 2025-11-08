import "dotenv/config";
import { Stagehand } from "@browserbasehq/stagehand";
import type { Observation, Affordance } from "./types.js";
import { logDebug, logInfo } from "./logger.js";

/**
 * Thin Stagehand v3 wrapper
 * - stagehand.observe(instruction) -> Action[] {selector, description, method?, arguments?}
 * - stagehand.act(instruction | Action) executes either a natural-language instruction or a deterministic Action
 * - stagehand.extract() -> { pageText: string } when called without args
 * Docs: act/observe/extract signatures; Stagehand class + env options.
 */
// act(): string | Action, observe(): string -> Action[], extract(): returns pageText; env: "LOCAL" | "BROWSERBASE".
// Citations: act/observe/extract and Stagehand class & env.
// :contentReference[oaicite:5]{index=5}

export class WebEnv {
  private sh!: Stagehand;

  async init(env: "LOCAL" | "BROWSERBASE" = "LOCAL") {
    this.sh = new Stagehand({ env });
    await this.sh.init();
    logInfo("Stagehand environment initialized", { env });
  }

  get page() {
    return this.sh.context.pages()[0];
  }

  async goto(url: string) {
    await this.page.goto(url);
    logInfo("Navigated to URL", { url });
  }

  async currentObservation(): Promise<Observation> {
    const url = this.page.url();
    const title = await this.page.title();
    const affordances = await this.sh.observe(
      "Find interactive controls relevant to the task, including buttons, links, form fields (inputs, textareas, selects), checkboxes, toggles, sliders, and other actionable elements."
    );
    // Raw page text can help with planning/critique:
    const { pageText } = await this.sh.extract();
    const observation: Observation = { url, title, affordances: affordances as Affordance[], pageText };
    logDebug("Current observation generated", {
      url,
      title,
      affordanceCount: observation.affordances.length,
      pageTextLength: observation.pageText?.length ?? 0,
    });
    return observation;
  }

  async act(a: Affordance) {
    logDebug("Dispatching action to Stagehand", {
      selector: a.selector,
      method: a.method,
      description: a.description,
      hasInstruction: Boolean(a.instruction),
    });
    if (a.selector && a.method) {
      await this.sh.act({
        selector: a.selector,
        description: a.description,
        method: a.method,
        arguments: a.arguments ?? [],
      }); // deterministic (no LLM)
    } else if (a.instruction) {
      await this.sh.act(a.instruction); // natural-language
    } else {
      throw new Error("Invalid action: need either selector+method or instruction");
    }
    logInfo("Action completed", { description: a.description });
  }

  async goBack() {
    await this.page.goBack();
    logInfo("Browser navigated back");
  }

  async close() {
    if (this.sh) {
      await this.sh.close();
      logInfo("Stagehand environment closed");
    }
  }
}
