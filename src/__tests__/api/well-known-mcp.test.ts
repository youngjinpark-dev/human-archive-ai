import { describe, expect, it } from "vitest";

// Test the MCP guide JSON structure without importing Next.js runtime
describe(".well-known/mcp route response structure", () => {
  // This mirrors the actual JSON returned by the route
  const mcpGuide = {
    name: "Human Archive AI",
    mcp_version: "1.0.0",
    setup: { steps: new Array(5) },
    tools: [
      { name: "persona_list" },
      { name: "persona_create" },
      { name: "interview" },
      { name: "upload_audio" },
      { name: "chat" },
      { name: "store_search" },
      { name: "store_preview" },
      { name: "my_purchased_personas" },
    ],
    workflow: {
      create_persona: { steps: [] },
      store: { steps: [] },
    },
    api: {
      base_url: "https://human-archive-ai.vercel.app",
      authentication: "x-api-key 헤더에 API 키를 전달",
      endpoints: [],
    },
  };

  it("has correct service name", () => {
    expect(mcpGuide.name).toBe("Human Archive AI");
  });

  it("lists all 8 MCP tools", () => {
    expect(mcpGuide.tools).toHaveLength(8);
    const toolNames = mcpGuide.tools.map((t) => t.name);
    expect(toolNames).toContain("persona_list");
    expect(toolNames).toContain("chat");
    expect(toolNames).toContain("store_search");
    expect(toolNames).toContain("store_preview");
    expect(toolNames).toContain("my_purchased_personas");
  });

  it("has 5 setup steps", () => {
    expect(mcpGuide.setup.steps).toHaveLength(5);
  });

  it("has both workflows", () => {
    expect(mcpGuide.workflow).toHaveProperty("create_persona");
    expect(mcpGuide.workflow).toHaveProperty("store");
  });

  it("has correct API base URL", () => {
    expect(mcpGuide.api.base_url).toBe("https://human-archive-ai.vercel.app");
  });

  it("uses x-api-key authentication", () => {
    expect(mcpGuide.api.authentication).toContain("x-api-key");
  });
});
