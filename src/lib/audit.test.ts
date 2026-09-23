import { describe, expect, it, vi } from "vitest";
import { normalizeAuditEvent, writeAuditEvent } from "./audit";

describe("audit event normalization", () => {
	it("accepts a valid event and keeps only supported fields", () => {
		expect(
			normalizeAuditEvent({
				action: "course_select",
				outcome: "success",
				username: "20260001",
				courseDate: "20260923",
				courseId: "1234567",
			}),
		).toMatchObject({ action: "course_select", outcome: "success", username: "20260001", courseId: "1234567" });
	});

	it("rejects unsupported actions, invalid dates, and out-of-range counts", () => {
		expect(normalizeAuditEvent({ action: "password_export", outcome: "success" })).toBeNull();
		expect(normalizeAuditEvent({ action: "course_filter", outcome: "success", courseDate: "2026-09-23" })).toBeNull();
		expect(normalizeAuditEvent({ action: "course_filter", outcome: "success", resultCount: -1 })).toBeNull();
	});

	it("does not require a configured database and does not throw on invalid input", async () => {
		const originalUrl = process.env.DATABASE_URL;
		delete process.env.DATABASE_URL;
		const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		await expect(writeAuditEvent({ action: "course_query", outcome: "success", username: "20260001" })).resolves.toBe(false);
		await expect(writeAuditEvent({ action: "course_query", outcome: "success", username: " ".repeat(41) })).resolves.toBe(false);
		warning.mockRestore();
		if (originalUrl) process.env.DATABASE_URL = originalUrl;
	});
});
