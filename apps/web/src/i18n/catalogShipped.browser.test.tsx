import { GTProvider } from "gt-react";
import { expect, it } from "vite-plus/test";
import { render } from "../../test/render";
import { zhCN } from "./catalog";
import { useUiText } from "./useUiText";
import zh from "./translations/zh.json";

const keys = Object.entries(zhCN).filter(([source, value]) => source !== value);

function Probe({ onResult }: { readonly onResult: (missing: string[]) => void }) {
  const text = useUiText();
  onResult(keys.flatMap(([source]) => (text(source) === source ? [source] : [])));
  return null;
}

// The runtime reads translations/zh.json by hash, not catalog.ts. A catalog entry missing from the
// shipped file renders English in the app while unit tests that read the catalog still pass (C79 C20).
it("ships every Chinese catalog entry in the GT translation file", async () => {
  let missing: string[] = [];
  await using _screen = await render(
    <GTProvider locale="zh" translations={{ zh, en: {} } as never}>
      <Probe onResult={(found) => (missing = found)} />
    </GTProvider>,
    { router: false },
  );
  expect(missing).toEqual([]);
});
