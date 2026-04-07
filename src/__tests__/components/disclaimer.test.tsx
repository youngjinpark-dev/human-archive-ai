import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Disclaimer from "@/components/disclaimer";
import { DISCLAIMER_TEXT } from "@/lib/store-constants";

describe("Disclaimer component", () => {
  it("renders default disclaimer text", () => {
    render(<Disclaimer />);
    expect(screen.getByText(DISCLAIMER_TEXT)).toBeInTheDocument();
  });

  it("renders custom disclaimer text", () => {
    const customText = "이것은 테스트 면책 조항입니다.";
    render(<Disclaimer text={customText} />);
    expect(screen.getByText(customText)).toBeInTheDocument();
  });

  it("renders warning icon", () => {
    render(<Disclaimer />);
    expect(screen.getByText("⚠️")).toBeInTheDocument();
  });

  it("has amber styling", () => {
    const { container } = render(<Disclaimer />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("bg-amber-50");
    expect(wrapper?.className).toContain("border-amber-200");
  });
});
