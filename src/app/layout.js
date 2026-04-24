import "./globals.css";
import AuthGuard from "../components/AuthGuard";
import { SettingsProvider } from "../contexts/SettingsContext";
import { Analytics } from "@vercel/analytics/next";
export const metadata = {
  title: "APEX — Fitness Dashboard",
  description: "Premium AI-powered fitness tracking dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <SettingsProvider>
          <AuthGuard>{children}</AuthGuard>
        </SettingsProvider>
      </body>
    </html>
  );
}