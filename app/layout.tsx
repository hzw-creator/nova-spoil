// Owner: Agent C
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Spoil Pricing — DoorDash x Nova",
  description: "Sell it before it spoils.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
