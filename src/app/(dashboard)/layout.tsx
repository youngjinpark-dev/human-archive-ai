import Nav from "@/components/nav";

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {children}
      </div>
    </>
  );
}
