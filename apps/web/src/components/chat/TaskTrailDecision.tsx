import { uiText } from "../../i18n";
import { useEffect, useLayoutEffect, useRef } from "react";
import type { UserInputQuestion } from "@t3tools/contracts";
import { useStableCallback } from "../../hooks/useStableCallback";
import { animateWorkbenchOnce } from "../../lib/workbenchMotion";

export interface TrailDecisionInput {
  requestId: string;
  question: UserInputQuestion;
  selectedValues: readonly string[];
  disabled: boolean;
  canAdvance: boolean;
  onSelect: (questionId: string, value: string) => void;
  onAdvance: () => void;
  onFocus: () => void;
}
export function TaskTrailDecision({
  input,
  images = {},
}: {
  input: TrailDecisionInput;
  images?: Record<string, string>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advance = useStableCallback(input.onAdvance);
  const question = input.question;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Cancel pending submission when answerability changes or this keyed request unmounts.
  useEffect(() => {
    const cancel = () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
    if (input.disabled) cancel();
    return cancel;
  }, [input.disabled]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Each keyed structured question reveals once on mount.
  useLayoutEffect(() => {
    if (!ref.current) return;
    return animateWorkbenchOnce(
      ref.current,
      [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 350, easing: "ease-out" },
    );
  }, []);
  if (question.options.length === 0) return null;
  return (
    <div ref={ref} className="combo-decision" data-task-trail-decision="">
      <p>{question.question}</p>
      <div className="combo-options">
        {question.options.map((option) => {
          const value = option.value ?? option.label;
          return (
            <button
              key={value}
              type="button"
              disabled={input.disabled}
              aria-pressed={input.selectedValues.includes(value)}
              onClick={() => {
                if (timer.current !== null) clearTimeout(timer.current);
                input.onSelect(question.id, value);
                if (!question.multiSelect)
                  timer.current = setTimeout(() => {
                    timer.current = null;
                    advance();
                  }, 200);
              }}
            >
              {images[value] ? <img src={images[value]} alt={option.label} loading="lazy" /> : null}
              <span>{option.label}</span>
              <small>{option.description}</small>
            </button>
          );
        })}
      </div>
      {question.multiSelect ? (
        <button
          className="combo-decision-more"
          type="button"
          disabled={input.disabled || !input.canAdvance}
          onClick={input.onAdvance}
        >
          {uiText("Confirm choice")}
        </button>
      ) : null}
      <button
        className="combo-decision-more ml-3"
        type="button"
        disabled={input.disabled}
        onClick={() => {
          if (timer.current !== null) clearTimeout(timer.current);
          input.onFocus();
        }}
      >
        {uiText("None of these · Add instructions")}
      </button>
    </div>
  );
}
