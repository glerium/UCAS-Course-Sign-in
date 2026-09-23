import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST } from "./route";

function request(body: unknown, headers: Record<string, string> = {}) {
	return new NextRequest("http://localhost/api/audit-events", {
		method: "POST",
		headers: { "content-type": "application/json", host: "localhost", ...headers },
		body: JSON.stringify(body),
	});
}

describe("POST /api/audit-events", () => {
	it("rejects a cross-origin request", async () => {
		const response = await POST(request({}, { origin: "https://example.com" }));
		expect(response.status).toBe(403);
	});

	it("rejects an event outside the action allowlist", async () => {
		const response = await POST(request({ action: "password_export", outcome: "success" }));
		expect(response.status).toBe(400);
	});

	it("accepts a valid event even when audit storage is unavailable", async () => {
		const response = await POST(request({ action: "course_filter", outcome: "success", username: "20260001", keyword: "数学" }));
		expect(response.status).toBe(204);
		expect(response.headers.get("cache-control")).toBe("no-store");
	});

	it("rate limits excessive event submissions from one client", async () => {
		const headers = { "x-forwarded-for": "audit-rate-limit-test" };
		for (let index = 0; index < 120; index += 1) {
			expect((await POST(request({ action: "course_filter", outcome: "success" }, headers))).status).toBe(204);
		}
		expect((await POST(request({ action: "course_filter", outcome: "success" }, headers))).status).toBe(429);
	});
});
