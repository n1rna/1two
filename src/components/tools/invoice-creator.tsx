"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useSyncedState } from "@/lib/sync";
import { SyncToggle } from "@/components/ui/sync-toggle";
import { ToolLayout } from "@/components/layout/tool-layout";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Trash2,
  Download,
  Save,
  RotateCcw,
  FileText,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Standard = "EU" | "US";

type Currency =
  | "EUR"
  | "USD"
  | "GBP"
  | "CHF"
  | "CAD"
  | "AUD"
  | "JPY"
  | "SEK"
  | "NOK"
  | "DKK"
  | "PLN"
  | "CZK";

type PaymentTerms =
  | "due_on_receipt"
  | "net_7"
  | "net_15"
  | "net_30"
  | "net_45"
  | "net_60"
  | "net_90";

interface LineItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  taxPercent: number;
}

interface SenderDetails {
  businessName: string;
  address: string;
  email: string;
  phone: string;
  // EU
  vatId: string;
  iban: string;
  bic: string;
  // US
  taxId: string;
  routingNumber: string;
  accountNumber: string;
}

interface RecipientDetails {
  businessName: string;
  address: string;
  email: string;
  phone: string;
  // EU
  vatId: string;
  // US
  taxId: string;
}

interface InvoiceData {
  standard: Standard;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: Currency;
  paymentTerms: PaymentTerms;
  sender: SenderDetails;
  recipient: RecipientDetails;
  lineItems: LineItem[];
  reverseCharge: boolean;
  intraCommunitySupply: boolean;
  notes: string;
}

interface SavedTemplate {
  id: string;
  name: string;
  data: InvoiceData;
  savedAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CURRENCIES: Currency[] = [
  "EUR","USD","GBP","CHF","CAD","AUD","JPY","SEK","NOK","DKK","PLN","CZK",
];

const PAYMENT_TERMS: { value: PaymentTerms; label: string; days: number }[] = [
  { value: "due_on_receipt", label: "Due on receipt", days: 0 },
  { value: "net_7", label: "Net 7", days: 7 },
  { value: "net_15", label: "Net 15", days: 15 },
  { value: "net_30", label: "Net 30", days: 30 },
  { value: "net_45", label: "Net 45", days: 45 },
  { value: "net_60", label: "Net 60", days: 60 },
  { value: "net_90", label: "Net 90", days: 90 },
];

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CHF: "CHF",
  CAD: "CA$",
  AUD: "A$",
  JPY: "¥",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  PLN: "zł",
  CZK: "Kč",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function generateInvoiceNumber(): string {
  const now = new Date();
  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `INV-${yyyymmdd}-001`;
}

function newLineItem(): LineItem {
  return {
    id: crypto.randomUUID(),
    description: "",
    qty: 1,
    unitPrice: 0,
    taxPercent: 0,
  };
}

function defaultInvoiceData(standard: Standard = "EU"): InvoiceData {
  const today = todayString();
  return {
    standard,
    invoiceNumber: generateInvoiceNumber(),
    issueDate: today,
    dueDate: addDays(today, 30),
    currency: standard === "EU" ? "EUR" : "USD",
    paymentTerms: "net_30",
    sender: {
      businessName: "",
      address: "",
      email: "",
      phone: "",
      vatId: "",
      iban: "",
      bic: "",
      taxId: "",
      routingNumber: "",
      accountNumber: "",
    },
    recipient: {
      businessName: "",
      address: "",
      email: "",
      phone: "",
      vatId: "",
      taxId: "",
    },
    lineItems: [newLineItem()],
    reverseCharge: false,
    intraCommunitySupply: false,
    notes: "",
  };
}

function formatMoney(amount: number, currency: Currency): string {
  const sym = CURRENCY_SYMBOLS[currency];
  const formatted = amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  // Put symbol before or after based on currency
  const after = ["SEK", "NOK", "DKK", "PLN", "CZK"].includes(currency);
  return after ? `${formatted} ${sym}` : `${sym}${formatted}`;
}

// ── Shared input/label styles ─────────────────────────────────────────────────

const inputCls =
  "h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring w-full";
const textareaCls =
  "px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring w-full resize-none";
const selectCls =
  "h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring w-full";
const labelCls = "text-xs font-medium text-muted-foreground";
const sectionCls = "rounded-lg border border-border p-4 space-y-3";

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

// ── Main Component ────────────────────────────────────────────────────────────

export function InvoiceCreator({
  children,
}: {
  children?: React.ReactNode;
}) {
  const [invoice, setInvoice] = useState<InvoiceData>(() =>
    defaultInvoiceData("EU")
  );
  const [isExporting, setIsExporting] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDropdown, setShowLoadDropdown] = useState(false);

