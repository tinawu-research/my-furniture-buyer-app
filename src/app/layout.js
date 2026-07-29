import { Baloo_2, Nunito } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import Navbar from "@/components/Navbar";

// Baloo 2 (bubbly, rounded) for headings/buttons and Nunito for body copy —
// the cute-but-readable pairing behind the pink/black Kuromi theme.
const baloo = Baloo_2({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const nunito = Nunito({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata = {
  title: "Furniture Buyer 🖤🎀",
  description: "Browse furniture and place orders against your budget",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${baloo.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
