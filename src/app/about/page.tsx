import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { TeamAvatar } from "@/components/TeamAvatar";

interface Dev {
  slug: string;
  name: string;
  linkedin: string;
  blurb: string;
  color: string;
}

// Photos: drop a file at public/team/<slug>.jpg to replace the initials
// fallback.
const TEAM: Dev[] = [
  {
    slug: "navneet",
    name: "Navneet Kishan Srinivasan",
    linkedin: "https://www.linkedin.com/in/navneet-kishan-s/",
    blurb: "Applied AI/ML @ Siemens Healthineers · MSc Data Science @ FAU · Ex-Quant Dev @ Citibank · AI Researcher & Hackathon Builder",
    color: "#0066B1",
  },
  {
    slug: "raj-bharmal",
    name: "Raj Bharmal",
    linkedin: "https://www.linkedin.com/in/raj-bharmal-595571199/",
    blurb: "M.Sc. Management @ TUM · Werkstudent @ Rohde & Schwarz",
    color: "#1d3d6b",
  },
  {
    slug: "shiv-kadiwala",
    name: "Shiv Kadiwala",
    linkedin: "https://www.linkedin.com/in/shiv-kadiwala/",
    blurb: "Software Engineer @ TU Munich · Departmental Rank 1 (Gold Medalist) · GTU Rank 5",
    color: "#2563eb",
  },
  {
    slug: "mitesh-kumar",
    name: "Mitesh Kumar",
    linkedin: "https://www.linkedin.com/in/mitesh-kumar0707/",
    blurb: "M.Sc. Data Science @ FAU Erlangen-Nürnberg",
    color: "#0f766e",
  },
  {
    slug: "raj-vasani",
    name: "Raj Vasani",
    linkedin: "https://www.linkedin.com/in/raj-vasani-7905bb230/",
    blurb: "M.Sc. CS @ TU Munich · SWE @ Micronova AG · CSEE",
    color: "#7c3aed",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <SiteHeader active="about" />

      <section className="relative overflow-hidden bg-[radial-gradient(120%_120%_at_70%_0%,#ffffff_0%,#eef0f2_50%,#dde1e5_100%)]">
        <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bmw-blue">The team</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">About PM Kompass</h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-neutral-600">
            Built for BMW Group&apos;s &quot;AI for Product Decision Making&quot; hackathon at TUM by a five-person team.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-[1440px] px-4 py-10 sm:px-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TEAM.map((dev) => (
            <a
              key={dev.slug}
              href={dev.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 border border-neutral-200 bg-white p-5 transition-colors hover:border-bmw-blue"
            >
              <TeamAvatar slug={dev.slug} name={dev.name} color={dev.color} size={64} />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold tracking-tight text-neutral-900">{dev.name}</p>
                <p className="mt-1 text-[13px] leading-snug text-neutral-500">{dev.blurb}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-bmw-blue group-hover:underline">
                  LinkedIn ↗
                </span>
              </div>
            </a>
          ))}
        </div>
      </main>

      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-neutral-500 sm:px-8">
          <span>BMW Group · PM Kompass · TUM Hackathon prototype</span>
          <Link href="/" className="hover:text-neutral-900">← Back to vehicle overview</Link>
        </div>
      </footer>
    </div>
  );
}
