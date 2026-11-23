import { createFileRoute } from "@tanstack/react-router";
import { StorageTidySettingsPanel } from "../components/storage/StorageTidyPage";

export const Route = createFileRoute("/_chat/settings/storage")({
  component: StorageTidySettingsPanel,
});
