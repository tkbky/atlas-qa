import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { runAtlas } from "../src/core/atlas.js";

vi.setConfig({ testTimeout: 150000 });

const VALID_FULL_NAME = "Morgan Adaptive";
const VALID_NICKNAME = "Mo";
const VALID_AGE = 29;
const VALID_FAVORITE_COLOR = "blue";
const VALID_HOBBIES = ["cooking", "painting"];
const VALID_BIO =
  "I enjoy building multi-step workflows and testing them thoroughly.";
const VALID_AVAILABILITY = generateFutureDateTimeIso(2);

const INVALID_AGE = 16;

type Scenario = "default" | "success" | "invalid";

type TestServerHandle = {
  baseUrl: string;
  close: () => Promise<void>;
};

type WizardSession = {
  scenario: Scenario;
  fullName: string;
  nickname: string;
  age: number | null;
  newsletterOptIn: boolean;
  favoriteColor: string;
  hobbies: string[];
  bio: string;
  availability: string;
  confirmed: boolean;
};

const wizardSessions = new Map<string, WizardSession>();

let testServer: TestServerHandle;

beforeAll(async () => {
  testServer = await startWizardServer();
});

afterAll(async () => {
  await testServer.close();
});

describe("Atlas multi-step onboarding wizard (end-to-end)", () => {
  it("completes the multi-step onboarding flow and summarizes the submission", async () => {
    const goal = [
      `Complete the multi-step onboarding wizard by filling out each step with the following values:`,
      `Step 1: Full name "${VALID_FULL_NAME}", Nickname "${VALID_NICKNAME}".`,
      `Step 2: Age ${VALID_AGE} and enable "Subscribe to product education updates".`,
      `Step 3: Favorite color ${VALID_FAVORITE_COLOR} and hobbies ${VALID_HOBBIES.join(
        ", ",
      )}.`,
      `Step 4: Enter a short bio and any valid future date/time for availability, then submit.`,
      `On the review page, click "Confirm summary". On the final page, verify it lists full name ${VALID_FULL_NAME}, nickname ${VALID_NICKNAME}, age ${VALID_AGE}, subscription status, favorite color ${VALID_FAVORITE_COLOR}, hobbies ${VALID_HOBBIES.join(
        ", ",
      )}, the supplied bio, and availability.`,
    ].join(" ");

    const startUrl = `${testServer.baseUrl}/`;

    const result = await runAtlas(goal, startUrl, {
      env: "LOCAL",
      maxSteps: 30,
      beamSize: 2,
      runLabel: "wizard-e2e",
      timeBudgetMs: 240_000,
    });

    expect(result.goal).toBe(goal);
    expect(result.startUrl).toBe(startUrl);
    expect(result.endedReason).toBe("success_heuristic");

    const final = result.finalObservation;
    expect(final.url.startsWith(`${testServer.baseUrl}/wizard/complete`)).toBe(true);
    expect(final.title).toContain("Application Complete");
    expect(final.pageText).toContain(VALID_FULL_NAME);
    expect(final.pageText).toContain(VALID_NICKNAME);
    expect(final.pageText).toContain(String(VALID_AGE));
    expect(final.pageText).toContain("Subscribed to updates");
    VALID_HOBBIES.forEach(hobby => {
      expect(final.pageText).toContain(capitalize(hobby));
    });
    expect(final.pageText).toContain("Availability");
    expect(final.pageText).toContain("Summary confirmed");
  });

  it("stops on validation errors when the age is too low", async () => {
    const goal = [
      `Walk through the onboarding wizard that is pre-filled with an age of ${INVALID_AGE}.`,
      `Do not change any inputs—simply use the Continue buttons until the flow blocks progress.`,
      `Confirm that Step 2 displays an error explaining the age requirement.`,
    ].join(" ");

    const startUrl = `${testServer.baseUrl}/?scenario=invalid`;

    const result = await runAtlas(goal, startUrl, {
      env: "LOCAL",
      maxSteps: 24,
      beamSize: 2,
      runLabel: "wizard-e2e-invalid",
      timeBudgetMs: 80_000,
    });

    expect(result.goal).toBe(goal);
    expect(result.startUrl).toBe(startUrl);
    expect(result.endedReason).not.toBe("success_heuristic");

    const final = result.finalObservation;
    expect(final.url.includes("/wizard/step-2")).toBe(true);
    expect(/Age must be at least 18/.test(final.pageText ?? "")).toBe(true);
    expect(/Step 2/i.test(final.title)).toBe(true);
  });
});

