"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { label: "Demo", href: "/" },
  { label: "App", href: "/app" },
  { label: "FAQ", href: "/faq" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Site navigation" className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div aria-hidden="true" className="h-7 w-7 rounded-md bg-[#9146FF]" />
          <span className="font-bold text-zinc-100">TwitchTok</span>
        </Link>
        <div className="flex gap-6">
          {NAV_LINKS.map(({ label, href }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`text-sm transition-colors ${
                  isActive
                    ? "border-b-2 border-[#9146FF] pb-0.5 font-semibold text-[#9146FF]"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
