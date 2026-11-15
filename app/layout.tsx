import type { Metadata } from "next";
import Link from "next/link";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], variable: "--font-poppins", display: "swap" });

export const metadata: Metadata = {
  title: "Account Growth · ISA Media Group",
  description: "What to sell next, when to call, and who might churn — from webCRM.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={poppins.variable}>
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            <img src="/isa-logo-white.svg" alt="ISA Media Group" />
            <span className="divider" />
            <span className="product">Account Growth <span>· Print &amp; Digital</span></span>
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
