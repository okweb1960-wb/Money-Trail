import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// One client per process. SQLite file path is relative to the project root.
const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

const g = globalThis as unknown as { __prisma?: PrismaClient };
export const prisma = g.__prisma ?? new PrismaClient({ adapter: new PrismaLibSql({ url }) });
if (process.env.NODE_ENV !== "production") g.__prisma = prisma;
