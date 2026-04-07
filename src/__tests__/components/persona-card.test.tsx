import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PersonaCard from "@/components/persona-card";
import type { Persona } from "@/types";

function makePersona(overrides: Partial<Persona> = {}): Persona {
  return {
    id: "p-1",
    user_id: "u-1",
    name: "김전문가",
    domain: null,
    description: null,
    style: null,
    principles: [],
    decision_scenarios: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("PersonaCard component", () => {
  it("renders persona name", () => {
    render(<PersonaCard persona={makePersona()} />);
    expect(screen.getByText("김전문가")).toBeInTheDocument();
  });

  it("renders domain badge when provided", () => {
    render(<PersonaCard persona={makePersona({ domain: "백엔드 개발" })} />);
    expect(screen.getByText("백엔드 개발")).toBeInTheDocument();
  });

  it("hides domain badge when null", () => {
    render(<PersonaCard persona={makePersona({ domain: null })} />);
    expect(screen.queryByText(/백엔드/)).not.toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(
      <PersonaCard persona={makePersona({ description: "10년차 개발자입니다" })} />
    );
    expect(screen.getByText("10년차 개발자입니다")).toBeInTheDocument();
  });

  it("renders principles count", () => {
    render(
      <PersonaCard
        persona={makePersona({ principles: ["원칙1", "원칙2", "원칙3"] })}
      />
    );
    expect(screen.getByText("원칙 3개")).toBeInTheDocument();
  });

  it("renders scenario count", () => {
    render(
      <PersonaCard
        persona={makePersona({
          decision_scenarios: [
            { situation: "s1", decision: "d1" },
            { situation: "s2", decision: "d2" },
          ],
        })}
      />
    );
    expect(screen.getByText("시나리오 2개")).toBeInTheDocument();
  });

  it("shows 0 for empty principles and scenarios", () => {
    render(<PersonaCard persona={makePersona()} />);
    expect(screen.getByText("원칙 0개")).toBeInTheDocument();
    expect(screen.getByText("시나리오 0개")).toBeInTheDocument();
  });

  it("links to persona detail page", () => {
    render(<PersonaCard persona={makePersona({ id: "persona-abc" })} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/personas/persona-abc");
  });
});
