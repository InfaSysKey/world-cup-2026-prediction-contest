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

  it("pinta la pestaña de número cuando se pasa number", () => {
    render(<Cromo number="CROMO 07">contenido</Cromo>);
    expect(screen.getByText("CROMO 07")).toBeDefined();
  });

  it("pinta el badge de estado cuando se pasa status", () => {
    render(<Cromo status="✓ colocado">contenido</Cromo>);
    expect(screen.getByText("✓ colocado")).toBeDefined();
  });

  it("oculta el status en la variante empty (el hueco no tiene estado)", () => {
    render(
      <Cromo variant="empty" status="✓ colocado">
        2-1
      </Cromo>,
    );
    expect(screen.queryByText("✓ colocado")).toBeNull();
  });
});
