import { Google_Sans } from "next/font/google";
import "./globals.css";

const googleSans = Google_Sans({
  variable: "--font-google-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "brighsteps",
  description:
    "Bring parents closer with daily updates, safer check‑ins, and effortless billing",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${googleSans.className} ${googleSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
