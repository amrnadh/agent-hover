// Sample data for the product preview. Every client and amount is made up.

export type InvoiceStatus = "paid" | "open" | "overdue" | "draft";

export interface Invoice {
  number: string;
  client: string;
  issued: string;
  due: string;
  amount: number;
  status: InvoiceStatus;
}

export const invoices: Invoice[] = [
  { number: "INV-0148", client: "Alder & Finch", issued: "Oct 9", due: "Oct 23", amount: 7200, status: "open" },
  { number: "INV-0147", client: "Mill Street Bakery", issued: "Oct 6", due: "Oct 20", amount: 1450, status: "paid" },
  { number: "INV-0146", client: "Copperleaf Films", issued: "Oct 2", due: "Oct 16", amount: 5800, status: "open" },
  { number: "INV-0144", client: "Harbor & Vine", issued: "Sep 23", due: "Oct 7", amount: 2400, status: "overdue" },
  { number: "INV-0143", client: "Lumen Yoga", issued: "Sep 22", due: "Oct 6", amount: 980, status: "paid" },
  { number: "INV-0141", client: "Northfield Dental", issued: "Sep 15", due: "Sep 29", amount: 750, status: "overdue" },
  { number: "INV-0149", client: "Studio Kiln", issued: "—", due: "—", amount: 3600, status: "draft" },
];

/** Cash collected per month, in dollars; the current month also shows what is still outstanding. */
export const monthlyCash = [
  { month: "May", paid: 21400, outstanding: 0 },
  { month: "Jun", paid: 24900, outstanding: 0 },
  { month: "Jul", paid: 19800, outstanding: 0 },
  { month: "Aug", paid: 27300, outstanding: 0 },
  { month: "Sep", paid: 23900, outstanding: 0 },
  { month: "Oct", paid: 26880, outstanding: 16150 },
];

export const formatMoney = (amount: number) =>
  amount.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
