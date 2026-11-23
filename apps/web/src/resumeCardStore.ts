import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as Schema from "effect/Schema";
import { ScopedThreadRef } from "@t3tools/contracts";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ResumeRequest } from "./resumeCard";

interface ResumeCardState {
  selected: Record<string, ResumeRequest>;
  hidden: Record<string, string>;
  hiddenUntil: Record<string, number>;
  open: (request: ResumeRequest) => void;
  restore: (request: ResumeRequest) => void;
  hide: (request: ResumeRequest, until?: number) => void;
}
const ResumeSaved = Schema.Struct({
  selected: Schema.Record(
    Schema.String,
    Schema.Struct({
      key: Schema.String,
      token: Schema.String,
      ref: ScopedThreadRef,
      title: Schema.String,
      reason: Schema.String,
      attention: Schema.optionalKey(Schema.String),
      boardFolder: Schema.optionalKey(Schema.String),
    }),
  ),
  hidden: Schema.Record(Schema.String, Schema.String),
  hiddenUntil: Schema.Record(Schema.String, Schema.Number),
});
const decodeResumeSaved = Schema.decodeUnknownOption(ResumeSaved);
export const useResumeCardStore = create<ResumeCardState>()(
  persist(
    (set) => ({
      selected: {},
      hidden: {},
      hiddenUntil: {},
      open: (request) =>
        set((state) => ({
          selected: { ...state.selected, [scopedThreadKey(request.ref)]: request },
        })),
      restore: (request) =>
        set((state) => {
          if (state.hidden[request.key] !== request.token) return state;
          const current = state.selected[scopedThreadKey(request.ref)];
          if (current && current.token !== request.token) return state;
          const hidden = { ...state.hidden };
          const hiddenUntil = { ...state.hiddenUntil };
          delete hidden[request.key];
          delete hiddenUntil[request.key];
          return {
            hidden,
            hiddenUntil,
            selected: { ...state.selected, [scopedThreadKey(request.ref)]: request },
          };
        }),
      hide: (request, until) =>
        set((state) => {
          const key = scopedThreadKey(request.ref);
          const current = state.selected[key];
          const selected = { ...state.selected };
          if (!current || current.token === request.token) {
            if (until === undefined) delete selected[key];
            else selected[key] = request;
          }
          const hiddenUntil = { ...state.hiddenUntil };
          if (until === undefined) delete hiddenUntil[request.key];
          else hiddenUntil[request.key] = until;
          return {
            selected,
            hiddenUntil,
            hidden: { ...state.hidden, [request.key]: request.token },
          };
        }),
    }),
    {
      name: "t3code:resume-attention:v1",
      storage: createJSONStorage(() => {
        if (!globalThis.localStorage) throw new Error("Local storage unavailable");
        return globalThis.localStorage;
      }),
      partialize: ({ selected, hidden, hiddenUntil }) => ({ selected, hidden, hiddenUntil }),
      merge: (saved, current) => {
        const decoded = decodeResumeSaved(saved);
        return decoded._tag === "Some" ? { ...current, ...decoded.value } : current;
      },
    },
  ),
);
if (typeof window !== "undefined")
  window.addEventListener("storage", (event) => {
    if (event.key === "t3code:resume-attention:v1" || event.key === null)
      void useResumeCardStore.persist.rehydrate();
  });
