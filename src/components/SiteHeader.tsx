"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { BmwLogo } from "@/components/BmwLogo";
import { HelpTutorial } from "@/components/HelpTutorial";

type Tab = "vehicles" | "workflow" | "evidence" | "spec" | "about";

const LAST_WORKFLOW_KEY = "ehl:lastWorkflow";
const NO_WORKFLOW_HREF = "/#components";

// Shared top nav for the light-themed pages. Pages inside a workflow pass
// `workflowHref`; it's remembered so the Workflow tab on other pages leads
// back to the last workflow opened (or to the component list if none yet).
export function SiteHeader({ active, workflowHref }: { active: Tab; workflowHref?: string }) {
  const [lastWorkflow, setLastWorkflow] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    try {
      if (workflowHref) localStorage.setItem(LAST_WORKFLOW_KEY, workflowHref);
      else setLastWorkflow(localStorage.getItem(LAST_WORKFLOW_KEY));
    } catch {
      // Storage blocked (private mode etc.): fall back to the component list.
    }
  }, [workflowHref]);

  const tabs: { key: Tab; href: string; label: string }[] = [
    { key: "vehicles", href: "/", label: "Vehicles" },
    { key: "workflow", href: workflowHref ?? lastWorkflow ?? NO_WORKFLOW_HREF, label: "Workflow" },
    { key: "evidence", href: "/evidence", label: "Evidence Explorer" },
    { key: "spec", href: "/spec", label: "Specification" },
    { key: "about", href: "/about", label: "About" },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <BmwLogo size={36} />
            <span className="hidden h-6 w-px bg-neutral-300 sm:block" />
            <span className="hidden text-[15px] font-semibold tracking-tight sm:block">PM Kompass</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={t.href}
                aria-current={active === t.key ? "page" : undefined}
                className={clsx(
                  "hidden border-b-2 px-3 py-5 font-medium md:block",
                  active === t.key ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-600 hover:text-neutral-900",
                )}
              >
                {t.label}
              </Link>
            ))}
            <button
              onClick={() => setHelpOpen(true)}
              aria-label="How to use this app"
              title="How to use this app"
              className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-[13px] font-semibold text-neutral-600 transition-colors hover:border-neutral-900 hover:text-neutral-900"
            >
              ?
            </button>
            <Link
              href="/evidence"
              className="ml-2 bg-bmw-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0653b6] md:hidden"
            >
              Evidence
            </Link>
          </nav>
        </div>
      </header>
      {helpOpen && <HelpTutorial onClose={() => setHelpOpen(false)} />}
    </>
  );
}