  const { data: savedTemplates, setData: setSavedTemplates, syncToggleProps } =
    useSyncedState<SavedTemplate[]>("1two-saved-invoices", []);

  // Helpers
  const update = useCallback(
    <K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) => {
      setInvoice((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateSender = useCallback(
    <K extends keyof SenderDetails>(key: K, value: SenderDetails[K]) => {
      setInvoice((prev) => ({
        ...prev,
        sender: { ...prev.sender, [key]: value },
      }));
    },
    []
  );

  const updateRecipient = useCallback(
    <K extends keyof RecipientDetails>(
      key: K,
      value: RecipientDetails[K]
    ) => {
      setInvoice((prev) => ({
        ...prev,
        recipient: { ...prev.recipient, [key]: value },
      }));
    },
    []
  );

  const updateLineItem = useCallback(
    <K extends keyof LineItem>(id: string, key: K, value: LineItem[K]) => {
      setInvoice((prev) => ({
        ...prev,
        lineItems: prev.lineItems.map((item) =>
          item.id === id ? { ...item, [key]: value } : item
        ),
      }));
    },
    []
  );

  const addLineItem = useCallback(() => {
    setInvoice((prev) => ({
      ...prev,
      lineItems: [...prev.lineItems, newLineItem()],
    }));
  }, []);

  const removeLineItem = useCallback((id: string) => {
    setInvoice((prev) => ({
      ...prev,
      lineItems: prev.lineItems.filter((item) => item.id !== id),
    }));
  }, []);

  // Recalculate due date when payment terms or issue date changes
  useEffect(() => {
    const term = PAYMENT_TERMS.find((t) => t.value === invoice.paymentTerms);
    if (term) {
      update("dueDate", addDays(invoice.issueDate, term.days));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.paymentTerms, invoice.issueDate]);

  // Switch standard
  const switchStandard = useCallback(
    (std: Standard) => {
      setInvoice((prev) => ({
        ...prev,
        standard: std,
        currency: std === "EU" ? "EUR" : "USD",
        reverseCharge: false,
        intraCommunitySupply: false,
      }));
    },
    []
  );

  // Totals
  const { subtotal, taxLines, total } = useMemo(() => {
    let sub = 0;
    const taxMap: Record<number, number> = {};

    for (const item of invoice.lineItems) {
      const amount = item.qty * item.unitPrice;
      sub += amount;
      const pct = item.taxPercent;
      if (invoice.reverseCharge) {
        // no tax under reverse charge
      } else {
        const taxAmt = amount * (pct / 100);
        taxMap[pct] = (taxMap[pct] ?? 0) + taxAmt;
      }
    }

    const lines = Object.entries(taxMap)
      .filter(([, amt]) => amt !== 0)
      .map(([pct, amt]) => ({ pct: Number(pct), amt }))
      .sort((a, b) => a.pct - b.pct);

    const taxTotal = lines.reduce((s, l) => s + l.amt, 0);
    return { subtotal: sub, taxLines: lines, total: sub + taxTotal };
  }, [invoice.lineItems, invoice.reverseCharge]);

  // Save template
  const handleSaveTemplate = useCallback(() => {
    if (!templateName.trim()) return;
    const tpl: SavedTemplate = {
      id: crypto.randomUUID(),
      name: templateName.trim(),
      data: invoice,
      savedAt: new Date().toISOString(),
    };
    setSavedTemplates((prev) => [tpl, ...prev]);
    setTemplateName("");
    setShowSaveDialog(false);
  }, [templateName, invoice, setSavedTemplates]);

  const handleLoadTemplate = useCallback(
    (tpl: SavedTemplate) => {
      setInvoice(tpl.data);
      setShowLoadDropdown(false);
    },
    []
  );

  const handleDeleteTemplate = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setSavedTemplates((prev) => prev.filter((t) => t.id !== id));
    },
    [setSavedTemplates]
  );

  const handleNewInvoice = useCallback(() => {
    setInvoice(defaultInvoiceData(invoice.standard));
  }, [invoice.standard]);

  // PDF export
  const handleExportPdf = useCallback(async () => {
    setIsExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const pageFormat = invoice.standard === "EU" ? "a4" : "letter";
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: pageFormat });

      const pageW = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentW = pageW - margin * 2;
      let y = margin;

      // ── Header: Sender ──────────────────────────────────────────────────────
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(invoice.sender.businessName || "Your Business", margin, y);
      y += 7;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);

      const senderLines: string[] = [];
      if (invoice.sender.address) {
        invoice.sender.address.split("\n").forEach((l) => senderLines.push(l.trim()));
      }
      if (invoice.sender.email) senderLines.push(invoice.sender.email);
      if (invoice.sender.phone) senderLines.push(invoice.sender.phone);
      if (invoice.standard === "EU" && invoice.sender.vatId)
        senderLines.push(`VAT ID: ${invoice.sender.vatId}`);
      if (invoice.standard === "US" && invoice.sender.taxId)
        senderLines.push(`EIN: ${invoice.sender.taxId}`);

      senderLines.forEach((line) => {
        doc.text(line, margin, y);
        y += 4.5;
      });

      // ── INVOICE title + meta (right side) ─────────────────────────────────
      const rightX = pageW - margin;
      let metaY = margin;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(20, 20, 20);
      doc.text("INVOICE", rightX, metaY, { align: "right" });
      metaY += 10;

      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);

