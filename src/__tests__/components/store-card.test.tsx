import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import StoreCard from "@/components/store-card";
import type { StoreListing } from "@/components/store-card";

function makeListing(overrides: Partial<StoreListing> = {}): StoreListing {
  return {
    id: "listing-1",
    persona_id: "p-1",
    seller_id: "s-1",
    seller_name: "김판매자",
    persona_name: "AI 전문가",
    title: "테스트 페르소나",
    subtitle: null,
    description: "테스트 설명입니다",
    category: "technology",
    tags: [],
    price: 10000,
    view_count: 100,
    trial_count: 50,
    purchase_count: 10,
    rating_avg: 4.5,
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("StoreCard component", () => {
  it("renders title", () => {
    render(<StoreCard listing={makeListing()} />);
    expect(screen.getByText("테스트 페르소나")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(<StoreCard listing={makeListing({ subtitle: "부제목입니다" })} />);
    expect(screen.getByText("부제목입니다")).toBeInTheDocument();
  });

  it("does not render subtitle when null", () => {
    render(<StoreCard listing={makeListing({ subtitle: null })} />);
    expect(screen.queryByText("부제목입니다")).not.toBeInTheDocument();
  });

  it("renders category badge", () => {
    render(<StoreCard listing={makeListing({ category: "business" })} />);
    expect(screen.getByText("business")).toBeInTheDocument();
  });

  it("renders seller name", () => {
    render(<StoreCard listing={makeListing()} />);
    expect(screen.getByText("by 김판매자")).toBeInTheDocument();
  });

  it("renders view and trial counts", () => {
    render(<StoreCard listing={makeListing()} />);
    expect(screen.getByText("조회 100")).toBeInTheDocument();
    expect(screen.getByText("시식 50")).toBeInTheDocument();
  });

  it("renders rating when provided", () => {
    render(<StoreCard listing={makeListing({ rating_avg: 4.5 })} />);
    expect(screen.getByText("★ 4.5")).toBeInTheDocument();
  });

  it("hides rating when null", () => {
    render(<StoreCard listing={makeListing({ rating_avg: null })} />);
    expect(screen.queryByText(/★/)).not.toBeInTheDocument();
  });

  it("renders 시식하기 button", () => {
    render(<StoreCard listing={makeListing()} />);
    expect(screen.getByText("시식하기")).toBeInTheDocument();
  });

  it("links to store detail page", () => {
    render(<StoreCard listing={makeListing({ id: "listing-abc" })} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/store/listing-abc");
  });
});
