import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Group Outing Planner",
  description: "Pick one place a whole friend group will enjoy, using Qloo's taste graph.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
