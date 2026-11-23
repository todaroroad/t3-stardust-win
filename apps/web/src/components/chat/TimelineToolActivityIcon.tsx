import { PullRequestGlyph } from "../pullRequest/pullRequestIcons";
import { type ToolActivityIcon } from "@t3tools/contracts";
import { toolActivityFaviconUrl } from "@t3tools/shared/favicon";
import { getProjectFaviconCacheKey } from "@t3tools/shared/projectFavicon";
import { use, useId, useState } from "react";
import { T3Wordmark } from "../T3Wordmark";
import {
  BotIcon,
  CheckIcon,
  CircleAlertIcon,
  EyeIcon,
  GlobeIcon,
  ListTodoIcon,
  MessageCircleIcon,
  SearchIcon,
  SmartphoneIcon,
  SquarePenIcon,
  TerminalIcon,
  HammerIcon,
  WrenchIcon,
  Code2Icon,
  XIcon,
  ZapIcon,
} from "lucide-react";
import { useAssetUrlState } from "../../assets/assetUrls";
import { cn } from "~/lib/utils";
import { TimelineRowCtx } from "./timelineRowContext";

export const failedToolIconClassName = "text-tool-error-icon/40";

export function toolIconAcceptsTint(toolIcon: ToolActivityIcon | undefined): boolean {
  return toolIcon === undefined;
}

export type WorkEntryIconName =
  | "bot"
  | "brain"
  | "browser"
  | "check"
  | "list-todo"
  | "circle-alert"
  | "computer"
  | "code"
  | "device"
  | "eye"
  | "globe"
  | "hammer"
  | "message-circle"
  | "search"
  | "square-pen"
  | "terminal"
  | "pull-request"
  | "t3-code"
  | "wrench"
  | "x"
  | "zap";

function BrowserAppIcon({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M8.5 19H7.2C4.4 19 3 17.5 3 14.6V7.4C3 4.5 4.5 3 7.4 3h8.2C18.5 3 20 4.5 20 7.4v2.4" />
      <circle cx="7.4" cy="7.2" r="0.75" fill="currentColor" stroke="none" />
      <path d="M11.2 7.2h4.3" />
      <path d="m12.4 11.4 7.5 2.6-3.4 1.6-1.5 3.6z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function StardustThoughtIcon({ className }: { className: string }) {
  const { resolvedTheme } = use(TimelineRowCtx);
  const gradId = useId();
  const isDark = resolvedTheme === "dark";
  const primary = isDark ? "#FF6734" : "#E34717";
  const secondary = isDark ? "#FFB340" : "#FF9500";
  const tertiary = isDark ? "#A78BFA" : "#8B5CF6";
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="3.5" y1="4" x2="18.5" y2="18.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={secondary} />
          <stop offset="52%" stopColor={primary} />
          <stop offset="100%" stopColor={tertiary} />
        </linearGradient>
      </defs>
      <circle cx="10.5" cy="11" r="7" fill={primary} fillOpacity={isDark ? 0.16 : 0.12} />
      <path
        fill={`url(#${gradId})`}
        d="M10.5 4C11 8.1 13.4 10.5 17.5 11C13.4 11.5 11 13.9 10.5 18C10 13.9 7.6 11.5 3.5 11C7.6 10.5 10 8.1 10.5 4Z"
      />
      <path
        fill={secondary}
        d="M18.5 2.3C18.74 4.12 19.88 5.26 21.7 5.5C19.88 5.74 18.74 6.88 18.5 8.7C18.26 6.88 17.12 5.74 15.3 5.5C17.12 5.26 18.26 4.12 18.5 2.3Z"
      />
      <path
        fill={tertiary}
        d="M17.5 16.2C17.68 17.5 18.5 18.32 19.8 18.5C18.5 18.68 17.68 19.5 17.5 20.8C17.32 19.5 16.5 18.68 15.2 18.5C16.5 18.32 17.32 17.5 17.5 16.2Z"
      />
    </svg>
  );
}

export function ToolActivityIconView(props: {
  icon: ToolActivityIcon | undefined;
  fallbackName: WorkEntryIconName;
  className: string;
  muted: boolean;
}) {
  const { resolvedTheme } = use(TimelineRowCtx);
  const keepVivid = props.fallbackName === "brain";
  const fallbackClassName = cn(
    props.className,
    props.muted && !keepVivid && "opacity-70 light:brightness-60",
  );
  if (!props.icon) {
    return <WorkEntryIcon name={props.fallbackName} className={fallbackClassName} />;
  }
  if (props.icon._tag === "website") {
    const src = toolActivityFaviconUrl(props.icon, resolvedTheme, 32);
    return src ? (
      <ToolActivityImageIcon
        key={src}
        cacheKey={src}
        src={src}
        fallbackName={props.fallbackName}
        className={props.className}
        muted={props.muted}
      />
    ) : (
      <WorkEntryIcon name={props.fallbackName} className={fallbackClassName} />
    );
  }
  if (props.icon._tag === "themed-logo") {
    const src =
      resolvedTheme === "dark"
        ? (props.icon.logoUrlDark ?? props.icon.logoUrl)
        : props.icon.logoUrl;
    return (
      <ToolActivityImageIcon
        key={src}
        cacheKey={src}
        src={src}
        fallbackName={props.fallbackName}
        className={props.className}
        muted={props.muted}
      />
    );
  }
  return (
    <NativeAppToolActivityIcon
      app={props.icon.app}
      fallbackName={props.fallbackName}
      className={cn(props.className, "size-5")}
      muted={props.muted}
    />
  );
}

