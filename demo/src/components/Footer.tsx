import { Logo } from "./ui/Logo";

const columns = [
  { title: "Product", links: ["Invoices", "Recurring", "Payments", "Reports", "Pricing"] },
  { title: "Company", links: ["About", "Customers", "Careers", "Contact"] },
  { title: "Resources", links: ["Help center", "Guides", "Changelog", "Status"] },
  { title: "Legal", links: ["Terms", "Privacy", "Security"] },
];

export function Footer() {
  return (
    <footer id="site-footer" className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.5fr_repeat(4,1fr)]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">Invoicing and payments for studios and agencies.</p>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <h3 className="text-sm font-medium">{column.title}</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {column.links.map((link) => (
                <li key={link}>
                  <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-foreground">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 border-t border-border px-6 py-6 text-xs text-muted-foreground">
        <span>© 2026 Sorrel</span>
        <span>Sorrel is a fictional product: this site is the Agent Hover demo app.</span>
      </div>
    </footer>
  );
}
