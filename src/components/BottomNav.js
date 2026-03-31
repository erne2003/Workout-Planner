"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Home",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M3 9.5L11 3l8 6.5V19a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke={active ? "#0A84FF" : "rgba(255,255,255,0.35)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 20v-8h6v8" stroke={active ? "#0A84FF" : "rgba(255,255,255,0.35)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/workout",
    label: "Workout",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M3 11h2m12 0h2M5 11l2-4 4 8 4-8 2 4" stroke={active ? "#0A84FF" : "rgba(255,255,255,0.35)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/recovery",
    label: "Recovery",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M11 3C7.686 3 5 5.686 5 9c0 4 6 10 6 10s6-6 6-10c0-3.314-2.686-6-6-6z" stroke={active ? "#0A84FF" : "rgba(255,255,255,0.35)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="11" cy="9" r="2" stroke={active ? "#0A84FF" : "rgba(255,255,255,0.35)"} strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    href: "/strength",
    label: "Strength",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="2" y="9" width="3" height="4" rx="1" stroke={active ? "#0A84FF" : "rgba(255,255,255,0.35)"} strokeWidth="1.8" />
        <rect x="17" y="9" width="3" height="4" rx="1" stroke={active ? "#0A84FF" : "rgba(255,255,255,0.35)"} strokeWidth="1.8" />
        <rect x="6" y="7" width="3" height="8" rx="1" stroke={active ? "#0A84FF" : "rgba(255,255,255,0.35)"} strokeWidth="1.8" />
        <rect x="13" y="7" width="3" height="8" rx="1" stroke={active ? "#0A84FF" : "rgba(255,255,255,0.35)"} strokeWidth="1.8" />
        <line x1="9" y1="11" x2="13" y2="11" stroke={active ? "#0A84FF" : "rgba(255,255,255,0.35)"} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/progress",
    label: "Progress",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <polyline points="3,16 7,10 11,13 15,7 19,4" stroke={active ? "#0A84FF" : "rgba(255,255,255,0.35)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <line x1="3" y1="19" x2="19" y2="19" stroke={active ? "#0A84FF" : "rgba(255,255,255,0.35)"} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  // Don't render nav on login page
  if (pathname === "/login") return null;

  const logout = () => {
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    router.replace("/login");
  };

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: "430px",
        background: "rgba(7,7,15,0.88)",
        backdropFilter: "blur(32px)",
        WebkitBackdropFilter: "blur(32px)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        padding: "10px 12px 28px",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        zIndex: 100,
      }}
    >
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              padding: "8px 12px",
              borderRadius: "14px",
              background: active ? "rgba(10,132,255,0.12)" : "transparent",
              textDecoration: "none",
              transition: "background 0.2s",
            }}
          >
            <div style={{ width: 22, height: 22 }}>{icon(active)}</div>
            <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", fontFamily: "var(--font-body)", color: active ? "#0A84FF" : "rgba(255,255,255,0.3)", transition: "color 0.2s" }}>
              {label}
            </span>
          </Link>
        );
      })}

      {/* Logout */}
      <button
        onClick={logout}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "4px",
          padding: "8px 12px",
          borderRadius: "14px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M9 3H5a1 1 0 00-1 1v14a1 1 0 001 1h4" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M15 15l4-4-4-4" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="19" y1="11" x2="9" y2="11" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.3)" }}>
          Out
        </span>
      </button>
    </nav>
  );
}