// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";

// A badge always sits beside the thing it qualifies, and nothing in the
// markup separates them: `<Link>Ayşe Yılmaz</Link><Badge>1 hayvan</Badge>`.
// The gap a sighted reader sees comes from `ms-2`, which the accessible
// name computation knows nothing about — it concatenates text. So the row
// was announced as "Ayşe Yılmaz1 hayvanArşivlendi".
//
// pm heard three of these on one 390px tour, on three screens, and they
// have one cause. Fixed in the one place, held here (TEAM.md #4, #26).
describe("a badge does not run into the words before it", () => {
  it("separates its text from the text beside it", () => {
    render(
      <p data-testid="row">
        <span>Ayşe Yılmaz</span>
        <Badge>1 hayvan</Badge>
      </p>,
    );

    // Two words, not one: this is the whole defect.
    expect(screen.getByTestId("row").textContent).toBe("Ayşe Yılmaz 1 hayvan");
  });

  it("separates two badges from each other", () => {
    // `/appointments/[id]` puts the visit type and the status side by side,
    // and `/clients` puts a count next to an archive mark.
    render(
      <p data-testid="row">
        <Badge>Aşı</Badge>
        <Badge>Planlandı</Badge>
      </p>,
    );

    expect(screen.getByTestId("row").textContent).toBe(" Aşı Planlandı");
  });

  it("separates a status badge too, which is the same span underneath", () => {
    render(
      <p data-testid="row">
        <span>SMS</span>
        <StatusBadge kind="staff" status="inactive" label="Bağlı değil" />
      </p>,
    );

    expect(screen.getByTestId("row").textContent).toBe("SMS Bağlı değil");
  });

  it("costs nothing on screen, because flex does not render it", () => {
    // Not `sr-only` and not `&nbsp;`: a whitespace-only run between flex
    // items is not rendered at all, by the flexbox spec. So the separator
    // is a real text node for the accessibility tree and no box for the
    // layout — which is why there is no extra element here to find.
    const { container } = render(<Badge>1 hayvan</Badge>);
    const badge = container.firstElementChild!;

    expect(badge.className).toContain("inline-flex");
    expect(badge.querySelector(".sr-only")).toBeNull();
    expect(badge.childElementCount).toBe(0);
  });
});
