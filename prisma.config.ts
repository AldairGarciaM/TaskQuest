import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // process.env instead of env() so `prisma generate` (postinstall) works without a .env
    url: process.env.DATABASE_URL,
  },
});
