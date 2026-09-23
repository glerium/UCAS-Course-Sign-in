import { neon } from "@neondatabase/serverless";

export const AUDIT_ACTIONS = [
	"course_query",
	"course_filter",
	"course_select",
	"qr_generate",
	"qr_refresh",
	"manual_qr_generate",
	"qr_download",
	"sign_url_copy",
	"direct_sign_attempt",
	"direct_sign_result",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditOutcome = "success" | "failure";

export type AuditEventInput = {
	action: AuditAction;
	outcome: AuditOutcome;
	username?: string;
	courseDate?: string;
	courseId?: string;
	courseUuid?: string;
	courseName?: string;
	teacherName?: string;
	keyword?: string;
	resultCount?: number;
	errorCode?: string;
	upstreamStatus?: string;
};

type NormalizedAuditEvent = Required<Pick<AuditEventInput, "action" | "outcome">> &
	Omit<AuditEventInput, "action" | "outcome">;

const MAX_LENGTHS = {
	username: 40,
	courseDate: 8,
	courseId: 64,
	courseUuid: 64,
	courseName: 300,
	teacherName: 200,
	keyword: 120,
	errorCode: 100,
	upstreamStatus: 32,
} as const;

function normalizeText(value: unknown, maxLength: number): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	const normalized = value.trim();
	return normalized && normalized.length <= maxLength ? normalized : undefined;
}

export function normalizeAuditEvent(value: unknown): NormalizedAuditEvent | null {
	if (typeof value !== "object" || value === null) {
		return null;
	}

	const input = value as Record<string, unknown>;
	const action = input.action;
	const outcome = input.outcome;
	if (!AUDIT_ACTIONS.includes(action as AuditAction) || (outcome !== "success" && outcome !== "failure")) {
		return null;
	}

	const username = normalizeText(input.username, MAX_LENGTHS.username);
	if (input.username !== undefined && !username) {
		return null;
	}

	const courseDate = normalizeText(input.courseDate, MAX_LENGTHS.courseDate);
	if ((input.courseDate !== undefined && !courseDate) || (courseDate && !/^\d{8}$/.test(courseDate))) {
		return null;
	}

	const resultCount = input.resultCount;
	if (
		resultCount !== undefined &&
		(typeof resultCount !== "number" || !Number.isInteger(resultCount) || resultCount < 0 || resultCount > 10000)
	) {
		return null;
	}
	const courseId = normalizeText(input.courseId, MAX_LENGTHS.courseId);
	const courseUuid = normalizeText(input.courseUuid, MAX_LENGTHS.courseUuid);
	const courseName = normalizeText(input.courseName, MAX_LENGTHS.courseName);
	const teacherName = normalizeText(input.teacherName, MAX_LENGTHS.teacherName);
	const keyword = normalizeText(input.keyword, MAX_LENGTHS.keyword);
	const errorCode = normalizeText(input.errorCode, MAX_LENGTHS.errorCode);
	const upstreamStatus = normalizeText(input.upstreamStatus, MAX_LENGTHS.upstreamStatus);
	if (
		(input.courseId !== undefined && !courseId) ||
		(input.courseUuid !== undefined && !courseUuid) ||
		(input.courseName !== undefined && !courseName) ||
		(input.teacherName !== undefined && !teacherName) ||
		(input.keyword !== undefined && !keyword) ||
		(input.errorCode !== undefined && !errorCode) ||
		(input.upstreamStatus !== undefined && !upstreamStatus)
	) {
		return null;
	}

	return {
		action: action as AuditAction,
		outcome,
		username,
		courseDate,
		courseId,
		courseUuid,
		courseName,
		teacherName,
		keyword,
		resultCount: resultCount as number | undefined,
		errorCode,
		upstreamStatus,
	};
}

let didWarnAboutMissingDatabase = false;

/**
 * Writes audit data without exposing credentials or changing the caller's outcome.
 * A missing/unavailable database is deliberately isolated from the product flow.
 */
export async function writeAuditEvent(input: AuditEventInput): Promise<boolean> {
	const event = normalizeAuditEvent(input);
	if (!event) {
		console.warn("[audit] refused invalid event payload");
		return false;
	}

	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		if (!didWarnAboutMissingDatabase) {
			console.warn("[audit] DATABASE_URL is not configured; audit events are not persisted");
			didWarnAboutMissingDatabase = true;
		}
		return false;
	}

	try {
		const sql = neon(databaseUrl);
		await sql.query(
			`INSERT INTO audit_events (
				action, outcome, username, course_date, course_id, course_uuid,
				course_name, teacher_name, keyword, result_count, error_code, upstream_status
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
			[
				event.action,
				event.outcome,
				event.username ?? null,
				event.courseDate ?? null,
				event.courseId ?? null,
				event.courseUuid ?? null,
				event.courseName ?? null,
				event.teacherName ?? null,
				event.keyword ?? null,
				event.resultCount ?? null,
				event.errorCode ?? null,
				event.upstreamStatus ?? null,
			],
		);
		return true;
	} catch (error) {
		console.error("[audit] database write failed", {
			errorName: error instanceof Error ? error.name : "UnknownError",
		});
		return false;
	}
}
