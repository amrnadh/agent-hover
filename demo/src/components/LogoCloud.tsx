// Wordmarks of fictional client studios, set in type rather than images.
const studios = [
  { name: "Alder & Finch", className: "font-semibold uppercase tracking-[0.18em] text-[13px]" },
  { name: "Copperleaf", className: "font-bold lowercase tracking-tight text-lg" },
  { name: "Harbor & Vine", className: "font-serif italic text-xl" },
  { name: "Mill Street", className: "font-medium tracking-tight text-lg" },
  { name: "Studio Kiln", className: "font-mono font-medium uppercase text-sm" },
  { name: "Lumen", className: "font-light uppercase tracking-[0.3em] text-base" },
];

export function LogoCloud() {
  return (
    <section id="logo-cloud" aria-label="Customers" className="mx-auto max-w-6xl px-6 py-16">
      <p className="text-center text-[13px] text-muted-foreground">Studios and agencies that bill with Sorrel</p>
      <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-5 text-muted-foreground">
        {studios.map((studio) => (
          <li key={studio.name} className={studio.className}>
            {studio.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
