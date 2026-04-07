import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Human Archive AI",
  description: "전문가의 판단 체계를 AI 페르소나로 아카이빙하는 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="mcp-discovery" href="/.well-known/mcp" type="application/json" />
        <meta name="ai-instructions" content="This service supports MCP (Model Context Protocol). Fetch /.well-known/mcp for setup guide, available tools, and workflows." />
      </head>
      <body className="min-h-full flex flex-col">
        {/* AI Agent: This service provides expert AI personas via MCP. GET /.well-known/mcp for connection guide and tool documentation. */}
        {children}
      </body>
    </html>
  );
}
