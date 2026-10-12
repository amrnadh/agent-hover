export function Testimonial() {
  return (
    <section id="customers" className="border-y border-border bg-surface py-24">
      <figure className="mx-auto max-w-3xl px-6 text-center">
        <blockquote className="text-2xl leading-snug font-medium tracking-[-0.02em] text-balance sm:text-[1.75rem]">
          “We used to spend Friday afternoons chasing invoices. Now the reminders go out on their own, and clients pay
          about a week sooner.”
        </blockquote>
        <figcaption className="mt-8 flex items-center justify-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">PN</span>
          <span className="text-left text-sm leading-tight">
            <span className="block font-medium">Priya Nair</span>
            <span className="text-muted-foreground">Operations lead, Alder & Finch</span>
          </span>
        </figcaption>
      </figure>
    </section>
  );
}