async function startWizardServer(): Promise<TestServerHandle> {
  const server = createServer((req, res) => {
    handleRequest(req, res).catch(error => {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
      }
      res.end("Internal Server Error");
      console.error("Wizard test server error:", error);
    });
  });

  return await new Promise<TestServerHandle>((resolve, reject) => {
    server.once("error", reject);
    server.listen({ port: 0, host: "127.0.0.1" }, () => {
      server.off("error", reject);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to determine test server address"));
        return;
      }

      const { port } = address as AddressInfo;
      const baseUrl = `http://127.0.0.1:${port}`;

      resolve({
        baseUrl,
        close: () =>
          new Promise<void>((resolveClose, rejectClose) => {
            server.close(err => {
              if (err) {
                rejectClose(err);
              } else {
                resolveClose();
              }
            });
          }),
      });
    });
  });
}

async function handleRequest(req: IncomingMessage, res: ServerResponse<IncomingMessage>) {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
  const { sessionId, data } = ensureSession(req, res, url.searchParams.get("scenario"));

  if (method === "GET" && url.pathname === "/") {
    sendHtml(res, renderLandingPage());
    return;
  }

  if (method === "GET" && url.pathname === "/wizard") {
    sendHtml(res, renderWizardIntro());
    return;
  }

  if (url.pathname === "/wizard/step-1") {
    if (method === "GET") {
      sendHtml(res, renderStep1(data));
      return;
    }

    if (method === "POST") {
      const params = new URLSearchParams(await collectRequestBody(req));
      const fullName = params.get("fullName")?.trim() ?? "";
      const nickname = params.get("nickname")?.trim() ?? "";
      const errors: string[] = [];

      if (!fullName) {
        errors.push("Full name is required.");
      }

      if (errors.length > 0) {
        sendHtml(
          res,
          renderStep1(
            { ...data, fullName, nickname },
            errors,
          ),
          422,
        );
        return;
      }

      updateSession(sessionId, { fullName, nickname });
      redirect(res, "/wizard/step-2");
      return;
    }
  }

  if (url.pathname === "/wizard/step-2") {
    const current = wizardSessions.get(sessionId);
    if (!current?.fullName) {
      redirect(res, "/wizard/step-1");
      return;
    }

    if (method === "GET") {
      sendHtml(res, renderStep2(current));
      return;
    }

    if (method === "POST") {
      const params = new URLSearchParams(await collectRequestBody(req));
      const ageRaw = params.get("age") ?? "";
      const newsletterOptIn = params.get("newsletter") === "on";
      const errors: string[] = [];

      const age = Number.parseInt(ageRaw, 10);
      if (!Number.isFinite(age)) {
        errors.push("Age must be a valid number.");
      } else if (age < 18) {
        errors.push("Age must be at least 18.");
      }

      if (errors.length > 0) {
        sendHtml(
          res,
          renderStep2(
            {
              ...current,
              age: Number.isFinite(age) ? age : null,
              newsletterOptIn,
            },
            errors,
          ),
          422,
        );
        return;
      }

      updateSession(sessionId, { age, newsletterOptIn });
      redirect(res, "/wizard/step-3");
      return;
    }
  }

  if (url.pathname === "/wizard/step-3") {
    const current = wizardSessions.get(sessionId);
    if (!current?.age || current.age < 18) {
      redirect(res, "/wizard/step-2");
      return;
    }

    if (method === "GET") {
      sendHtml(res, renderStep3(current));
      return;
    }

    if (method === "POST") {
      const params = new URLSearchParams(await collectRequestBody(req));
      const favoriteColor = params.get("favoriteColor") ?? "";
      const hobbies = params.getAll("hobbies");
      const errors: string[] = [];

      if (!favoriteColor) {
        errors.push("Please select your favorite color.");
      }

      if (errors.length > 0) {
        sendHtml(
          res,
          renderStep3(
            {
              ...current,
              favoriteColor,
              hobbies,
            },
            errors,
          ),
          422,
        );
        return;
      }

      updateSession(sessionId, { favoriteColor, hobbies });
      redirect(res, "/wizard/step-4");
      return;
    }
  }

  if (url.pathname === "/wizard/step-4") {
    const current = wizardSessions.get(sessionId);
    if (!current?.favoriteColor) {
      redirect(res, "/wizard/step-3");
      return;
    }

    if (method === "GET") {
      sendHtml(res, renderStep4(current));
      return;
    }

    if (method === "POST") {
      const params = new URLSearchParams(await collectRequestBody(req));
      const bio = params.get("bio")?.trim() ?? "";
      const availability = params.get("availability") ?? "";
      const errors: string[] = [];

      const availabilityDate = new Date(availability);
      if (!availability) {
        errors.push("Please provide your next availability.");
      } else if (Number.isNaN(availabilityDate.getTime())) {
        errors.push("Availability must be a valid date and time.");
      } else if (availabilityDate.getTime() <= Date.now()) {
        errors.push("Availability must be in the future.");
      }

      if (errors.length > 0) {
        sendHtml(
          res,
          renderStep4(
            {
              ...current,
              bio,
              availability,
            },
            errors,
          ),
          422,
        );
        return;
      }

      updateSession(sessionId, { bio, availability, confirmed: false });
      redirect(res, "/wizard/review");
      return;
    }
  }

  if (method === "GET" && url.pathname === "/wizard/review") {
    const current = wizardSessions.get(sessionId);
    if (!current || !current.fullName || !current.favoriteColor || !current.availability) {
      redirect(res, "/wizard/step-1");
      return;
    }
    if (current.confirmed) {
      redirect(res, "/wizard/complete");
      return;
    }
    sendHtml(res, renderReviewPage(current));
    return;
  }

  if (method === "GET" && url.pathname === "/wizard/complete") {
    const current = wizardSessions.get(sessionId);
    if (!current || !current.fullName || !current.favoriteColor || !current.availability) {
      redirect(res, "/wizard/step-1");
      return;
    }
    if (!current.confirmed) {
      redirect(res, "/wizard/review");
      return;
    }

    sendHtml(res, renderCompletion(current));
    return;
  }

  if (method === "POST" && url.pathname === "/wizard/confirm") {
    const current = wizardSessions.get(sessionId);
    if (!current || !current.fullName || !current.favoriteColor || !current.availability) {
      redirect(res, "/wizard/step-1");
      return;
    }

    updateSession(sessionId, { confirmed: true });
    redirect(res, "/wizard/complete");
    return;
  }

  sendHtml(res, renderNotFound(), 404);
}

