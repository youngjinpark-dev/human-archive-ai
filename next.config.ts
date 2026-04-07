import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: "/((?!api|_next).*)",
      headers: [
        {
          key: "Link",
          value: '</.well-known/mcp>; rel="mcp-discovery"; type="application/json"',
        },
      ],
    },
  ],
};

export default nextConfig;
