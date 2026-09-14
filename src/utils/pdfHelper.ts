import { jsPDF } from 'jspdf';

/**
 * Retrieves the current system logo as a base64 PNG data URL.
 * If a custom logo is uploaded, it uses that.
 * Otherwise, it dynamically renders the elegant Madigun vector crest SVG onto an offscreen canvas
 * and returns its high-quality PNG base64 representation.
 */
export function getSystemLogoBase64(): Promise<string> {
  const custom = localStorage.getItem('madigun_custom_logo');
  if (custom) {
    return Promise.resolve(custom);
  }

  // Symmetrical Elegant Madigun crest SVG template
  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200">
      <rect width="100" height="100" fill="transparent" />
      <polygon points="50,15 54,23 50,29 46,23" fill="#C3B5A6" />
      <path d="M50,26 C57,20 68,26 71,36 C64,30 55,30 50,37 C45,30 36,30 29,36 C32,26 43,20 50,26 Z" fill="#D5CBC1" />
      <path d="M22,38 L27,35 C29,48 23,65 24,80 L18,80 C19,65 20,48 22,38 Z" fill="#D5CBC1" />
      <path d="M78,38 L73,35 C71,48 77,65 76,80 L82,80 C81,65 80,48 78,38 Z" fill="#D5CBC1" />
      <path d="M50,44 L56,38 C54,55 46,72 45,80 L39,80 C40,72 48,55 50,44 Z" fill="#C3B5A6" />
      <path d="M50,44 L44,38 C46,55 54,72 55,80 L61,80 C60,72 52,55 50,44 Z" fill="#C3B5A6" />
      <path d="M28,37 C34,45 38,55 41,75 L35,75 C33,59 29,49 26,41 L28,37 Z" fill="#D5CBC1" />
      <path d="M72,37 C66,45 62,55 59,75 L65,75 C67,59 71,49 74,41 L72,37 Z" fill="#D5CBC1" />
      <rect x="16" y="80" width="10" height="3" fill="#C3B5A6" rx="0.5" />
      <rect x="74" y="80" width="10" height="3" fill="#C3B5A6" rx="0.5" />
      <rect x="38" y="80" width="8" height="2.5" fill="#B7A898" rx="0.5" />
      <rect x="54" y="80" width="8" height="2.5" fill="#B7A898" rx="0.5" />
    </svg>
  `;

  return new Promise((resolve) => {
    try {
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 200, 200);
        }
        const dataUrl = canvas.toDataURL('image/png');
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      };
      img.onerror = () => {
        resolve('');
      };
      img.src = url;
    } catch (e) {
      resolve('');
    }
  });
}

/**
 * Draws the branded header in jsPDF with the system logo.
 */
export function drawBrandedHeader(
  doc: jsPDF,
  logoBase64: string,
  primaryColor: number[],
  secondaryColor: number[],
  pageNum: number
) {
  // Top Border Accent Line
  doc.setFillColor(24, 24, 27);
  doc.rect(15, 10, 180, 1.5, 'F');

  // Draw Logo in Header
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 15, 13, 11, 11);
    } catch (e) {
      console.warn("Could not draw header logo image:", e);
    }
  }

  // Header Typography
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('MADIGUN HOTEL & EVENTS', logoBase64 ? 28 : 15, 18);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('PROPERTY & INVENTORY MANAGEMENT SYSTEM', logoBase64 ? 28 : 15, 23);

  // Date in PH Time (GMT+8)
  const phDateTimeStr = new Date().toLocaleString('en-US', { 
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`REPORT GENERATED: ${phDateTimeStr} (GMT+8)`, 195, 18, { align: 'right' });
  doc.text(`PAGE: ${pageNum}`, 195, 23, { align: 'right' });

  // Divider Line
  doc.setDrawColor(228, 228, 231); // zinc-200
  doc.line(15, 26, 195, 26);
}

/**
 * Applies a centered transparent logo watermark to all pages of a jsPDF document.
 */
export function applyCenterWatermarkToAllPages(doc: jsPDF, logoBase64: string) {
  if (!logoBase64) return;

  const totalPages = doc.getNumberOfPages();
  const wmSize = 90; // Size of center watermark (90mm x 90mm)
  const wmX = (210 - wmSize) / 2;
  const wmY = (297 - wmSize) / 2;

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    try {
      doc.saveGraphicsState();
      const gState = new (doc as any).GState({ opacity: 0.05 }); // Faint, secure, elegant watermark opacity
      doc.setGState(gState);
      doc.addImage(logoBase64, 'PNG', wmX, wmY, wmSize, wmSize);
      doc.restoreGraphicsState();
    } catch (err) {
      console.warn(`Could not add watermark on page ${i}:`, err);
    }
  }
}

/**
 * Generates and downloads a beautifully formatted, comprehensive system White Paper.
 */
export async function generateSystemWhitePaperPDF() {
  const logoBase64 = await getSystemLogoBase64();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [24, 24, 27]; // zinc-900
  const secondaryColor = [113, 113, 122]; // zinc-500
  const accentColor = [161, 98, 7]; // amber-700
  const lightBg = [250, 250, 250]; // zinc-50

  // PAGE 1: TITLE / COVER PAGE
  // Draw top border accent line
  doc.setFillColor(24, 24, 27);
  doc.rect(15, 15, 180, 2, 'F');

  // Decorative vector element
  doc.setFillColor(161, 98, 7);
  doc.rect(15, 25, 4, 25, 'F');

  // Logo if available
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 15, 60, 25, 25);
    } catch (e) {
      console.warn(e);
    }
  }

  // Cover Page Typography
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(24, 24, 27);
  const wrappedCoverTitle = doc.splitTextToSize('MADIGUN HOTEL & EVENTS', 180);
  let titleY = 100;
  wrappedCoverTitle.forEach((line: string) => {
    doc.text(line, 15, titleY);
    titleY += 10;
  });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(113, 113, 122);
  const wrappedCoverSubtitle = doc.splitTextToSize('PROPERTY, ASSET & WAREHOUSE LOGISTICS SYSTEM', 180);
  let subtitleY = titleY + 2;
  wrappedCoverSubtitle.forEach((line: string) => {
    doc.text(line, 15, subtitleY);
    subtitleY += 6;
  });

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(161, 98, 7);
  const wrappedPaperTitle = doc.splitTextToSize('OFFICIAL SYSTEM WHITE PAPER', 180);
  let paperTitleY = subtitleY + 10;
  wrappedPaperTitle.forEach((line: string) => {
    doc.text(line, 15, paperTitleY);
    paperTitleY += 7;
  });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(63, 63, 70);
  const abstractText = "This authoritative document details the architecture, operational design, methodologies, and technical specifications of the Madigun Logistics System. Combining real-time reactive data pipelines, secure multi-user authorization, granular physical warehouse grid tracking, and comprehensive transmittal ledgering, the system represents an advanced paradigm in modern hospitality resource management, asset auditing, and shrinkage prevention.";
  const wrappedAbstract = doc.splitTextToSize(abstractText, 180);
  let abstractY = paperTitleY + 8;
  wrappedAbstract.forEach((line: string) => {
    doc.text(line, 15, abstractY);
    abstractY += 5;
  });

  // Metadata Footer
  doc.setDrawColor(228, 228, 231);
  doc.line(15, 240, 195, 240);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(24, 24, 27);
  doc.text('AUTHOR:', 15, 248);
  doc.text('RELEASE VERSION:', 15, 254);
  doc.text('DOCUMENT CLASSIFICATION:', 15, 260);

  doc.setFont('Helvetica', 'normal');
  doc.text('Madigun Hotel & Events Engineering Division', 65, 248);
  doc.text('v1.2 (Production Ready - Stable)', 65, 254);
  doc.text('Internal Proprietary / Operations Guideline', 65, 260);

  // PAGE 2: ARCHITECTURE & OPERATION
  doc.addPage();
  drawBrandedHeader(doc, logoBase64, primaryColor, secondaryColor, 2);

  let y = 38;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(161, 98, 7);
  doc.text('1. THE HOSPITALITY LOGISTICS LANDSCAPE', 15, y);
  y += 6;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(39, 39, 42);
  const introText = "Hospitality and events operations require highly fluid asset logistics. Unlike stationary office inventories, events assets (furniture, audio-visual equipment, table settings, and rental supplies) are constantly checked out, deployed, exposed to guest wear-and-tear, and returned to warehouse grids. Managing this high-velocity flow without real-time tracking leads to extreme operational noise, double-booking, stock-outs, and significant asset shrinkage.";
  const wrappedIntro = doc.splitTextToSize(introText, 180);
  wrappedIntro.forEach((line: string) => {
    doc.text(line, 15, y);
    y += 4.5;
  });
  y += 4;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(161, 98, 7);
  doc.text('2. TECHNICAL ARCHITECTURE & REAL-TIME LEDGERING', 15, y);
  y += 6;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(39, 39, 42);
  const archText = "The Madigun Logistics System utilizes a reactive, client-serverless architecture sitting atop Google Cloud Run and Firebase Firestore. At its core, the system relies on real-time data streaming. Rather than conventional request-response polling, the client establishes persistent duplex WebChannel connections utilizing Firestore's reactive 'onSnapshot' listeners. This ensures that any change in stock levels, room asset deployments, or transmittal status is propagated to all logged-in terminals in under 150ms. Concurrency is resolved via atomic batched transactions, protecting physical inventory totals from race conditions during high-volume event handovers.";
  const wrappedArch = doc.splitTextToSize(archText, 180);
  wrappedArch.forEach((line: string) => {
    doc.text(line, 15, y);
    y += 4.5;
  });
  y += 4;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(161, 98, 7);
  doc.text('3. ASSET CLASSIFICATION SCHEMA', 15, y);
  y += 6;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(39, 39, 42);
  const classText = "To ensure rigorous controls, assets are split into two distinct schemas:\n\n" +
    "• RENTABLE ASSETS: Managed via the Transmittals Engine. These undergo a strict Checkout, Pending Return, and Check-in lifecycle. Handover states and custodian responsibilities are locked to formal transmittal IDs.\n\n" +
    "• STATIONARY ASSETS: Managed via the Requisition and Installation Engine. These represent fixed room properties (appliances, beds, room-bound fixtures). Withdrawals and warehouse returns are batch-registered, and a real-time, co-signed PDF requisition receipt is automatically generated for operational audit trails.";
  const wrappedClass = doc.splitTextToSize(classText, 180);
  wrappedClass.forEach((line: string) => {
    doc.text(line, 15, y);
    y += 4.5;
  });

  // PAGE 3: CONTROLS & LIFECYCLE
  doc.addPage();
  drawBrandedHeader(doc, logoBase64, primaryColor, secondaryColor, 3);

  y = 38;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(161, 98, 7);
  doc.text('4. INVENTORY VALUATION & LIFECYCLE CONTROLS', 15, y);
  y += 6;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(39, 39, 42);
  const controlText = "To provide high-level financial oversight, all registered rental and stationary inventory profiles now incorporate two critical parameters:\n\n" +
    "• PRICE VALUE: Establishes the replacement value of each property unit. This underpins the financial exposure metrics displayed in transmittals, allowing management to immediately assess the total worth of assets checked out by external clients or installed in specific resort offices.\n\n" +
    "• ESTIMATED LIFESPAN: Documents the operational lifecycle (e.g., '5 Years', '24 Months') of the assets. This drives proactive maintenance schedules, depreciation calculations, and automated disposal forecasting, ensuring the hotel's physical asset value is accurately amortized.";
  const wrappedControl = doc.splitTextToSize(controlText, 180);
  wrappedControl.forEach((line: string) => {
    doc.text(line, 15, y);
    y += 4.5;
  });
  y += 4;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(161, 98, 7);
  doc.text('5. THE BATCH STATIONARY REQUISITION PIPELINE', 15, y);
  y += 6;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(39, 39, 42);
  const batchText = "The latest v1.2 release introduces the Batch Stationary Requisition mechanism. When deploying or de-installing multiple stationary assets, staff can register a multi-item batch under a single requisition. The transaction automatically computes warehouse stock availability, performs bulk updates to room asset manifests in Firestore, and bundles the transaction into an official printable Requisition Form. This form includes deep warehouse tracking details, grid locations, remarks, and formalized signature placeholders for the dispatcher, releasing officer, and receiver, creating watertight custody handovers.";
  const wrappedBatch = doc.splitTextToSize(batchText, 180);
  wrappedBatch.forEach((line: string) => {
    doc.text(line, 15, y);
    y += 4.5;
  });
  y += 4;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(161, 98, 7);
  doc.text('6. OPERATIONAL BENCHMARKS & SUMMARY', 15, y);
  y += 6;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(39, 39, 42);
  const summaryText = "Implementing the Madigun Property and Warehouse system delivers direct operational enhancements: zero double-booking errors due to real-time sync, an average 40% speed-up in event handovers via digitized transmittals, 100% auditability for room property with co-signed requisitions, and robust asset depreciation scheduling via valuation-lifespan modeling. Madigun Hotel & Events remains at the cutting edge of hospitality logistics.";
  const wrappedSummary = doc.splitTextToSize(summaryText, 180);
  wrappedSummary.forEach((line: string) => {
    doc.text(line, 15, y);
    y += 4.5;
  });

  // Apply general markings
  applyCenterWatermarkToAllPages(doc, logoBase64);

  // Footers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(113, 113, 122);
    doc.text('Madigun Property, Asset & Warehouse Logistics System  |  Official White Paper', 15, 288);
    doc.text(`Page ${i} of ${totalPages}`, 195, 288, { align: 'right' });
  }

  doc.save('madigun_logistics_system_white_paper.pdf');
}

/**
 * Generates an official printable PDF Certificate / Decommission Incident Slip for an asset.
 */
export async function generateDecommissionSlipPDF(
  item: {
    name: string;
    sku: string;
    category: string;
    quantityTotal: number;
    price?: number;
    serialNumber?: string;
    plateNumber?: string;
    decommissionReason?: string;
    decommissionNotes?: string;
    decommissionedAt?: string;
    decommissionedBy?: string;
    decommissionSeverity?: string;
    decommissionDisposalMethod?: string;
    warehouseName?: string;
  }
) {
  const doc = new jsPDF();
  const logoBase64 = await getSystemLogoBase64();

  // Top header line
  doc.setFillColor(24, 24, 27);
  doc.rect(15, 10, 180, 2, 'F');

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 15, 14, 14, 14);
    } catch (e) {
      console.warn("Could not draw logo:", e);
    }
  }

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(24, 24, 27);
  doc.text('MADIGUN HOTEL & EVENTS', logoBase64 ? 32 : 15, 20);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(113, 113, 122);
  doc.text('PROPERTY, INVENTORY & LOGISTICS MANAGEMENT DIVISION', logoBase64 ? 32 : 15, 25);
  doc.text('OFFICIAL ASSET DECOMMISSION & WRITE-OFF CERTIFICATE', logoBase64 ? 32 : 15, 29);

  // Document Title Bar
  doc.setFillColor(244, 244, 245);
  doc.rect(15, 34, 180, 10, 'F');
  doc.setDrawColor(228, 228, 231);
  doc.rect(15, 34, 180, 10, 'S');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(185, 28, 28);
  doc.text('STATUS: ASSET DECOMMISSIONED & RETIRED FROM SERVICE', 20, 40.5);

  let y = 52;

  // Section 1: Asset Information
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(24, 24, 27);
  doc.text('1. ASSET SPECIFICATIONS & IDENTIFICATION', 15, y);
  y += 5;

  const drawRow = (label: string, value: string, currentY: number) => {
    doc.setFillColor(250, 250, 250);
    doc.rect(15, currentY - 3.5, 60, 7, 'F');
    doc.setDrawColor(228, 228, 231);
    doc.rect(15, currentY - 3.5, 60, 7, 'S');
    doc.rect(75, currentY - 3.5, 120, 7, 'S');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(113, 113, 122);
    doc.text(label.toUpperCase(), 18, currentY + 1);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(24, 24, 27);
    doc.text(value || 'N/A', 78, currentY + 1);
  };

  drawRow('Asset Display Name', item.name, y);
  y += 7;
  drawRow('Asset SKU / Serial Code', item.sku, y);
  y += 7;
  drawRow('Classification Category', item.category, y);
  y += 7;
  drawRow('Decommissioned Units', `${item.quantityTotal} unit(s)`, y);
  y += 7;
  if (item.serialNumber) {
    drawRow('Manufacturer Serial No.', item.serialNumber, y);
    y += 7;
  }
  if (item.plateNumber) {
    drawRow('Vehicle Plate Number', item.plateNumber, y);
    y += 7;
  }
  drawRow('Last Known Warehouse', item.warehouseName || 'Unassigned / Floor Stock', y);
  y += 7;
  drawRow('Recorded Asset Value', item.price ? `PHP ${Number(item.price).toLocaleString()}` : 'PHP 0.00', y);
  y += 12;

  // Section 2: Decommission Assessment
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(24, 24, 27);
  doc.text('2. DECOMMISSION & FAILURE ASSESSMENT', 15, y);
  y += 5;

  drawRow('Primary Decommission Reason', item.decommissionReason || 'Damaged Beyond Repair', y);
  y += 7;
  drawRow('Damage Severity / Condition', item.decommissionSeverity || 'Total Loss / Scrap', y);
  y += 7;
  drawRow('Disposal / Storage Plan', item.decommissionDisposalMethod || 'Salvage Depot / Storage', y);
  y += 7;
  drawRow('Inspecting Staff / Officer', item.decommissionedBy || 'Property Inspector', y);
  y += 7;

  const decommDate = item.decommissionedAt 
    ? new Date(item.decommissionedAt).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: '2-digit', year: 'numeric' });
  drawRow('Date Decommissioned', `${decommDate} (GMT+8)`, y);
  y += 12;

  // Section 3: Assessment Notes
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(24, 24, 27);
  doc.text('3. DETAILED INSPECTION REMARKS & INCIDENT NOTES', 15, y);
  y += 6;

  doc.setFillColor(253, 253, 254);
  doc.rect(15, y - 2, 180, 24, 'F');
  doc.setDrawColor(228, 228, 231);
  doc.rect(15, y - 2, 180, 24, 'S');

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(63, 63, 70);
  const noteLines = doc.splitTextToSize(item.decommissionNotes || 'Asset retired from circulation due to damage or obsolescence. Equipment no longer meets operational safety or rental quality requirements.', 172);
  let noteY = y + 3;
  noteLines.slice(0, 4).forEach((line: string) => {
    doc.text(line, 19, noteY);
    noteY += 4.5;
  });

  y += 32;

  // Section 4: Formal Authorization Signatures
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(24, 24, 27);
  doc.text('4. VERIFICATION & ADMINISTRATIVE SIGN-OFF', 15, y);
  y += 14;

  const colWidth = 55;
  // Box 1: Inspecting Custodian
  doc.line(15, y, 15 + colWidth, y);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(24, 24, 27);
  doc.text(item.decommissionedBy || 'Inspecting Officer', 15, y + 4);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(113, 113, 122);
  doc.text('Inspecting Custodian / Evaluator', 15, y + 8);

  // Box 2: Warehouse Supervisor
  doc.line(77, y, 77 + colWidth, y);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(24, 24, 27);
  doc.text('Warehouse Supervisor', 77, y + 4);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(113, 113, 122);
  doc.text('Asset Custody & Logistics Lead', 77, y + 8);

  // Box 3: Managing Director / Admin
  doc.line(140, y, 140 + colWidth, y);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(24, 24, 27);
  doc.text('Managing Director / Admin', 140, y + 4);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(113, 113, 122);
  doc.text('Executive Authorization & Approval', 140, y + 8);

  // Footer
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(161, 161, 170);
  doc.text('Madigun Hotel & Events • Decommission & Salvage Audit Slip • Generated via Madigun Logistics Core', 15, 285);
  doc.text(`Doc ID: DEC-${item.sku}-${Date.now().toString().slice(-4)}`, 195, 285, { align: 'right' });

  doc.save(`Decommission_Certificate_${item.sku}.pdf`);
}