function ensureSession(
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  scenarioParam?: string | null,
) {
  const cookies = parseCookies(req.headers.cookie ?? "");
  let sessionId = cookies.get("wizard_session");
  const requestedScenario = normalizeScenario(scenarioParam);

  if (!sessionId || !wizardSessions.has(sessionId)) {
    sessionId = randomUUID();
    wizardSessions.set(sessionId, createSessionForScenario(requestedScenario));
  } else if (requestedScenario !== "default") {
    const current = wizardSessions.get(sessionId);
    if (current && current.scenario === "default") {
      wizardSessions.set(sessionId, createSessionForScenario(requestedScenario));
    }
  }

  res.setHeader("Set-Cookie", `wizard_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax`);

  return {
    sessionId,
    data: wizardSessions.get(sessionId) ?? createSessionForScenario("default"),
  };
}

function updateSession(sessionId: string, updates: Partial<WizardSession>) {
  const existing = wizardSessions.get(sessionId) ?? createSessionForScenario("default");
  wizardSessions.set(sessionId, { ...existing, ...updates });
}

async function collectRequestBody(req: IncomingMessage): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    req.on("data", chunk => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

function sendHtml(
  res: ServerResponse<IncomingMessage>,
  html: string,
  statusCode = 200,
) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(html);
}

