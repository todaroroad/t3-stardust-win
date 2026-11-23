import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";
import * as NodeSqliteClient from "../packages/shared/src/nodeSqliteClient.ts";
import { runMigrations } from "../apps/server/src/persistence/Migrations.ts";

const filename = process.argv[2];
if (!filename || !NodePath.isAbsolute(filename)) throw new Error("Expected absolute snapshot path");
// The directory that holds isolated database copies is supplied by the operator; there is no
// built-in location, so the script refuses to run until one is named.
const allowedRoot = process.env.T3_MIGRATE_COPY_ROOT?.trim();
if (!allowedRoot || !NodePath.isAbsolute(allowedRoot))
  throw new Error(
    "Set T3_MIGRATE_COPY_ROOT to the absolute directory that holds isolated database copies",
  );
const real = NodeFS.realpathSync(filename);
const root = NodeFS.realpathSync(allowedRoot) + NodePath.sep;
if (real !== filename || !real.startsWith(root) || !NodeFS.lstatSync(filename).isFile())
  throw new Error("Only an isolated database copy inside T3_MIGRATE_COPY_ROOT may be migrated");

await Effect.runPromise(
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`PRAGMA journal_mode = DELETE`;
    yield* sql`PRAGMA foreign_keys = ON`;
    yield* sql`PRAGMA synchronous = FULL`;
    yield* sql`PRAGMA temp_store = MEMORY`;
    const [before] = yield* sql`SELECT MAX(migration_id) AS id FROM effect_sql_migrations`;
    if (before?.id !== 79) throw new Error("Expected schema79 cold copy");
    for (let id = 80; id <= 95; id++) {
      const start = performance.now();
      const migrated = yield* runMigrations({ toMigrationInclusive: id });
      if (migrated.length !== 1 || migrated[0]?.[0] !== id)
        throw new Error("Migration ledger mismatch");
      console.log(
        JSON.stringify({ id, name: migrated[0][1], milliseconds: performance.now() - start }),
      );
    }
  }).pipe(Effect.provide(NodeSqliteClient.layer({ filename }))),
);
