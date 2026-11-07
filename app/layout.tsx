// Owner: Agent C
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "noSpoilers",
  description: "Inventory tracking and spoilage-aware menu pricing.",
  icons: { icon: "/graphics/icons/plant.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
