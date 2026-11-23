import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WorkbenchMode = "custom" | "full" | "focus";
export const useWorkbenchMode = create<{
  mode: WorkbenchMode;
  resumeMode: "custom" | "full";
  setMode: (mode: WorkbenchMode) => void;
}>()(
  persist(
    (set) => ({
      mode: "custom",
      resumeMode: "custom",
      setMode: (mode) =>
        set((state) => ({ mode, resumeMode: mode === "focus" ? state.resumeMode : mode })),
    }),
    {
      name: "t3code:workbench-mode:v1",
      partialize: ({ mode, resumeMode }) => ({ mode, resumeMode }),
      merge: (stored, current) => {
        const mode = (stored as { mode?: unknown } | null)?.mode;
        const resumeMode = (stored as { resumeMode?: unknown } | null)?.resumeMode;
        return {
          ...current,
          mode: mode === "full" || mode === "focus" ? mode : "custom",
          resumeMode: resumeMode === "full" ? "full" : "custom",
        };
      },
    },
  ),
);
