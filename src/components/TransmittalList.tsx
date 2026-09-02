import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Calendar, User, MapPin, ClipboardCheck, ArrowLeftRight, Clock, X, CheckSquare, PlusCircle, MinusCircle, CheckCircle, MessageSquare, Printer, Trash2 } from 'lucide-react';
import { localStore } from '../localStore';
import { Transmittal, InventoryItem, Custodian, TransmittalItem, UserSession } from '../types';
import { jsPDF } from 'jspdf';
import { getSystemLogoBase64, drawBrandedHeader, applyCenterWatermarkToAllPages } from '../utils/pdfHelper';

interface TransmittalListProps {
  transmittals: Transmittal[];
  inventory: InventoryItem[];
  onReturnItems: (
    transmittalId: string,
    returns: { itemId: string; quantityToReturn: number }[],
    newStatus: 'Pending' | 'On Going' | 'Partially Returned' | 'Returned'
  ) => Promise<void>;
  onDeleteTransmittal: (id: string, restoreInventory?: boolean) => Promise<void>;
  currentUser?: UserSession | null;
  onReverseReconciliation?: (transmittalId: string) => Promise<void>;
}

export default function TransmittalList({ transmittals, inventory, onReturnItems, onDeleteTransmittal, currentUser, onReverseReconciliation }: TransmittalListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedTx, setSelectedTx] = useState<Transmittal | null>(null);

  // Return quantities form state (itemId -> number)
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReverseConfirm, setShowReverseConfirm] = useState(false);

  // Edit manifest items state
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [editingItems, setEditingItems] = useState<TransmittalItem[]>([]);
  const [editItemSearchQuery, setEditItemSearchQuery] = useState('');
  const [showEditItemDropdown, setShowEditItemDropdown] = useState(false);

  // Date-Range Report Generation States
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const generateDateRangePDFReport = async () => {
    if (!reportStartDate || !reportEndDate) {
      alert("Please select a valid date range first!");
      return;
    }
    if (reportStartDate > reportEndDate) {
      alert("Start Date cannot be after End Date!");
      return;
    }

    // Filter transmittals that fall within the selected date range
    const filteredReportTxs = transmittals.filter(tx => {
      const checkoutDate = tx.dateCheckout;
      return checkoutDate >= reportStartDate && checkoutDate <= reportEndDate;
    });

    if (filteredReportTxs.length === 0) {
      alert("No transmittal records found within the selected date range!");
      return;
    }

    // Sort by checkout date descending (most recent first)
    filteredReportTxs.sort((a, b) => b.dateCheckout.localeCompare(a.dateCheckout));

    const logoBase64 = await getSystemLogoBase64();
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor = [24, 24, 27]; // zinc-900
    const secondaryColor = [113, 113, 122]; // zinc-500
    const lightBg = [244, 244, 245]; // zinc-100

    let y = 15;

    const drawHeader = (pageNum: number) => {
      drawBrandedHeader(doc, logoBase64, primaryColor, secondaryColor, pageNum);
    };

    drawHeader(1);
    y = 35;

    // Report Title & Metadata
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    const wrappedReportTitle = doc.splitTextToSize(`OFFICIAL TRANSMITTAL REGISTER REPORT`, 180);
    wrappedReportTitle.forEach((line: string) => {
      doc.text(line, 15, y);
      y += 5;
    });

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    const filterText = `FILTERS: ${reportStartDate} TO ${reportEndDate}    |    TOTAL CONTRACTS: ${filteredReportTxs.length}`;
    const wrappedFilters = doc.splitTextToSize(filterText, 180);
    wrappedFilters.forEach((line: string) => {
      doc.text(line, 15, y);
      y += 4.5;
    });
    y += 4.5;

    // Table Header
    const drawTableHeader = (currentY: number) => {
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.rect(15, currentY, 180, 8, 'F');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(63, 63, 70); // zinc-700

      doc.text('TX NO.', 17, currentY + 5.5);
      doc.text('DATE', 36, currentY + 5.5);
      doc.text('RENTEE / REPRESENTATIVE', 55, currentY + 5.5);
      doc.text('ITEMS SUMMARY & QUANTITY', 105, currentY + 5.5);
      doc.text('STATUS', 172, currentY + 5.5);

      doc.setDrawColor(200, 200, 200);
      doc.line(15, currentY + 8, 195, currentY + 8);
    };

    drawTableHeader(y);
    y += 8;

    let currentPage = 1;

    filteredReportTxs.forEach((tx, idx) => {
      const itemsSummary = tx.items.map(item => `${item.name} (x${item.quantity})`).join(', ');
      
      const wrappedTxNo = doc.splitTextToSize(tx.transmittalNo || '-', 16);
      const wrappedDate = doc.splitTextToSize(tx.dateCheckout || '-', 16);
      const wrappedRentee = doc.splitTextToSize(tx.rentee || '-', 45);
      const wrappedItems = doc.splitTextToSize(itemsSummary || '-', 64);
      const wrappedStatus = doc.splitTextToSize(tx.status || '-', 20);

      const maxTextLines = Math.max(
        wrappedTxNo.length,
        wrappedDate.length,
        wrappedRentee.length,
        wrappedItems.length,
        wrappedStatus.length
      );
      const rowHeight = Math.max(maxTextLines * 3.5 + 4, 10);

      // Page limit check
      if (y + rowHeight > 260) {
        doc.addPage();
        currentPage++;
        drawHeader(currentPage);
        y = 32;
        drawTableHeader(y);
        y += 8;
      }

      if (idx % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(15, y, 180, rowHeight, 'F');
      }

      // TX No lines
      doc.setFont('Helvetica', 'bold');
      let txNoY = y + 5;
      wrappedTxNo.forEach(line => {
        let size = 7.5;
        doc.setFontSize(size);
        while (doc.getTextWidth(line) > 16 && size > 5) {
          size -= 0.5;
          doc.setFontSize(size);
        }
        doc.text(line, 17, txNoY);
        txNoY += 3.5;
      });

      // Date lines
      doc.setFont('Helvetica', 'normal');
      let dateY = y + 5;
      wrappedDate.forEach(line => {
        let size = 7;
        doc.setFontSize(size);
        while (doc.getTextWidth(line) > 16 && size > 5) {
          size -= 0.5;
          doc.setFontSize(size);
        }
        doc.text(line, 36, dateY);
        dateY += 3.5;
      });

      // Rentee lines
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(39, 39, 42); // zinc-800
      let renteeY = y + 5;
      wrappedRentee.forEach(line => {
        let size = 7;
        doc.setFontSize(size);
        while (doc.getTextWidth(line) > 45 && size > 5) {
          size -= 0.5;
          doc.setFontSize(size);
        }
        doc.text(line, 55, renteeY);
        renteeY += 3.5;
      });

      // Items lines
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(63, 63, 70); // zinc-700
      let itemsY = y + 5;
      wrappedItems.forEach(line => {
        let size = 7;
        doc.setFontSize(size);
        while (doc.getTextWidth(line) > 64 && size > 5) {
          size -= 0.5;
          doc.setFontSize(size);
        }
        doc.text(line, 105, itemsY);
        itemsY += 3.5;
      });

      // Status lines
      doc.setFont('Helvetica', 'bold');
      if (tx.status === 'Returned') {
        doc.setTextColor(22, 101, 52); // green-800
      } else if (tx.status === 'Partially Returned') {
        doc.setTextColor(154, 52, 18); // orange-800
      } else {
        doc.setTextColor(153, 27, 27); // red-800
      }
      
      let statusY = y + 5;
      wrappedStatus.forEach(line => {
        let size = 7;
        doc.setFontSize(size);
        while (doc.getTextWidth(line.toUpperCase()) > 20 && size > 5) {
          size -= 0.5;
          doc.setFontSize(size);
        }
        doc.text(line.toUpperCase(), 172, statusY);
        statusY += 3.5;
      });

      doc.setDrawColor(244, 244, 245);
      doc.line(15, y + rowHeight, 195, y + rowHeight);

      y += rowHeight;
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(113, 113, 122);
      doc.text('Madigun Property, Asset & Warehouse Logistics System', 15, 288);
      doc.text(`Page ${i} of ${totalPages}`, 195, 288, { align: 'right' });
    }

    applyCenterWatermarkToAllPages(doc, logoBase64);

    doc.save(`madigun_transmittals_report_${reportStartDate}_to_${reportEndDate}.pdf`);
  };

  // Custodian signing support
  const [custodians, setCustodians] = useState<Custodian[]>([]);
  const [signingCustodian, setSigningCustodian] = useState('');

  // Reset states when the selected transmittal changes
  React.useEffect(() => {
    setShowDeleteConfirm(false);
    setShowReverseConfirm(false);
    setErrorMsg('');
    setSuccessMsg('');
    setSigningCustodian('');
  }, [selectedTx]);

  // Listen to custodians in real-time
  useEffect(() => {
    const unsubscribe = localStore.subscribe<Custodian>('custodians', (list) => {
      setCustodians(list || []);
    });
    return () => unsubscribe();
  }, []);

  const handleSignRelease = async () => {
    if (!selectedTx || !signingCustodian) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      await localStore.updateItem('transmittals', selectedTx.id, {
        custodianSigned: true,
        custodianSignedBy: signingCustodian,
        custodianSignedAt: today
      });
      // Update local state instantly
      setSelectedTx({
        ...selectedTx,
        custodianSigned: true,
        custodianSignedBy: signingCustodian,
        custodianSignedAt: today
      });
      setSuccessMsg('Transmittal release signed off successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg('Failed to sign off release: ' + err.message);
    }
  };

  const handleRequestGatePassApproval = async () => {
    if (!selectedTx || !currentUser) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const requester = currentUser.fullName || currentUser.username || 'Front Desk';
      await localStore.updateItem('transmittals', selectedTx.id, {
        gatePassRequested: true,
        gatePassRequestedBy: requester,
        gatePassRequestedAt: today
      });
      // Update local state instantly
      setSelectedTx({
        ...selectedTx,
        gatePassRequested: true,
        gatePassRequestedBy: requester,
        gatePassRequestedAt: today
      });
      setSuccessMsg('Gate pass approval request submitted successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg('Failed to submit approval request: ' + err.message);
    }
  };

  const handleReverseReconciliationClick = async () => {
    if (!selectedTx || !onReverseReconciliation) return;
    try {
      setIsSubmitting(true);
      await onReverseReconciliation(selectedTx.id);
      
      // Update selectedTx local state to match the reset transmittal
      const resetItems = selectedTx.items.map(item => ({
        ...item,
        returnedQuantity: 0
      }));
      setSelectedTx({
        ...selectedTx,
        status: 'Pending',
        items: resetItems
      });

      setShowReverseConfirm(false);
      setSuccessMsg('Reconciliation reversed! Status is now pending, and inventory levels have been adjusted.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg('Failed to reverse reconciliation: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // Print Transmittal PDF function
  const handlePrintPDF = (tx: Transmittal) => {
    const printWindow = window.open('', '_blank', 'width=850,height=950');
    if (!printWindow) {
      alert("Please allow pop-ups to generate the print-ready document!");
      return;
    }

    const customLogo = localStorage.getItem('madigun_custom_logo');

    const itemsHtml = tx.items.map(item => `
      <tr style="border-bottom: 1px solid #E6DFD6;">
        <td style="padding: 6px 8px; font-family: monospace; font-size: 10px; color: #4E4037;">${item.sku}</td>
        <td style="padding: 6px 8px; font-weight: bold; font-size: 11px; color: #251D19; text-transform: uppercase;">${item.name}</td>
        <td style="padding: 6px 8px; text-align: center; color: #251D19; font-weight: 700; font-size: 11px;">${item.quantity}</td>
        <td style="padding: 6px 8px; text-align: center; color: #837265; font-weight: 600; font-size: 11px;">${item.returnedQuantity}</td>
        <td style="padding: 6px 8px; text-align: right;">
          <span style="
            display: inline-block;
            font-size: 8px;
            font-weight: 800;
            padding: 2px 6px;
            border: 1px solid ${item.returnedQuantity === item.quantity ? '#A7F3D0' : '#FDE68A'};
            background-color: ${item.returnedQuantity === item.quantity ? '#ECFDF5' : '#FEF3C7'};
            color: ${item.returnedQuantity === item.quantity ? '#047857' : '#D97706'};
            letter-spacing: 0.05em;
          ">
            ${item.returnedQuantity === item.quantity ? 'RECONCILED' : 'RENTED'}
          </span>
        </td>
      </tr>
    `).join('');

    const isOverdue = tx.status !== 'Returned' && tx.dateCheckin < todayStr;
    const statusText = isOverdue ? 'OVERDUE' : (tx.status === 'Pending' ? 'ON GOING' : tx.status.toUpperCase());
    const statusBg = tx.status === 'Returned' ? '#ECFDF5' : (isOverdue ? '#FEF2F2' : '#F3EFEA');
    const statusBorder = tx.status === 'Returned' ? '#A7F3D0' : (isOverdue ? '#FCA5A5' : '#E6DFD6');
    const statusColor = tx.status === 'Returned' ? '#047857' : (isOverdue ? '#DC2626' : '#4E4037');

    printWindow.document.write(`
      <html>
        <head>
          <title>Madigun Rental Transmittal - ${tx.transmittalNo}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@300;400;500;600;700&display=swap');
            @page {
              size: portrait;
              margin: 8mm 10mm;
            }
            body {
              font-family: 'Inter', sans-serif;
              color: #251D19;
              background-color: #FFFFFF;
              margin: 0;
              padding: 20px;
              line-height: 1.4;
              position: relative;
            }
            .header-container {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #251D19;
              padding-bottom: 10px;
              margin-bottom: 15px;
            }
            .logo-title {
              font-family: 'Outfit', sans-serif;
              letter-spacing: 0.22em;
              font-size: 22px;
              font-weight: 300;
              color: #251D19;
              margin: 0;
              text-transform: uppercase;
            }
            .logo-sub {
              font-size: 9px;
              letter-spacing: 0.18em;
              font-weight: 700;
              color: #837265;
              text-transform: uppercase;
              margin-top: 2px;
            }
            .document-info {
              text-align: right;
            }
            .doc-label {
              font-size: 9px;
              font-weight: 800;
              letter-spacing: 0.15em;
              color: #837265;
              text-transform: uppercase;
            }
            .doc-no {
              font-family: monospace;
              font-size: 18px;
              font-weight: bold;
              color: #251D19;
              margin-top: 2px;
            }
            .details-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px 12px;
              background-color: #FAF8F6;
              border: 1px solid #E6DFD6;
              padding: 12px 16px;
              margin-bottom: 15px;
              position: relative;
              z-index: 1;
            }
            .detail-card h4 {
              font-size: 8px;
              font-weight: 800;
              letter-spacing: 0.12em;
              color: #837265;
              text-transform: uppercase;
              margin: 0 0 4px 0;
            }
            .detail-card p {
              font-size: 11px;
              font-weight: 700;
              color: #251D19;
              margin: 0;
              text-transform: uppercase;
            }
            .manifest-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
              position: relative;
              z-index: 1;
            }
            .manifest-table th {
              font-size: 8px;
              font-weight: 800;
              letter-spacing: 0.12em;
              color: #837265;
              text-transform: uppercase;
              border-bottom: 2px solid #251D19;
              padding: 6px 8px;
              text-align: left;
            }
            .notes-block {
              background-color: #FAF8F6;
              border-left: 3px solid #837265;
              padding: 8px 12px;
              margin-bottom: 15px;
              font-style: italic;
              font-size: 10px;
              color: #4E4037;
              position: relative;
              z-index: 1;
            }
            .terms-block {
              font-size: 8px;
              color: #6B5C51;
              border-top: 1px solid #E6DFD6;
              padding-top: 8px;
              margin-bottom: 15px;
              position: relative;
              z-index: 1;
            }
            .terms-hdr {
              font-weight: 800;
              text-transform: uppercase;
              margin-bottom: 4px;
              letter-spacing: 0.08em;
              color: #251D19;
              font-size: 8.5px;
            }
            .terms-text {
              margin-bottom: 3px;
              line-height: 1.35;
            }
            .signature-area {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 20px;
              margin-top: 15px;
              page-break-inside: avoid;
              position: relative;
              z-index: 1;
            }
            .signature-field {
              border-top: 1px solid #251D19;
              text-align: center;
              padding-top: 6px;
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
              color: #251D19;
              letter-spacing: 0.05em;
            }
            .signature-sub {
              font-size: 7.5px;
              color: #837265;
              margin-top: 2px;
            }
            .watermark-container {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 220px;
              height: 220px;
              opacity: 0.04;
              pointer-events: none;
              z-index: 0;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .watermark-container svg, .watermark-container img {
              width: 100%;
              height: 100%;
              object-fit: contain;
            }
            @media print {
              body {
                padding: 0;
                margin: 0;
              }
              .no-print {
                display: none;
              }
            }
            .print-btn {
              position: fixed;
              bottom: 30px;
              right: 30px;
              z-index: 999;
              background-color: #251D19;
              color: #FFFFFF;
              border: none;
              padding: 10px 20px;
              font-family: 'Inter', sans-serif;
              font-size: 11px;
              font-weight: bold;
              letter-spacing: 0.12em;
              text-transform: uppercase;
              cursor: pointer;
              box-shadow: 0 4px 20px rgba(0,0,0,0.2);
              transition: all 0.2s;
            }
            .print-btn:hover {
              background-color: #4E4037;
            }
          </style>
        </head>
        <body>
          <button class="print-btn no-print" onclick="window.print()">Print Transmittal</button>

          <div class="watermark-container">
            ${customLogo ? `<img src="${customLogo}" />` : `
              <svg viewBox="0 0 100 100" style="color: #251D19;" fill="currentColor">
                <polygon points="50,15 54,23 50,29 46,23" fill="#C3B5A6" />
                <path d="M50,26 C57,20 68,26 71,36 C64,30 55,30 50,37 C45,30 36,30 29,36 C32,26 43,20 50,26 Z" fill="#D5CBC1" />
                <path d="M22,38 L27,35 C29,48 23,65 24,80 L18,80 C19,65 20,48 22,38 Z" fill="#D5CBC1" />
                <path d="M78,38 L73,35 C71,48 77,65 76,80 L82,80 C81,65 80,48 78,38 Z" fill="#D5CBC1" />
                <path d="M50,44 L56,38 C54,55 46,72 45,80 L39,80 C40,72 48,55 50,44 Z" fill="#C3B5A6" />
                <path d="M50,44 L44,38 C46,55 54,72 55,80 L61,80 C60,72 52,55 50,44 Z" fill="#C3B5A6" />
                <path d="M28,37 C34,45 38,55 41,75 L35,75 C33,59 29,49 26,41 L28,37 Z" fill="#D5CBC1" />
                <path d="M72,37 C66,45 62,55 59,75 L65,75 C67,59 71,49 74,41 L72,37 Z" fill="#D5CBC1" />
              </svg>
            `}
          </div>

          <div class="header-container">
            <div style="display: flex; align-items: center; gap: 12px;">
              ${customLogo ? `<img src="${customLogo}" style="height: 38px; width: auto; object-fit: contain;" />` : `
                <div style="width: 36px; height: 36px; display: inline-block;">
                  <svg viewBox="0 0 100 100" style="width: 100%; height: 100%; color: #C3B5A6;" fill="currentColor">
                    <polygon points="50,15 54,23 50,29 46,23" fill="#C3B5A6" />
                    <path d="M50,26 C57,20 68,26 71,36 C64,30 55,30 50,37 C45,30 36,30 29,36 C32,26 43,20 50,26 Z" fill="#D5CBC1" />
                    <path d="M22,38 L27,35 C29,48 23,65 24,80 L18,80 C19,65 20,48 22,38 Z" fill="#D5CBC1" />
                    <path d="M78,38 L73,35 C71,48 77,65 76,80 L82,80 C81,65 80,48 78,38 Z" fill="#D5CBC1" />
                    <path d="M50,44 L56,38 C54,55 46,72 45,80 L39,80 C40,72 48,55 50,44 Z" fill="#C3B5A6" />
                    <path d="M50,44 L44,38 C46,55 54,72 55,80 L61,80 C60,72 52,55 50,44 Z" fill="#C3B5A6" />
                    <path d="M28,37 C34,45 38,55 41,75 L35,75 C33,59 29,49 26,41 L28,37 Z" fill="#D5CBC1" />
                    <path d="M72,37 C66,45 62,55 59,75 L65,75 C67,59 71,49 74,41 L72,37 Z" fill="#D5CBC1" />
                  </svg>
                </div>
              `}
              <div>
                <h1 class="logo-title" style="font-size: 20px;">MADIGUN</h1>
                <div class="logo-sub">HOTEL & EVENTS • RENTALS</div>
              </div>
            </div>
            <div class="document-info">
              <div class="doc-label">Official Transmittal & Rental Contract</div>
              <div class="doc-no">${tx.transmittalNo}</div>
            </div>
          </div>

          <div class="details-grid">
            <div class="detail-card">
              <h4>Recipient (Rentee)</h4>
              <p>${tx.rentee}</p>
            </div>
            <div class="detail-card">
              <h4>Custodian Handler</h4>
              <p>${tx.handler}</p>
            </div>
            <div class="detail-card">
              <h4>Delivery Grid / Event Venue</h4>
              <p>${tx.address}</p>
            </div>
            <div class="detail-card">
              <h4>Dispatch Status</h4>
              <p>
                <span style="
                  display: inline-block;
                  font-size: 9px;
                  font-weight: 800;
                  padding: 2px 8px;
                  border: 1px solid ${statusBorder};
                  background-color: ${statusBg};
                  color: ${statusColor};
                  letter-spacing: 0.05em;
                ">
                  ${statusText}
                </span>
              </p>
            </div>
            <div class="detail-card">
              <h4>Date Outbound</h4>
              <p style="font-family: monospace;">${tx.dateCheckout}</p>
            </div>
            <div class="detail-card">
              <h4>Due Return Date</h4>
              <p style="font-family: monospace; ${isOverdue ? 'color: #DC2626; font-weight: bold;' : ''}">${tx.dateCheckin}</p>
            </div>
          </div>

          <h3 style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; color: #837265; margin-bottom: 8px; border-bottom: 2px solid #251D19; padding-bottom: 4px;">
            RENTAL ASSETS MANIFEST
          </h3>

          <table class="manifest-table">
            <thead>
              <tr>
                <th style="width: 25%;">Item SKU</th>
                <th style="width: 45%;">Item Name / Particulars</th>
                <th style="width: 15%; text-align: center;">Qty Out</th>
                <th style="width: 15%; text-align: center;">Qty In</th>
                <th style="width: 15%; text-align: right;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          ${tx.notes ? `
            <div class="notes-block">
              <strong>Logistics & Special Handling Instructions:</strong><br/>
              "${tx.notes}"
            </div>
          ` : ''}

          <div class="terms-block">
            <div class="terms-hdr">Rental Terms & Operational Conditions</div>
            <div class="terms-text">
              1. <strong>CUSTODY TRANSFER & SATISFACTION:</strong> The Recipient (Rentee) acknowledges that all specified assets have been inspected and received in excellent working order. Custody, care, and physical control of these items are transferred fully to the Recipient.
            </div>
            <div class="terms-text">
              2. <strong>DAMAGE & PHYSICAL LOSS LIABILITY:</strong> The Recipient accepts full financial responsibility for repair or complete replacement costs of any listed assets in the event of theft, damage, or operational abuse during the designated rental timeframe.
            </div>
            <div class="terms-text">
              3. <strong>RECONCILIATION DEADLINE:</strong> All checked-out assets must be returned to the warehouse under custodian observation on or before the due return date. Late returns or failure to reconcile the manifest will trigger standard penalty fees.
            </div>
          </div>

          <div class="signature-area">
            <div class="signature-field" style="border-top: none; padding-top: 0; text-align: center;">
              <div style="height: 25px; display: flex; align-items: flex-end; justify-content: center; font-family: monospace; font-size: 11px; font-weight: bold; color: #251D19; text-transform: uppercase; padding-bottom: 4px; letter-spacing: 0.05em;">
                ${tx.handler}
              </div>
              <div style="border-top: 1px solid #251D19; padding-top: 6px; font-size: 9px; font-weight: 700; text-transform: uppercase; color: #251D19; letter-spacing: 0.05em;">
                Authorized Dispatcher
              </div>
              <div class="signature-sub">Logistics / Creator</div>

              ${tx.custodianSigned ? `
                <div style="margin-top: 8px; font-family: 'Inter', sans-serif; font-size: 8px; font-weight: bold; color: #047857; border: 1px dashed #A7F3D0; padding: 3px; background-color: #ECFDF5; text-transform: uppercase; text-align: center;">
                  Release Signed By:<br/>
                  <span style="font-size: 9px; font-weight: 800;">${tx.custodianSignedBy}</span>
                  <div style="font-size: 8px; font-weight: normal; color: #065F46; margin-top: 1px;">Co-Signee • Approved on ${tx.custodianSignedAt}</div>
                </div>
              ` : `
                <div style="margin-top: 8px; border-top: 1px dashed #E6DFD6; padding-top: 4px; text-align: center;">
                  <span style="font-size: 8px; color: #A1A1AA; letter-spacing: 0.05em; text-transform: uppercase; font-weight: normal;">Pending Custodian Sign-Off (Co-Signee)</span>
                </div>
              `}
            </div>
            <div class="signature-field" style="border-top: none; padding-top: 0; text-align: center;">
              <div style="height: 25px; display: flex; align-items: flex-end; justify-content: center; font-family: monospace; font-size: 11px; font-weight: bold; color: #251D19; text-transform: uppercase; padding-bottom: 4px; letter-spacing: 0.05em;">
                ${tx.rentee}
              </div>
              <div style="border-top: 1px solid #251D19; padding-top: 6px; font-size: 9px; font-weight: 700; text-transform: uppercase; color: #251D19; letter-spacing: 0.05em;">
                Acknowledge Recipient
              </div>
              <div class="signature-sub">Authorized Rentee Signature</div>
            </div>
            <div class="signature-field" style="border-top: none; padding-top: 0; text-align: center;">
              <div style="height: 25px; display: flex; align-items: flex-end; justify-content: center; font-family: monospace; font-size: 11px; font-weight: bold; color: #251D19; text-transform: uppercase; padding-bottom: 4px; letter-spacing: 0.05em;">
                ${tx.custodianSignedBy || tx.handler || 'Authorized Custodian'}
              </div>
              <div style="border-top: 1px solid #251D19; padding-top: 6px; font-size: 9px; font-weight: 700; text-transform: uppercase; color: #251D19; letter-spacing: 0.05em;">
                Audited & Reconciled
              </div>
              <div class="signature-sub">Custodian Verification Signature</div>
            </div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filter transmittals
  const filteredTransmittals = transmittals.filter(tx => {
    const matchesSearch = 
      tx.transmittalNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.rentee.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.handler.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = 
      selectedStatus === 'All' || 
      (selectedStatus === 'On Going' && (tx.status === 'On Going' || tx.status === 'Pending')) ||
      tx.status === selectedStatus ||
      (selectedStatus === 'Overdue' && tx.status !== 'Returned' && tx.dateCheckin < todayStr);

    return matchesSearch && matchesStatus;
  });

  const pendingTickets = filteredTransmittals.filter(tx => tx.status !== 'Returned');
  const fullyReconciledTickets = filteredTransmittals.filter(tx => tx.status === 'Returned');

  const renderCard = (tx: Transmittal) => {
    const isOverdue = tx.status !== 'Returned' && tx.dateCheckin < todayStr;
    const itemsCount = tx.items.reduce((acc, item) => acc + item.quantity, 0);
    const returnedCount = tx.items.reduce((acc, item) => acc + item.returnedQuantity, 0);
    
    return (
      <motion.div
        layout
        id={`tx-card-${tx.transmittalNo}`}
        key={tx.id}
        onClick={() => handleOpenDetails(tx)}
        className="bg-white border border-zinc-200 p-6 cursor-pointer flex flex-col justify-between hover:border-zinc-900 relative group transition-all"
      >
        <div>
          <div className="flex justify-between items-start gap-2">
            <span className="font-mono text-xs font-bold text-zinc-400 group-hover:text-zinc-900 transition-colors">
              {tx.transmittalNo}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrintPDF(tx);
                }}
                className="p-1 border border-zinc-200 hover:border-zinc-500 hover:bg-zinc-50 text-zinc-500 hover:text-zinc-950 transition-all cursor-pointer flex items-center justify-center"
                title="Print Official PDF"
              >
                <Printer className="h-3 w-3" />
              </button>
              {tx.custodianSigned ? (
                <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border bg-emerald-50 text-emerald-800 border-emerald-200">
                  Gate Pass Cleared
                </span>
              ) : tx.gatePassRequested ? (
                <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border bg-amber-50 text-amber-800 border-amber-200 animate-pulse">
                  Pending Approval
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border bg-zinc-50 text-zinc-400 border-zinc-150">
                  Pending Request
                </span>
              )}
              <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                tx.status === 'Returned' 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : tx.status === 'Partially Returned'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : isOverdue
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-zinc-100 text-zinc-800 border-zinc-200'
              }`}>
                {isOverdue ? 'Overdue' : (tx.status === 'Pending' ? 'On Going' : tx.status)}
              </span>
            </div>
          </div>

          <h3 className="mt-4 text-sm font-bold text-zinc-900 uppercase tracking-tight leading-tight">
            {tx.rentee}
          </h3>
          
          <div className="text-xs text-zinc-500 space-y-2 mt-4">
            <div className="flex items-center">
              <User className="h-3.5 w-3.5 mr-1.5 text-zinc-400 shrink-0" />
              <span className="text-[11px] uppercase tracking-wide font-semibold text-zinc-500">Issued by: <span className="font-bold text-zinc-700">{tx.handler}</span></span>
            </div>
            <div className="flex items-center">
              <MapPin className="h-3.5 w-3.5 mr-1.5 text-zinc-400 shrink-0" />
              <span className="truncate text-[11px] uppercase tracking-wide font-semibold text-zinc-500">Grid: <span className="font-bold text-zinc-700">{tx.address}</span></span>
            </div>
            <div className="flex items-center">
              <Calendar className="h-3.5 w-3.5 mr-1.5 text-zinc-400 shrink-0" />
              <span className="text-[11px] uppercase tracking-wide font-semibold text-zinc-500">Out Date: <span className="font-bold text-zinc-700 font-mono">{tx.dateCheckout}</span></span>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-zinc-100 flex justify-between items-center text-xs">
          <div className="flex items-center text-zinc-500 font-mono text-[10px] uppercase font-bold tracking-wider">
            <Clock className="h-3 w-3 mr-1 text-zinc-400" />
            <span>Due: {tx.dateCheckin}</span>
          </div>
          <div className="font-bold text-zinc-700 font-mono">
            {returnedCount} / {itemsCount} units in
          </div>
        </div>
      </motion.div>
    );
  };

  // Open Details Modal and initialize return quantities form
  const handleOpenDetails = (tx: Transmittal) => {
    setSelectedTx(tx);
    setErrorMsg('');
    setSuccessMsg('');
    setIsEditingItems(false);
    setEditingItems([]);
    setEditItemSearchQuery('');
    setShowEditItemDropdown(false);
    
    // Initialize return quantities state to 0 for all items
    const initialQtys: Record<string, number> = {};
    tx.items.forEach(item => {
      const remaining = item.quantity - item.returnedQuantity;
      initialQtys[item.itemId] = remaining > 0 ? remaining : 0; // default to returning everything remaining
    });
    setReturnQtys(initialQtys);
  };

  const handleStartEditing = () => {
    if (!selectedTx) return;
    setEditingItems([...selectedTx.items]);
    setIsEditingItems(true);
    setEditItemSearchQuery('');
    setShowEditItemDropdown(false);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSaveChanges = async () => {
    if (!selectedTx) return;
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // 1. Validate quantities & stock
      for (const editItem of editingItems) {
        const minAllowed = Math.max(1, editItem.returnedQuantity);
        if (editItem.quantity < minAllowed) {
          throw new Error(`Quantity for ${editItem.name} must be at least ${minAllowed}.`);
        }

        const originalItem = inventory.find(i => i.id === editItem.itemId);
        if (!originalItem) {
          throw new Error(`Item ${editItem.name} not found in master inventory.`);
        }

        const originalTxItem = selectedTx.items.find(t => t.itemId === editItem.itemId);
        const originalQty = originalTxItem ? originalTxItem.quantity : 0;
        const diff = editItem.quantity - originalQty;

        if (diff > originalItem.quantityAvailable) {
          throw new Error(`Insufficient stock for ${editItem.name}. Only ${originalItem.quantityAvailable} more units available.`);
        }
      }

      // 2. Begin localStore batch
      const batch = localStore.batch();

      // We need to keep track of inventory items we are updating
      // We also check if anything actually changed
      let hasChanges = false;

      // Let's find all deleted items (items in selectedTx.items but not in editingItems)
      const deletedItems = selectedTx.items.filter(otx => !editingItems.some(etx => etx.itemId === otx.itemId));
      if (deletedItems.length > 0) {
        hasChanges = true;
        for (const delItem of deletedItems) {
          const originalItem = inventory.find(i => i.id === delItem.itemId);
          if (originalItem) {
            const newAvailable = originalItem.quantityAvailable + delItem.quantity;
            let status: 'In Stock' | 'Partially Rented' | 'Out of Stock' = 'In Stock';
            if (newAvailable === 0 && originalItem.quantityTotal > 0) {
              status = 'Out of Stock';
            } else if (newAvailable < originalItem.quantityTotal) {
              status = 'Partially Rented';
            }

            batch.update('inventory', delItem.itemId, {
              quantityAvailable: newAvailable,
              status
            });
          }
        }
      }

      // Let's process all items in editingItems
      for (const editItem of editingItems) {
        const originalTxItem = selectedTx.items.find(t => t.itemId === editItem.itemId);
        const originalQty = originalTxItem ? originalTxItem.quantity : 0;
        const diff = editItem.quantity - originalQty;

        if (diff !== 0) {
          hasChanges = true;
          const originalItem = inventory.find(i => i.id === editItem.itemId)!;
          const newAvailable = originalItem.quantityAvailable - diff;
          let status: 'In Stock' | 'Partially Rented' | 'Out of Stock' = 'In Stock';
          if (newAvailable === 0 && originalItem.quantityTotal > 0) {
            status = 'Out of Stock';
          } else if (newAvailable < originalItem.quantityTotal) {
            status = 'Partially Rented';
          }

          batch.update('inventory', editItem.itemId, {
            quantityAvailable: newAvailable,
            status
          });
        }
      }

      // If there are no changes, we can just close edit mode and return
      if (!hasChanges && editingItems.length === selectedTx.items.length) {
        setIsEditingItems(false);
        setIsSubmitting(false);
        return;
      }

      // 3. Determine the new status of the transmittal
      let allFullyReturned = true;
      let anyReturned = false;

      editingItems.forEach(item => {
        if (item.returnedQuantity < item.quantity) {
          allFullyReturned = false;
        }
        if (item.returnedQuantity > 0) {
          anyReturned = true;
        }
      });

      const newStatus = editingItems.length === 0
        ? 'On Going'
        : allFullyReturned
        ? 'Returned'
        : anyReturned
        ? 'Partially Returned'
        : 'On Going';

      // 4. Update transmittal document
      const updateData: any = {
        items: editingItems,
        status: newStatus,
        custodianSigned: false,
        custodianSignedBy: undefined,
        custodianSignedAt: undefined,
        gatePassRequested: false,
        gatePassRequestedBy: undefined,
        gatePassRequestedAt: undefined,
      };

      batch.update('transmittals', selectedTx.id, updateData);

      // Commit the batch
      await batch.commit();

      // Update local selectedTx state to reflect the saved changes
      const updatedTx: Transmittal = {
        ...selectedTx,
        items: editingItems,
        status: newStatus,
        custodianSigned: false,
        custodianSignedBy: undefined,
        custodianSignedAt: undefined,
        gatePassRequested: false,
        gatePassRequestedBy: undefined,
        gatePassRequestedAt: undefined,
      };

      setSelectedTx(updatedTx);
      setIsEditingItems(false);
      setSuccessMsg('Rental items updated successfully! Approval status has been reset.');
      
      // Update return quantities state based on new items manifest
      const updatedReturnQtys: Record<string, number> = {};
      editingItems.forEach(item => {
        const remaining = item.quantity - item.returnedQuantity;
        updatedReturnQtys[item.itemId] = remaining > 0 ? remaining : 0;
      });
      setReturnQtys(updatedReturnQtys);

      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update rental items');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Adjust return quantity value
  const handleReturnQtyChange = (itemId: string, val: number, maxVal: number) => {
    const validVal = Math.max(0, Math.min(maxVal, val));
    setReturnQtys({
      ...returnQtys,
      [itemId]: validVal
    });
  };

  // Submit Returns
  const handleProcessReturn = async () => {
    if (!selectedTx) return;
    setErrorMsg('');
    setSuccessMsg('');

    // Compile returns list
    const returnsList = Object.entries(returnQtys)
      .map(([itemId, qty]) => ({ itemId, quantityToReturn: Number(qty) }))
      .filter(r => r.quantityToReturn > 0);

    if (returnsList.length === 0) {
      setErrorMsg('Please specify at least 1 item to return');
      return;
    }

    try {
      setIsSubmitting(true);

      // Determine final status
      // We check if the sum of (returnedQuantity + current quantityToReturn) equals (total checked out quantity) for all items
      let allFullyReturned = true;
      let anyReturned = false;

      const updatedItems = selectedTx.items.map(item => {
        const toReturn = returnQtys[item.itemId] || 0;
        const totalReturned = item.returnedQuantity + toReturn;
        
        if (totalReturned < item.quantity) {
          allFullyReturned = false;
        }
        if (totalReturned > 0) {
          anyReturned = true;
        }
        return {
          ...item,
          returnedQuantity: totalReturned
        };
      });

      const newStatus = allFullyReturned 
        ? 'Returned' 
        : anyReturned 
        ? 'Partially Returned' 
        : 'On Going';

      await onReturnItems(selectedTx.id, returnsList, newStatus);
      
      // Update modal display state
      const updatedTx: Transmittal = {
        ...selectedTx,
        items: updatedItems,
        status: newStatus
      };
      
      setSelectedTx(updatedTx);
      setSuccessMsg('Return logged successfully and inventory updated in real-time!');
      
      // Reset return quantities to remaining
      const resetQtys: Record<string, number> = {};
      updatedItems.forEach(item => {
        const remaining = item.quantity - item.returnedQuantity;
        resetQtys[item.itemId] = remaining > 0 ? remaining : 0;
      });
      setReturnQtys(resetQtys);
      
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process check-in');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="border-b border-zinc-200 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl font-black font-display text-zinc-900 uppercase tracking-wider">Transmittal Register</h1>
      </div>

      {/* Date-Range Report Generation Panel */}
      <div className="bg-zinc-50 border border-zinc-200 p-4 md:p-5 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="space-y-1 text-center md:text-left">
          <h2 className="text-xs font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2 justify-center md:justify-start">
            <Calendar className="h-3.5 w-3.5 text-zinc-800" />
            Transmittal Date Range Report
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-center w-full md:w-auto">
          <div className="w-full sm:w-auto flex items-center gap-2">
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest shrink-0">From</span>
            <input
              type="date"
              value={reportStartDate}
              onChange={(e) => setReportStartDate(e.target.value)}
              className="w-full sm:w-36 px-2.5 py-1.5 border border-zinc-200 text-[11px] font-semibold bg-white focus:outline-none focus:border-zinc-900 transition-all text-zinc-800"
            />
          </div>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest shrink-0">To</span>
            <input
              type="date"
              value={reportEndDate}
              onChange={(e) => setReportEndDate(e.target.value)}
              className="w-full sm:w-36 px-2.5 py-1.5 border border-zinc-200 text-[11px] font-semibold bg-white focus:outline-none focus:border-zinc-900 transition-all text-zinc-800"
            />
          </div>

          <button
            onClick={generateDateRangePDFReport}
            className="w-full sm:w-auto px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-black uppercase tracking-widest cursor-pointer transition-colors flex items-center justify-center gap-2 border border-zinc-900 shrink-0"
          >
            <Printer className="h-3.5 w-3.5" />
            Export Report
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 border border-zinc-200">
        <div className="relative w-full md:flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            id="input-search-tx"
            type="text"
            placeholder="Search transmittals by TX No., Rentee, or Handler..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-zinc-200 text-xs font-semibold uppercase tracking-wider bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 transition-all text-zinc-800 placeholder-zinc-400"
          />
        </div>
        
        {/* Status Tab selectors */}
        <div className="flex gap-1.5 overflow-x-auto w-full md:w-auto scrollbar-none pb-1 md:pb-0">
          {['All', 'On Going', 'Partially Returned', 'Returned', 'Overdue'].map((status) => (
            <button
              id={`status-btn-${status.toLowerCase().replace(' ', '-')}`}
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer ${
                selectedStatus === status
                  ? 'bg-zinc-900 text-white border border-zinc-900'
                  : 'bg-white text-zinc-500 hover:text-zinc-900 hover:border-zinc-400 border border-zinc-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* List of Transmittals */}
      {filteredTransmittals.length === 0 ? (
        <div className="bg-white border border-zinc-200 p-12 text-center text-zinc-400">
          <ClipboardCheck className="h-8 w-8 mx-auto mb-3 text-zinc-300" />
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">No transmittal logs found</p>
          <p className="text-[11px] text-zinc-400 mt-1 uppercase tracking-wider font-semibold">Try refining your search queries or selecting a different category.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Section 1: Pending & Not Yet Fully Returned */}
          {pendingTickets.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-zinc-800">
                    On Going / Partially Returned
                  </h3>
                </div>
                <span className="font-mono text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5">
                  {pendingTickets.length} {pendingTickets.length === 1 ? 'TICKET' : 'TICKETS'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingTickets.map((tx) => renderCard(tx))}
              </div>
            </div>
          )}

          {/* Section 2: Fully Reconciled */}
          {fullyReconciledTickets.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-zinc-800">
                    Fully Reconciled
                  </h3>
                </div>
                <span className="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5">
                  {fullyReconciledTickets.length} {fullyReconciledTickets.length === 1 ? 'TICKET' : 'TICKETS'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fullyReconciledTickets.map((tx) => renderCard(tx))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transmittal Details and Check-In Modal */}
      <AnimatePresence>
        {selectedTx && (
          <div className="fixed inset-0 z-50 bg-zinc-900/30 backdrop-blur-[1px] flex justify-end">
            {/* Click outside container to close */}
            <div className="absolute inset-0 cursor-default" onClick={() => setSelectedTx(null)}></div>
            
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className="bg-white w-full max-w-lg h-full border-l border-zinc-200 shadow-none flex flex-col p-6 overflow-y-auto relative z-10"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center border-b border-zinc-200 pb-4 shrink-0">
                <div>
                  <span className="text-[9px] font-bold font-mono text-zinc-400 tracking-widest block uppercase">LOGISTICS DISPATCH PROFILE</span>
                  <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900 flex items-center mt-0.5">
                    Transmittal {selectedTx.transmittalNo}
                  </h2>
                </div>
                <button
                  id="btn-close-tx-details"
                  onClick={() => setSelectedTx(null)}
                  className="text-zinc-400 hover:text-zinc-900 p-1.5 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto py-4 space-y-6">
                
                {/* Alert banners */}
                {errorMsg && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 text-[11px] font-bold uppercase tracking-wider">
                    {errorMsg}
                  </div>
                )}
                {successMsg && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 text-[11px] font-bold uppercase tracking-wider">
                    {successMsg}
                  </div>
                )}

                {/* Logistics Profile Panel */}
                <div className="bg-zinc-50 p-4 border border-zinc-200 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Recipient (Rentee)</span>
                      <span className="text-sm font-bold text-zinc-900 uppercase tracking-tight">{selectedTx.rentee}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`inline-flex px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                        selectedTx.status === 'Returned' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : selectedTx.status === 'Partially Returned'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : selectedTx.dateCheckin < todayStr
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-zinc-100 text-zinc-800 border-zinc-200'
                      }`}>
                        {selectedTx.status === 'Returned' 
                          ? 'COMPLETED' 
                          : (selectedTx.dateCheckin < todayStr 
                              ? 'OVERDUE' 
                              : (selectedTx.status === 'Pending' ? 'ON GOING' : selectedTx.status.toUpperCase()))}
                      </span>
                      <button
                        id="btn-print-tx-details"
                        onClick={() => handlePrintPDF(selectedTx)}
                        className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-zinc-700 bg-white border border-zinc-300 hover:border-zinc-500 hover:text-zinc-950 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Printer className="h-3 w-3 text-zinc-500" />
                        Print Contract
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs border-t border-zinc-200 pt-3">
                    <div>
                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Custodian Handler</span>
                      <span className="font-bold text-zinc-700 uppercase tracking-wide">{selectedTx.handler}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Destination Address</span>
                      <span className="font-bold text-zinc-700 uppercase tracking-wide truncate block">{selectedTx.address}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Date Issued Out</span>
                      <span className="font-bold text-zinc-750 font-mono">{selectedTx.dateCheckout}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Due Return Date</span>
                      <span className={`font-bold font-mono ${selectedTx.status !== 'Returned' && selectedTx.dateCheckin < todayStr ? 'text-red-650' : 'text-zinc-750'}`}>
                        {selectedTx.dateCheckin}
                      </span>
                    </div>
                  </div>

                  {selectedTx.notes && (
                    <div className="pt-3 border-t border-zinc-200">
                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Internal Protocol Notes</span>
                      <p className="text-xs text-zinc-650 leading-relaxed font-medium italic">"{selectedTx.notes}"</p>
                    </div>
                  )}

                  {/* Rental Items Manifest Section */}
                  <div className="space-y-3 pt-3 border-t border-zinc-200">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-900 flex items-center">
                        <ClipboardCheck className="h-4 w-4 text-zinc-800 mr-2" />
                        Rental Items Manifest
                      </h3>
                      {!isEditingItems && selectedTx.status !== 'Returned' && currentUser?.role !== 'Managing Director' && (
                        <button
                          id="btn-edit-manifest-items"
                          type="button; submit"
                          onClick={handleStartEditing}
                          className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-zinc-700 bg-white border border-zinc-300 hover:border-zinc-500 hover:text-zinc-950 transition-colors cursor-pointer"
                        >
                          Edit Items
                        </button>
                      )}
                    </div>

                    {isEditingItems ? (
                      <div className="space-y-4">
                        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                          {editingItems.map((item, idx) => {
                            const originalItem = inventory.find(i => i.id === item.itemId);
                            const availableStock = originalItem ? originalItem.quantityAvailable : 0;
                            const originalTxItem = selectedTx.items.find(t => t.itemId === item.itemId);
                            const originalQty = originalTxItem ? originalTxItem.quantity : 0;
                            const maxAllowed = item.quantity + availableStock;
                            const minAllowed = Math.max(1, item.returnedQuantity);

                            return (
                              <div key={item.itemId || idx} className="p-3 bg-zinc-50 border border-zinc-250 flex flex-col gap-2.5">
                                <div className="flex justify-between items-start">
                                  <div className="min-w-0 flex-1">
                                    <h4 className="font-bold text-zinc-900 text-xs uppercase tracking-tight truncate">{item.name}</h4>
                                    <p className="text-[10px] text-zinc-400 font-mono mt-0.5 uppercase tracking-wide">
                                      {item.sku} • Warehouse Avail: <span className="font-bold text-zinc-700">{availableStock}</span>
                                    </p>
                                  </div>
                                  <button
                                    id={`btn-delete-edit-item-${item.sku}`}
                                    type="button"
                                    disabled={item.returnedQuantity > 0}
                                    onClick={() => {
                                      setEditingItems(editingItems.filter(ei => ei.itemId !== item.itemId));
                                    }}
                                    className={`text-zinc-400 hover:text-red-650 p-1 transition-colors ${item.returnedQuantity > 0 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                                    title={item.returnedQuantity > 0 ? "Cannot delete item. Units are already returned." : "Remove item from manifest"}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>

                                <div className="flex justify-between items-center bg-white border border-zinc-200 p-2">
                                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                    Returned Count: <span className="text-emerald-600 font-bold font-mono">{item.returnedQuantity}</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Manifest Qty</span>
                                    <div className="flex items-center border border-zinc-200 bg-white overflow-hidden">
                                      <button
                                        id={`btn-edit-qty-dec-${item.sku}`}
                                        type="button"
                                        onClick={() => {
                                          const newQty = Math.max(minAllowed, item.quantity - 1);
                                          setEditingItems(editingItems.map(ei => ei.itemId === item.itemId ? { ...ei, quantity: newQty } : ei));
                                        }}
                                        className="p-1 hover:bg-zinc-100 text-zinc-500 cursor-pointer"
                                      >
                                        <MinusCircle className="h-3.5 w-3.5" />
                                      </button>
                                      <input
                                        id={`input-edit-qty-${item.sku}`}
                                        type="number"
                                        min="0"
                                        max={maxAllowed}
                                        value={item.quantity === 0 ? '' : item.quantity}
                                        onChange={(e) => {
                                          const val = e.target.value === '' ? 0 : Number(e.target.value);
                                          const validQty = Math.max(0, Math.min(maxAllowed, val));
                                          setEditingItems(editingItems.map(ei => ei.itemId === item.itemId ? { ...ei, quantity: validQty } : ei));
                                        }}
                                        className="w-10 text-center font-bold text-xs font-mono focus:outline-none py-1"
                                      />
                                      <button
                                        id={`btn-edit-qty-inc-${item.sku}`}
                                        type="button"
                                        onClick={() => {
                                          const newQty = Math.min(maxAllowed, item.quantity + 1);
                                          setEditingItems(editingItems.map(ei => ei.itemId === item.itemId ? { ...ei, quantity: newQty } : ei));
                                        }}
                                        className="p-1 hover:bg-zinc-100 text-zinc-500 cursor-pointer"
                                      >
                                        <PlusCircle className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {editingItems.length === 0 && (
                            <p className="p-4 text-xs text-zinc-400 text-center uppercase tracking-wider font-semibold border border-dashed border-zinc-200">
                              Manifest is empty. Add items below.
                            </p>
                          )}
                        </div>

                        {/* Add Item search bar inside editing mode */}
                        <div className="space-y-1.5 relative">
                          <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest flex items-center">
                            <PlusCircle className="h-3.5 w-3.5 mr-1 text-zinc-400" />
                            Add Item to Manifest
                          </label>
                          <div className="relative">
                            <input
                              id="input-edit-search"
                              type="text"
                              placeholder="SEARCH ACTIVE INVENTORY BY NAME / SKU..."
                              value={editItemSearchQuery}
                              onChange={(e) => {
                                setEditItemSearchQuery(e.target.value);
                                setShowEditItemDropdown(true);
                              }}
                              onFocus={() => setShowEditItemDropdown(true)}
                              className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold uppercase tracking-wider bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-950 text-zinc-800"
                            />
                            {editItemSearchQuery && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditItemSearchQuery('');
                                  setShowEditItemDropdown(false);
                                }}
                                className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-650 cursor-pointer"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Dropdown with eligible items */}
                          <AnimatePresence>
                            {showEditItemDropdown && editItemSearchQuery && (
                              <>
                                <div className="fixed inset-0 z-30" onClick={() => setShowEditItemDropdown(false)}></div>
                                <motion.div
                                  initial={{ opacity: 0, y: -5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -5 }}
                                  className="absolute left-0 right-0 mt-1 bg-white border border-zinc-300 max-h-48 overflow-y-auto z-40 shadow-xl divide-y divide-zinc-100"
                                >
                                  {inventory
                                    .filter(item => {
                                      const isAvailable = item.quantityAvailable > 0;
                                      const isNotStagnant = item.status !== 'Retired';
                                      const isNotAlreadyAdded = !editingItems.some(ei => ei.itemId === item.id);
                                      const matchesQuery = item.name.toLowerCase().includes(editItemSearchQuery.toLowerCase()) ||
                                                           item.sku.toLowerCase().includes(editItemSearchQuery.toLowerCase());
                                      return isAvailable && isNotStagnant && isNotAlreadyAdded && matchesQuery;
                                    })
                                    .map((item) => (
                                      <button
                                        id={`btn-add-searched-item-${item.sku}`}
                                        key={item.id}
                                        type="button"
                                        onClick={() => {
                                          setEditingItems([...editingItems, {
                                            itemId: item.id,
                                            name: item.name,
                                            sku: item.sku,
                                            quantity: 1,
                                            returnedQuantity: 0
                                          }]);
                                          setEditItemSearchQuery('');
                                          setShowEditItemDropdown(false);
                                        }}
                                        className="w-full text-left px-3 py-2.5 hover:bg-zinc-50 transition-colors flex justify-between items-center cursor-pointer text-xs"
                                      >
                                        <div>
                                          <span className="font-bold text-zinc-900 block uppercase">{item.name}</span>
                                          <span className="text-[10px] text-zinc-400 font-mono uppercase block">{item.sku}</span>
                                        </div>
                                        <span className="text-[9px] bg-zinc-100 text-zinc-700 font-bold px-1.5 py-0.5 font-mono uppercase">
                                          {item.quantityAvailable} Avail
                                        </span>
                                      </button>
                                    ))}
                                  {inventory.filter(item => {
                                    const isAvailable = item.quantityAvailable > 0;
                                    const isNotStagnant = item.status !== 'Retired';
                                    const isNotAlreadyAdded = !editingItems.some(ei => ei.itemId === item.id);
                                    const matchesQuery = item.name.toLowerCase().includes(editItemSearchQuery.toLowerCase()) ||
                                                         item.sku.toLowerCase().includes(editItemSearchQuery.toLowerCase());
                                    return isAvailable && isNotStagnant && isNotAlreadyAdded && matchesQuery;
                                  }).length === 0 && (
                                    <div className="p-3 text-[10px] text-zinc-400 font-semibold uppercase tracking-wider text-center">
                                      No eligible items found
                                    </div>
                                  )}
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>

                        <div className="flex gap-2.5 pt-1.5">
                          <button
                            id="btn-edit-items-cancel"
                            type="button"
                            onClick={() => setIsEditingItems(false)}
                            className="flex-1 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-[10px] uppercase tracking-widest border border-zinc-200 cursor-pointer transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            id="btn-edit-items-save"
                            type="button"
                            onClick={handleSaveChanges}
                            disabled={isSubmitting}
                            className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-[10px] uppercase tracking-widest cursor-pointer transition-all disabled:opacity-50"
                          >
                            {isSubmitting ? 'Saving...' : 'Save Manifest'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-zinc-50 border border-zinc-200 divide-y divide-zinc-200/60">
                        {selectedTx.items.map((item) => (
                          <div key={item.itemId} className="p-3 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-zinc-850 uppercase block">{item.name}</span>
                              <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">{item.sku}</span>
                            </div>
                            <div className="text-right font-mono text-[11px] font-bold text-zinc-700">
                              Qty: {item.quantity} <span className="text-zinc-300 mx-1">|</span> Rec: {item.returnedQuantity}
                            </div>
                          </div>
                        ))}
                        {selectedTx.items.length === 0 && (
                          <p className="p-3 text-xs text-zinc-400 text-center uppercase tracking-wider font-semibold">No items in this manifest.</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Custodian Release Sign-Off Block */}
                  <div className="pt-3.5 border-t border-zinc-200 uppercase tracking-wide">
                    {selectedTx.custodianSigned ? (
                      <div className="bg-emerald-50 border border-emerald-200 p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest block">Gate Pass Release Cleared</span>
                          <span className="font-extrabold text-emerald-900 text-[11px] uppercase tracking-tight block mt-0.5">Signed by {selectedTx.custodianSignedBy}</span>
                        </div>
                        <span className="text-[10px] text-emerald-700 font-mono font-bold shrink-0">{selectedTx.custodianSignedAt}</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <span className="text-[9px] font-black text-zinc-450 uppercase tracking-widest block">Custodian Gate Pass Sign-Off</span>
                        
                        {/* Front Desk user has view only or request only capability */}
                        {currentUser?.role === 'Managing Director' ? (
                          <div className="bg-zinc-50 border border-zinc-200 p-3 text-xs">
                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Managing Director Session</span>
                            <p className="text-[10px] text-zinc-600 mt-1 uppercase font-semibold tracking-wide">Read-Only Gate Pass Inspection Mode.</p>
                          </div>
                        ) : currentUser?.role === 'Front Desk' ? (
                          selectedTx.gatePassRequested ? (
                            <div className="bg-amber-50 border border-amber-200 p-3 text-xs">
                              <span className="text-[9px] font-black text-amber-800 uppercase tracking-widest block">Gate Pass Clearance Requested</span>
                              <p className="text-[10px] text-amber-700 mt-1 lowercase font-semibold tracking-wide first-letter:uppercase">
                                Submitted by {selectedTx.gatePassRequestedBy} on {selectedTx.gatePassRequestedAt}.
                              </p>
                              <p className="text-[9px] text-zinc-400 mt-1 uppercase tracking-wider font-medium">Pending custodian/admin review & signature.</p>
                            </div>
                          ) : (
                            <div className="p-3 border border-zinc-150 bg-zinc-50 flex flex-col gap-2">
                              <p className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider leading-relaxed">
                                Front desk sessions require custodian approval to clear gate pass releases. Click below to request check-off.
                              </p>
                              <button
                                id="btn-request-gatepass"
                                type="button"
                                onClick={handleRequestGatePassApproval}
                                className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-[10px] uppercase tracking-widest transition-colors cursor-pointer"
                              >
                                Request Custodian Sign-Off
                              </button>
                            </div>
                          )
                        ) : (
                          /* Admin/Custodian user can sign off & clear */
                          <div className="space-y-2">
                            {selectedTx.gatePassRequested && (
                              <div className="bg-amber-50 border border-amber-200 p-2.5 text-xs">
                                <span className="text-[9px] font-black text-amber-800 uppercase tracking-widest block">⚠️ Attention Admin / Custodian</span>
                                <p className="text-[10px] text-amber-700 mt-0.5 lowercase font-semibold tracking-wide first-letter:uppercase">
                                  Gate pass check requested by {selectedTx.gatePassRequestedBy} on {selectedTx.gatePassRequestedAt}.
                                </p>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <select
                                id="details-signing-custodian"
                                value={signingCustodian}
                                onChange={(e) => setSigningCustodian(e.target.value)}
                                className="flex-1 px-2.5 py-1.5 border border-zinc-200 text-xs font-semibold uppercase bg-white focus:outline-none focus:border-zinc-900 text-zinc-800"
                              >
                                <option value="">-- Choose Custodian --</option>
                                {custodians.map(c => (
                                  <option key={c.id} value={c.name}>{c.name}</option>
                                ))}
                              </select>
                              <button
                                id="btn-sign-gatepass"
                                type="button"
                                onClick={handleSignRelease}
                                disabled={!signingCustodian}
                                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[10px] uppercase tracking-widest transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                              >
                                Approve & Clear
                              </button>
                            </div>
                            <p className="text-[8px] text-zinc-400 font-medium leading-relaxed uppercase tracking-wider">
                              Note: Admin/Custodian signature confirms that physical items match this manifest and authorizes release.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Return Asset Process Panel */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-zinc-200 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-900 flex items-center">
                      <ClipboardCheck className="h-4 w-4 text-zinc-800 mr-2" />
                      Manifest Verification Protocol
                    </h3>
                  </div>

                  {selectedTx.status === 'Returned' ? (
                    <div className="space-y-3">
                      <div className="bg-emerald-50 border border-emerald-200 p-5 text-center text-emerald-800">
                        <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                        <p className="text-xs font-bold uppercase tracking-widest text-emerald-850">Fully Reconciled</p>
                        <p className="text-[11px] text-emerald-600/95 mt-1 leading-relaxed uppercase tracking-wide font-semibold">All assets inside this transmittal batch are safely back in warehouse stock.</p>
                      </div>

                      {currentUser?.role === 'Admin' && (
                        <div className="bg-zinc-50 border border-zinc-200 p-4">
                          <span className="text-[9px] font-black text-zinc-450 uppercase tracking-widest block mb-2">Administrative Actions</span>
                          
                          {!showReverseConfirm ? (
                            <button
                              id="btn-reverse-reconciliation-init"
                              type="button"
                              onClick={() => setShowReverseConfirm(true)}
                              className="w-full py-2 bg-red-850 hover:bg-red-900 text-white font-bold text-[10px] uppercase tracking-widest transition-colors cursor-pointer"
                            >
                              Reverse Fully Reconciled Status
                            </button>
                          ) : (
                            <div className="space-y-2">
                              <span className="text-[9px] font-black text-red-850 uppercase tracking-widest block">
                                ⚠️ Reset returned quantities to 0 & adjust inventory?
                              </span>
                              <div className="flex gap-2">
                                <button
                                  id="btn-reverse-reconciliation-confirm"
                                  type="button"
                                  onClick={handleReverseReconciliationClick}
                                  disabled={isSubmitting}
                                  className="flex-1 py-1.5 bg-red-850 hover:bg-red-900 text-white font-bold text-[9px] uppercase tracking-widest transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  {isSubmitting ? 'Reversing...' : 'Confirm Reverse'}
                                </button>
                                <button
                                  id="btn-reverse-reconciliation-cancel"
                                  type="button"
                                  onClick={() => setShowReverseConfirm(false)}
                                  className="px-3 py-1.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 font-bold text-[9px] uppercase tracking-widest transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-[11px] text-zinc-500 uppercase tracking-widest font-semibold leading-relaxed">
                        Verify returned units below to update stock counts. Submitting will restore availability immediately.
                      </p>

                      <div className="space-y-3">
                        {selectedTx.items.map((item) => {
                          const remainingToReturn = item.quantity - item.returnedQuantity;
                          const currentReturnInput = returnQtys[item.itemId] || 0;

                          return (
                            <div key={item.itemId} className="p-4 bg-zinc-50 border border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-zinc-900 text-xs uppercase tracking-tight truncate">{item.name}</h4>
                                <p className="text-[10px] text-zinc-400 font-mono mt-0.5 uppercase tracking-wide">
                                  {item.sku} • Out: <span className="font-bold text-zinc-700">{item.quantity}</span> • Reconciled: <span className="font-bold text-emerald-600">{item.returnedQuantity}</span>
                                </p>
                              </div>

                              {/* Input panel */}
                              <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                                {remainingToReturn === 0 ? (
                                  <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 border border-emerald-200 inline-flex items-center gap-1 uppercase tracking-wider">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    Verified
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <div className="flex flex-col items-end">
                                      <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Return Qty</label>
                                      <div className="flex items-center border border-zinc-200 bg-white overflow-hidden mt-1">
                                        <button
                                          id={`btn-qty-dec-${item.sku}`}
                                          type="button"
                                          onClick={() => handleReturnQtyChange(item.itemId, currentReturnInput - 1, remainingToReturn)}
                                          className="p-1 hover:bg-zinc-100 text-zinc-500 cursor-pointer"
                                        >
                                          <MinusCircle className="h-3.5 w-3.5" />
                                        </button>
                                        <input
                                          id={`input-return-qty-${item.sku}`}
                                          type="number"
                                          min="0"
                                          max={remainingToReturn}
                                          value={currentReturnInput === 0 ? '' : currentReturnInput}
                                          onChange={(e) => {
                                            const val = e.target.value === '' ? 0 : Number(e.target.value);
                                            handleReturnQtyChange(item.itemId, val, remainingToReturn);
                                          }}
                                          className="w-10 text-center font-bold text-xs font-mono focus:outline-none py-1"
                                        />
                                        <button
                                          id={`btn-qty-inc-${item.sku}`}
                                          type="button"
                                          onClick={() => handleReturnQtyChange(item.itemId, currentReturnInput + 1, remainingToReturn)}
                                          className="p-1 hover:bg-zinc-100 text-zinc-500 cursor-pointer"
                                        >
                                          <PlusCircle className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                    
                                    <button
                                      id={`btn-max-${item.sku}`}
                                      onClick={() => handleReturnQtyChange(item.itemId, remainingToReturn, remainingToReturn)}
                                      className="px-2.5 py-1 border border-zinc-300 hover:border-zinc-500 text-zinc-700 font-bold text-[10px] uppercase tracking-widest mt-4 cursor-pointer"
                                      title="Return all outstanding units"
                                    >
                                      All
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {currentUser?.role !== 'Managing Director' && (
                        <button
                          id="btn-process-return"
                          onClick={handleProcessReturn}
                          disabled={isSubmitting || Object.values(returnQtys).every(v => v === 0)}
                          className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <CheckSquare className="h-4 w-4" />
                          {isSubmitting ? 'Syncing...' : 'Verify Return Check-In'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Void / Delete Transmittal Action (Admin & Director) */}
                {currentUser?.role !== 'Front Desk' && (
                  <div className="border-t border-zinc-200/80 pt-6">
                    <div className="bg-zinc-50 border border-zinc-200 p-4 space-y-3">
                      <div>
                        <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Administrative Actions</h4>
                        <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wider mt-1">Void / Delete Transmittal</h3>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1 leading-normal">
                          Completely void and remove this transaction record.
                          {selectedTx.status !== 'Returned' && (
                            <span className="text-amber-700 font-bold block mt-1">
                              ⚠️ Outstanding items will be automatically returned to inventory stock.
                            </span>
                          )}
                        </p>
                      </div>
                      {!showDeleteConfirm ? (
                        <button
                          id="btn-delete-transmittal"
                          onClick={() => setShowDeleteConfirm(true)}
                          className="w-full py-2.5 bg-red-50 hover:bg-red-105 text-red-700 border border-red-200 font-bold text-xs uppercase tracking-widest inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                          Void & Delete Transmittal
                        </button>
                      ) : (
                        <div className="bg-red-50 border border-red-200 p-3.5 space-y-3.5">
                          <div className="text-[11px] font-bold text-red-800 uppercase tracking-wider leading-relaxed">
                            ⚠️ ARE YOU ABSOLUTELY SURE?
                            <span className="block font-normal normal-case text-red-700 mt-1">
                              This action is completely irreversible. This transmittal and its history will be permanently deleted and a system audit log will be created.
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              id="btn-confirm-delete-cancel"
                              onClick={() => setShowDeleteConfirm(false)}
                              className="flex-1 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-[10px] uppercase tracking-widest border border-zinc-200 cursor-pointer transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              id="btn-confirm-delete-proceed"
                              onClick={async () => {
                                try {
                                  await onDeleteTransmittal(selectedTx.id, true);
                                  setSelectedTx(null);
                                  setShowDeleteConfirm(false);
                                } catch (err: any) {
                                  setErrorMsg(err.message || 'Failed to delete transmittal');
                                }
                              }}
                              className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] uppercase tracking-widest cursor-pointer transition-colors"
                            >
                              Yes, Void & Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
