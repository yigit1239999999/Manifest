// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Callout } from "@/components/ui/callout";

describe("Callout", () => {
  it("renders its message", () => {
    render(<Callout variant="warning">Isırır</Callout>);
    expect(screen.getByText("Isırır")).toBeInTheDocument();
  });

  it("renders an optional title alongside the message", () => {
    render(
      <Callout variant="warning" title="Uyarılar">
        Isırır, alerjik
      </Callout>,
    );
    expect(screen.getByText("Uyarılar")).toBeInTheDocument();
    expect(screen.getByText("Isırır, alerjik")).toBeInTheDocument();
  });

  it("omits the title element entirely when no title is given", () => {
    const { container } = render(<Callout variant="danger">Hata</Callout>);
    expect(container.querySelector("p")).toBeNull();
  });

  describe("live region", () => {
    // The distinction that matters: a form error appears after a submit and
    // must be announced; a standing warning is already on screen at first
    // paint and has nothing to announce.
    it("announces danger callouts by default", () => {
      render(<Callout variant="danger">Form gönderilemedi</Callout>);
      expect(screen.getByRole("alert")).toHaveTextContent("Form gönderilemedi");
    });

    it("does not announce warning callouts by default", () => {
      render(<Callout variant="warning">Isırır</Callout>);
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("lets a caller announce a warning that appears dynamically", () => {
      render(
        <Callout variant="warning" live>
          Isırır
        </Callout>,
      );
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("lets a caller silence a danger callout that is present on load", () => {
      render(
        <Callout variant="danger" live={false}>
          Hata
        </Callout>,
      );
      expect(screen.queryByRole("alert")).toBeNull();
    });

    // A box that reads as a warning to anyone looking at it and as an
    // unnamed `div` to anyone not. pm found it on the reminder banner --
    // "message sending has stopped" was undiscoverable without reading
    // the whole page -- and every standing notice had the same hole: an
    // archived client, a deceased animal, "bites".
    //
    // `status`, not `alert`: these are conditions, not events, and
    // assertive would interrupt. Neither announces on first paint, so
    // this buys a name in the accessibility tree rather than noise.
    it("still names a notice that is not announcing", () => {
      render(<Callout variant="warning">Isırır</Callout>);
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("gives a silenced danger callout a status role, not nothing", () => {
      render(
        <Callout variant="danger" live={false}>
          Hata
        </Callout>,
      );
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    // The third case, and there is exactly one of it. `ActionForm` moves
    // focus to its error box; a focused live region is read twice, so the
    // focus is the announcement and the role would be the second copy.
    // Without this the change above would have quietly reintroduced the
    // double reading that `live={false}` was added to stop.
    it("leaves the role off entirely when the caller takes focus instead", () => {
      render(
        <Callout variant="danger" live="none" tabIndex={-1}>
          Hata
        </Callout>,
      );
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("never sets aria-live next to role=alert", () => {
      // role="alert" already implies an assertive live region; declaring both
      // double-announces in some screen reader and browser pairings.
      render(<Callout variant="danger">Hata</Callout>);
      expect(screen.getByRole("alert")).not.toHaveAttribute("aria-live");
    });
  });

  describe("icon", () => {
    it("marks the icon decorative so it is not read before every message", () => {
      const { container } = render(<Callout variant="warning">Isırır</Callout>);
      const icon = container.querySelector("svg");
      expect(icon).not.toBeNull();
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });

    it("gives each variant its own fixed mark", () => {
      // Same meaning, same mark, on every screen — the caller cannot choose.
      const danger = render(<Callout variant="danger">x</Callout>);
      const warning = render(<Callout variant="warning">y</Callout>);
      const classOf = (r: ReturnType<typeof render>) =>
        r.container.querySelector("svg")?.getAttribute("class");
      expect(classOf(danger)).not.toEqual(classOf(warning));
    });
  });

  it("paints each variant from its own role token, never a raw palette colour", () => {
    const { container: danger } = render(<Callout variant="danger">x</Callout>);
    const { container: warning } = render(<Callout variant="warning">y</Callout>);
    const { container: info } = render(<Callout variant="info">z</Callout>);
    const classes = (c: HTMLElement) => c.firstElementChild!.className;

    expect(classes(danger)).toContain("text-destructive");
    expect(classes(warning)).toContain("text-warning");
    // The whole point of the token: no `amber-700` that dark mode cannot reach.
    for (const c of [classes(danger), classes(warning), classes(info)]) {
      expect(c).not.toMatch(/(text|bg|border)-(amber|red|yellow)-\d/);
    }
  });

  describe("info", () => {
    it("reports an absence without borrowing a severity colour", () => {
      // "The channel you picked is not connected yet" is not a fault. If it
      // were painted destructive or warning it would sit in the same visual
      // class as a failed send, and a palette where everything is loud says
      // nothing.
      const { container } = render(<Callout variant="info">x</Callout>);
      const classes = container.firstElementChild!.className;
      expect(classes).toContain("text-muted-foreground");
      expect(classes).not.toContain("text-destructive");
      expect(classes).not.toContain("text-warning");
    });

    it("does not announce by default, and can be asked to", () => {
      // Standing notice on first paint: nothing to announce. But the
      // notification settings box appears only after the main switch is
      // turned on, which is a change worth speaking.
      render(<Callout variant="info">Kanal bağlı değil</Callout>);
      expect(screen.queryByRole("alert")).toBeNull();

      render(
        <Callout variant="info" live>
          Kanal bağlı değil
        </Callout>,
      );
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("carries its own mark, not another variant's", () => {
      const classOf = (v: "danger" | "warning" | "info") =>
        render(<Callout variant={v}>x</Callout>)
          .container.querySelector("svg")
          ?.getAttribute("class");
      const marks = [classOf("danger"), classOf("warning"), classOf("info")];
      expect(new Set(marks).size).toBe(3);
    });
  });

  it("keeps caller classes so a call site can hold its grid position", () => {
    // `reminder-form.tsx` needs `sm:col-span-2` on the box itself.
    const { container } = render(
      <Callout variant="danger" className="sm:col-span-2">
        x
      </Callout>,
    );
    expect(container.firstElementChild!.className).toContain("sm:col-span-2");
  });

  describe("long content", () => {
    // TEAM.md #32: a component is not finished until it has met the longest
    // translation. `Pet.alerts` is free text an owner types, so the longest
    // string here is not a translation at all — it is whatever the clinic
    // wrote, up to the 500 characters the schema allows.
    const longest =
      "Bu hayvan muayene sırasında ısırma eğilimi göstermektedir, " +
      "penisilin grubu antibiyotiklere karşı alerjisi bulunmaktadır ve " +
      "kalp yetmezliği nedeniyle sedasyon öncesinde mutlaka kardiyoloji " +
      "konsültasyonu yapılması gerekmektedir.";

    it("renders the whole message rather than truncating it", () => {
      render(<Callout variant="warning">{longest}</Callout>);
      expect(screen.getByText(longest)).toBeInTheDocument();
    });

    it("can wrap an unbroken string instead of widening its column", () => {
      // A microchip id or a URL pasted into a free-text field has no spaces.
      const { container } = render(
        <Callout variant="warning">{"A".repeat(200)}</Callout>,
      );
      const body = container.querySelector(".break-words");
      expect(body).not.toBeNull();
      // The flex child must be allowed to shrink below its content width,
      // otherwise `break-words` never gets the chance to act.
      expect(container.querySelectorAll(".min-w-0").length).toBeGreaterThan(0);
    });

    it("keeps the icon from shrinking when the message is long", () => {
      const { container } = render(<Callout variant="warning">{longest}</Callout>);
      expect(container.querySelector("svg")).toHaveClass("shrink-0");
    });
  });

  it("uses logical direction utilities only", () => {
    // TEAM.md #31: new code stays direction-agnostic. Cheap to hold now,
    // expensive to retrofit. `px-*`/`py-*` are logical in Tailwind v4.
    const { container } = render(
      <Callout variant="warning" title="Uyarılar">
        Isırır
      </Callout>,
    );
    const classes = [...container.querySelectorAll("*")]
      .flatMap((el) => el.getAttribute("class")?.split(/\s+/) ?? []);
    const physical = classes.filter((c) =>
      /^-?(ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|text-(left|right))(-|$)/.test(c),
    );
    expect(physical).toEqual([]);
  });
});
