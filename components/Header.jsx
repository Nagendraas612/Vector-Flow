"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import BrandLogo from "@/components/BrandLogo";
import { IconMenu, IconClose, IconChevronDown } from "@/components/icons";
import { formatDisplayName, initialsFor } from "@/lib/names";

// Admin redesign: the server layout passes the signed-in user
// (or null) as initialUser, so the first paint already shows the
// right account state. The Header initialises from that prop and
// never blanks the account slot while refreshing: on navigation it
// re-fetches /api/auth/me in the background and only swaps the
// state when the answer arrives, so a slow fetch can never flash
// the wrong links. A failed fetch keeps the last known state; a
// clear non-OK answer (signed out) clears it.
//
// Signed-in account area: the raw Google name used to print in the
// header as plain grey text next to a bare Sign out button. Now the
// desktop header shows an avatar button (initials + cased name);
// tapping it opens a small menu with the name, email and Sign out.
// In the mobile drawer the same account shows as a static block
// under the links instead — the drawer is the menu there, so no
// second dropdown is needed.
export default function Header({ initialUser = null }) {
  const [user, setUser] = useState(initialUser);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const firstFetchSkipped = useRef(true);
  const accountRef = useRef(null);
  const accountButtonRef = useRef(null);

  // P0 (M3): re-fetch the session on every navigation, not just on
  // mount, so the Header cannot show a stale signed-in / signed-out
  // state after a client-side navigation. The first run is skipped:
  // the server already passed the session in initialUser. While a
  // refresh is running, the current user stays on screen.
  useEffect(() => {
    if (firstFetchSkipped.current) {
      firstFetchSkipped.current = false;
      return;
    }
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.ok) setUser(j.data.user);
        else setUser(null);
      })
      .catch(() => {
        // Keep the last known state on a failed fetch: a network
        // blip must not flash the signed-out links.
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Automatically close menu when navigating to another route
  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  // Vercel pattern: the header is transparent at the top of the
  // page and gains its blur + border once the user scrolls. The
  // threshold is 8px so a tiny nudge does not flicker the style.
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Handle escape key and body scroll lock when mobile overlay is active
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && menuOpen) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  // Close the account menu on Escape (returning focus to the avatar
  // button) and on any click outside the menu.
  useEffect(() => {
    if (!accountOpen) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setAccountOpen(false);
        accountButtonRef.current?.focus();
      }
    }
    function handlePointerDown(e) {
      if (accountRef.current && !accountRef.current.contains(e.target)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [accountOpen]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  function navLinkClass(href) {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return `site-nav__link${active ? " is-active" : ""}`;
  }

  return (
    <header className={`site-header${scrolled ? " is-scrolled" : ""}`}>
      <div className="site-header__inner">
        <Link className="site-brand" href="/" aria-label="Vector Flow home" onClick={closeMenu}>
          <BrandLogo className="site-brand__logo" priority />
          <span className="site-brand__copy">
            <strong>Vector Flow</strong>
            <span>VVCE · CSE (AI &amp; ML)</span>
          </span>
        </Link>

        <button
          className="site-menu-toggle"
          type="button"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="site-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <IconClose /> : <IconMenu />}
        </button>

        {/* Semi-transparent navy/slate backdrop: bg-slate-900/60 backdrop-blur-sm */}
        <div
          className={`site-nav-backdrop${menuOpen ? " is-open" : ""}`}
          onClick={closeMenu}
          aria-hidden="true"
        />

        {/* Floating/sliding overlay drawer on mobile */}
        <nav
          className={`site-nav${menuOpen ? " is-open" : ""}`}
          id="site-navigation"
          aria-label="Main navigation"
        >
          {/* Drawer header with brand slate/navy accents and 'X' close button */}
          <div className="site-drawer__header">
            <div className="site-drawer__brand">
              <BrandLogo className="site-drawer__logo" />
              <div className="site-drawer__copy">
                <strong>Vector Flow</strong>
                <span>VVCE · CSE (AI &amp; ML)</span>
              </div>
            </div>
            <button
              className="site-drawer__close"
              type="button"
              aria-label="Close navigation menu"
              onClick={closeMenu}
            >
              <IconClose />
            </button>
          </div>

          <div className="site-nav__links">
            <Link className={navLinkClass("/")} href="/" aria-current={pathname === "/" ? "page" : undefined} onClick={closeMenu}>
              <span>Home</span>
            </Link>
            <Link className={navLinkClass("/gallery")} href="/gallery" aria-current={pathname.startsWith("/gallery") ? "page" : undefined} onClick={closeMenu}>
              <span>Gallery</span>
            </Link>
            <Link className={navLinkClass("/team")} href="/team" aria-current={pathname.startsWith("/team") ? "page" : undefined} onClick={closeMenu}>
              <span>Team</span>
            </Link>
            <Link className={navLinkClass("/participation")} href="/participation" aria-current={pathname.startsWith("/participation") ? "page" : undefined} onClick={closeMenu}>
              <span>Participation</span>
            </Link>
            {user && user.role === "ADMIN" && (
              <Link className={navLinkClass("/admin")} href="/admin" aria-current={pathname.startsWith("/admin") ? "page" : undefined} onClick={closeMenu}>
                <span>Admin</span>
              </Link>
            )}
          </div>

          <div className="site-nav__account">
            {user ? (
              <>
                {/* Desktop: avatar button + dropdown menu. */}
                <div className="site-account site-account--desktop" ref={accountRef}>
                  <button
                    className="site-account__button"
                    type="button"
                    ref={accountButtonRef}
                    aria-haspopup="menu"
                    aria-expanded={accountOpen}
                    aria-label={`Account menu for ${formatDisplayName(user.name)}`}
                    onClick={() => setAccountOpen((open) => !open)}
                  >
                    <span className="site-account__avatar" aria-hidden="true">
                      {initialsFor(user.name)}
                    </span>
                    <span className="site-account__name">{formatDisplayName(user.name)}</span>
                    <IconChevronDown className="site-account__chevron" />
                  </button>
                  {accountOpen && (
                    <div className="site-account__menu" role="menu">
                      <div className="site-account__menu-head">
                        <span className="site-account__avatar" aria-hidden="true">
                          {initialsFor(user.name)}
                        </span>
                        <div className="site-account__menu-identity">
                          <strong>{formatDisplayName(user.name)}</strong>
                          <span>{user.email}</span>
                        </div>
                      </div>
                      <button
                        className="site-account__signout"
                        type="button"
                        role="menuitem"
                        onClick={logout}
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
                {/* Mobile drawer: the same account as a static block
                    under the links, no second dropdown. */}
                <div className="site-account site-account--drawer">
                  <div className="site-account__row">
                    <span className="site-account__avatar" aria-hidden="true">
                      {initialsFor(user.name)}
                    </span>
                    <div className="site-account__identity">
                      <strong>{formatDisplayName(user.name)}</strong>
                      <span>{user.email}</span>
                    </div>
                  </div>
                  <button
                    className="site-account__signout"
                    type="button"
                    onClick={() => {
                      closeMenu();
                      logout();
                    }}
                  >
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <Link
                className="site-nav__signin"
                href="/signin"
                aria-current={pathname.startsWith("/signin") ? "page" : undefined}
                onClick={closeMenu}
              >
                Sign in
              </Link>
            )}
          </div>

          {/* Drawer footer: club contact at the bottom of the drawer,
              so the drawer ends on something useful instead of dead space. */}
          <div className="site-drawer__footer">
            <a href="mailto:vectorflow@vvce.ac.in">vectorflow@vvce.ac.in</a>
          </div>
        </nav>
      </div>
    </header>
  );
}
