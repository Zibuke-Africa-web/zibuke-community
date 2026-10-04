import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "drizzle-kit";

const LOCAL_D1_DIR = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";

function resolveLocalD1File() {
  if (!existsSync(LOCAL_D1_DIR)) {
    throw new Error(
      `No local D1 state found at ${LOCAL_D1_DIR}. Run: npx wrangler d1 execute zibuke-db --local --command "select 1"`,
    );
  }

  const files = readdirSync(LOCAL_D1_DIR).filter(
    (file) => file.endsWith(".sqlite") && file !== "metadata.sqlite",
  );

  if (files.length !== 1) {
    throw new Error(
      `Expected exactly one local D1 database in ${LOCAL_D1_DIR}, found ${files.length}.`,
    );
  }

  return join(LOCAL_D1_DIR, files[0]);
}

export default defineConfig({
  dialect: "sqlite",
  schema: "./db/schema.ts",
  out: "./drizzle",
  // Generating SQL does not require an initialized local database.
  ...(process.argv.includes("generate") ? {} : {
    dbCredentials: { url: resolveLocalD1File() },
  }),
});
