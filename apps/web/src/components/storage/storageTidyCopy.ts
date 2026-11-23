import type { StorageTidyItem, StorageTidyOutcome } from "@t3tools/contracts";

import { daysBetween } from "./storageTidyModel";

export type Translate = (source: string, values?: Readonly<Record<string, unknown>>) => string;

const MOLE_SECTIONS: Readonly<Record<string, string>> = {
  user: "User app caches",
  apps: "App caches",
  browsers: "Browser caches",
  developer: "Developer tool caches",
  utilities: "Apps and utility caches",
  support: "Caches inside Application Support",
  other: "Other caches",
};

export function relativeDays(t: Translate, iso: string | null, nowMs: number): string {
  const days = daysBetween(iso, nowMs);
  if (days === null) return t("Unknown date");
  if (days === 0) return t("Today");
  return t("{count} days ago", { count: days });
}

export type ItemCopy = {
  readonly title: string;
  readonly subtitle: string;
  readonly badge: string | null;
  readonly what: string;
  readonly tool: string;
  readonly why: string;
  readonly recover: string;
};

export function itemCopy(t: Translate, item: StorageTidyItem): ItemCopy {
  const d = item.detail;
  const count = d.count ?? String(item.pathCount);
  switch (item.kind) {
    case "mole-section":
      return {
        title: t(MOLE_SECTIONS[item.name] ?? "Other caches"),
        subtitle: t("{count} locations · listed by Mole's rules", { count }),
        badge: null,
        what: t("Cache files that apps and tools rebuild by themselves when they need them."),
        tool: t("Mole (tw93/Mole), run as a separate program in preview mode"),
        why: t("Caches are rebuilt automatically, so removing them loses nothing."),
        recover: t("Nothing to restore. The apps recreate what they need; the next launch may be a little slower."),
      };
    case "dev-cache":
      return {
        title: item.name,
        subtitle: t("Developer download and build cache"),
        badge: null,
        what: t("Downloaded packages and build products kept so installs and builds go faster."),
        tool: item.name,
        why: t("It is re-downloaded or rebuilt the next time you install or build."),
        recover: t("Nothing to restore. The next install or build refills it."),
      };
    case "worktree": {
      const merged = d.merged === "yes";
      const dirtyFiles = item.dirtyFiles;
      return {
        title: item.name,
        subtitle: [d.repo, d.branch].filter(Boolean).join(" · "),
        badge: item.tier === "remind" ? null : merged ? t("Merged") : t("Not merged"),
        what: t("A checked-out copy of a repository that an agent worked in."),
        tool: t("T3 Stardust worktree"),
        why:
          item.tier === "safe"
            ? t("Its branch is merged and nothing in it is uncommitted, so every change already lives in git.")
            : item.tier === "review"
              ? t("It has no uncommitted changes, but its branch is not merged yet or it was used in the last 3 days. Commits stay in git; only this folder goes to Trash.")
              : t("It holds {count} uncommitted files that a removal would lose, so it is never touched.", { count: dirtyFiles }),
        recover:
          item.tier === "safe"
            ? t("Create a worktree for the branch again with git; the files come back from the commit.")
            : t("Undo from the summary while it is in Trash, or create the worktree again from the branch."),
      };
    }
    case "session-archive": {
      const tool = item.tool === "codex" ? "Codex" : item.tool === "claude-code" ? "Claude Code" : item.tool;
      return {
        title: t("{tool} session transcripts", { tool }),
        subtitle: t("{sessions} sessions · not opened for {days}+ days", { sessions: d.sessions ?? count, days: d.oldestDays ?? "60" }),
        badge: t("Compress and archive"),
        what: t("Transcripts of past agent conversations, stored as one file per session."),
        tool,
        why: t("Old transcripts only matter if you want to reread them, and they compress to a fraction of their size."),
        recover: t("A compressed copy goes to the rescue folder first, and the originals can be put back while they are in Trash."),
      };
    }
    case "t3-data":
      return {
        title: t("T3 chat database and attachments"),
        subtitle: t("Managed by T3 itself"),
        badge: null,
        what: t("The database and attachments behind your T3 conversations."),
        tool: "T3 Stardust",
        why: t("Removing these would delete conversations, so this page never touches them. Use Maintenance settings to compact or archive."),
        recover: "",
      };
    case "agent-tmp":
      return {
        title: t("Agent temporary folders in /tmp"),
        subtitle: t("{count} folders untouched for a day or more", { count }),
        badge: null,
        what: t("Scratch folders that agents and test browsers leave in /tmp."),
        tool: t("Codex, Claude Code, T3 and test browsers"),
        why: t("Nothing has written to them for 24 hours, and /tmp is scratch space by design."),
        recover: t("Nothing to restore. The tool recreates its scratch folder the next time it runs."),
      };
    case "app-backup":
      return {
        title: t("{name} old copies", { name: item.name }),
        subtitle: t("{count} copies · newest {kept} kept", { count, kept: d.kept ?? "2" }),
        badge: t("Rollback copies"),
        what: t("Whole-app backups made before an app was replaced or rolled back."),
        tool: item.name,
        why: t("Newer backups of the same app are kept; these are older than that."),
        recover: t("Undo while they are in Trash, or reinstall the app from its update channel."),
      };
    case "backup-file":
      return {
        title: t(".bak-pre-* and .orig files"),
        subtitle: t("{count} files · newest {kept} per source kept", { count, kept: d.kept ?? "2" }),
        badge: t("Rollback copies"),
        what: t("Backup copies of single files that a patch or a merge left next to the original."),
        tool: t("Patch and merge tools"),
        why: t("The newest copies of each file are kept; these are older."),
        recover: t("Undo while they are in Trash."),
      };
    case "build-generation":
      return {
        title: t("Older builds in my build folder ({name})", { name: item.name }),
        subtitle: t("{count} builds · newest {kept} kept", { count, kept: d.kept ?? "2" }),
        badge: t("Rollback copies"),
        what: t("Folders from earlier build generations kept for rollbacks."),
        tool: t("Your build folder"),
        why: t("Newer generations of the same build are kept; these are older."),
        recover: t("Undo while they are in Trash; after that, rebuild from source."),
      };
    case "dirty-repo":
      return item.tier === "remind"
        ? {
            title: t("Caches inside repositories with uncommitted changes"),
            subtitle: t("{count} locations", { count }),
            badge: null,
            what: t("Cache folders that sit inside a git repository whose files are not committed."),
            tool: "git",
            why: t("A cache rule matched them, but uncommitted work must never be deleted automatically."),
            recover: "",
          }
        : {
            title: item.name,
            subtitle: t("{count} uncommitted files", { count: item.dirtyFiles }),
            badge: t("Uncommitted work"),
            what: t("A build folder that is also a git repository with uncommitted changes."),
            tool: t("Your build folder"),
            why: t("It is older than your newest builds. Its uncommitted changes are saved to the rescue folder before it moves to Trash."),
            recover: t("Rescued changes stay in the archive folder; undo while the folder is in Trash."),
          };
  }
}