      const termLabel =
        PAYMENT_TERMS.find((t) => t.value === invoice.paymentTerms)?.label ??
        invoice.paymentTerms;

      // Right-aligned two-column meta block: labels right-aligned to a fixed column, values right-aligned to page edge
      const metaLabelX = rightX - 50; // label column right edge
      const metaValueX = rightX;      // value column right edge

      const metaRows = [
        ["Invoice #", invoice.invoiceNumber],
        ["Issue Date", invoice.issueDate],
        ["Due Date", invoice.dueDate],
        ["Payment Terms", termLabel],
        ["Currency", invoice.currency],
      ];

      for (const [lbl, val] of metaRows) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120, 120, 120);
        doc.text(lbl, metaLabelX, metaY, { align: "right" });
        doc.setFont("helvetica", "normal");
        doc.setTextColor(40, 40, 40);
        doc.text(val, metaValueX, metaY, { align: "right" });
        metaY += 5.5;
      }

      y = Math.max(y, metaY) + 8;

      // ── Divider ────────────────────────────────────────────────────────────
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, y, pageW - margin, y);
      y += 8;

      // ── Bill To ────────────────────────────────────────────────────────────
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text("BILL TO", margin, y);
      y += 5;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20);
      doc.text(invoice.recipient.businessName || "Recipient", margin, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);

      const recipientLines: string[] = [];
      if (invoice.recipient.address) {
        invoice.recipient.address
          .split("\n")
          .forEach((l) => recipientLines.push(l.trim()));
      }
      if (invoice.recipient.email) recipientLines.push(invoice.recipient.email);
      if (invoice.recipient.phone) recipientLines.push(invoice.recipient.phone);
      if (invoice.standard === "EU" && invoice.recipient.vatId)
        recipientLines.push(`VAT ID: ${invoice.recipient.vatId}`);
      if (invoice.standard === "US" && invoice.recipient.taxId)
        recipientLines.push(`EIN: ${invoice.recipient.taxId}`);

      recipientLines.forEach((line) => {
        doc.text(line, margin, y);
        y += 4.5;
      });

      y += 8;

      // ── Line Items table ───────────────────────────────────────────────────
      const tableBody = invoice.lineItems.map((item) => {
        const amount = item.qty * item.unitPrice;
        const taxLabel =
          invoice.reverseCharge ? "RC" : `${item.taxPercent}%`;
        return [
          item.description,
          String(item.qty),
          formatMoney(item.unitPrice, invoice.currency),
          taxLabel,
          formatMoney(amount, invoice.currency),
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [["Description", "Qty", "Unit Price", "Tax %", "Amount"]],
        body: tableBody,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: {
          fillColor: [245, 245, 245],
          textColor: [60, 60, 60],
          fontStyle: "bold",
          lineColor: [220, 220, 220],
          lineWidth: 0.1,
        },
        bodyStyles: {
          textColor: [40, 40, 40],
          lineColor: [235, 235, 235],
          lineWidth: 0.1,
        },
        columnStyles: {
          0: { cellWidth: contentW * 0.4 },
          1: { halign: "right", cellWidth: contentW * 0.1 },
          2: { halign: "right", cellWidth: contentW * 0.2 },
          3: { halign: "right", cellWidth: contentW * 0.1 },
          4: { halign: "right", cellWidth: contentW * 0.2 },
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

      // ── Totals ─────────────────────────────────────────────────────────────
      const totalsLabelX = pageW - margin - 75;
      const totalsValueX = pageW - margin;

      const drawTotalRow = (
        label: string,
        value: string,
        bold = false,
        lineAbove = false
      ) => {
        if (lineAbove) {
          doc.setDrawColor(200, 200, 200);
          doc.line(totalsLabelX, y, totalsValueX, y);
          y += 4;
        }
        if (bold) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(20, 20, 20);
        } else {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(80, 80, 80);
        }
        doc.text(label, totalsLabelX, y);
        doc.text(value, totalsValueX, y, { align: "right" });
        y += 5.5;
      };

      drawTotalRow("Subtotal:", formatMoney(subtotal, invoice.currency));

      if (invoice.reverseCharge) {
        drawTotalRow("Tax (Reverse Charge):", formatMoney(0, invoice.currency));
      } else {
        for (const line of taxLines) {
          const label =
            invoice.standard === "EU"
              ? `VAT ${line.pct}%:`
              : `Tax ${line.pct}%:`;
          drawTotalRow(label, formatMoney(line.amt, invoice.currency));
        }
        if (taxLines.length === 0) {
          drawTotalRow("Tax:", formatMoney(0, invoice.currency));
        }
      }

      drawTotalRow("Total:", formatMoney(total, invoice.currency), true, true);

      y += 6;

      // ── Payment Details ────────────────────────────────────────────────────
      const paymentLines: string[] = [];
      if (invoice.standard === "EU") {
        if (invoice.sender.iban) paymentLines.push(`IBAN: ${invoice.sender.iban}`);
        if (invoice.sender.bic) paymentLines.push(`BIC: ${invoice.sender.bic}`);
      } else {
        if (invoice.sender.routingNumber)
          paymentLines.push(`Routing: ${invoice.sender.routingNumber}`);
        if (invoice.sender.accountNumber)
          paymentLines.push(`Account: ${invoice.sender.accountNumber}`);
      }

      if (paymentLines.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text("PAYMENT DETAILS", margin, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(40, 40, 40);
        paymentLines.forEach((line) => {
          doc.text(line, margin, y);
          y += 4.5;
        });
        y += 4;
      }

      // ── Notes ─────────────────────────────────────────────────────────────
      if (invoice.notes.trim()) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text("NOTES", margin, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        const noteLines = doc.splitTextToSize(invoice.notes, contentW);
        doc.text(noteLines, margin, y);
        y += noteLines.length * 4.5 + 4;
      }

      // ── Legal notices ──────────────────────────────────────────────────────
      const notices: string[] = [];
      if (invoice.reverseCharge) {
        notices.push(
          "Reverse charge: Tax liability is transferred to the recipient of this invoice."
        );
      }
      if (invoice.intraCommunitySupply) {
        notices.push(
          "Intra-community supply exempt from VAT pursuant to Art. 138 VAT Directive."
        );
      }

      if (notices.length > 0) {
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, y, pageW - margin, y);
        y += 5;
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        notices.forEach((notice) => {
          const wrapped = doc.splitTextToSize(notice, contentW);
          doc.text(wrapped, margin, y);
          y += wrapped.length * 4;
        });
      }

      const filename = `${invoice.invoiceNumber || "invoice"}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error("PDF export failed", err);
    } finally {
      setIsExporting(false);
    }
  }, [invoice, subtotal, taxLines, total]);

  const { standard } = invoice;

  return (
    <ToolLayout slug="invoice" toolbar={<SyncToggle {...syncToggleProps} />}>
      <div className="space-y-6 lg:grid lg:grid-cols-[1fr_1fr] lg:gap-6 lg:space-y-0">

        {/* ── Left column: settings ───────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Standards toggle */}
          <div className={sectionCls}>
            <p className={labelCls}>Standard</p>
            <div className="flex gap-1 rounded-lg border border-border p-1 w-fit">
              {(["EU", "US"] as Standard[]).map((s) => (
                <button
                  key={s}
                  onClick={() => switchStandard(s)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    standard === s
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Invoice metadata */}
          <div className={sectionCls}>
            <p className="text-sm font-semibold">Invoice Details</p>
            <Row>
              <Field label="Invoice Number">
                <input
                  className={inputCls}
                  value={invoice.invoiceNumber}
                  onChange={(e) => update("invoiceNumber", e.target.value)}
                />
              </Field>
              <Field label="Currency">
                <select
                  className={selectCls}
                  value={invoice.currency}
                  onChange={(e) => update("currency", e.target.value as Currency)}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
            </Row>
            <Row>
              <Field label="Issue Date">
                <input
                  type="date"
                  className={inputCls}
                  value={invoice.issueDate}
                  onChange={(e) => update("issueDate", e.target.value)}
                />
              </Field>
              <Field label="Payment Terms">
                <select
                  className={selectCls}
                  value={invoice.paymentTerms}
                  onChange={(e) =>
                    update("paymentTerms", e.target.value as PaymentTerms)
                  }
                >
                  {PAYMENT_TERMS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
            </Row>
            <Field label="Due Date">
              <input
                type="date"
                className={inputCls}
                value={invoice.dueDate}
                onChange={(e) => update("dueDate", e.target.value)}
              />
            </Field>
          </div>

          {/* Sender details */}
          <div className={sectionCls}>
            <p className="text-sm font-semibold">From (Sender)</p>
            <Field label="Business Name">
              <input
                className={inputCls}
                value={invoice.sender.businessName}
                onChange={(e) => updateSender("businessName", e.target.value)}
                placeholder="Your company name"
              />
            </Field>
            <Field label="Address">
              <textarea
                className={textareaCls}
                rows={3}
                value={invoice.sender.address}
                onChange={(e) => updateSender("address", e.target.value)}
                placeholder="Street, City, Country"
              />
            </Field>
            <Row>
              <Field label="Email">
                <input
                  className={inputCls}
                  type="email"
                  value={invoice.sender.email}
                  onChange={(e) => updateSender("email", e.target.value)}
                />
              </Field>
              <Field label="Phone">
                <input
                  className={inputCls}
                  value={invoice.sender.phone}
                  onChange={(e) => updateSender("phone", e.target.value)}
                />
              </Field>
            </Row>

            {standard === "EU" && (
              <>
                <Field label="VAT ID">
                  <input
                    className={inputCls}
                    value={invoice.sender.vatId}
                    onChange={(e) => updateSender("vatId", e.target.value)}
                    placeholder="DE123456789"
                  />
                </Field>
                <Row>
                  <Field label="IBAN">
                    <input
                      className={inputCls}
                      value={invoice.sender.iban}
                      onChange={(e) => updateSender("iban", e.target.value)}
                      placeholder="DE89 3704 0044 ..."
                    />
                  </Field>
                  <Field label="BIC / SWIFT">
                    <input
                      className={inputCls}
                      value={invoice.sender.bic}
                      onChange={(e) => updateSender("bic", e.target.value)}
                      placeholder="COBADEFFXXX"
                    />
                  </Field>
                </Row>
              </>
            )}

            {standard === "US" && (
              <>
                <Field label="Tax ID / EIN">
                  <input
                    className={inputCls}
                    value={invoice.sender.taxId}
                    onChange={(e) => updateSender("taxId", e.target.value)}
                    placeholder="12-3456789"
                  />
                </Field>
                <Row>
                  <Field label="Routing Number">
                    <input
                      className={inputCls}
                      value={invoice.sender.routingNumber}
                      onChange={(e) => updateSender("routingNumber", e.target.value)}
                    />
                  </Field>
                  <Field label="Account Number">
                    <input
                      className={inputCls}
                      value={invoice.sender.accountNumber}
                      onChange={(e) => updateSender("accountNumber", e.target.value)}
                    />
                  </Field>
                </Row>
              </>
            )}
          </div>

          {/* Recipient details */}
          <div className={sectionCls}>
            <p className="text-sm font-semibold">To (Recipient)</p>
            <Field label="Business Name">
              <input
                className={inputCls}
                value={invoice.recipient.businessName}
                onChange={(e) => updateRecipient("businessName", e.target.value)}
                placeholder="Client company name"
              />
            </Field>
            <Field label="Address">
              <textarea
                className={textareaCls}
                rows={3}
                value={invoice.recipient.address}
                onChange={(e) => updateRecipient("address", e.target.value)}
                placeholder="Street, City, Country"
              />
            </Field>
            <Row>
              <Field label="Email">
                <input
                  className={inputCls}
                  type="email"
                  value={invoice.recipient.email}
                  onChange={(e) => updateRecipient("email", e.target.value)}
                />
              </Field>
              <Field label="Phone">
                <input
                  className={inputCls}
                  value={invoice.recipient.phone}
                  onChange={(e) => updateRecipient("phone", e.target.value)}
                />
              </Field>
            </Row>

            {standard === "EU" && (
              <Field label="VAT ID">
                <input
                  className={inputCls}
                  value={invoice.recipient.vatId}
                  onChange={(e) => updateRecipient("vatId", e.target.value)}
                  placeholder="FR12345678901"
                />
              </Field>
            )}

            {standard === "US" && (
              <Field label="Tax ID / EIN">
                <input
                  className={inputCls}
                  value={invoice.recipient.taxId}
                  onChange={(e) => updateRecipient("taxId", e.target.value)}
                  placeholder="12-3456789"
                />
              </Field>
            )}
          </div>

          {/* EU-specific options */}
          {standard === "EU" && (
            <div className={sectionCls}>
              <p className="text-sm font-semibold">EU Options</p>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                  checked={invoice.reverseCharge}
                  onChange={(e) => update("reverseCharge", e.target.checked)}
                />
                <span className="space-y-0.5">
                  <span className="text-sm font-medium block">Reverse Charge</span>
                  <span className="text-xs text-muted-foreground block">
                    Tax liability transfers to the recipient. Tax amounts will show as 0.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                  checked={invoice.intraCommunitySupply}
                  onChange={(e) =>
                    update("intraCommunitySupply", e.target.checked)
                  }
                />
                <span className="space-y-0.5">
                  <span className="text-sm font-medium block">
                    Intra-community Supply
                  </span>
                  <span className="text-xs text-muted-foreground block">
                    Adds VAT exemption notice under Art. 138 VAT Directive.
                  </span>
                </span>
              </label>
            </div>
          )}

          {/* Notes */}
          <div className={sectionCls}>
            <p className="text-sm font-semibold">Notes</p>
            <textarea
              className={textareaCls}
              rows={4}
              value={invoice.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Payment instructions, terms and conditions, thank you message..."
            />
          </div>
        </div>

        {/* ── Right column: line items + totals + actions ─────────────────── */}
        <div className="space-y-4">

          {/* Line items */}
          <div className={sectionCls}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Line Items</p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={addLineItem}
              >
                <Plus className="h-3 w-3" />
                Add row
              </Button>
            </div>

            {/* Table header */}
            <div className="grid gap-1.5" style={{ gridTemplateColumns: "1fr 56px 88px 60px 80px 28px" }}>
              <span className={labelCls}>Description</span>
              <span className={`${labelCls} text-right`}>Qty</span>
              <span className={`${labelCls} text-right`}>Unit Price</span>
              <span className={`${labelCls} text-right`}>Tax %</span>
              <span className={`${labelCls} text-right`}>Amount</span>
              <span />
            </div>

            {/* Rows */}
            <div className="space-y-2">
              {invoice.lineItems.map((item) => {
                const amount = item.qty * item.unitPrice;
                return (
                  <div
                    key={item.id}
                    className="grid gap-1.5 items-center"
                    style={{ gridTemplateColumns: "1fr 56px 88px 60px 80px 28px" }}
                  >
                    <input
                      className={inputCls}
                      value={item.description}
                      onChange={(e) =>
                        updateLineItem(item.id, "description", e.target.value)
                      }
                      placeholder="Service or product"
                    />
                    <input
                      className={`${inputCls} text-right`}
                      type="number"
                      min={0}
                      step="any"
                      value={item.qty}
                      onChange={(e) =>
                        updateLineItem(
                          item.id,
                          "qty",
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                    <input
                      className={`${inputCls} text-right`}
                      type="number"
                      min={0}
                      step="any"
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateLineItem(
                          item.id,
                          "unitPrice",
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                    <input
                      className={`${inputCls} text-right`}
                      type="number"
                      min={0}
                      max={100}
                      step="any"
                      value={item.taxPercent}
                      onChange={(e) =>
                        updateLineItem(
                          item.id,
                          "taxPercent",
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                    <span className="text-sm text-right pr-1 tabular-nums">
                      {formatMoney(amount, invoice.currency)}
                    </span>
                    <button
                      className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={() => removeLineItem(item.id)}
                      disabled={invoice.lineItems.length === 1}
                      title="Remove row"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals */}
          <div className={sectionCls}>
            <p className="text-sm font-semibold">Summary</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">
                  {formatMoney(subtotal, invoice.currency)}
                </span>
              </div>

              {invoice.reverseCharge ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Tax{" "}
                    <span className="text-xs bg-muted text-muted-foreground rounded px-1 py-0.5 ml-1">
                      Reverse Charge
                    </span>
                  </span>
                  <span className="tabular-nums">
                    {formatMoney(0, invoice.currency)}
                  </span>
                </div>
              ) : taxLines.length > 0 ? (
                taxLines.map((line) => (
                  <div
                    key={line.pct}
                    className="flex justify-between text-sm"
                  >
                    <span className="text-muted-foreground">
                      {standard === "EU" ? "VAT" : "Tax"} {line.pct}%
                    </span>
                    <span className="tabular-nums">
                      {formatMoney(line.amt, invoice.currency)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="tabular-nums">
                    {formatMoney(0, invoice.currency)}
                  </span>
                </div>
              )}

              <div className="border-t border-border pt-1.5 flex justify-between">
                <span className="font-semibold text-sm">Total</span>
                <span className="font-semibold text-sm tabular-nums">
                  {formatMoney(total, invoice.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Legal notices preview */}
          {(invoice.reverseCharge || invoice.intraCommunitySupply) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4 space-y-2">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                Legal notices (added to PDF)
              </p>
              {invoice.reverseCharge && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Reverse charge: Tax liability is transferred to the recipient of this invoice.
                </p>
              )}
              {invoice.intraCommunitySupply && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Intra-community supply exempt from VAT pursuant to Art. 138 VAT Directive.
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className={sectionCls}>
            <p className="text-sm font-semibold">Actions</p>
            <div className="flex flex-wrap gap-2">
              <Button
                className="gap-1.5"
                onClick={handleExportPdf}
                disabled={isExporting}
              >
                <Download className="h-4 w-4" />
                {isExporting ? "Generating..." : "Export PDF"}
              </Button>

              {/* Save template */}
              <div className="relative">
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    setShowSaveDialog((v) => !v);
                    setShowLoadDropdown(false);
                  }}
                >
                  <Save className="h-4 w-4" />
                  Save Template
                </Button>
                {showSaveDialog && (
                  <div className="absolute top-full mt-1 left-0 z-50 w-64 rounded-lg border border-border bg-popover shadow-md p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Template name
                    </p>
                    <input
                      className={inputCls}
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="e.g. Freelance - Standard"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveTemplate();
                        if (e.key === "Escape") setShowSaveDialog(false);
                      }}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={handleSaveTemplate}
                        disabled={!templateName.trim()}
                      >
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSaveDialog(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Load template */}
              <div className="relative">
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    setShowLoadDropdown((v) => !v);
                    setShowSaveDialog(false);
                  }}
                  disabled={savedTemplates.length === 0}
                >
                  <FileText className="h-4 w-4" />
                  Load Template
                </Button>
                {showLoadDropdown && savedTemplates.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 z-50 w-72 rounded-lg border border-border bg-popover shadow-md overflow-hidden">
                    {savedTemplates.map((tpl) => (
                      <button
                        key={tpl.id}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted text-left transition-colors"
                        onClick={() => handleLoadTemplate(tpl)}
                      >
                        <div>
                          <p className="text-sm font-medium">{tpl.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(tpl.savedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                          onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                          title="Delete template"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                className="gap-1.5"
                onClick={handleNewInvoice}
              >
                <RotateCcw className="h-4 w-4" />
                New Invoice
              </Button>
            </div>
          </div>
        </div>
      </div>
      {children}
    </ToolLayout>
  );
}
