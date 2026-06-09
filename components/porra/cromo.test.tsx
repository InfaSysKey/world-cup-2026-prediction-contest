// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Cromo } from "./cromo";

afterEach(cleanup);

describe("Cromo", () => {
  it("renderiza children en la variante normal", () => {
    render(<Cromo>CARLOS</Cromo>);
    expect(screen.getByText("CARLOS")).toBeDefined();
  });

  it("muestra el '?' del hueco cuando la variante empty no tiene children", () => {
    const { container } = render(<Cromo variant="empty" />);
    expect(container.textContent).toContain("?");
    expect(container.firstElementChild?.getAttribute("data-variant")).toBe(
      "empty",
    );
  });

  it("deja que children sustituyan al '?' en un hueco con contenido", () => {
    render(<Cromo variant="empty">2-1</Cromo>);
    expect(screen.getByText("2-1")).toBeDefined();
    expect(screen.queryByText("?")).toBeNull();
  });

  it("aplica la clase foil en la variante foil", () => {
    const { container } = render(<Cromo variant="foil">#1</Cromo>);
    expect(container.firstElementChild?.className).toContain("cromo-foil");
  });
});
