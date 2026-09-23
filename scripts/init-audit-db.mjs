import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	throw new Error("DATABASE_URL is required. Pull Vercel environment variables before running this script.");
}

const schemaUrl = new URL("../db/audit-events.sql", import.meta.url);
const statements = (await readFile(schemaUrl, "utf8"))
	.split(";")
	.map((statement) => statement.trim())
	.filter(Boolean);

const sql = neon(databaseUrl);
for (const statement of statements) {
	await sql.query(statement);
}

console.log("Audit event table and indexes are ready.");
