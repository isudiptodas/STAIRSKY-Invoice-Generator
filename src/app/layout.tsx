import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stair Sky Invoice Generator",
  description: "An invoice generator for Stair Sky company",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
