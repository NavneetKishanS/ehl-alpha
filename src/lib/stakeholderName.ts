// Stakeholder names are stored as "Mara Voss — R&D". Display the
// person and the role separately instead of the raw dashed string.
export function splitStakeholderName(name: string): { person: string; role: string | null } {
  const [person, ...rest] = name.split(/\s+[—–-]\s+/);
  return { person: person.trim(), role: rest.length ? rest.join(" ").trim() : null };
}

const EXPERTISE_LABEL: Record<string, string> = {
  research_development: "R&D",
  manufacturing: "Manufacturing",
  controlling: "Controlling",
  procurement: "Procurement",
  brand: "Brand",
};

export function expertiseLabel(expertise: string): string {
  return EXPERTISE_LABEL[expertise] ?? expertise.replace(/_/g, " ");
}
