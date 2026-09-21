import type { Locator, Page } from "@playwright/test";

/**
 * Picks an entry in a Combobox field (components/ui/combobox.tsx): the
 * visible control is a text input with role "combobox" whose list opens on
 * focus, and choosing an option happens on mousedown.
 *
 * With `text`, it is typed first and the option whose name contains it is
 * picked; without, the first option is. The pickers this drives (owner,
 * client, pet) used to be plain <select>s, which is why the specs once
 * called `selectOption` here.
 */
export async function pickOption(page: Page, field: Locator, text?: string) {
  await field.click();
  if (text) await field.fill(text);
  const options = page.getByRole("option");
  const option = text
    ? options.filter({ hasText: new RegExp(escapeRegExp(text), "i") }).first()
    : options.first();
  await option.click();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
