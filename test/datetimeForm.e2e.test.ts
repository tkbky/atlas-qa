import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { runAtlas } from "../src/atlas.js";

vi.setConfig({ testTimeout: 120000 });

type TestServerHandle = {
  baseUrl: string;
  close: () => Promise<void>;
};

type FormSession = {
  eventName: string;
  eventDateTime: string;
  submitted: boolean;
};

const formSessions = new Map<string, FormSession>();

let testServer: TestServerHandle;

beforeAll(async () => {
  testServer = await startDateTimeServer();
});

afterAll(async () => {
  await testServer.close();
});

describe("Atlas datetime-local form (end-to-end)", () => {
  it("completes the form with a valid future datetime-local input", async () => {
    const goal = [
      `Fill out the event scheduling form with event name "Team Meeting".`,
      `Set the event date and time to Year 2035, Month 07, Day 15, Hours 02, Minutes 30, PM.`,
      `Submit the form and verify the confirmation page shows "Team Meeting" and confirms scheduling.`
    ].join(" ");

    const startUrl = `${testServer.baseUrl}/`;

    const result = await runAtlas(goal, startUrl, {
      env: "LOCAL",
      maxSteps: 20,
      beamSize: 2,
      runLabel: "datetime-form-e2e",
      timeBudgetMs: 120_000,
    });

    expect(result.goal).toBe(goal);
    expect(result.startUrl).toBe(startUrl);
    expect(result.endedReason).toBe("success_heuristic");

    const final = result.finalObservation;
    expect(final.url.startsWith(`${testServer.baseUrl}/confirm`)).toBe(true);
    expect(final.title).toContain("Event Scheduled");
    expect(final.pageText).toContain("Team Meeting");
    expect(final.pageText).toContain("Event scheduled successfully");

    // Verify datetime-local input was filled with direct ISO fill
    const executedFillActions = result.steps
      .filter(step => step.action.method?.toLowerCase() === "fill")
      .map(step => step.action);

    const datetimeLocalFill = executedFillActions.find(action => {
      const type = action.fieldInfo?.type?.toLowerCase();
      const desc = action.description?.toLowerCase() || "";
      return type === "datetime-local" || desc.includes("datetime-local");
    });

    expect(datetimeLocalFill).toBeDefined();
    expect(datetimeLocalFill?.arguments?.[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    // Verify it matches the expected ISO format: 2035-07-15T14:30 (2 PM = 14:00)
    expect(datetimeLocalFill?.arguments?.[0]).toBe("2035-07-15T14:30");
  });

  it("displays validation error when datetime is in the past", async () => {
    const goal = `Fill out the event scheduling form with event name "Past Event" and attempt to submit with a past date/time. Confirm that the form displays a validation error requiring a future date/time.`;

    const startUrl = `${testServer.baseUrl}/`;

    const result = await runAtlas(goal, startUrl, {
      env: "LOCAL",
      maxSteps: 15,
      beamSize: 2,
      runLabel: "datetime-form-e2e-invalid",
      timeBudgetMs: 80_000,
    });

    expect(result.goal).toBe(goal);
    expect(result.startUrl).toBe(startUrl);
    expect(result.endedReason).not.toBe("success_heuristic");

    const final = result.finalObservation;
    expect(final.url.startsWith(`${testServer.baseUrl}/`)).toBe(true);
    expect(/must be in the future/i.test(final.pageText ?? "")).toBe(true);
  });
});

async function startDateTimeServer(): Promise<TestServerHandle> {
  const server = createServer((req, res) => {
    handleRequest(req, res).catch(error => {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
      }
      res.end("Internal Server Error");
      console.error("DateTime test server error:", error);
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
  const { sessionId, data } = ensureSession(req, res);

  if (method === "GET" && url.pathname === "/") {
    sendHtml(res, renderFormPage(data));
    return;
  }

  if (method === "POST" && url.pathname === "/submit") {
    const params = new URLSearchParams(await collectRequestBody(req));
    const eventName = params.get("eventName")?.trim() ?? "";
    const eventDateTime = params.get("eventDateTime") ?? "";
    const errors: string[] = [];

    if (!eventName) {
      errors.push("Event name is required.");
    }

    if (!eventDateTime) {
      errors.push("Event date and time is required.");
    } else {
      const dateTime = new Date(eventDateTime);
      if (Number.isNaN(dateTime.getTime())) {
        errors.push("Event date and time must be a valid date and time.");
      } else if (dateTime.getTime() <= Date.now()) {
        errors.push("Event date and time must be in the future.");
      }
    }

    if (errors.length > 0) {
      sendHtml(
        res,
        renderFormPage(
          {
            ...data,
            eventName,
            eventDateTime,
          },
          errors,
        ),
        422,
      );
      return;
    }

    updateSession(sessionId, { eventName, eventDateTime, submitted: true });
    redirect(res, "/confirm");
    return;
  }

  if (method === "GET" && url.pathname === "/confirm") {
    const current = formSessions.get(sessionId);
    if (!current || !current.submitted) {
      redirect(res, "/");
      return;
    }
    sendHtml(res, renderConfirmationPage(current));
    return;
  }

  sendHtml(res, renderNotFound(), 404);
}

function ensureSession(
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
) {
  const cookies = parseCookies(req.headers.cookie ?? "");
  let sessionId = cookies.get("form_session");

  if (!sessionId || !formSessions.has(sessionId)) {
    sessionId = randomUUID();
    formSessions.set(sessionId, {
      eventName: "",
      eventDateTime: "",
      submitted: false,
    });
  }

  res.setHeader("Set-Cookie", `form_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax`);

  return {
    sessionId,
    data: formSessions.get(sessionId) ?? {
      eventName: "",
      eventDateTime: "",
      submitted: false,
    },
  };
}

function updateSession(sessionId: string, updates: Partial<FormSession>) {
  const existing = formSessions.get(sessionId) ?? {
    eventName: "",
    eventDateTime: "",
    submitted: false,
  };
  formSessions.set(sessionId, { ...existing, ...updates });
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

function renderFormPage(data: FormSession, errors: string[] = []): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Schedule Event</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 3rem auto; max-width: 640px; line-height: 1.6; padding: 0 1.5rem; }
      main { display: grid; gap: 1.5rem; border: 1px solid #d4d4d8; border-radius: 16px; padding: 2rem; background: #ffffff; }
      form { display: grid; gap: 1.25rem; }
      label { display: grid; gap: 0.5rem; font-weight: 600; }
      input[type="text"],
      input[type="datetime-local"] { padding: 0.75rem; font-size: 1rem; border: 1px solid #cbd5f5; border-radius: 8px; }
      button { padding: 0.75rem 1.5rem; font-size: 1rem; border-radius: 8px; border: none; background: #2563eb; color: white; font-weight: 600; cursor: pointer; }
      button:hover { background: #1d4ed8; }
      .required { color: #dc2626; }
      .errors { border: 1px solid #f87171; background: #fee2e2; padding: 1rem; border-radius: 8px; color: #991b1b; }
      .errors ul { margin: 0; padding-left: 1.25rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>Schedule an Event</h1>
      <p>Fill out the form below to schedule your event. The event date and time must be in the future.</p>
      ${renderErrors(errors)}
      <form id="event-form" method="POST" action="/submit">
        <label>
          Event name <span aria-hidden="true" class="required">*</span>
          <input id="eventName" name="eventName" type="text" required value="${escapeAttr(data.eventName)}" placeholder="Enter event name" />
        </label>
        <label>
          Event date and time <span aria-hidden="true" class="required">*</span>
          <input id="eventDateTime" name="eventDateTime" type="datetime-local" required value="${escapeAttr(data.eventDateTime)}" />
        </label>
        <button id="submit-button" type="submit">Schedule Event</button>
      </form>
    </main>
  </body>
</html>`;
}

function renderConfirmationPage(data: FormSession): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Event Scheduled</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 3rem auto; max-width: 640px; line-height: 1.6; padding: 0 1.5rem; }
      main { display: grid; gap: 1.25rem; border: 1px solid #d4d4d8; border-radius: 16px; padding: 2rem; background: #f8fafc; }
      p[data-status="success"] { color: #166534; font-weight: 600; border: 1px solid #bbf7d0; background: #dcfce7; padding: 0.75rem 1rem; border-radius: 8px; }
      dl { margin: 0; }
      dt { font-weight: 600; }
      dd { margin: 0 0 0.75rem; }
      a { color: #2563eb; }
    </style>
  </head>
  <body data-event-status="success">
    <main>
      <h1>Event Scheduled</h1>
      <p id="success-message" data-status="success">Event scheduled successfully!</p>
      <dl>
        <dt>Event name</dt>
        <dd>${escapeHtml(data.eventName)}</dd>
        <dt>Event date and time</dt>
        <dd>${escapeHtml(formatDateTimeDisplay(data.eventDateTime))}</dd>
      </dl>
      <a id="return-home" href="/">Schedule another event</a>
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

function formatDateTimeDisplay(dateTime: string): string {
  if (!dateTime) {
    return "Unknown";
  }
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) {
    return dateTime;
  }
  return date.toLocaleString("en-US", { timeZone: "UTC" });
}
