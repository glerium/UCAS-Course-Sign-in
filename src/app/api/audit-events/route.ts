import { NextRequest, NextResponse } from "next/server";
import { normalizeAuditEvent, writeAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = {
	"Cache-Control": "no-store",
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "no-referrer",
	"X-Frame-Options": "DENY",
};
const WINDOW_MS = 60 * 1000;
const MAX_EVENTS_PER_WINDOW = 120;
const hitsByIp = new Map<string, number[]>();

function isSameOriginRequest(req: NextRequest): boolean {
	const origin = req.headers.get("origin");
	if (!origin) return true;
	const host = req.headers.get("host");
	if (!host) return false;
	try {
		return new URL(origin).host === host;
	} catch {
		return false;
	}
}

function getClientIp(req: NextRequest): string {
	return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim() || "unknown";
}

function isRateLimited(ip: string, now: number): boolean {
	const recentHits = (hitsByIp.get(ip) ?? []).filter((timestamp) => now - timestamp < WINDOW_MS);
	if (recentHits.length >= MAX_EVENTS_PER_WINDOW) {
		hitsByIp.set(ip, recentHits);
		return true;
	}
	recentHits.push(now);
	hitsByIp.set(ip, recentHits);
	return false;
}

export async function POST(req: NextRequest) {
	if (!isSameOriginRequest(req)) {
		return NextResponse.json({ message: "非法来源请求" }, { status: 403, headers: RESPONSE_HEADERS });
	}
	if (!req.headers.get("content-type")?.includes("application/json")) {
		return NextResponse.json({ message: "请求格式错误" }, { status: 415, headers: RESPONSE_HEADERS });
	}
	if (isRateLimited(getClientIp(req), Date.now())) {
		return NextResponse.json({ message: "请求过于频繁" }, { status: 429, headers: RESPONSE_HEADERS });
	}

	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ message: "请求体 JSON 格式错误" }, { status: 400, headers: RESPONSE_HEADERS });
	}

	const event = normalizeAuditEvent(body);
	if (!event) {
		return NextResponse.json({ message: "审计事件格式错误" }, { status: 400, headers: RESPONSE_HEADERS });
	}

	await writeAuditEvent(event);
	return new NextResponse(null, { status: 204, headers: RESPONSE_HEADERS });
}
