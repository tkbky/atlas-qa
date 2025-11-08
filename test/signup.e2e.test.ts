import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { runAtlas } from "../src/atlas.js";

vi.setConfig({ testTimeout: 120000 });

const EMAIL = "signup.tester@example.com";
const PASSWORD = "SuperSecure!123";
const INVALID_EMAIL = "wrong.user@example.com";
const INVALID_PASSWORD = "DefinitelyWrong!999";

type TestServerHandle = {
  baseUrl: string;
  close: () => Promise<void>;
};

let testServer: TestServerHandle;

beforeAll(async () => {
  testServer = await startSignupServer();
});

afterAll(async () => {
  await testServer.close();
});

describe("Atlas sign-up flow (end-to-end)", () => {
  it("completes the sign-up flow and records cognitive map transitions", async () => {
    const goal = `Sign up for a new account using email ${EMAIL} and password ${PASSWORD}. Confirm the account is created successfully.`;

    const startUrl = `${testServer.baseUrl}/`;

    const result = await runAtlas(goal, startUrl, {
      env: "LOCAL",
      maxSteps: 8,
      beamSize: 2,
      runLabel: "signup-e2e",
      timeBudgetMs: 30_000,
    });

    expect(result.goal).toBe(goal);
    expect(result.startUrl).toBe(startUrl);
    expect(result.steps.length).toBeGreaterThan(0);

    const fillAffordances = result.steps.flatMap(step =>
      step.observationBefore.affordances.filter(aff => aff.method?.toLowerCase() === "fill")
    );

    expect(fillAffordances.length).toBeGreaterThan(0);
    expect(fillAffordances.length).toBeGreaterThan(1);
    expect(fillAffordances.some(aff => aff.fieldInfo?.tagName === "input")).toBe(true);
    expect(fillAffordances.some(aff => aff.fieldInfo?.type === "email")).toBe(true);
    expect(fillAffordances.some(aff => aff.fieldInfo?.type === "password")).toBe(true);
    expect(fillAffordances.some(aff => aff.fieldInfo?.label?.toLowerCase().includes("email"))).toBe(true);
    expect(fillAffordances.some(aff => aff.fieldInfo?.label?.toLowerCase().includes("password"))).toBe(true);
    expect(fillAffordances.some(aff => (aff.fieldInfo?.placeholder ?? "").toLowerCase().includes("example"))).toBe(true);

    const filledValues = result.steps.flatMap(step =>
      step.observationAfter.affordances.filter(aff => aff.method?.toLowerCase() === "fill")
    );
    expect(
      filledValues.some(aff => (aff.fieldInfo?.value ?? "").includes("@"))
    ).toBe(true);
  });

  it("displays an error page when credentials are invalid", async () => {
    const invalidGoal = `Attempt to sign up with email ${INVALID_EMAIL} and password ${INVALID_PASSWORD}. Confirm that the system shows an error message about invalid signup.`;

    const startUrl = `${testServer.baseUrl}/`;

    const result = await runAtlas(invalidGoal, startUrl, {
      env: "LOCAL",
      maxSteps: 8,
      beamSize: 2,
      runLabel: "signup-e2e-invalid",
      timeBudgetMs: 30_000,
    });

    expect(result.goal).toBe(invalidGoal);
    expect(result.startUrl).toBe(startUrl);

    const observedFillFields = result.steps.flatMap(step =>
      step.observationBefore.affordances.filter(aff => aff.method?.toLowerCase() === "fill")
    );

    expect(observedFillFields.length).toBeGreaterThan(0);
    expect(observedFillFields.length).toBeGreaterThan(1);
    expect(observedFillFields.some(aff => aff.fieldInfo?.type === "email")).toBe(true);
    expect(observedFillFields.some(aff => aff.fieldInfo?.type === "password")).toBe(true);
    expect(observedFillFields.some(aff => aff.fieldInfo?.required === true)).toBe(true);
  });
});

