import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Button } from "./ui/button";

const field = "mt-1.5 h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20";

/** "Book a demo" form in a native <dialog>. Nothing is sent anywhere. */
export function DemoDialog() {
  const { isDemoDialogOpen, closeDemoDialog, demoPlan, showToast } = useApp();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (isDemoDialogOpen && !dialog.open) dialog.showModal();
    if (!isDemoDialogOpen && dialog.open) dialog.close();
  }, [isDemoDialogOpen]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get("name")?.toString().split(" ")[0];
    closeDemoDialog();
    showToast({ title: `Thanks${name ? `, ${name}` : ""}`, description: "We'll email you within one working day to find a time." });
    event.currentTarget.reset();
  };

  return (
    <dialog
      ref={ref}
      id="demo-dialog"
      aria-labelledby="demo-dialog-title"
      onClose={closeDemoDialog}
      onClick={(e) => e.target === e.currentTarget && closeDemoDialog()}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-card p-0 text-foreground shadow-window backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
    >
      <form onSubmit={submit} className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="demo-dialog-title" className="text-lg font-semibold tracking-tight">Book a demo</h2>
            <p className="mt-1 text-sm text-muted-foreground">A 20-minute call with someone who has run a studio's billing.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={closeDemoDialog} aria-label="Close" className="-mt-1 -mr-2">
            <X className="size-4" />
          </Button>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
            Name
            <input name="name" required autoComplete="name" className={field} />
          </label>
          <label className="block text-sm font-medium">
            Work email
            <input name="email" type="email" required autoComplete="email" className={field} />
          </label>
          <label className="block text-sm font-medium">
            Team size
            <select name="team" defaultValue="2–10" className={field}>
              <option>Just me</option>
              <option>2–10</option>
              <option>11–50</option>
              <option>More than 50</option>
            </select>
          </label>
          <input type="hidden" name="plan" value={demoPlan} />
        </div>

        <Button type="submit" className="mt-6 h-10 w-full">
          Request a demo
        </Button>
      </form>
    </dialog>
  );
}
