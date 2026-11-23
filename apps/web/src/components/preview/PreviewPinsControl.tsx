import { serverCopy } from "~/i18n/serverCopy";
import { uiText } from "../../i18n";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { PreviewAnnotationPayload } from "@t3tools/contracts";
import type { ComposerImageAttachment } from "~/composerDraftStore";
import { previewBridge } from "./previewBridge";
import { Button } from "~/components/ui/button";

type Send = (
  annotation: PreviewAnnotationPayload,
  image: ComposerImageAttachment | null,
) => void | boolean | Promise<void | boolean>;
export function PreviewPinsControl({
  tabId,
  url,
  loading,
  enabled,
  onSend,
}: {
  tabId: string;
  url: string;
  loading: boolean;
  enabled: boolean;
  onSend: Send | undefined;
}) {
  const [active, setActive] = useState(false);
  const [count, setCount] = useState(0);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const session = useRef({ wanted: false, epoch: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = (closeNative = true) => {
    session.current.wanted = false;
    session.current.epoch += 1;
    setActive(false);
    setCount(0);
    setState("idle");
    if (closeNative)
      void previewBridge
        ?.pinAction?.(tabId, "close", [])
        .catch(() => previewBridge?.cancelPickElement(tabId));
  };
  const begin = async () => {
    const bridge = previewBridge;
    if (!bridge || !session.current.wanted) return;
    const epoch = ++session.current.epoch;
    try {
      await bridge.setAnnotationSendEnabled(tabId, enabled && Boolean(onSend));
      if (epoch !== session.current.epoch) return;
      const result = await bridge.pickElement(tabId, undefined, true);
      if (epoch !== session.current.epoch) return;
      if (!result) {
        // Native cancellation may mean another pick mode already owns this tab.
        stop(false);
        return;
      }
      setState("sending");
      const accepted = await onSend?.(result.annotation, null);
      if (accepted !== true) {
        setError(
          uiText("Submission is unconfirmed. Annotations are still unsent and can be retried."),
        );
        stop();
        return;
      }
      await bridge.pinAction?.(
        tabId,
        "accepted",
        result.annotation.pins?.map((pin) => pin.id) ?? [],
      );
      if (epoch !== session.current.epoch) return;
      setState("sent");
      timer.current = setTimeout(() => {
        setState("idle");
        timer.current = null;
      }, 1600);
      void begin();
    } catch (cause) {
      if (epoch !== session.current.epoch) return;
      setError(cause instanceof Error ? cause.message : uiText("Annotation action failed"));
      setState("idle");
      session.current.wanted = false;
      setActive(false);
      void bridge.cancelPickElement(tabId).catch(() => undefined);
    }
  };
  const toggle = () => {
    if (session.current.wanted) {
      stop();
      return;
    }
    setError("");
    session.current.wanted = true;
    setActive(true);
    void begin();
  };
  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (
      event.target instanceof Element &&
      event.target.closest('input,textarea,[contenteditable="true"]')
    )
      return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.toLowerCase() === "c") {
      event.preventDefault();
      toggle();
    } else if (event.key === "Escape" && session.current.wanted) {
      event.preventDefault();
      stop();
    }
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Subscribe to native pin-count events and document keyboard shortcuts for this preview tab.
  useEffect(() => {
    const unlisten = previewBridge?.onPinState?.((id, pending) => {
      if (id === tabId) setCount(pending);
    });
    const key = (event: KeyboardEvent) => onShortcut(event);
    document.addEventListener("keydown", key);
    return () => {
      unlisten?.();
      document.removeEventListener("keydown", key);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [tabId]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Cancel the native annotation session when its preview tab unmounts; native navigation keeps the session alive.
  useEffect(() => {
    return () => {
      session.current.epoch += 1;
      void previewBridge?.cancelPickElement(tabId).catch(() => undefined);
    };
  }, [tabId]);
  return (
    <div className="flex shrink-0 items-center gap-2" data-preview-pins-controls>
      <Button
        size="annotation-pill"
        variant={active ? "annotation" : "ghost"}
        disabled={!active && (loading || !url)}
        aria-pressed={active}
        title={error || uiText("Annotations (C), Esc to exit")}
        onClick={toggle}
      >
        {uiText("Annotations")}
      </Button>
      {active && (
        <Button
          size="annotation-pill"
          variant="annotation-send"
          style={{ width: state === "sent" ? 88 : state === "sending" ? 104 : 132 }}
          disabled={!enabled || count === 0 || state === "sending"}
          onClick={() => {
            void previewBridge
              ?.pinAction?.(tabId, "send", [])
              .catch((cause: unknown) => setError(String(cause)));
          }}
        >
          {state === "sending"
            ? uiText("Sending…")
            : state === "sent"
              ? uiText("Sent")
              : uiText("Send to assistant ({count})", { count })}
        </Button>
      )}
      {error && (
        <span role="alert" className="max-w-48 text-xs text-destructive">
          {serverCopy(error)}
        </span>
      )}
    </div>
  );
}
