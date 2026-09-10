import "./globals.css";

export const metadata = {
    title: "APEX Admin Console",
    description: "APEX fitness app — admin management dashboard",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en" className="h-full">
            <body className="min-h-full">
                {children}
            </body>
        </html>
    );
}