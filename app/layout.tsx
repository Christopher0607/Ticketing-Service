import type { Metadata } from "next";
import { Footer, Header } from "./ui";
import { paymentMode } from "@/lib/config";
import "./styles.css";

export const metadata: Metadata = {
  title: { default: "Setlist | Malaysia’s live event ticket marketplace", template: "%s | Setlist" },
  description: "Find tickets for concerts, festivals, sports and theatre around Malaysia.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-MY"><body>
    <a className="skip" href="#content">Skip to content</a>
    <Header />
    {paymentMode() === "demo" && <div className="demo-banner">Local demo · Sample events and simulated payments</div>}
    <main id="content">{children}</main>
    <Footer />
  </body></html>;
}
