import { isProviderTextGenerationCapable } from "@t3tools/contracts";
import { welcomeAgentState } from "~/onboarding/welcomePage.logic";
import { useEnvironmentProviders, usePrimaryEnvironment } from "~/state/environments";

export function useSidebarSuggestionModels() {
  const environment = usePrimaryEnvironment();
  const byEnvironment = useEnvironmentProviders();
  const environmentId = environment?.environmentId ?? null;
  const models = (environmentId === null ? [] : (byEnvironment.get(environmentId) ?? []))
    .filter(
      (provider) =>
        isProviderTextGenerationCapable(provider) &&
        welcomeAgentState(provider, environment?.serverConfig?.settings) === "ready",
    )
    .flatMap((provider) =>
      provider.models
        .filter((model) => model.supportsTextGeneration !== false && !model.isLegacy)
        .map((model) => ({
          selection: { instanceId: provider.instanceId, model: model.slug },
          key: JSON.stringify([provider.instanceId, model.slug]),
          label: `${provider.displayName?.trim() || provider.driver} · ${model.name}`,
        })),
    );
  return { environmentId, models };
}