function redirect(res: ServerResponse<IncomingMessage>, location: string) {
  res.statusCode = 303;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.end();
}

function renderLandingPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Atlas QA Wizard Landing</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 3rem auto; max-width: 620px; line-height: 1.6; padding: 0 1.5rem; }
      main { display: grid; gap: 1.5rem; }
      a.button { display: inline-flex; align-items: center; justify-content: center; padding: 0.75rem 1.75rem; border-radius: 999px; background: #2563eb; color: white; text-decoration: none; font-size: 1rem; font-weight: 600; }
      a.button:hover { background: #1d4ed8; }
    </style>
  </head>
  <body>
    <main>
      <h1>Welcome to the onboarding wizard</h1>
      <p>This demo walks through a four-step application. Start the flow to provide your details across multiple form controls.</p>
      <a id="start-wizard" class="button" href="/wizard">Start onboarding</a>
    </main>
  </body>
</html>`;
}

function renderWizardIntro(): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Wizard Overview</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 3rem auto; max-width: 620px; line-height: 1.6; padding: 0 1.5rem; }
      main { display: grid; gap: 1.5rem; }
      a.button { display: inline-flex; align-items: center; justify-content: center; padding: 0.75rem 1.75rem; border-radius: 999px; background: #047857; color: white; text-decoration: none; font-size: 1rem; font-weight: 600; }
      a.button:hover { background: #065f46; }
      ul { list-style: disc; padding-left: 1.5rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>Onboarding wizard</h1>
      <p>The application collects a mix of required and optional inputs:</p>
      <ul>
        <li>Step 1: Personal basics (required name, optional nickname)</li>
        <li>Step 2: Demographics (required age, optional newsletter opt-in)</li>
        <li>Step 3: Preferences (required single select, optional multi-select)</li>
        <li>Step 4: Final details (optional bio, required future availability)</li>
      </ul>
      <a id="begin-step-1" class="button" href="/wizard/step-1">Begin Step 1</a>
    </main>
  </body>
</html>`;
}

function renderStep1(data: WizardSession, errors: string[] = []): string {
  return renderStepTemplate({
    step: 1,
    title: "Step 1 · Personal Basics",
    body: `
      <p>Tell us who you are. We only require your full name, but a nickname helps personalize things.</p>
      ${renderErrors(errors)}
      <form id="step-1-form" method="POST" action="/wizard/step-1">
        <label>
          Full name <span aria-hidden="true" class="required">*</span>
          <input id="fullName" name="fullName" type="text" required value="${escapeAttr(data.fullName)}" autocomplete="name" />
        </label>
        <label>
          Nickname (optional)
          <input id="nickname" name="nickname" type="text" value="${escapeAttr(data.nickname)}" autocomplete="nickname" />
        </label>
        <button id="step-1-continue" type="submit">Continue to Step 2</button>
      </form>
    `,
  });
}

function renderStep2(data: WizardSession, errors: string[] = []): string {
  return renderStepTemplate({
    step: 2,
    title: "Step 2 · Demographics",
    body: `
      <p>Your age helps us tailor the experience. You must be at least 18 to continue.</p>
      ${renderErrors(errors)}
      <form id="step-2-form" method="POST" action="/wizard/step-2">
        <label>
          Age <span aria-hidden="true" class="required">*</span>
          <input id="age" name="age" type="number" min="0" required value="${data.age ?? ""}" />
        </label>
        <label class="checkbox-row">
          <input id="newsletter" name="newsletter" type="checkbox" ${data.newsletterOptIn ? "checked" : ""} />
          <span>Subscribe to product education updates</span>
        </label>
        <button id="step-2-continue" type="submit">Continue to Step 3</button>
      </form>
    `,
  });
}

function renderStep3(data: WizardSession, errors: string[] = []): string {
  const hobbyOptions = [
    { value: "cooking", label: "Cooking" },
    { value: "painting", label: "Painting" },
    { value: "hiking", label: "Hiking" },
    { value: "gaming", label: "Gaming" },
  ];

  const favoriteOptions = [
    { value: "red", label: "Red" },
    { value: "blue", label: "Blue" },
    { value: "green", label: "Green" },
    { value: "violet", label: "Violet" },
  ];

  return renderStepTemplate({
    step: 3,
    title: "Step 3 · Preferences",
    body: `
      <p>Select a favorite color (required) and any hobbies that resonate with you.</p>
      ${renderErrors(errors)}
      <form id="step-3-form" method="POST" action="/wizard/step-3">
        <label>
          Favorite color <span aria-hidden="true" class="required">*</span>
          <select id="favoriteColor" name="favoriteColor" required>
            <option value="">Select a color</option>
            ${favoriteOptions
              .map(
                option => `<option value="${option.value}" ${data.favoriteColor === option.value ? "selected" : ""}>
                  ${option.label}
                </option>`,
              )
              .join("")}
          </select>
        </label>
        <label>
          Hobbies (select one or more, optional)
          <select id="hobbies" name="hobbies" multiple size="4">
            ${hobbyOptions
              .map(
                option => `<option value="${option.value}" ${data.hobbies.includes(option.value) ? "selected" : ""}>
                  ${option.label}
                </option>`,
              )
              .join("")}
          </select>
        </label>
        <button id="step-3-continue" type="submit">Continue to Step 4</button>
      </form>
    `,
  });
}

function renderStep4(data: WizardSession, errors: string[] = []): string {
  return renderStepTemplate({
    step: 4,
    title: "Step 4 · Final Details",
    body: `
      <p>Wrap things up with a short bio (optional) and tell us when you're next available.</p>
      ${renderErrors(errors)}
      <form id="step-4-form" method="POST" action="/wizard/step-4">
        <label>
          Short bio (optional)
          <textarea id="bio" name="bio" rows="4" placeholder="Share a few sentences about yourself.">${escapeHtml(
            data.bio,
          )}</textarea>
        </label>
        <label>
          Next availability <span aria-hidden="true" class="required">*</span>
          <input id="availability" name="availability" type="datetime-local" required value="${escapeAttr(
            data.availability,
          )}" />
        </label>
        <button id="step-4-submit" type="submit">Submit application</button>
      </form>
    `,
  });
}

function renderReviewPage(data: WizardSession): string {
  const hobbiesText =
    data.hobbies.length > 0
      ? data.hobbies.map(capitalize).join(", ")
      : "No hobbies selected";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Review Submission</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 3rem auto; max-width: 640px; line-height: 1.6; padding: 0 1.5rem; }
      main { display: grid; gap: 1.25rem; border: 1px solid #d4d4d8; border-radius: 16px; padding: 2rem; background: #ffffff; }
      .review-hint { border: 1px solid #bfdbfe; background: #eef2ff; padding: 0.75rem 1rem; border-radius: 8px; color: #1e3a8a; }
      dl { margin: 0; }
      dt { font-weight: 600; }
      dd { margin: 0 0 0.75rem; }
      form { margin: 0; }
      #confirm-summary-review { padding: 0.75rem 1.5rem; font-size: 1rem; border-radius: 8px; border: none; background: #2563eb; color: white; font-weight: 600; cursor: pointer; }
      #confirm-summary-review:hover { background: #1d4ed8; }
      #review-back { color: #2563eb; }
    </style>
  </head>
  <body data-wizard-status="review">
    <main>
      <h1>Review your submission</h1>
      <p class="review-hint">Everything is pre-filled. Confirm the details below to finish.</p>
      <dl>
        <dt>Full name</dt>
        <dd>${escapeHtml(data.fullName)}</dd>
        <dt>Nickname</dt>
        <dd>${escapeHtml(data.nickname || "Not provided")}</dd>
        <dt>Age</dt>
        <dd>${escapeHtml(String(data.age ?? "Unknown"))}</dd>
        <dt>Updates</dt>
        <dd>${data.newsletterOptIn ? "Subscribed to updates" : "Opted out"}</dd>
        <dt>Favorite color</dt>
        <dd>${escapeHtml(capitalize(data.favoriteColor))}</dd>
        <dt>Hobbies</dt>
        <dd>${escapeHtml(hobbiesText)}</dd>
        <dt>Bio</dt>
        <dd>${escapeHtml(data.bio || "No bio provided")}</dd>
        <dt>Availability</dt>
        <dd>${escapeHtml(formatAvailabilityDisplay(data.availability))}</dd>
      </dl>
      <form id="confirm-review-form" method="POST" action="/wizard/confirm">
        <button id="confirm-summary-review" type="submit">Confirm summary</button>
      </form>
      <a id="review-back" href="/wizard/step-4">Back to Step 4</a>
    </main>
  </body>
</html>`;
}

function renderCompletion(data: WizardSession): string {
  const hobbiesText =
    data.hobbies.length > 0
      ? data.hobbies.map(capitalize).join(", ")
      : "No hobbies selected";
  const confirmationSection = `<p id="confirmation-status" data-confirmed="${data.confirmed}">${
    data.confirmed
      ? "Summary confirmed. You can return to the start when ready."
      : "Summary not yet confirmed."
  }</p>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Application Complete</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 3rem auto; max-width: 640px; line-height: 1.6; padding: 0 1.5rem; }
      main { display: grid; gap: 1.25rem; border: 1px solid #d4d4d8; border-radius: 16px; padding: 2rem; background: #f8fafc; }
      p[data-status="success"] { color: #166534; font-weight: 600; }
      dt { font-weight: 600; }
      dd { margin: 0 0 0.75rem; }
      #confirmation-status { border: 1px solid #bbf7d0; background: #dcfce7; padding: 0.75rem 1rem; border-radius: 8px; color: #166534; }
      #return-home { color: #2563eb; }
    </style>
  </head>
  <body data-wizard-status="success">
    <main>
      <h1>Application Complete</h1>
      <p id="completion-message" data-status="success">Thanks for completing the wizard! Here is what we captured:</p>
      <dl>
        <dt>Full name</dt>
        <dd>${escapeHtml(data.fullName)}</dd>
        <dt>Nickname</dt>
        <dd>${escapeHtml(data.nickname || "Not provided")}</dd>
        <dt>Age</dt>
        <dd>${escapeHtml(String(data.age ?? "Unknown"))}</dd>
        <dt>Updates</dt>
        <dd>${data.newsletterOptIn ? "Subscribed to updates" : "Opted out"}</dd>
        <dt>Favorite color</dt>
        <dd>${escapeHtml(capitalize(data.favoriteColor))}</dd>
        <dt>Hobbies</dt>
        <dd>${escapeHtml(hobbiesText)}</dd>
        <dt>Bio</dt>
        <dd>${escapeHtml(data.bio || "No bio provided")}</dd>
        <dt>Availability</dt>
        <dd>${escapeHtml(formatAvailabilityDisplay(data.availability))}</dd>
      </dl>
      ${confirmationSection}
      <a id="return-home" href="/">Return to start</a>
    </main>
  </body>
</html>`;
}

function renderNotFound(): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Not Found</title>
  </head>
  <body>
    <main>
      <h1>404 - Not Found</h1>
      <p>The page you requested could not be found.</p>
      <a href="/">Back to onboarding home</a>
    </main>
  </body>
</html>`;
}

function renderStepTemplate({
  step,
  title,
  body,
}: {
  step: number;
  title: string;
  body: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 3rem auto; max-width: 640px; line-height: 1.6; padding: 0 1.5rem; }
      main { display: grid; gap: 1.5rem; border: 1px solid #d4d4d8; border-radius: 16px; padding: 2rem; background: #ffffff; }
      form { display: grid; gap: 1.25rem; }
      label { display: grid; gap: 0.5rem; font-weight: 600; }
      input[type="text"],
      input[type="number"],
      input[type="datetime-local"],
      select,
      textarea { padding: 0.75rem; font-size: 1rem; border: 1px solid #cbd5f5; border-radius: 8px; }
      textarea { font-family: system-ui, sans-serif; resize: vertical; }
      button { padding: 0.75rem 1.5rem; font-size: 1rem; border-radius: 8px; border: none; background: #2563eb; color: white; font-weight: 600; cursor: pointer; }
      button:hover { background: #1d4ed8; }
      .step-indicator { font-size: 0.9rem; color: #475569; }
      .required { color: #dc2626; }
      .errors { border: 1px solid #f87171; background: #fee2e2; padding: 1rem; border-radius: 8px; color: #991b1b; }
      .errors ul { margin: 0; padding-left: 1.25rem; }
      .checkbox-row { display: flex; align-items: center; gap: 0.75rem; font-weight: 500; }
    </style>
  </head>
  <body>
    <main>
      <p class="step-indicator">Step ${step} of 4</p>
      <h1>${escapeHtml(title)}</h1>
      ${body}
      <a id="step-${step}-back" href="${step === 1 ? "/" : `/wizard/step-${step - 1}`}">Back</a>
    </main>
  </body>
</html>`;
}

function renderErrors(errors: string[]): string {
  if (errors.length === 0) {
    return "";
  }

  return `<div class="errors" role="alert">
    <strong>There were issues with your submission:</strong>
    <ul>
      ${errors.map(err => `<li>${escapeHtml(err)}</li>`).join("")}
    </ul>
  </div>`;
}

function normalizeScenario(value?: string | null): Scenario {
  if (value === "success" || value === "invalid") {
    return value;
  }
  return "default";
}

function createSessionForScenario(scenario: Scenario): WizardSession {
  const base: WizardSession = {
    scenario,
    fullName: "",
    nickname: "",
    age: null,
    newsletterOptIn: false,
    favoriteColor: "",
    hobbies: [],
    bio: "",
    availability: "",
    confirmed: false,
  };

  if (scenario === "success") {
    base.fullName = VALID_FULL_NAME;
    base.nickname = VALID_NICKNAME;
    base.age = VALID_AGE;
    base.newsletterOptIn = true;
    base.favoriteColor = VALID_FAVORITE_COLOR;
    base.hobbies = [...VALID_HOBBIES];
    base.bio = VALID_BIO;
    base.availability = VALID_AVAILABILITY;
  } else if (scenario === "invalid") {
    base.fullName = VALID_FULL_NAME;
    base.nickname = VALID_NICKNAME;
    base.age = INVALID_AGE;
    base.newsletterOptIn = true;
    base.favoriteColor = VALID_FAVORITE_COLOR;
    base.hobbies = [...VALID_HOBBIES];
    base.bio = VALID_BIO;
    base.availability = VALID_AVAILABILITY;
  }

  return base;
}

function parseCookies(header: string): Map<string, string> {
  const map = new Map<string, string>();
  header.split(";").forEach(cookie => {
    const [rawKey, rawValue] = cookie.split("=").map(part => part?.trim());
    if (rawKey && rawValue) {
      map.set(rawKey, rawValue);
    }
  });
  return map;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatAvailabilityDisplay(availability: string): string {
  if (!availability) {
    return "Unknown";
  }
  const date = new Date(availability);
  if (Number.isNaN(date.getTime())) {
    return availability;
  }
  return date.toLocaleString("en-US", { timeZone: "UTC" });
}

function generateFutureDateTimeIso(daysAhead: number): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + Math.max(1, daysAhead));
  now.setUTCHours(15, 30, 0, 0);
  const iso = now.toISOString();
  return iso.slice(0, 16);
}
