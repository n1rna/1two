import { InvoiceCreator } from "@/components/tools/invoice-creator";
import { ToolInfo } from "@/components/layout/tool-info";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "invoice",
  title: "Invoice Creator - Professional PDF Invoices, EU & US",
  description:
    "Create professional invoices with EU VAT and US sales tax support. Add line items, calculate totals, and export to PDF. All data stays in your browser.",
  keywords: [
    "invoice generator",
    "invoice creator",
    "pdf invoice",
    "vat invoice",
    "sales tax",
    "billing",
    "receipt",
    "eu invoice",
    "us invoice",
    "iban",
    "ein",
    "reverse charge",
  ],
});

export default function InvoicePage() {
  const jsonLd = toolJsonLd("invoice");

  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <InvoiceCreator>
        <ToolInfo>
          <ToolInfo.H2>What is an invoice?</ToolInfo.H2>
          <ToolInfo.P>
            An invoice is a commercial document issued by a seller to a buyer requesting payment for goods or services. In the EU, invoices must comply with <ToolInfo.Code>Directive 2006/112/EC</ToolInfo.Code> and include the seller's VAT identification number, while US invoices typically reference a <ToolInfo.Code>Tax ID / EIN</ToolInfo.Code> and applicable sales tax rates.
          </ToolInfo.P>

          <ToolInfo.H2>EU vs US standards</ToolInfo.H2>
          <ToolInfo.P>
            EU invoices require a <ToolInfo.Code>VAT ID</ToolInfo.Code>, bank details via <ToolInfo.Code>IBAN</ToolInfo.Code> and <ToolInfo.Code>BIC</ToolInfo.Code>, and support mechanisms like <ToolInfo.Strong>reverse charge</ToolInfo.Strong> (transferring tax liability to the buyer) and <ToolInfo.Strong>intra-community supply</ToolInfo.Strong> exemptions for cross-border B2B transactions. US invoices use an <ToolInfo.Code>EIN</ToolInfo.Code>, routing and account numbers for bank transfers, and apply flat sales tax rates per jurisdiction.
          </ToolInfo.P>

          <ToolInfo.H2>How to use this tool</ToolInfo.H2>
          <ToolInfo.UL>
            <li>Select <ToolInfo.Strong>EU or US</ToolInfo.Strong> standard to configure the appropriate fields</li>
            <li>Fill in <ToolInfo.Strong>sender and recipient</ToolInfo.Strong> business details including tax identifiers</li>
            <li>Add <ToolInfo.Strong>line items</ToolInfo.Strong> with description, quantity, unit price, and tax rate</li>
            <li>Review the <ToolInfo.Strong>tax breakdown and total</ToolInfo.Strong> in the summary section</li>
            <li>Click <ToolInfo.Strong>Export PDF</ToolInfo.Strong> to download a professional invoice</li>
            <li><ToolInfo.Strong>Save templates</ToolInfo.Strong> to reuse sender details and common line items</li>
          </ToolInfo.UL>

          <ToolInfo.H2>Common use cases</ToolInfo.H2>
          <ToolInfo.UL>
            <li>Freelancers billing clients for project work or hourly services</li>
            <li>EU cross-border B2B invoicing with reverse charge or intra-community supply</li>
            <li>Small businesses generating tax-compliant invoices without accounting software</li>
            <li>Contractors creating one-off invoices with proper tax documentation</li>
          </ToolInfo.UL>


        </ToolInfo>
      </InvoiceCreator>
    </>
  );
}
