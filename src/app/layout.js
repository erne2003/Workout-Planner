import "./globals.css";

export const metadata = {
  title: "APEX — Fitness Dashboard",
  description: "Premium AI-powered fitness tracking dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
