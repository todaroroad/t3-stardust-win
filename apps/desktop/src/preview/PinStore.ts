import * as Effect from "effect/Effect";
import type { FileSystem } from "effect/FileSystem";
import * as Schema from "effect/Schema";
import { PreviewPinSchema, type PreviewPin } from "@t3tools/contracts";
const StoreSchema = Schema.Struct({
  version: Schema.Literal(1),
  pages: Schema.Record(Schema.String, Schema.Array(PreviewPinSchema)),
});
const decode = Schema.decodeUnknownSync(Schema.fromJsonString(StoreSchema));
export class PinStore {
  private tail: Promise<unknown> = Promise.resolve();
  private readonly file: string;
  private readonly fs: FileSystem;
  private readonly uuid: () => Promise<string>;
  constructor(file: string, fs: FileSystem, uuid: () => Promise<string>) {
    this.file = file;
    this.fs = fs;
    this.uuid = uuid;
  }
  private async read() {
    let raw: string;
    try {
      raw = await Effect.runPromise(this.fs.readFileString(this.file));
    } catch (error) {
      if (!(await Effect.runPromise(this.fs.exists(this.file))))
        return { version: 1 as const, pages: {} };
      throw error;
    }
    try {
      return decode(raw);
    } catch {
      await Effect.runPromise(
        this.fs.rename(this.file, this.file + ".corrupt-" + (await this.uuid())),
      );
      return { version: 1 as const, pages: {} };
    }
  }
  private serial<T>(run: () => Promise<T>): Promise<T> {
    const next = this.tail.then(run, run);
    this.tail = next.catch(() => undefined);
    return next;
  }
  load(key: string): Promise<readonly PreviewPin[]> {
    return this.serial(async () => (await this.read()).pages[key] ?? []);
  }
  save(key: string, pins: readonly PreviewPin[]): Promise<void> {
    return this.serial(async () => {
      if (pins.length > 100) throw new Error("每页最多100条批注");
      const data = await this.read();
      const raw = JSON.stringify({ version: 1, pages: { ...data.pages, [key]: pins } });
      decode(raw);
      if (raw.length > 32 * 1024 * 1024) throw new Error("批注存储已达到32MiB，请先整理");
      await Effect.runPromise(
        this.fs.makeDirectory(this.file.slice(0, this.file.lastIndexOf("/")), { recursive: true }),
      );
      const temporary = this.file + ".writing-" + (await this.uuid());
      try {
        await Effect.runPromise(
          this.fs.writeFileString(temporary, raw, { mode: 0o600, flag: "wx" }),
        );
        await Effect.runPromise(this.fs.rename(temporary, this.file));
      } finally {
        await Effect.runPromise(this.fs.remove(temporary, { force: true }));
      }
    });
  }
}
