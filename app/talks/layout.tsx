import RouteGuard from "@/components/RouteGuard";

export default function TalksRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RouteGuard category="talks">{children}</RouteGuard>;
}
