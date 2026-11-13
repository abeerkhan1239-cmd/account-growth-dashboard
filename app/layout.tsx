import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hallo Nabo · Account Growth",
  description: "What to sell next, when to call, and who might churn — from webCRM.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            <span className="dot" /> Hallo Nabo <span className="muted">· Account Growth</span>
          </Link>
          <nav>
            <Link href="/">Accounts</Link>
            <Link href="/feedback">Feedback</Link>
          </nav>
        </header>
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
