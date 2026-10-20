// Bloque con título en versalitas. Agrupa una parte de la hoja.
export function SheetSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const id = `section-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="grid gap-2">
      <h2 id={id} className="font-heading text-lg font-bold text-primary">
        {title}
      </h2>
      {children}
    </section>
  );
}
