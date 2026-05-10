import "./globals.css";
import AuthGuard from "../components/AuthGuard";
import { SettingsProvider } from "../contexts/SettingsContext";
import { DataProvider } from "../contexts/DataContext";
import KeepAlive from "../components/KeepAlive";

export const metadata = {
  title: "APEX — Fitness Dashboard",
  description: "Premium AI-powered fitness tracking dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <KeepAlive />
        <SettingsProvider>
          <DataProvider>
            <AuthGuard>{children}</AuthGuard>
          </DataProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}