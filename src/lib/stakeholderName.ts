// Stakeholder names are stored as "Mara Voss — Engineering". Display the
// person and the role separately instead of the raw dashed string.
export function splitStakeholderName(name: string): { person: string; role: string | null } {
  const [person, ...rest] = name.split(/\s+[—–-]\s+/);
  return { person: person.trim(), role: rest.length ? rest.join(" ").trim() : null };
}
