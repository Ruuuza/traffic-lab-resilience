import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Traffic Lab — Resilience Engineering Simulator",
  description: "Simule picos, DDoS, retry storms e estratégias de resiliência em sistemas distribuídos.",
  openGraph: {
    title: "Traffic Lab — Projete para o pico. Sobreviva ao caos.",
    description: "Laboratório interativo de rate limiting, load balancing, backpressure e resiliência.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Traffic Lab — Resilience Engineering Lab" }],
  },
  twitter: { card: "summary_large_image", title: "Traffic Lab", description: "Projete para o pico. Sobreviva ao caos.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className={geistSans.variable + " " + geistMono.variable}>{children}</body></html>;
}