async function startSignupServer(): Promise<TestServerHandle> {
  const server = createServer((req, res) => {
    handleRequest(req, res).catch(error => {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
      }
      res.end("Internal Server Error");
      console.error("Signup test server error:", error);
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

  if (method === "GET" && url.pathname === "/") {
    sendHtml(res, renderLandingPage());
    return;
  }

  if (method === "GET" && url.pathname === "/signup") {
    sendHtml(res, renderSignupPage());
    return;
  }

  if (method === "POST" && url.pathname === "/signup") {
    const body = await collectRequestBody(req);
    const params = new URLSearchParams(body);
    const email = params.get("email")?.trim() ?? "";
    const password = params.get("password") ?? "";
    const success = email === EMAIL && password === PASSWORD;

    const status = success ? "success" : "error";
    const redirectTarget = `/account?status=${status}&email=${encodeURIComponent(email)}`;
    res.statusCode = 303;
    res.setHeader("Location", redirectTarget);
    res.setHeader("Cache-Control", "no-store");
    res.end();
    return;
  }

  if (method === "GET" && url.pathname === "/account") {
    const email = url.searchParams.get("email")?.trim() ?? "";
    const status = url.searchParams.get("status") ?? "success";
    const success = status !== "error";
    sendHtml(res, renderAccountPage(email, success));
    return;
  }

  sendHtml(res, renderNotFound(), 404);
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

function sendHtml(res: ServerResponse<IncomingMessage>, html: string, statusCode = 200) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(html);
}

function renderLandingPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Atlas QA Landing</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 3rem auto; max-width: 560px; line-height: 1.5; padding: 0 1.5rem; }
      main { display: grid; gap: 1.5rem; }
      a.button { display: inline-flex; align-items: center; justify-content: center; padding: 0.75rem 1.5rem; border-radius: 999px; background: #2563eb; color: white; text-decoration: none; font-size: 1rem; font-weight: 600; }
      a.button:hover { background: #1d4ed8; }
    </style>
  </head>
  <body>
    <main>
      <h1>Welcome to Atlas QA</h1>
      <p>This minimal test app demonstrates the sign-up flow used in our end-to-end evaluation.</p>
      <a id="start-signup" class="button" href="/signup" role="button">Start sign up</a>
    </main>
  </body>
</html>`;
}

function renderSignupPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Create Your Account</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 3rem auto; max-width: 560px; line-height: 1.5; padding: 0 1.5rem; }
      form { display: grid; gap: 1rem; padding: 1.5rem; border: 1px solid #d4d4d8; border-radius: 12px; background: #f8fafc; }
      label { display: grid; gap: 0.5rem; font-weight: 600; }
      input { padding: 0.75rem; font-size: 1rem; border: 1px solid #cbd5f5; border-radius: 8px; }
      button { padding: 0.75rem 1.5rem; font-size: 1rem; border-radius: 8px; border: none; background: #2563eb; color: white; font-weight: 600; cursor: pointer; }
      button:hover { background: #1d4ed8; }
    </style>
  </head>
  <body>
    <main>
      <h1>Create your account</h1>
      <p>Enter a valid email and password to sign up.</p>
      <form id="signup-form" method="POST" action="/signup">
        <label>
          Email address
          <input id="email" name="email" type="email" autocomplete="off" placeholder="name@example.com" required />
        </label>
        <label>
          Password
          <input id="password" name="password" type="password" autocomplete="new-password" placeholder="********" required />
        </label>
        <button id="signup-button" type="submit">Sign Up</button>
      </form>
    </main>
  </body>
</html>`;
}

function renderAccountPage(email: string, success: boolean): string {
  const safeEmail = escapeHtml(email || "unknown user");
  const status = success ? "success" : "error";
  const title = success ? "Signup Success" : "Signup Failed";
  const message = success
    ? `Account created successfully for ${safeEmail}.`
    : "Invalid signup attempt. Please try again.";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 3rem auto; max-width: 560px; line-height: 1.5; padding: 0 1.5rem; }
      main { display: grid; gap: 1rem; padding: 1.5rem; border: 1px solid #d4d4d8; border-radius: 12px; background: #f8fafc; }
      p[data-status="success"] { color: #166534; font-weight: 600; }
      p[data-status="error"] { color: #b91c1c; font-weight: 600; }
      .account-email { font-weight: 600; }
      a { color: #2563eb; }
    </style>
  </head>
  <body data-signup-status="${status}">
    <main>
      <h1>${title}</h1>
      <p id="status" data-status="${status}">${message}</p>
      ${success ? `<p class="account-email">Signed in as <strong>${safeEmail}</strong></p>` : ""}
      <a id="return-home" href="/">Return to home</a>
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
      <a href="/">Back to home</a>
    </main>
  </body>
</html>`;
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
