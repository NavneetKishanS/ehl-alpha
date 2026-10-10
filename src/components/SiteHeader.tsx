"use client";

import Link from "next/link";
import clsx from "clsx";
import { BmwLogo } from "@/components/BmwLogo";

// Shared top nav for the light-themed pages (landing, workflow). Pulled out
// once two pages needed the identical header instead of copy-pasting it.
export function SiteHeader({ active }: { active: "vehicles" | "evidence" }) {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <BmwLogo size={36} />
          <span className="hidden h-6 w-px bg-neutral-300 sm:block" />
          <span className="hidden text-[15px] font-semibold tracking-tight sm:block">Requirements Copilot</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/"
            className={clsx(
              "hidden px-3 py-5 font-medium md:block",
              active === "vehicles" ? "border-b-2 border-neutral-900 text-neutral-900" : "text-neutral-600 hover:text-neutral-900",
            )}
          >
            Vehicles
          </Link>
          <Link
            href="/evidence"
            className={clsx(
              "hidden px-3 py-5 font-medium md:block",
              active === "evidence" ? "border-b-2 border-neutral-900 text-neutral-900" : "text-neutral-600 hover:text-neutral-900",
            )}
          >
            Evidence Explorer
          </Link>
          <Link
            href="/evidence"
            className="ml-2 bg-bmw-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0653b6] md:hidden"
          >
            Evidence
          </Link>
        </nav>
      </div>
    </header>
  );
}
