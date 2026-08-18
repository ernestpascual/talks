import RouteGuard from "@/components/RouteGuard";

export default function ExperienceRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RouteGuard category="experience">{children}</RouteGuard>;
}
