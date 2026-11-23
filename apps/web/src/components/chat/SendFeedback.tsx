import { useEffect, useState } from "react";
import { useUiText } from "~/i18n/useUiText";
import { Button } from "../ui/button";

export interface SendFeedbackState {
  readonly threadKey: string;
  readonly messageId: string;
  readonly stage: "preparing" | "connecting" | "thinking" | "failed";
  readonly provider: string;
  readonly error?: string;
  readonly retry?: () => void;
}

export function SendFeedback({ feedback }: { readonly feedback: SendFeedbackState }) {
  const text = useUiText();
  const [waitKey, setWaitKey] = useState<string | null>(null);
  const key = `${feedback.threadKey}:${feedback.messageId}:${feedback.stage}`;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- One deadline explains a long wait; no polling or idle timer remains after completion.
  useEffect(() => {
    if (feedback.stage === "failed") return;
    const timer = setTimeout(() => setWaitKey(key), 10000);
    return () => clearTimeout(timer);
  }, [key, feedback.stage]);
  const label =
    feedback.stage === "failed"
      ? text("Message could not be sent: {reason}", {
          reason:
            !feedback.error || feedback.error === "Connection interrupted"
              ? text("Connection interrupted")
              : feedback.error,
        })
      : feedback.stage === "preparing"
        ? text("Preparing your message")
        : feedback.stage === "connecting"
          ? text("Connecting to {provider}", { provider: feedback.provider })
          : text("Thinking");
  return (
    <div
      className="chat-content-lane py-4 text-sm text-muted-foreground"
      data-send-feedback={feedback.stage}
      role={feedback.stage === "failed" ? "alert" : "status"}
    >
      <p>{label}</p>
      {waitKey === key && feedback.stage !== "failed" ? (
        <p>
          {text(
            feedback.stage === "preparing"
              ? "Waiting for attachments or workspace preparation"
              : feedback.stage === "connecting"
                ? "Waiting for {provider} to confirm the connection"
                : "Waiting for {provider} to respond",
            { provider: feedback.provider },
          )}
        </p>
      ) : null}
      {feedback.stage === "failed" && feedback.retry ? (
        <Button variant="outline" size="sm" onClick={feedback.retry}>
          {text("Retry message")}
        </Button>
      ) : null}
    </div>
  );
}