export function blockedCopy(t: Translate, item: StorageTidyItem): string {
  switch (item.blocked) {
    case "dirty-worktree":
      return t("{count} uncommitted files, so it is left untouched", { count: item.dirtyFiles });
    case "git-unreadable":
      return t("Git could not report its state, so it is left untouched");
    case "protected-t3-data":
      return t("Protected: it holds your conversations");
    case "linked-root":
      return t("Its folder is a link (for example to an external disk), so it is left untouched");
    case "path-link":
    case "not-owned":
    case "cross-volume":
    case "special-file":
    case "scan-budget":
      return t("It could not be checked completely, so it is left untouched");
    default:
      return item.blocked ?? "";
  }
}

export function outcomeReason(t: Translate, entry: StorageTidyOutcome): string | null {
  const reason = entry.reason;
  if (reason === null) return null;
  const code = reason.startsWith("partial:") ? reason.slice(8) : reason;
  const prefix = reason.startsWith("partial:") ? t("Some paths were skipped: ") : "";
  const text = (() => {
    switch (code) {
      case "unknown-item":
        return t("Not part of the last scan");
      case "in-use":
        return t("Used a moment ago, so it was skipped");
      case "changed-since-scan":
        return t("Changed after the scan, so it was skipped");
      case "uncommitted-needs-rescue":
        return t("Has uncommitted work and rescue is off, so it was kept");
      case "dirty-worktree":
        return t("Has uncommitted files, so it was kept");
      case "low-disk":
        return t("There is not enough free space to save a rescue copy first, so it was kept");
      case "trash-unavailable":
        return t("This disk has no Trash folder, so the original was kept");
      case "archive-failed":
      case "archive-unverified":
        return t("The archive could not be verified, so the originals were kept");
      case "outside-allowed-roots":
      case "path-link":
      case "not-owned":
      case "cross-volume":
      case "special-file":
      case "path-invalid":
        return t("Failed a safety check, so it was kept");
      case "restored":
        return t("Put back");
      default:
        return t("It could not be removed");
    }
  })();
  return prefix + text;
}
