export function PmsPropertySections({
  sections,
}: {
  sections: { title: string; body: string }[];
}) {
  if (sections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No PMS details available.</p>
    );
  }
  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <div key={s.title}>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
            {s.title}
          </p>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {s.body}
          </p>
        </div>
      ))}
    </div>
  );
}