function NativeAppToolActivityIcon(props: {
  app: Extract<ToolActivityIcon, { readonly _tag: "native-app" }>["app"];
  fallbackName: WorkEntryIconName;
  className: string;
  muted: boolean;
}) {
  const { activeThreadEnvironmentId } = use(TimelineRowCtx);
  const asset = useAssetUrlState(activeThreadEnvironmentId, {
    _tag: "native-app-icon",
    app: props.app,
  });
  if (asset._tag !== "Success") {
    return (
      <WorkEntryIcon
        name={props.fallbackName}
        className={cn(props.className, props.muted && "opacity-70 light:brightness-60")}
      />
    );
  }
  const cacheKey = getProjectFaviconCacheKey(
    activeThreadEnvironmentId,
    JSON.stringify(props.app),
    asset.url,
  );
  return (
    <ToolActivityImageIcon
      key={cacheKey}
      cacheKey={cacheKey}
      src={asset.url}
      fallbackName={props.fallbackName}
      className={props.className}
      muted={props.muted}
    />
  );
}

const loadedToolActivityIconSrcs = new Map<string, string>();

function ToolActivityImageIcon(props: {
  cacheKey: string;
  src: string;
  fallbackName: WorkEntryIconName;
  className: string;
  muted: boolean;
}) {
  const [displayedSrc, setDisplayedSrc] = useState<string | null>(
    () => loadedToolActivityIconSrcs.get(props.cacheKey) ?? null,
  );
  const isLoading = displayedSrc !== props.src;
  const handleLoadError = (failedSrc: string) => {
    if (loadedToolActivityIconSrcs.get(props.cacheKey) === failedSrc) {
      loadedToolActivityIconSrcs.delete(props.cacheKey);
    }
    setDisplayedSrc((currentSrc) => (currentSrc === failedSrc ? null : currentSrc));
  };
  return (
    <>
      {displayedSrc === null ? (
        <WorkEntryIcon
          name={props.fallbackName}
          className={cn(props.className, props.muted && "opacity-70 light:brightness-60")}
        />
      ) : null}
      {displayedSrc ? (
        <span
          className={cn(
            props.className,
            "inline-block overflow-hidden rounded-xs bg-background",
            props.muted && "dark:opacity-70",
          )}
        >
          <img
            src={displayedSrc}
            alt=""
            aria-hidden
            decoding="async"
            referrerPolicy="no-referrer"
            className={cn("block size-full object-contain", props.muted && "light:brightness-70")}
            onError={() => handleLoadError(displayedSrc)}
          />
        </span>
      ) : null}
      {isLoading ? (
        <img
          src={props.src}
          alt=""
          aria-hidden
          decoding="async"
          referrerPolicy="no-referrer"
          className="hidden"
          onLoad={() => {
            loadedToolActivityIconSrcs.set(props.cacheKey, props.src);
            setDisplayedSrc(props.src);
          }}
          onError={() => handleLoadError(props.src)}
        />
      ) : null}
    </>
  );
}

function WorkEntryIcon({ name, className }: { name: WorkEntryIconName; className: string }) {
  switch (name) {
    case "pull-request":
      return <PullRequestGlyph.pullRequest className={className} aria-hidden />;
    case "bot":
      return <BotIcon className={className} aria-hidden />;
    case "brain":
      return <StardustThoughtIcon className={className} />;
    case "browser":
    case "computer":
      return <BrowserAppIcon className={className} />;
    case "code":
      return <Code2Icon className={className} aria-hidden />;
    case "device":
      return <SmartphoneIcon className={className} aria-hidden />;
    case "t3-code":
      return <T3Wordmark className={className} aria-hidden />;
    case "check":
      return <CheckIcon className={className} aria-hidden />;
    case "list-todo":
      return <ListTodoIcon className={className} aria-hidden />;
    case "circle-alert":
      return <CircleAlertIcon className={className} aria-hidden />;
    case "eye":
      return <EyeIcon className={className} aria-hidden />;
    case "globe":
      return <GlobeIcon className={className} aria-hidden />;
    case "hammer":
      return <HammerIcon className={className} aria-hidden />;
    case "search":
      return <SearchIcon className={className} aria-hidden />;
    case "message-circle":
      return <MessageCircleIcon className={className} aria-hidden />;
    case "square-pen":
      return <SquarePenIcon className={className} aria-hidden />;
    case "terminal":
      return <TerminalIcon className={className} aria-hidden />;
    case "wrench":
      return <WrenchIcon className={className} aria-hidden />;
    case "x":
      return <XIcon className={className} aria-hidden />;
    case "zap":
      return <ZapIcon className={className} aria-hidden />;
  }
}
