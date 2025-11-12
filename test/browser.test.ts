import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebEnv } from "../src/browser/index.js";

vi.setConfig({ testTimeout: 30000 });

const SAMPLE_HTML = `<html><body>
  <h1>Checkout</h1>
  <button id="purchase">Complete purchase</button>
  <input id="email" placeholder="Email address" />
  <textarea id="notes">Leave a note</textarea>
  <select id="shipping">
    <option value="">Select shipping</option>
    <option value="express">Express</option>
  </select>
  <input type="checkbox" id="tos" />
  <input type="range" id="slider" min="0" max="100" value="50" />
</body></html>`;

const SAMPLE_URL = `data:text/html,${encodeURIComponent(SAMPLE_HTML)}`;

describe("WebEnv.currentObservation (integration)", () => {
  let env: WebEnv;

  beforeEach(async () => {
    env = new WebEnv();
    await env.init();
    await env.goto(SAMPLE_URL);
  });

  afterEach(async () => {
    await env.close();
  });

  it("discovers a variety of interactive controls", async () => {
    const observation = await env.currentObservation();
    const descriptions = observation.affordances.map((a) => a.description.toLowerCase());

    expect(observation.affordances.length).toBeGreaterThanOrEqual(5);
    expect(descriptions.some((d) => d.includes("button"))).toBe(true);
    expect(descriptions.some((d) => d.includes("textbox"))).toBe(true);
    expect(descriptions.some((d) => d.includes("select"))).toBe(true);
    expect(descriptions.some((d) => d.includes("checkbox"))).toBe(true);
    expect(descriptions.some((d) => d.includes("slider"))).toBe(true);
  });

  it("returns metadata and extracted page text", async () => {
    const observation = await env.currentObservation();

    expect(observation.url).toBe(SAMPLE_URL);
    expect(observation.title).toBe(""); // data URL has no explicit title
    expect(observation.pageText).toContain("Checkout");
    expect(observation.pageText).toContain("slider");
  });
});
