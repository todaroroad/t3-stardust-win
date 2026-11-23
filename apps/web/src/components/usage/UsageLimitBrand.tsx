import type { ProviderDriverKind } from "@t3tools/contracts";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";

export function UsageLimitBrand({
  driver,
  label,
  large = false,
}: {
  readonly driver: ProviderDriverKind;
  readonly label: string;
  readonly large?: boolean;
}) {
  const size = large ? "size-10" : "size-6";
  return (
    <ProviderInstanceIcon
      driverKind={driver}
      displayName={label}
      className={size}
      iconClassName={size}
    />
  );
}
