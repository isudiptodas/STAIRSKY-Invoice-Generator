"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Document, Image, Page as PdfPage, StyleSheet, Text, View } from "@react-pdf/renderer";

const ClientPDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((module) => module.PDFDownloadLink),
  { ssr: false },
);

type ThemeMode = "light" | "dark";
type DateMode = "payment" | "due" | null;
type PaymentStatus = "Paid" | "Pending";

type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
};

type ValidationErrors = { [key: string]: string };

type VisibleColumns = {
  description: boolean;
  quantity: boolean;
  unitPrice: boolean;
  discount: boolean;
  total: boolean;
};

const STORAGE_KEYS = {
  theme: "stairsky-theme",
  sequence: "stairsky-invoice-sequence",
};

const COMPANY = {
  name: "STAIRSKY ADVERTISING PRIVATE LIMITED",
  owner: "KRISHANU DUTTA",
  address: "Near Children Model School, Gangapur, Duttapukur, North 24 Parganas, West Bengal",
  phone: "7003846270",
  email: "stairsky1632@gmail.com",
  logo: "/assets/logo.png",
  signature: "/assets/signature.jpeg",
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const createItem = (id?: string): InvoiceItem => ({
  id: id ?? `item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  description: "",
  quantity: 0,
  unitPrice: 0,
  discount: 0,
});

const formatMoney = (amount: number) => `${new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
}).format(amount)}/-`;

const toNumber = (value: number | string | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const makeInvoiceNumber = (dateString: string, sequence: number) => {
  const year = dateString ? new Date(`${dateString}T00:00:00`).getFullYear() : new Date().getFullYear();
  return `INV-${year}-${String(sequence).padStart(4, "0")}`;
};

const formatDisplayDate = (dateString: string) => {
  if (!dateString) return "";
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const getInitialSequence = () => {
  return 1;
};

const ones = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const toWordsUnder100 = (n: number): string => {
  if (n < 20) return ones[n] ?? "";
  const ten = Math.floor(n / 10);
  const rem = n % 10;
  return rem ? `${tens[ten]} ${ones[rem]}` : tens[ten];
};

const convertToIndianWords = (n: number): string => {
  const absolute = Math.abs(Math.round(n));
  if (absolute === 0) return "Zero";

  const crore = Math.floor(absolute / 10000000);
  const lakh = Math.floor((absolute % 10000000) / 100000);
  const thousand = Math.floor((absolute % 100000) / 1000);
  const rest = absolute % 1000;

  const chunks: string[] = [];

  if (crore) chunks.push(`${convertToIndianWords(crore)} Crore`);
  if (lakh) chunks.push(`${toWordsUnder100(lakh)} Lakh`);
  if (thousand) chunks.push(`${toWordsUnder100(thousand)} Thousand`);
  if (rest) {
    const renderedRest = rest >= 100 ? `${toWordsUnder100(Math.floor(rest / 100))} Hundred` : "";
    const remainder = rest % 100;
    const next = remainder ? toWordsUnder100(remainder) : "";
    const combined = [renderedRest, next].filter(Boolean).join(" ");
    if (combined) chunks.push(combined);
  }

  return chunks.join(" ");
};

const paymentStatusOptions: PaymentStatus[] = ["Paid", "Pending"];

const pdfStyles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: "#ffffff",
    color: "#111827",
    fontFamily: "Helvetica",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  leftCol: { width: 290 },
  rightCol: { width: 180, alignItems: "flex-end" },
  companyWrap: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 70, height: 42, marginRight: 12, resizeMode: "stretch" },
  companyName: { fontSize: 11, fontWeight: 700, marginBottom: 2, color: "#111827" },
  companyMeta: { fontSize: 7.6, color: "#4b5563", lineHeight: 1.5 },
  invoiceTitle: { fontSize: 18, fontWeight: 700, letterSpacing: 1, marginBottom: 8, color: "#111827" },
  invoiceMeta: { fontSize: 8.1, color: "#111827", lineHeight: 1.6 },
  divider: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingVertical: 10,
    marginBottom: 12,
  },
  customerBox: { width: 250 },
  label: { fontSize: 9, fontWeight: 700, letterSpacing: 0.8, color: "#374151", marginBottom: 6 },
  customerText: { fontSize: 8.3, color: "#111827", lineHeight: 1.5 },
  table: { borderWidth: 1, borderColor: "#9ca3af", marginTop: 4 },
  tableHead: { flexDirection: "row", backgroundColor: "#f3f4f6", borderBottomWidth: 1, borderBottomColor: "#9ca3af", paddingVertical: 7 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#d1d5db", paddingVertical: 7 },
  tableCell: { fontSize: 8, color: "#111827", borderRightWidth: 1, borderRightColor: "#d1d5db", paddingLeft: 4 },
  summary: { marginTop: 16, width: 210, alignSelf: "flex-end" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", fontSize: 8.5, color: "#111827", paddingVertical: 2 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", fontSize: 11, fontWeight: 700, borderTopWidth: 1, borderTopColor: "#d1d5db", paddingTop: 6, marginTop: 4 },
  words: { marginTop: 18, fontSize: 8.5, color: "#111827" },
  detailSection: { marginTop: 18, borderTopWidth: 1, borderTopColor: "#d1d5db", paddingTop: 10 },
  footerText: { fontSize: 8, color: "#111827", lineHeight: 1.6 },
  signatureRow: { marginTop: 18, alignItems: "flex-end" },
  signature: { width: 120, height: 32, marginBottom: 6 },
  footerName: { fontSize: 8.5, fontWeight: 700, color: "#111827" },
});

function InvoiceDocument({
  invoiceNumber,
  invoiceDate,
  paymentMode,
  paymentDate,
  dueDate,
  paymentStatus,
  paymentStatusEnabled,
  placeOfSupply,
  placeOfSupplyEnabled,
  clientName,
  companyName,
  billingAddress,
  phone,
  items,
  visibleColumns,
  subtotal,
  discountTotal,
  manualAdjustment,
  finalAmount,
  amountInWords,
  paymentDetails,
  terms,
}: {
  invoiceNumber: string;
  invoiceDate: string;
  paymentMode: DateMode;
  paymentDate: string;
  dueDate: string;
  paymentStatus: PaymentStatus;
  paymentStatusEnabled: boolean;
  placeOfSupply: string;
  placeOfSupplyEnabled: boolean;
  clientName: string;
  companyName: string;
  billingAddress: string;
  phone: string;
  items: InvoiceItem[];
  visibleColumns: VisibleColumns;
  subtotal: number;
  discountTotal: number;
  manualAdjustment: number;
  finalAmount: number;
  amountInWords: string;
  paymentDetails: {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    ifsc: string;
    upiId: string;
  };
  terms: string;
}) {
  const invoiceMeta = [
    `Invoice No: ${invoiceNumber}`,
    `Invoice Date: ${formatDisplayDate(invoiceDate)}`,
  ];

  if (paymentMode === "due") invoiceMeta.push(`Due Date: ${formatDisplayDate(dueDate)}`);
  if (paymentMode === "payment") invoiceMeta.push(`Payment Date: ${formatDisplayDate(paymentDate)}`);
  if (paymentStatusEnabled && paymentStatus) invoiceMeta.push(`Payment Status: ${paymentStatus}`);
  if (placeOfSupplyEnabled && placeOfSupply.trim()) invoiceMeta.push(`Place of Supply: ${placeOfSupply.trim()}`);

  const tableColumns = [
    { key: "description", label: "Description", width: "45%" },
    { key: "quantity", label: "Qty", width: "12%" },
    { key: "unitPrice", label: "Unit Price", width: "18%" },
    { key: "discount", label: "Discount", width: "12%" },
    { key: "total", label: "Amount", width: "13%" },
  ].filter((column) => {
    if (column.key === "description" || column.key === "total") return true;
    return visibleColumns[column.key as keyof VisibleColumns];
  });

  const paymentRows = [
    paymentDetails.bankName ? `Bank Name: ${paymentDetails.bankName}` : null,
    paymentDetails.accountHolder ? `Account Holder: ${paymentDetails.accountHolder}` : null,
    paymentDetails.accountNumber ? `Account Number: ${paymentDetails.accountNumber}` : null,
    paymentDetails.ifsc ? `IFSC: ${paymentDetails.ifsc}` : null,
    paymentDetails.upiId ? `UPI ID: ${paymentDetails.upiId}` : null,
  ].filter(Boolean) as string[];

  const customerName = clientName.trim() || companyName.trim() || "Client Name";
  const customerCompany = companyName.trim() && companyName.trim() !== clientName.trim() ? companyName.trim() : "";

  return (
    <Document>
      <PdfPage size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.headerRow}>
          <View style={pdfStyles.leftCol}>
            <View style={pdfStyles.companyWrap}>
              <Image src={COMPANY.logo} style={pdfStyles.logo} />
              <View style={{ flex: 1, maxWidth: 210 }}>
                <Text style={pdfStyles.companyName}>{COMPANY.name}</Text>
                <Text style={pdfStyles.companyMeta}>{COMPANY.address}</Text>
                <Text style={pdfStyles.companyMeta}>Phone: {COMPANY.phone}</Text>
                <Text style={pdfStyles.companyMeta}>Email: {COMPANY.email}</Text>
              </View>
            </View>
          </View>

          <View style={pdfStyles.rightCol}>
            <Text style={pdfStyles.invoiceTitle}>INVOICE</Text>
            {invoiceMeta.map((line) => (
              <Text key={line} style={pdfStyles.invoiceMeta}>{line}</Text>
            ))}
          </View>
        </View>

        <View style={pdfStyles.divider}>
          <View style={{ width: 250 }}>
            <Text style={pdfStyles.label}>BILL TO</Text>
            <Text style={pdfStyles.customerText}>{customerName}</Text>
            {customerCompany ? <Text style={pdfStyles.customerText}>{customerCompany}</Text> : null}
            {billingAddress ? <Text style={pdfStyles.customerText}>{billingAddress}</Text> : null}
            {phone ? <Text style={pdfStyles.customerText}>Phone: {phone}</Text> : null}
          </View>

          <View style={{ width: 200, alignItems: "flex-end" }}>
            <Text style={pdfStyles.label}>SUPPLIED BY</Text>
            <Text style={[pdfStyles.customerText, { textAlign: "right" }]}>{COMPANY.name}</Text>
            <Text style={[pdfStyles.customerText, { textAlign: "right" }]}>{COMPANY.address}</Text>
            <Text style={[pdfStyles.customerText, { textAlign: "right" }]}>Phone: {COMPANY.phone}</Text>
            <Text style={[pdfStyles.customerText, { textAlign: "right" }]}>Email: {COMPANY.email}</Text>
          </View>
        </View>

        <View style={pdfStyles.table}>
          <View style={pdfStyles.tableHead}>
            {tableColumns.map((column) => (
              <Text
                key={column.key}
                  style={[
                  pdfStyles.tableCell,
                  { width: column.width, fontWeight: 700, paddingRight: 4, textAlign: column.key === "description" ? "left" : "right" },
                ]}
              >
                {column.label}
              </Text>
            ))}
          </View>

          {items.map((item) => {
            const itemTotal = Math.max(
              toNumber(item.quantity) * toNumber(item.unitPrice) - (visibleColumns.discount ? toNumber(item.discount) : 0),
              0,
            );

            return (
              <View key={item.id} style={pdfStyles.tableRow}>
                {visibleColumns.description && (
                  <Text style={[pdfStyles.tableCell, { width: "45%", paddingRight: 4 }]}>{item.description || "-"}</Text>
                )}
                {visibleColumns.quantity && (
                  <Text style={[pdfStyles.tableCell, { width: "12%", textAlign: "right", paddingRight: 4 }]}> 
                    {toNumber(item.quantity)}
                  </Text>
                )}
                {visibleColumns.unitPrice && (
                  <Text style={[pdfStyles.tableCell, { width: "18%", textAlign: "right", paddingRight: 4 }]}>
                    {formatMoney(toNumber(item.unitPrice))}
                  </Text>
                )}
                {visibleColumns.discount && (
                  <Text style={[pdfStyles.tableCell, { width: "12%", textAlign: "right", paddingRight: 4 }]}>
                    {formatMoney(toNumber(item.discount))}
                  </Text>
                )}
                {visibleColumns.total && (
                  <Text style={[pdfStyles.tableCell, { width: "13%", textAlign: "right" }]}>
                    {formatMoney(itemTotal)}
                  </Text>
                )}
              </View>
            );
          })}
        </View>

        <View style={pdfStyles.summary}>
          <View style={pdfStyles.summaryRow}>
            <Text>Subtotal</Text>
            <Text>{formatMoney(subtotal)}</Text>
          </View>
          <View style={pdfStyles.summaryRow}>
            <Text>Discount</Text>
            <Text>{formatMoney(discountTotal)}</Text>
          </View>
          <View style={pdfStyles.summaryRow}>
            <Text>Adjustment</Text>
            <Text>{formatMoney(manualAdjustment)}</Text>
          </View>
          <View style={pdfStyles.totalRow}>
            <Text>TOTAL</Text>
            <Text>{formatMoney(finalAmount)}</Text>
          </View>
        </View>

        <Text style={pdfStyles.words}>Amount in Words: {amountInWords}</Text>

        {paymentRows.length > 0 && (
          <View style={pdfStyles.detailSection}>
            <Text style={pdfStyles.label}>PAYMENT DETAILS</Text>
            {paymentRows.map((line) => (
              <Text key={line} style={pdfStyles.footerText}>{line}</Text>
            ))}
          </View>
        )}

        {terms.trim() && (
          <View style={pdfStyles.detailSection}>
            <Text style={pdfStyles.label}>TERMS & CONDITIONS</Text>
            <Text style={pdfStyles.footerText}>{terms}</Text>
          </View>
        )}

        <View style={pdfStyles.signatureRow}>
          <Image src={COMPANY.signature} style={pdfStyles.signature} />
          <Text style={pdfStyles.footerName}>{COMPANY.owner}</Text>
          <Text style={pdfStyles.footerText}>Authorized Signatory</Text>
        </View>
      </PdfPage>
    </Document>
  );
}

export default function Page() {
  const [theme, setTheme] = useState<ThemeMode>("light");

  const [sequence, setSequence] = useState<number>(1);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<DateMode>("due");
  const [paymentDate, setPaymentDate] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [paymentStatusEnabled, setPaymentStatusEnabled] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("Paid");
  const [placeOfSupplyEnabled, setPlaceOfSupplyEnabled] = useState(false);
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [clientName, setClientName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [termEnabled, setTermEnabled] = useState(false);
  const [terms, setTerms] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [upiId, setUpiId] = useState("");
  const [overrideFinalAmount, setOverrideFinalAmount] = useState(false);
  const [manualFinalAmount, setManualFinalAmount] = useState(0);
  const [manualAdjustment, setManualAdjustment] = useState(0);
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    description: true,
    quantity: true,
    unitPrice: true,
    discount: true,
    total: true,
  });
  const [items, setItems] = useState<InvoiceItem[]>([{ id: "item-1", description: "", quantity: 0, unitPrice: 0, discount: 0 }]);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(STORAGE_KEYS.theme);
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
    }
    const savedSequence = Number(window.localStorage.getItem(STORAGE_KEYS.sequence) || "1");
    if (Number.isFinite(savedSequence) && savedSequence > 0) {
      setSequence(savedSequence);
    }
    setPreferencesReady(true);
  }, []);

  useEffect(() => {
    if (preferencesReady) {
      window.localStorage.setItem(STORAGE_KEYS.theme, theme);
      document.documentElement.style.colorScheme = theme;
    }
  }, [preferencesReady, theme]);

  useEffect(() => {
    if (preferencesReady) {
      window.localStorage.setItem(STORAGE_KEYS.sequence, String(sequence));
    }
  }, [preferencesReady, sequence]);

  useEffect(() => {
    setInvoiceDate((current) => current || todayIso());
    setPaymentDate((current) => current || todayIso());
    setDueDate((current) => current || todayIso());
  }, []);

  const invoiceNumber = useMemo(() => makeInvoiceNumber(invoiceDate, sequence), [invoiceDate, sequence]);

  const itemTotals = useMemo(
    () =>
      items.map((item) => {
        const baseAmount = toNumber(item.quantity) * toNumber(item.unitPrice);
        const discountAmount = visibleColumns.discount ? toNumber(item.discount) : 0;
        const total = Math.max(baseAmount - discountAmount, 0);
        return { ...item, baseAmount, discountAmount, total };
      }),
    [items, visibleColumns.discount],
  );

  const subtotal = useMemo(() => itemTotals.reduce((sum, item) => sum + item.total, 0), [itemTotals]);
  const discountTotal = useMemo(() => itemTotals.reduce((sum, item) => sum + item.discountAmount, 0), [itemTotals]);
  const finalAmount = overrideFinalAmount ? Number(manualFinalAmount || 0) : subtotal + Number(manualAdjustment || 0);

  const amountInWords = useMemo(() => {
    const rupees = convertToIndianWords(finalAmount);
    return `Rupees ${rupees} Only`;
  }, [finalAmount]);

  const paymentDetailsEmpty = !bankName && !accountHolder && !accountNumber && !ifsc && !upiId;

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        if (field === "description") return { ...item, description: String(value) };
        if (field === "quantity") return { ...item, quantity: Math.max(0, Number(value) || 0) };
        if (field === "unitPrice") return { ...item, unitPrice: Math.max(0, Number(value) || 0) };
        if (field === "discount") return { ...item, discount: Math.max(0, Number(value) || 0) };
        return item;
      }),
    );
  };

  const addItemRow = () => setItems((current) => [...current, createItem()]);

  const deleteItemRow = (id: string) => {
    setItems((current) => {
      if (current.length === 1) return [{ id: "item-1", description: "", quantity: 0, unitPrice: 0, discount: 0 }];
      return current.filter((item) => item.id !== id);
    });
  };

  const toggleColumn = (column: keyof VisibleColumns) => {
    setVisibleColumns((current) => {
      if (column === "description" || column === "total") return current;
      return { ...current, [column]: !current[column] };
    });
  };

  const validateForm = () => {
    const errors: ValidationErrors = {};

    if (!clientName.trim() && !companyName.trim()) {
      errors.client = "Client Name or Company Name is required.";
    }
    if (!billingAddress.trim()) {
      errors.billingAddress = "Billing Address is required.";
    }
    if (!items.some((item) => item.description.trim() && toNumber(item.quantity) > 0 && toNumber(item.unitPrice) > 0)) {
      errors.items = "Add at least one valid service item.";
    }

    items.forEach((item, index) => {
      if (!item.description.trim()) {
        errors[`item-${index}-description`] = "Description is required.";
      }
      if (toNumber(item.quantity) <= 0) {
        errors[`item-${index}-quantity`] = "Quantity must be greater than zero.";
      }
      if (toNumber(item.unitPrice) <= 0) {
        errors[`item-${index}-unitPrice`] = "Unit price must be greater than zero.";
      }
    });

    return errors;
  };

  const handleDownloadRequest = (event?: { preventDefault: () => void }) => {
    const errors = validateForm();
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      event?.preventDefault();
      return false;
    }
    return true;
  };

  const currentThemeClasses =
    theme === "dark" ? "bg-[#0d1117] text-[#e5e7eb] border-[#2a2f36]" : "bg-[#f5f5f4] text-[#111827] border-[#d6d3d1]";

  const controlClasses =
    theme === "dark"
      ? "bg-[#111827] border-[#374151] text-slate-100 placeholder:text-slate-400 transition-colors duration-150 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
      : "bg-white border-[#d6d3d1] text-slate-900 placeholder:text-slate-400 transition-colors duration-150 focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20";

  const cardClasses =
    theme === "dark" ? "border-[#2c313a] bg-[#0f172a]" : "border-[#e7e5e4] bg-white";

  const pdfDocument = (
    <InvoiceDocument
      invoiceNumber={invoiceNumber}
      invoiceDate={invoiceDate}
      paymentMode={paymentMode}
      paymentDate={paymentDate}
      dueDate={dueDate}
      paymentStatus={paymentStatus}
      paymentStatusEnabled={paymentStatusEnabled}
      placeOfSupply={placeOfSupply}
      placeOfSupplyEnabled={placeOfSupplyEnabled}
      clientName={clientName}
      companyName={companyName}
      billingAddress={billingAddress}
      phone={phone}
      items={items}
      visibleColumns={visibleColumns}
      subtotal={subtotal}
      discountTotal={discountTotal}
      manualAdjustment={manualAdjustment}
      finalAmount={finalAmount}
      amountInWords={amountInWords}
      paymentDetails={{ bankName, accountHolder, accountNumber, ifsc, upiId }}
      terms={terms}
    />
  );

  return (
    <main className={`min-h-screen transition-colors duration-200 ${currentThemeClasses}`}>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-center justify-between gap-4 border-b border-current/10 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[0.7rem] text-zinc-500">
              Stairsky Advertising Private Limited
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Invoice Generator</h1>
          </div>

          <button
            type="button"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sm active:scale-95 ${cardClasses}`}
          >
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-6">
            <div className={`${cardClasses} rounded-md border p-4`}>
              <h2 className="mb-4 text-lg font-semibold">Invoice Details</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium">Invoice Number</span>
                  <input value={invoiceNumber} readOnly className={`w-full rounded-md border px-3 py-2.5 outline-none ${controlClasses}`} />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium">Invoice Date</span>
                  <input type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value || todayIso())} className={`w-full rounded-md border px-3 py-2.5 outline-none ${controlClasses}`} />
                </label>
              </div>

              <div className="mt-4 space-y-3">
                <span className="text-sm font-medium">Date Type</span>
                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex items-center gap-2 text-sm"><input type="radio" name="datemode" checked={paymentMode === "payment"} onChange={() => setPaymentMode("payment")} />Payment Date</label>
                  <label className="inline-flex items-center gap-2 text-sm"><input type="radio" name="datemode" checked={paymentMode === "due"} onChange={() => setPaymentMode("due")} />Due Date</label>
                  <label className="inline-flex items-center gap-2 text-sm"><input type="radio" name="datemode" checked={paymentMode === null} onChange={() => setPaymentMode(null)} />None</label>
                </div>
              </div>

              {(paymentMode === "payment" || paymentMode === "due") && (
                <div className="fade-in mt-4">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">{paymentMode === "payment" ? "Payment Date" : "Due Date"}</span>
                    <input type="date" value={paymentMode === "payment" ? paymentDate : dueDate} onChange={(event) => paymentMode === "payment" ? setPaymentDate(event.target.value || todayIso()) : setDueDate(event.target.value || todayIso())} className={`w-full rounded-md border px-3 py-2.5 outline-none ${controlClasses}`} />
                  </label>
                </div>
              )}

              <div className="mt-4 space-y-3">
                <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={paymentStatusEnabled} onChange={(event) => setPaymentStatusEnabled(event.target.checked)} />Payment Status</label>
                {paymentStatusEnabled && (
                  <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as PaymentStatus)} className={`fade-in w-full rounded-md border px-3 py-2.5 outline-none ${controlClasses}`}>
                    {paymentStatusOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="mt-4 space-y-3">
                <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={placeOfSupplyEnabled} onChange={(event) => setPlaceOfSupplyEnabled(event.target.checked)} />Place of Supply</label>
                {placeOfSupplyEnabled && (
                  <input value={placeOfSupply} onChange={(event) => setPlaceOfSupply(event.target.value)} placeholder="Enter place of supply" className={`fade-in mt-2 w-full rounded-md border px-3 py-2.5 outline-none ${controlClasses}`} />
                )}
              </div>
            </div>

            <div className={`${cardClasses} rounded-md border p-4`}>
              <h2 className="mb-4 text-lg font-semibold">Client Details</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm"><span className="font-medium">Client Name</span><input value={clientName} onChange={(event) => setClientName(event.target.value)} className={`w-full rounded-md border px-3 py-2.5 outline-none ${controlClasses}`} /></label>
                <label className="space-y-2 text-sm"><span className="font-medium">Company Name</span><input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className={`w-full rounded-md border px-3 py-2.5 outline-none ${controlClasses}`} /></label>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <span className="font-medium">Billing Address</span>
                <textarea value={billingAddress} onChange={(event) => setBillingAddress(event.target.value)} rows={4} className={`w-full rounded-md border px-3 py-2.5 outline-none ${controlClasses}`} />
                {validationErrors.billingAddress && <p className="text-xs text-red-500">{validationErrors.billingAddress}</p>}
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <span className="font-medium">Phone Number</span>
                <input value={phone} onChange={(event) => setPhone(event.target.value)} className={`w-full rounded-md border px-3 py-2.5 outline-none ${controlClasses}`} />
              </div>

              {validationErrors.client && <p className="mt-3 text-xs text-red-500">{validationErrors.client}</p>}
            </div>

            <div className={`${cardClasses} rounded-md border p-4`}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Services</h2>
                <button type="button" onClick={addItemRow} className="rounded-md bg-[#111827] px-3 py-2 text-sm font-medium text-white transition-all duration-200 ease-out hover:-translate-y-0.5 hover:opacity-95 active:scale-95 dark:bg-[#f3f4f6] dark:text-[#111827]">+ Add Item</button>
              </div>

              <div className="mb-4 flex flex-wrap gap-3">
                {[
                  { key: "description", label: "Description", disabled: true },
                  { key: "quantity", label: "Quantity" },
                  { key: "unitPrice", label: "Unit Price" },
                  { key: "discount", label: "Discount" },
                  { key: "total", label: "Total Amount", disabled: true },
                ].map((column) => (
                  <label key={column.key} className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    <input type="checkbox" checked={visibleColumns[column.key as keyof VisibleColumns]} disabled={Boolean(column.disabled)} onChange={() => toggleColumn(column.key as keyof VisibleColumns)} />{column.label}
                  </label>
                ))}
              </div>

              <div className="space-y-4">
                {items.map((item, index) => {
                  const itemTotal = toNumber(item.quantity) * toNumber(item.unitPrice) - (visibleColumns.discount ? toNumber(item.discount) : 0);
                  return (
                    <div key={item.id} className="fade-in rounded-md border border-dashed border-current/10 p-3 transition-colors duration-200 hover:border-current/25">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-medium">Item {index + 1}</span>
                        <button type="button" onClick={() => deleteItemRow(item.id)} className="text-xs font-medium text-red-500 transition-all duration-150 hover:translate-x-0.5 hover:text-red-600 active:scale-95">Remove</button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                        {visibleColumns.description && (
                          <label className="space-y-2 text-xs md:col-span-2">
                            <span className="font-medium">Description</span>
                            <input value={item.description} onChange={(event) => updateItem(item.id, "description", event.target.value)} className={`w-full rounded-md border px-3 py-2 outline-none ${controlClasses}`} placeholder="Enter description" />
                            {validationErrors[`item-${index}-description`] && <span className="block text-[10px] text-red-500">{validationErrors[`item-${index}-description`]}</span>}
                          </label>
                        )}

                        {visibleColumns.quantity && (
                          <label className="space-y-2 text-xs">
                            <span className="font-medium">Quantity</span>
                            <input type="number" min="0" value={item.quantity} onChange={(event) => updateItem(item.id, "quantity", Number(event.target.value))} className={`w-full rounded-md border px-3 py-2 outline-none ${controlClasses}`} placeholder="0" />
                            {validationErrors[`item-${index}-quantity`] && <span className="block text-[10px] text-red-500">{validationErrors[`item-${index}-quantity`]}</span>}
                          </label>
                        )}

                        {visibleColumns.unitPrice && (
                          <label className="space-y-2 text-xs">
                            <span className="font-medium">Unit Price</span>
                            <input type="number" min="0" value={item.unitPrice} onChange={(event) => updateItem(item.id, "unitPrice", Number(event.target.value))} className={`w-full rounded-md border px-3 py-2 outline-none ${controlClasses}`} placeholder="0" />
                            {validationErrors[`item-${index}-unitPrice`] && <span className="block text-[10px] text-red-500">{validationErrors[`item-${index}-unitPrice`]}</span>}
                          </label>
                        )}

                        {visibleColumns.discount && (
                          <label className="space-y-2 text-xs">
                            <span className="font-medium">Discount</span>
                            <input type="number" min="0" value={item.discount} onChange={(event) => updateItem(item.id, "discount", Number(event.target.value))} className={`w-full rounded-md border px-3 py-2 outline-none ${controlClasses}`} placeholder="0" />
                          </label>
                        )}

                        {visibleColumns.total && (
                          <div className="flex items-end">
                            <div className="w-full rounded-md border border-dashed border-current/10 bg-current/3 p-2 text-xs">
                              <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">Total</div>
                              <div className="font-semibold">{formatMoney(Math.max(itemTotal, 0))}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {validationErrors.items && <p className="mt-3 text-xs text-red-500">{validationErrors.items}</p>}
            </div>

            <div className={`${cardClasses} rounded-md border p-4`}>
              <h2 className="mb-4 text-lg font-semibold">Amount</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm"><span className="font-medium">Manual Adjustment</span><input type="number" value={manualAdjustment} onChange={(event) => setManualAdjustment(Number(event.target.value) || 0)} className={`w-full rounded-md border px-3 py-2.5 outline-none ${controlClasses}`} /></label>
                <label className="inline-flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={overrideFinalAmount} onChange={(event) => setOverrideFinalAmount(event.target.checked)} />Override Final Amount</label>
              </div>

              {overrideFinalAmount && (
                <div className="fade-in mt-4 space-y-2 text-sm">
                  <span className="font-medium">Manual Final Amount</span>
                  <input type="number" min="0" value={manualFinalAmount} onChange={(event) => setManualFinalAmount(Number(event.target.value) || 0)} className={`w-full rounded-md border px-3 py-2.5 outline-none ${controlClasses}`} />
                </div>
              )}

              <div className="mt-6 space-y-3 rounded-md border border-current/10 p-3">
                <div className="flex items-center justify-between text-sm"><span>Subtotal</span><span className="font-medium">{formatMoney(subtotal)}</span></div>
                <div className="flex items-center justify-between text-sm"><span>Discount</span><span className="font-medium">{formatMoney(discountTotal)}</span></div>
                <div className="flex items-center justify-between text-sm"><span>Adjustment</span><span className="font-medium">{formatMoney(manualAdjustment)}</span></div>
                <div className="flex items-center justify-between border-t border-current/10 pt-3 text-base font-semibold"><span>Final Total</span><span>{formatMoney(finalAmount)}</span></div>
                <div className="border-t border-current/10 pt-3"><div className="text-xs uppercase tracking-wide text-zinc-500">Amount in Words</div><div className="mt-1 text-sm font-medium">{amountInWords}</div></div>
              </div>
            </div>

            <div className={`${cardClasses} rounded-md border p-4`}>
              <h2 className="mb-4 text-lg font-semibold">Payment Details</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm"><span className="font-medium">Bank Name</span><input value={bankName} onChange={(event) => setBankName(event.target.value)} className={`w-full rounded-md border px-3 py-2.5 outline-none ${controlClasses}`} /></label>
                <label className="space-y-2 text-sm"><span className="font-medium">Account Holder Name</span><input value={accountHolder} onChange={(event) => setAccountHolder(event.target.value)} className={`w-full rounded-md border px-3 py-2.5 outline-none ${controlClasses}`} /></label>
                <label className="space-y-2 text-sm"><span className="font-medium">Account Number</span><input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} className={`w-full rounded-md border px-3 py-2.5 outline-none ${controlClasses}`} /></label>
                <label className="space-y-2 text-sm"><span className="font-medium">IFSC Code</span><input value={ifsc} onChange={(event) => setIfsc(event.target.value)} className={`w-full rounded-md border px-3 py-2.5 outline-none ${controlClasses}`} /></label>
                <label className="space-y-2 text-sm md:col-span-2"><span className="font-medium">UPI ID</span><input value={upiId} onChange={(event) => setUpiId(event.target.value)} className={`w-full rounded-md border px-3 py-2.5 outline-none ${controlClasses}`} /></label>
              </div>
            </div>

            <div className={`${cardClasses} rounded-md border p-4`}>
              <label className="mb-3 inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={termEnabled} onChange={(event) => setTermEnabled(event.target.checked)} />Terms & Conditions</label>
              {termEnabled && <textarea value={terms} onChange={(event) => setTerms(event.target.value)} rows={5} className={`fade-in w-full rounded-md border px-3 py-2.5 outline-none ${controlClasses}`} placeholder="Payment once made is non-refundable." />}
            </div>
          </section>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-md border border-[#d1d5db] bg-white p-3 text-[#111827] shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold">Live Invoice Preview</h2>
                <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">A4</span>
              </div>

              <div style={{ margin: "0 auto", width: "100%", maxWidth: 820, background: "white", padding: 16, color: "#111827", boxShadow: "0 0 0 1px rgba(15,23,42,0.08)" }}>
                <div style={{ margin: "0 auto", width: "100%", maxWidth: 760, aspectRatio: "210 / 297", background: "white", padding: 22, fontFamily: "Arial, Helvetica, sans-serif", fontSize: 10 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, borderBottom: "1px solid #d4d4d8", paddingBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0, flex: 1 }}>
                      <img src={COMPANY.logo} alt="company logo" style={{ width: 110, height: 42, objectFit: "fill" }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", lineHeight: 1.2 }}>{COMPANY.name}</div>
                        <div style={{ marginTop: 4, maxWidth: 200, fontSize: 6.8, lineHeight: 1.4, color: "#52525b" }}>{COMPANY.address}</div>
                        <div style={{ marginTop: 4, fontSize: 6.8, color: "#52525b" }}>Phone: {COMPANY.phone} &nbsp; Email: {COMPANY.email}</div>
                      </div>
                    </div>

                    <div style={{ minWidth: 180, textAlign: "right" }}>
                      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1.5 }}>INVOICE</div>
                      <div style={{ marginTop: 8, fontSize: 9, lineHeight: 1.4 }}>
                        <div>Invoice No: {invoiceNumber}</div>
                        <div>Invoice Date: {formatDisplayDate(invoiceDate)}</div>
                        {paymentMode === "due" && <div>Due Date: {formatDisplayDate(dueDate)}</div>}
                        {paymentMode === "payment" && <div>Payment Date: {formatDisplayDate(paymentDate)}</div>}
                        {paymentStatusEnabled && paymentStatus && <div>Payment Status: {paymentStatus}</div>}
                        {placeOfSupplyEnabled && placeOfSupply && <div>Place of Supply: {placeOfSupply}</div>}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-6 border-b border-zinc-300 pb-4">
                    <div>
                      <div className="mb-2 text-[10px] font-bold tracking-[0.18em] text-zinc-700">BILL TO</div>
                      <div className="space-y-1 text-[9px] leading-4">
                        <div>{clientName || companyName || "Client Name"}</div>
                        {companyName && companyName !== clientName && <div>{companyName}</div>}
                        {billingAddress && <div>{billingAddress}</div>}
                        {phone && <div>Phone: {phone}</div>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="mb-2 text-[7px] font-bold tracking-[0.18em] text-zinc-700">SUPPLIED BY</div>
                      <div className="text-right text-[6.8px] leading-[1.45] text-zinc-600">
                        <div>{COMPANY.name}</div>
                        <div>{COMPANY.address}</div>
                        <div>Phone: {COMPANY.phone}</div>
                        <div>Email: {COMPANY.email}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <table className="w-full border-collapse border border-zinc-400 text-left text-[9px]">
                      <thead>
                        <tr className="border-b border-zinc-300 text-zinc-700">
                          {visibleColumns.description && <th className="border-r border-zinc-300 pb-2 pr-2 pl-2 font-bold">Description</th>}
                          {visibleColumns.quantity && <th className="border-r border-zinc-300 pb-2 pr-2 font-bold text-right">Qty</th>}
                          {visibleColumns.unitPrice && <th className="border-r border-zinc-300 pb-2 pr-2 font-bold text-right">Unit Price</th>}
                          {visibleColumns.discount && <th className="border-r border-zinc-300 pb-2 pr-2 font-bold text-right">Discount</th>}
                          {visibleColumns.total && <th className="pb-2 pr-2 font-bold text-right">Amount</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {itemTotals.map((row) => (
                          <tr key={row.id} className="border-b border-zinc-200 align-top">
                            {visibleColumns.description && <td className="border-r border-zinc-200 py-2 pr-2 pl-2 leading-4">{row.description || "-"}</td>}
                            {visibleColumns.quantity && <td className="border-r border-zinc-200 py-2 pr-2 text-right">{toNumber(row.quantity)}</td>}
                            {visibleColumns.unitPrice && <td className="border-r border-zinc-200 py-2 pr-2 text-right">{formatMoney(toNumber(row.unitPrice))}</td>}
                            {visibleColumns.discount && <td className="border-r border-zinc-200 py-2 pr-2 text-right">{formatMoney(toNumber(row.discount))}</td>}
                            {visibleColumns.total && <td className="py-2 pr-2 text-right font-medium">{formatMoney(row.total)}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: 20, marginLeft: "auto", maxWidth: 260, fontSize: 9 }}>
                    <div className="flex items-center justify-between border-b border-zinc-200 pb-1"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
                    <div className="flex items-center justify-between border-b border-zinc-200 py-1"><span>Discount</span><span>{formatMoney(discountTotal)}</span></div>
                    <div className="flex items-center justify-between border-b border-zinc-200 py-1"><span>Adjustment</span><span>{formatMoney(manualAdjustment)}</span></div>
                    <div className="flex items-center justify-between pt-2 text-[12px] font-bold"><span>Total</span><span>{formatMoney(finalAmount)}</span></div>
                  </div>

                  <div className="mt-5 text-[9px]">
                    <div className="mb-1 font-bold">Amount in Words:</div>
                    <div>{amountInWords}</div>
                  </div>

                  {!paymentDetailsEmpty && (
                    <div className="mt-5 border-t border-zinc-300 pt-3">
                      <div className="mb-2 text-[10px] font-bold tracking-[0.18em] text-zinc-700">PAYMENT DETAILS</div>
                      <div className="space-y-1 text-[9px] leading-4 text-zinc-700">
                        {bankName && <div>Bank Name: {bankName}</div>}
                        {accountHolder && <div>Account Holder: {accountHolder}</div>}
                        {accountNumber && <div>Account Number: {accountNumber}</div>}
                        {ifsc && <div>IFSC: {ifsc}</div>}
                        {upiId && <div>UPI ID: {upiId}</div>}
                      </div>
                    </div>
                  )}

                  {termEnabled && terms.trim() && (
                    <div className="mt-5 border-t border-zinc-300 pt-3">
                      <div className="mb-2 text-[10px] font-bold tracking-[0.18em] text-zinc-700">TERMS & CONDITIONS</div>
                      <div className="whitespace-pre-line text-[9px] leading-4 text-zinc-700">{terms}</div>
                    </div>
                  )}

                  <div className="mt-6 flex items-end justify-end border-t border-zinc-300 pt-4">
                    <div className="text-center">
                      <img src={COMPANY.signature} alt="signature" style={{ margin: "0 auto", width: 140, height: 34, objectFit: "contain" }} />
                      <div className="mt-2 border-t border-zinc-300 pt-2 text-[9px] font-bold">{COMPANY.owner}</div>
                      <div className="text-[8px] text-zinc-500">Authorized Signatory</div>
                    </div>
                  </div>
                </div>
              </div>

              <ClientPDFDownloadLink
                document={pdfDocument}
                fileName={`STAIRSKY-Invoice-${invoiceNumber}.pdf`}
                className="mt-4 block w-full rounded-md bg-[#111827] px-4 py-3 text-center text-sm font-semibold text-white transition-all duration-200 ease-out hover:-translate-y-0.5 hover:opacity-95 active:translate-y-0 dark:bg-[#f3f4f6] dark:text-[#111827]"
                onClick={(event) => {
                  const valid = handleDownloadRequest({ preventDefault: () => event.preventDefault() });
                  if (!valid) {
                    event.preventDefault();
                  }
                }}
              >
                {({ loading }) => (loading ? "Generating PDF..." : "Download Invoice PDF")}
              </ClientPDFDownloadLink>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
