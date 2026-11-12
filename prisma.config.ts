import { defineConfig } from "prisma/config";

// SQLite file for v1. Moving to Postgres/Supabase later = change provider + url + adapter.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" },
});
