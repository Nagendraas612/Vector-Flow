"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

// The sign-in page has no site header or footer (Linear, Vercel and
// GitHub all drop the header on their sign-in pages): the sign-in
// card already carries the logo, and a header there would show a
// Sign in button pointing at the page you are already on. This
// wrapper is a client component so the layout itself can stay a
// server component and keep reading the session there.
export default function SiteChrome({ initialUser, children }) {
  const pathname = usePathname();
  const bare = pathname === "/signin" || pathname.startsWith("/signin/");
  if (bare) {
    return (
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    );
  }
  return (
    <>
      <Header initialUser={initialUser} />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </>
  );
}
