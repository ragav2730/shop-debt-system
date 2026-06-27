import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Paper, Typography, Box, Button, Card, CardContent,
  Stack, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, CircularProgress, Grid, Chip, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, InputAdornment, Tabs, Tab, Avatar,
  Divider, List, ListItem, ListItemText, ListItemSecondaryAction,
  Tooltip, useTheme, useMediaQuery
} from '@mui/material';
import {
  ArrowBack, Edit, Download,
  Search, Receipt,
  CheckCircle, Close, Payment as PaymentIcon,
  Business, History,
  Inventory, Phone, Email, Delete, Warning,
  PictureAsPdf, TableChart, TextFields, WhatsApp
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  doc, getDoc, collection, query, where, onSnapshot,
  addDoc, updateDoc, serverTimestamp, orderBy, getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../services/firebase';

// ─── PDF Generator ────────────────────────────────────────────────────────────
const generatePDF = async (vendor, transactions, payments, formatDate, formatFullDate, getProductName) => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const M = 14; // margin

  const totalSales = transactions.reduce((s, t) => s + (t.amount || 0), 0);
  const totalPaid  = payments.reduce((s, p) => s + Math.abs(p.amount || 0), 0);
  const balance    = vendor.balance || 0;

  // ── Page header helper ──
  const drawPageHeader = () => {
    doc.setFillColor(183, 28, 28);
    doc.rect(0, 0, pw, 22, 'F');
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('VENDOR REPORT', M, 10);
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text(vendor.vendorName || '', M, 17);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pw - M, 17, { align: 'right' });
  };

  drawPageHeader();

  // ── Section 1: Vendor Info ──
  let y = 30;

  // Info box background
  doc.setFillColor(255, 247, 247);
  doc.roundedRect(M, y, pw - M * 2, 34, 2, 2, 'F');

  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(183, 28, 28);
  doc.text('VENDOR INFORMATION', M + 4, y + 7);

  doc.setFont(undefined, 'normal');
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(9);

  const col1x = M + 4;
  const col2x = pw / 2 + 4;
  doc.text(`Name:    ${vendor.vendorName || 'N/A'}`,    col1x, y + 15);
  doc.text(`Phone:   ${vendor.phone    || 'N/A'}`,    col1x, y + 22);
  doc.text(`Email:   ${vendor.email    || 'N/A'}`,    col2x, y + 15);
  doc.text(`Address: ${vendor.address  || 'N/A'}`,    col2x, y + 22);

  y += 42;

  // ── Section 2: Financial Summary ──
  const boxW = (pw - M * 2 - 6) / 3;

  const summaryBoxes = [
    { label: 'TOTAL SALES',    value: `Rs.${totalSales.toLocaleString('en-IN')}`,   fill: [227, 242, 253], text: [13, 71, 161]  },
    { label: 'TOTAL RECEIVED', value: `Rs.${totalPaid.toLocaleString('en-IN')}`,    fill: [232, 245, 233], text: [27, 94, 32]   },
    { label: 'PENDING BALANCE',value: `Rs.${balance.toLocaleString('en-IN')}`,      fill: [255, 235, 238], text: [183, 28, 28]  },
  ];

  summaryBoxes.forEach((box, i) => {
    const bx = M + i * (boxW + 3);
    doc.setFillColor(...box.fill);
    doc.roundedRect(bx, y, boxW, 22, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...box.text);
    doc.text(box.label, bx + boxW / 2, y + 7, { align: 'center' });
    doc.setFontSize(11);
    doc.text(box.value, bx + boxW / 2, y + 17, { align: 'center' });
  });

  y += 30;

  // ── Section 3: Purchase History Table ──
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(183, 28, 28);
  doc.text('PURCHASE HISTORY', M, y);
  doc.setDrawColor(183, 28, 28);
  doc.setLineWidth(0.4);
  doc.line(M, y + 1.5, M + 55, y + 1.5);
  y += 5;

  if (transactions.length === 0) {
    doc.setFont(undefined, 'italic');
    doc.setTextColor(120);
    doc.setFontSize(9);
    doc.text('No purchases recorded.', M, y + 6);
    y += 14;
  } else {
    const purchaseRows = transactions.map(t => [
      formatDate(t.date),
      t.customerName || '—',
      getProductName(t),
      t.category || '—',
      `${t.quantity || 0} ${t.unit || ''}`.trim(),
      `Rs.${(t.price || 0).toLocaleString('en-IN')}`,
      `Rs.${(t.amount || 0).toLocaleString('en-IN')}`,
      `Rs.${(t.remainingAmount || 0).toLocaleString('en-IN')}`,
      (t.remainingAmount || 0) > 0 ? 'Pending' : 'Paid',
    ]);

    const totalPurchaseAmt = transactions.reduce((s, t) => s + (t.amount || 0), 0);
    const totalRemaining   = transactions.reduce((s, t) => s + (t.remainingAmount || 0), 0);

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Customer', 'Product', 'Category', 'Qty', 'Price', 'Total', 'Remaining', 'Status']],
      body: purchaseRows,
      foot: [['', '', '', '', '', 'TOTAL', `Rs.${totalPurchaseAmt.toLocaleString('en-IN')}`, `Rs.${totalRemaining.toLocaleString('en-IN')}`, '']],
      styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: [220, 220, 220], lineWidth: 0.2 },
      headStyles: { fillColor: [183, 28, 28], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      footStyles: { fillColor: [255, 235, 238], textColor: [100, 0, 0], fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [255, 250, 250] },
      columnStyles: {
        0: { cellWidth: 16 },
        1: { cellWidth: 26 },
        2: { cellWidth: 32 },
        3: { cellWidth: 18 },
        4: { cellWidth: 14 },
        5: { cellWidth: 18, halign: 'right' },
        6: { cellWidth: 18, halign: 'right' },
        7: { cellWidth: 20, halign: 'right' },
        8: { cellWidth: 14, halign: 'center' },
      },
      margin: { left: M, right: M },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 8) {
          data.cell.styles.textColor = data.cell.text[0] === 'Paid' ? [27, 94, 32] : [183, 28, 28];
          data.cell.styles.fontStyle = 'bold';
        }
      },
      didDrawPage: () => {
        drawPageHeader();
      },
    });

    y = doc.lastAutoTable.finalY + 8;
  }

  // ── Section 4: Payment History Table ──
  // Start new page if not enough space
  if (y > ph - 70) {
    doc.addPage();
    drawPageHeader();
    y = 30;
  }

  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(183, 28, 28);
  doc.text('PAYMENT HISTORY', M, y);
  doc.setDrawColor(183, 28, 28);
  doc.setLineWidth(0.4);
  doc.line(M, y + 1.5, M + 55, y + 1.5);
  y += 5;

  if (payments.length === 0) {
    doc.setFont(undefined, 'italic');
    doc.setTextColor(120);
    doc.setFontSize(9);
    doc.text('No payments recorded.', M, y + 6);
    y += 14;
  } else {
    const paymentRows = payments.map(p => [
      formatFullDate(p.date),
      p.customerName || p.vendorName || '—',
      p.productName || '—',
      `Rs.${Math.abs(p.amount || 0).toLocaleString('en-IN')}`,
      p.paymentMode || 'Cash',
      p.settledType || 'individual',
      p.notes || '—',
    ]);

    const totalPaidAmt = payments.reduce((s, p) => s + Math.abs(p.amount || 0), 0);

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Customer', 'Product', 'Amount', 'Mode', 'Type', 'Notes']],
      body: paymentRows,
      foot: [['', '', 'TOTAL RECEIVED', `Rs.${totalPaidAmt.toLocaleString('en-IN')}`, '', '', '']],
      styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: [220, 220, 220], lineWidth: 0.2 },
      headStyles: { fillColor: [27, 94, 32], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      footStyles: { fillColor: [232, 245, 233], textColor: [27, 94, 32], fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [250, 255, 250] },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 28 },
        2: { cellWidth: 30 },
        3: { cellWidth: 22, halign: 'right' },
        4: { cellWidth: 18 },
        5: { cellWidth: 20 },
        6: { cellWidth: 38 },
      },
      margin: { left: M, right: M },
      didDrawPage: () => {
        drawPageHeader();
      },
    });

    y = doc.lastAutoTable.finalY + 8;
  }

  // ── Footer on every page ──
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(245, 245, 245);
    doc.rect(0, ph - 12, pw, 12, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(100);
    doc.setFont(undefined, 'normal');
    doc.text(`Vendor: ${vendor.vendorName}  |  Balance: Rs.${balance.toLocaleString('en-IN')}  |  Purchases: ${transactions.length}  |  Payments: ${payments.length}`, M, ph - 4.5);
    doc.text(`Page ${i} of ${totalPages}`, pw - M, ph - 4.5, { align: 'right' });
  }

  doc.save(`Vendor_${(vendor.vendorName || 'Report').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};

// ─── Excel export ─────────────────────────────────────────────────────────────
const generateExcel = async (vendor, transactions, payments, formatDate, formatFullDate, getProductName) => {
  const { utils, writeFile } = await import('xlsx');
  const wb = utils.book_new();

  // Sheet 1 – Purchases
  const purchaseData = transactions.map(t => ({
    Date: formatDate(t.date),
    Customer: t.customerName || '',
    Product: getProductName(t),
    Category: t.category || '',
    Quantity: `${t.quantity || 0} ${t.unit || ''}`.trim(),
    'Price (Rs.)': t.price || 0,
    'Total (Rs.)': t.amount || 0,
    'Remaining (Rs.)': t.remainingAmount || 0,
    Status: (t.remainingAmount || 0) > 0 ? 'Pending' : 'Paid',
  }));
  const ws1 = utils.json_to_sheet(purchaseData);
  ws1['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 10 }];
  utils.book_append_sheet(wb, ws1, 'Purchases');

  // Sheet 2 – Payments
  const paymentData = payments.map(p => ({
    Date: formatFullDate(p.date),
    Customer: p.customerName || p.vendorName || '',
    Product: p.productName || '',
    'Amount (Rs.)': Math.abs(p.amount || 0),
    Mode: p.paymentMode || 'Cash',
    Type: p.settledType || 'individual',
    Notes: p.notes || '',
  }));
  const ws2 = utils.json_to_sheet(paymentData);
  ws2['!cols'] = [{ wch: 18 }, { wch: 22 }, { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 30 }];
  utils.book_append_sheet(wb, ws2, 'Payments');

  // Sheet 3 – Summary
  const summaryData = [
    { Field: 'Vendor Name',     Value: vendor.vendorName || '' },
    { Field: 'Phone',           Value: vendor.phone || '' },
    { Field: 'Email',           Value: vendor.email || '' },
    { Field: 'Address',         Value: vendor.address || '' },
    { Field: 'Balance (Rs.)',   Value: vendor.balance || 0 },
    { Field: 'Total Sales',     Value: transactions.reduce((s, t) => s + (t.amount || 0), 0) },
    { Field: 'Total Received',  Value: payments.reduce((s, p) => s + Math.abs(p.amount || 0), 0) },
    { Field: 'Total Purchases', Value: transactions.length },
    { Field: 'Total Payments',  Value: payments.length },
  ];
  const ws3 = utils.json_to_sheet(summaryData);
  ws3['!cols'] = [{ wch: 20 }, { wch: 30 }];
  utils.book_append_sheet(wb, ws3, 'Summary');

  writeFile(wb, `Vendor_${(vendor.vendorName || 'Report').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// ─── CSV export ───────────────────────────────────────────────────────────────
const generateCSV = (vendor, transactions, getProductName, formatDate) => {
  const header = ['Date', 'Customer', 'Product', 'Category', 'Quantity', 'Price', 'Total', 'Remaining', 'Status'];
  const rows = transactions.map(t => [
    formatDate(t.date),
    `"${t.customerName || ''}"`,
    `"${getProductName(t)}"`,
    t.category || '',
    `${t.quantity || 0} ${t.unit || ''}`.trim(),
    t.price || 0,
    t.amount || 0,
    t.remainingAmount || 0,
    (t.remainingAmount || 0) > 0 ? 'Pending' : 'Paid',
  ]);
  const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Vendor_${(vendor.vendorName || 'Report').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─────────────────────────────────────────────────────────────────────────────

const VendorDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [vendor, setVendor] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(isMobile ? 5 : 10);

  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({ vendorName: '', phone: '', email: '', address: '' });

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deletingVendor, setDeletingVendor] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const [openDeletePurchaseDialog, setOpenDeletePurchaseDialog] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState(null);
  const [deletingPurchase, setDeletingPurchase] = useState(false);
  const [deletePurchaseConfirmation, setDeletePurchaseConfirmation] = useState('');

  const [downloadDialog, setDownloadDialog] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState('pdf');
  const [downloading, setDownloading] = useState(false);

  const [notification, setNotification] = useState({ show: false, message: '', type: 'success', amount: 0 });

  // Fetch vendor
  useEffect(() => {
    const fetchVendor = async () => {
      try {
        const snap = await getDoc(doc(db, 'vendors', id));
        if (!snap.exists()) { navigate('/vendors'); return; }
        const data = { id: snap.id, ...snap.data() };
        setVendor(data);
        setEditForm({ vendorName: data.vendorName || '', phone: data.phone || '', email: data.email || '', address: data.address || '' });
        setLoading(false);
      } catch (e) { console.error(e); setLoading(false); }
    };
    fetchVendor();
  }, [id, navigate]);

  // Fetch transactions
  useEffect(() => {
    if (!id) return;
    return onSnapshot(
      query(collection(db, 'transactions'), where('vendorId', '==', id), orderBy('date', 'desc')),
      snap => setTransactions(snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, amount: data.amount || 0, remainingAmount: data.remainingAmount ?? data.amount ?? 0, date: data.date?.toDate?.() || data.date || new Date() };
      }))
    );
  }, [id]);

  // Fetch payments
  useEffect(() => {
    if (!id) return;
    return onSnapshot(
      query(collection(db, 'payments'), where('vendorId', '==', id), orderBy('date', 'desc')),
      snap => setPayments(snap.docs.map(d => ({ id: d.id, ...d.data(), date: d.data().date?.toDate?.() || d.data().date || new Date() })))
    );
  }, [id]);

  // Stats
  const stats = {
    totalSales:      transactions.reduce((s, t) => s + (t.amount || 0), 0),
    totalPending:    vendor?.balance || 0,
    totalPaid:       payments.reduce((s, p) => s + Math.abs(p.amount || 0), 0),
    transactionCount: transactions.length,
    pendingCount:    transactions.filter(t => (t.remainingAmount || 0) > 0).length,
  };

  // Helpers
  const formatDate = (date) => {
    if (!date) return 'N/A';
    try { return (date.toDate ? date.toDate() : new Date(date)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
    catch { return 'N/A'; }
  };

  const formatFullDate = (date) => {
    if (!date) return 'N/A';
    try { return (date.toDate ? date.toDate() : new Date(date)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return 'N/A'; }
  };

  const getProductName = (t) => {
    if (t.productName) return t.productName;
    const parts = [];
    if (t.company) parts.push(t.company);
    if (t.category) parts.push(t.category);
    let name = parts.join(' ');
    if (t.quantity && t.unit) name += ` (${t.quantity} ${t.unit})`;
    return name || 'Product';
  };

  const showNotification = (message, type = 'success', amount = 0) => {
    setNotification({ show: true, message, type, amount });
    setTimeout(() => setNotification(p => ({ ...p, show: false })), 3000);
  };

  const filteredTransactions = transactions.filter(t => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return t.customerName?.toLowerCase().includes(term) || t.productName?.toLowerCase().includes(term) || t.category?.toLowerCase().includes(term);
  });

  // Download handler
  const handleDownloadReport = async () => {
    if (!vendor || transactions.length === 0) { showNotification('No data to export', 'info'); return; }
    setDownloading(true);
    try {
      if (downloadFormat === 'pdf') {
        await generatePDF(vendor, transactions, payments, formatDate, formatFullDate, getProductName);
        showNotification('PDF downloaded successfully', 'success');
      } else if (downloadFormat === 'excel') {
        await generateExcel(vendor, transactions, payments, formatDate, formatFullDate, getProductName);
        showNotification('Excel downloaded successfully', 'success');
      } else {
        generateCSV(vendor, transactions, getProductName, formatDate);
        showNotification('CSV downloaded successfully', 'success');
      }
      setDownloadDialog(false);
    } catch (err) {
      console.error('Download error:', err);
      showNotification('Download failed: ' + err.message, 'error');
    } finally {
      setDownloading(false);
    }
  };

  // WhatsApp share
  const handleWhatsAppShare = () => {
    if (!vendor) return;

    const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    // Build pending purchases list (max 5 to keep message concise)
    const pendingList = transactions
      .filter(t => (t.remainingAmount || 0) > 0)
      .slice(0, 5)
      .map(t => `  - ${getProductName(t)} (${t.customerName || 'N/A'}): ₹${(t.remainingAmount || 0).toLocaleString('en-IN')}`)
      .join('\n');

    const msg =
      `*VENDOR ACCOUNT STATEMENT*\n` +
      `Date: ${date}\n` +
      `--------------------------------\n` +
      `*Vendor:* ${vendor.vendorName}\n` +
      (vendor.phone ? `*Phone:* ${vendor.phone}\n` : '') +
      `--------------------------------\n` +
      `*Total Sales:*    ₹${stats.totalSales.toLocaleString('en-IN')}\n` +
      `*Amount Received:* ₹${stats.totalPaid.toLocaleString('en-IN')}\n` +
      `*Pending Balance:* ₹${stats.totalPending.toLocaleString('en-IN')}\n` +
      `*Total Purchases:* ${stats.transactionCount}\n` +
      `--------------------------------\n` +
      (pendingList
        ? `*Pending Purchases:*\n${pendingList}\n` +
          (transactions.filter(t => (t.remainingAmount || 0) > 0).length > 5
            ? `  ...and ${transactions.filter(t => (t.remainingAmount || 0) > 0).length - 5} more\n`
            : '') +
          `--------------------------------\n`
        : `*Status:* All Settled\n` +
          `--------------------------------\n`) +
      `_Please clear the pending balance at the earliest._`;

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Update vendor
  const handleUpdateVendor = async () => {
    if (!editForm.vendorName.trim()) { showNotification('Vendor name is required', 'error'); return; }
    try {
      await updateDoc(doc(db, 'vendors', id), { ...editForm, updatedAt: serverTimestamp() });
      setVendor(p => ({ ...p, ...editForm }));
      showNotification('Vendor updated', 'success');
      setOpenEditDialog(false);
    } catch (e) { showNotification('Update failed', 'error'); }
  };

  // Delete purchase
  const handleDeletePurchase = async () => {
    if (deletePurchaseConfirmation !== 'DELETE') { showNotification('Type DELETE to confirm', 'error'); return; }
    if (!purchaseToDelete) return;
    if (!window.confirm(`Delete purchase for ${purchaseToDelete.customerName}? This cannot be undone.`)) return;
    setDeletingPurchase(true);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'transactions', purchaseToDelete.id));
      payments.filter(p => p.transactionId === purchaseToDelete.id).forEach(p => batch.delete(doc(db, 'payments', p.id)));
      const newBalance = Math.max(0, vendor.balance - purchaseToDelete.remainingAmount);
      batch.update(doc(db, 'vendors', id), { balance: newBalance, updatedAt: serverTimestamp() });
      await batch.commit();
      setVendor(p => ({ ...p, balance: newBalance }));
      showNotification('Purchase deleted', 'success');
      setOpenDeletePurchaseDialog(false);
      setPurchaseToDelete(null);
      setDeletePurchaseConfirmation('');
    } catch (e) { showNotification('Delete failed', 'error'); }
    finally { setDeletingPurchase(false); }
  };

  // Delete vendor
  const handleDeleteVendor = async () => {
    if (deleteConfirmation !== 'DELETE') { showNotification('Type DELETE to confirm', 'error'); return; }
    if (!window.confirm(`Permanently delete "${vendor.vendorName}" and all data?`)) return;
    setDeletingVendor(true);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'vendors', id));
      transactions.forEach(t => batch.delete(doc(db, 'transactions', t.id)));
      payments.forEach(p => batch.delete(doc(db, 'payments', p.id)));
      await batch.commit();
      showNotification('Vendor deleted', 'success');
      setTimeout(() => navigate('/vendors'), 1500);
    } catch (e) { showNotification('Delete failed', 'error'); }
    finally { setDeletingVendor(false); setOpenDeleteDialog(false); setDeleteConfirmation(''); }
  };

  const paymentModes = ['Cash', 'UPI', 'Bank', 'Card', 'Cheque'];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh', pb: 4 }}>

        {/* Notification */}
        {notification.show && (
          <Alert severity={notification.type} sx={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, width: isMobile ? '90%' : '400px', boxShadow: 3 }}
            action={<IconButton size="small" onClick={() => setNotification(p => ({ ...p, show: false }))}><Close fontSize="small" /></IconButton>}>
            {notification.message}{notification.amount > 0 && ` — ₹${notification.amount}`}
          </Alert>
        )}

        {/* Header */}
        <Box sx={{ bgcolor: 'white', borderBottom: '1px solid #e0e0e0', py: 2 }}>
          <Container maxWidth="lg">
            <Stack direction="row" alignItems="center" spacing={2}>
              <IconButton onClick={() => navigate('/vendors')} sx={{ color: 'primary.main' }}><ArrowBack /></IconButton>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5" fontWeight={600}>{vendor.vendorName}</Typography>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                  {vendor.phone && <Typography variant="body2" color="text.secondary"><Phone sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />{vendor.phone}</Typography>}
                  {vendor.email && <Typography variant="body2" color="text.secondary"><Email sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />{vendor.email}</Typography>}
                  <Chip label={`Balance: ₹${vendor.balance || 0}`} size="small" color={vendor.balance > 0 ? 'error' : 'success'} />
                </Stack>
              </Box>
              <Stack direction="row" spacing={1}>
                <Tooltip title="Edit Vendor"><IconButton onClick={() => setOpenEditDialog(true)}><Edit /></IconButton></Tooltip>
                <Tooltip title="Delete Vendor"><IconButton onClick={() => setOpenDeleteDialog(true)} sx={{ color: 'error.main' }}><Delete /></IconButton></Tooltip>
              </Stack>
            </Stack>
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{ mt: 3 }}>

          {/* Balance Card */}
          <Paper sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ bgcolor: vendor.balance > 0 ? 'error.main' : 'success.main', color: 'white', py: 2, px: 3 }}>
              <Typography variant="h4" fontWeight={700}>₹{vendor.balance}</Typography>
              <Typography variant="body2">{vendor.balance > 0 ? 'Total Balance Owed' : 'All Settled'}</Typography>
            </Box>
            <Box sx={{ p: 3 }}>
              <Grid container spacing={3}>
                {[
                  { label: 'Total Sales',  value: `₹${stats.totalSales.toLocaleString()}` },
                  { label: 'Pending',      value: `₹${stats.totalPending.toLocaleString()}`, color: 'error.main' },
                  { label: 'Received',     value: `₹${stats.totalPaid.toLocaleString()}`,    color: 'success.main' },
                  { label: 'Purchases',    value: stats.transactionCount },
                ].map(({ label, value, color }) => (
                  <Grid item xs={6} sm={3} key={label}>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Typography variant="h6" fontWeight={600} color={color}>{value}</Typography>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Paper>

          {/* Action Buttons */}
          <Paper sx={{ p: 2, mb: 3, borderRadius: 2, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="contained" startIcon={<PaymentIcon />} onClick={() => navigate('/payment')} fullWidth={isMobile}>Make Payment</Button>
            <Button variant="contained" color="success" startIcon={<Download />} onClick={() => setDownloadDialog(true)} sx={{ bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }} fullWidth={isMobile}>Download Report</Button>
            <Button variant="contained" startIcon={<WhatsApp />} onClick={handleWhatsAppShare} sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#128C7E' } }} fullWidth={isMobile}>Share via WhatsApp</Button>
            <Box sx={{ flex: 1 }} />
            <TextField
              placeholder="Search purchases..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              size="small"
              sx={{ width: isMobile ? '100%' : 250 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
            />
          </Paper>

          {/* Tabs */}
          <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} variant={isMobile ? 'fullWidth' : 'standard'} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tab label="Purchase History" />
              <Tab label="Payment History" />
              <Tab label="Reports" />
            </Tabs>

            {/* Purchase History */}
            {activeTab === 0 && (
              <Box>
                {filteredTransactions.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                    <Inventory sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                    <Typography>No purchases found</Typography>
                  </Box>
                ) : (
                  <>
                    {isMobile ? (
                      <List sx={{ p: 0 }}>
                        {filteredTransactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(t => {
                          const remaining = t.remainingAmount || 0;
                          return (
                            <React.Fragment key={t.id}>
                              <ListItem sx={{ borderBottom: '1px solid #f0f0f0', py: 2 }}>
                                <ListItemText
                                  primary={
                                    <Stack direction="row" alignItems="center" spacing={1}>
                                      <Typography fontWeight={600} flex={1}>{t.customerName}</Typography>
                                      <IconButton size="small" onClick={() => { setPurchaseToDelete(t); setOpenDeletePurchaseDialog(true); setDeletePurchaseConfirmation(''); }} sx={{ color: 'error.main' }}><Delete fontSize="small" /></IconButton>
                                    </Stack>
                                  }
                                  secondary={
                                    <>
                                      <Typography variant="body2">{getProductName(t)}</Typography>
                                      <Typography variant="caption" color="text.secondary">{formatDate(t.date)}</Typography>
                                      <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                                        <Typography variant="body2">₹{t.amount}</Typography>
                                        <Typography variant="body2" color={remaining > 0 ? 'error.main' : 'success.main'} fontWeight={600}>₹{remaining} remaining</Typography>
                                      </Stack>
                                    </>
                                  }
                                />
                                <ListItemSecondaryAction>
                                  <Chip label={remaining <= 0 ? 'Paid' : 'Pending'} size="small" color={remaining <= 0 ? 'success' : 'warning'} />
                                </ListItemSecondaryAction>
                              </ListItem>
                            </React.Fragment>
                          );
                        })}
                      </List>
                    ) : (
                      <TableContainer>
                        <Table>
                          <TableHead>
                            <TableRow sx={{ bgcolor: '#fafafa' }}>
                              <TableCell>Date</TableCell><TableCell>Customer</TableCell><TableCell>Product</TableCell>
                              <TableCell>Category</TableCell><TableCell align="right">Qty</TableCell>
                              <TableCell align="right">Price</TableCell><TableCell align="right">Total</TableCell>
                              <TableCell align="right">Remaining</TableCell><TableCell>Status</TableCell><TableCell>Action</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {filteredTransactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(t => {
                              const remaining = t.remainingAmount || 0;
                              return (
                                <TableRow key={t.id} hover>
                                  <TableCell>{formatDate(t.date)}</TableCell>
                                  <TableCell><Typography fontWeight={500}>{t.customerName}</Typography></TableCell>
                                  <TableCell>{getProductName(t)}</TableCell>
                                  <TableCell>{t.category}</TableCell>
                                  <TableCell align="right">{t.quantity} {t.unit}</TableCell>
                                  <TableCell align="right">₹{t.price}</TableCell>
                                  <TableCell align="right"><Typography fontWeight={600}>₹{t.amount}</Typography></TableCell>
                                  <TableCell align="right"><Typography color={remaining > 0 ? 'error.main' : 'success.main'} fontWeight={600}>₹{remaining}</Typography></TableCell>
                                  <TableCell><Chip label={remaining <= 0 ? 'Paid' : 'Pending'} size="small" color={remaining <= 0 ? 'success' : 'warning'} /></TableCell>
                                  <TableCell>
                                    <Tooltip title="Delete">
                                      <IconButton size="small" onClick={() => { setPurchaseToDelete(t); setOpenDeletePurchaseDialog(true); setDeletePurchaseConfirmation(''); }} sx={{ color: 'error.main' }}><Delete fontSize="small" /></IconButton>
                                    </Tooltip>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                    <TablePagination
                      rowsPerPageOptions={[5, 10, 25]} component="div"
                      count={filteredTransactions.length} rowsPerPage={rowsPerPage} page={page}
                      onPageChange={(e, np) => setPage(np)}
                      onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                    />
                  </>
                )}
              </Box>
            )}

            {/* Payment History */}
            {activeTab === 1 && (
              <Box>
                {payments.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                    <History sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                    <Typography>No payment history found</Typography>
                  </Box>
                ) : (
                  <List sx={{ p: 0 }}>
                    {payments.map(p => {
                      const isRefund = p.amount < 0;
                      return (
                        <React.Fragment key={p.id}>
                          <ListItem sx={{ borderBottom: '1px solid #f0f0f0', py: 2 }}>
                            <ListItemText
                              primary={<Typography fontWeight={600}>{p.customerName || p.vendorName}</Typography>}
                              secondary={
                                <>
                                  <Typography variant="body2">{formatFullDate(p.date)} • {p.paymentMode || 'Cash'}</Typography>
                                  {p.productName && <Typography variant="body2">{p.productName}</Typography>}
                                </>
                              }
                            />
                            <ListItemSecondaryAction>
                              <Stack alignItems="flex-end" spacing={0.5}>
                                <Typography variant="h6" color={isRefund ? 'error.main' : 'success.main'} fontWeight={600}>
                                  {isRefund ? '-' : '+'}₹{Math.abs(p.amount)}
                                </Typography>
                                <Chip label={isRefund ? 'Refund' : 'Payment'} size="small" color={isRefund ? 'error' : 'success'} />
                              </Stack>
                            </ListItemSecondaryAction>
                          </ListItem>
                        </React.Fragment>
                      );
                    })}
                  </List>
                )}
              </Box>
            )}

            {/* Reports Tab */}
            {activeTab === 2 && (
              <Box sx={{ p: 3 }}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3, borderRadius: 2 }}>
                      <Typography variant="h6" gutterBottom fontWeight={600}>Financial Summary</Typography>
                      <Stack spacing={2}>
                        {[
                          { label: 'Total Sales:', value: `₹${stats.totalSales.toLocaleString()}` },
                          { label: 'Total Received:', value: `₹${stats.totalPaid.toLocaleString()}`, color: 'success.main' },
                          { label: 'Pending Balance:', value: `₹${stats.totalPending.toLocaleString()}`, color: 'error.main' },
                        ].map(({ label, value, color }) => (
                          <Stack key={label} direction="row" justifyContent="space-between">
                            <Typography>{label}</Typography>
                            <Typography fontWeight={600} color={color}>{value}</Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3, borderRadius: 2 }}>
                      <Typography variant="h6" gutterBottom fontWeight={600}>Purchase Summary</Typography>
                      <Stack spacing={2}>
                        {[
                          { label: 'Total Purchases:', value: stats.transactionCount },
                          { label: 'Pending Purchases:', value: stats.pendingCount, color: 'warning.main' },
                          { label: 'Paid Purchases:', value: stats.transactionCount - stats.pendingCount, color: 'success.main' },
                        ].map(({ label, value, color }) => (
                          <Stack key={label} direction="row" justifyContent="space-between">
                            <Typography>{label}</Typography>
                            <Typography fontWeight={600} color={color}>{value}</Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            )}
          </Paper>
        </Container>

        {/* ── Download Dialog ── */}
        <Dialog open={downloadDialog} onClose={() => !downloading && setDownloadDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            <Typography variant="h6" fontWeight={600}><Download sx={{ verticalAlign: 'middle', mr: 1 }} />Download Report</Typography>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <Alert severity="info">Exports both Purchase History and Payment History.</Alert>
              <Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>Select Format</Typography>
                <Stack direction="row" spacing={2}>
                  {[
                    { key: 'pdf',   label: 'PDF',        icon: <PictureAsPdf />, desc: 'Best for printing',  color: 'primary' },
                    { key: 'excel', label: 'Excel',       icon: <TableChart />,   desc: 'Best for analysis', color: 'success' },
                    { key: 'csv',   label: 'CSV',         icon: <TextFields />,   desc: 'Simple format',     color: 'secondary' },
                  ].map(({ key, label, icon, desc, color }) => (
                    <Paper key={key} variant="outlined" onClick={() => setDownloadFormat(key)} sx={{
                      p: 2, flex: 1, cursor: 'pointer',
                      borderColor: downloadFormat === key ? `${color}.main` : 'divider',
                      bgcolor: downloadFormat === key ? `${color}.light` : 'transparent',
                      '&:hover': { borderColor: `${color}.main` }
                    }}>
                      <Stack alignItems="center" spacing={1}>
                        {React.cloneElement(icon, { color: downloadFormat === key ? color : 'inherit' })}
                        <Typography variant="subtitle2" color={downloadFormat === key ? `${color}.main` : 'text.primary'}>{label}</Typography>
                        <Typography variant="caption" color="text.secondary" align="center">{desc}</Typography>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Box>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fafafa' }}>
                <Typography variant="body2"><strong>Vendor:</strong> {vendor?.vendorName}</Typography>
                <Typography variant="body2"><strong>Purchases:</strong> {transactions.length}</Typography>
                <Typography variant="body2"><strong>Payments:</strong> {payments.length}</Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}><strong>Balance:</strong> ₹{vendor?.balance}</Typography>
              </Paper>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 0 }}>
            <Button onClick={() => setDownloadDialog(false)} disabled={downloading}>Cancel</Button>
            <Button variant="contained" onClick={handleDownloadReport} disabled={downloading}
              startIcon={downloading ? <CircularProgress size={20} /> : <Download />}>
              {downloading ? 'Generating...' : `Download ${downloadFormat.toUpperCase()}`}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ── Edit Vendor Dialog ── */}
        <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle><Typography variant="h6" fontWeight={600}>Edit Vendor Details</Typography></DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField fullWidth label="Vendor Name *" value={editForm.vendorName} onChange={e => setEditForm({ ...editForm, vendorName: e.target.value })} />
              <TextField fullWidth label="Phone Number" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} type="tel" />
              <TextField fullWidth label="Email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} type="email" />
              <TextField fullWidth label="Address" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} multiline rows={2} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setOpenEditDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleUpdateVendor} startIcon={<CheckCircle />}>Update Vendor</Button>
          </DialogActions>
        </Dialog>

        {/* ── Delete Vendor Dialog ── */}
        <Dialog open={openDeleteDialog} onClose={() => !deletingVendor && setOpenDeleteDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle><Typography variant="h6" fontWeight={600} color="error"><Warning sx={{ verticalAlign: 'middle', mr: 1 }} />Delete Vendor</Typography></DialogTitle>
          <DialogContent>
            <Stack spacing={3}>
              <Alert severity="error" icon={false}>
                <Typography fontWeight={600} gutterBottom>⚠️ DANGER ZONE</Typography>
                <Typography variant="body2">This will permanently delete {vendor?.vendorName}, {stats.transactionCount} purchases, {payments.length} payments and ₹{vendor?.balance} balance.</Typography>
              </Alert>
              <Alert severity="warning">This action cannot be undone.</Alert>
              <TextField fullWidth label='Type "DELETE" to confirm' value={deleteConfirmation} onChange={e => setDeleteConfirmation(e.target.value)} placeholder="DELETE" disabled={deletingVendor} helperText="Type DELETE in uppercase" />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 0 }}>
            <Button onClick={() => { setOpenDeleteDialog(false); setDeleteConfirmation(''); }} disabled={deletingVendor}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleDeleteVendor} disabled={deleteConfirmation !== 'DELETE' || deletingVendor}
              startIcon={deletingVendor ? <CircularProgress size={20} /> : <Delete />}>
              {deletingVendor ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ── Delete Purchase Dialog ── */}
        <Dialog open={openDeletePurchaseDialog} onClose={() => !deletingPurchase && setOpenDeletePurchaseDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle><Typography variant="h6" fontWeight={600} color="error"><Warning sx={{ verticalAlign: 'middle', mr: 1 }} />Delete Purchase</Typography></DialogTitle>
          <DialogContent>
            <Stack spacing={3}>
              <Alert severity="error" icon={false}>
                <Typography fontWeight={600} gutterBottom>⚠️ Delete Purchase Entry</Typography>
                <List dense sx={{ pl: 1 }}>
                  <ListItem sx={{ py: 0 }}>• Product: {purchaseToDelete && getProductName(purchaseToDelete)}</ListItem>
                  <ListItem sx={{ py: 0 }}>• Customer: {purchaseToDelete?.customerName}</ListItem>
                  <ListItem sx={{ py: 0 }}>• Amount: ₹{purchaseToDelete?.amount}</ListItem>
                  <ListItem sx={{ py: 0 }}>• Remaining: ₹{purchaseToDelete?.remainingAmount}</ListItem>
                </List>
              </Alert>
              <Alert severity="warning">This will delete all related payments and update balances.</Alert>
              <TextField fullWidth label='Type "DELETE" to confirm' value={deletePurchaseConfirmation} onChange={e => setDeletePurchaseConfirmation(e.target.value)} placeholder="DELETE" disabled={deletingPurchase} helperText="Type DELETE in uppercase" />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 0 }}>
            <Button onClick={() => { setOpenDeletePurchaseDialog(false); setPurchaseToDelete(null); setDeletePurchaseConfirmation(''); }} disabled={deletingPurchase}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleDeletePurchase} disabled={deletePurchaseConfirmation !== 'DELETE' || deletingPurchase}
              startIcon={deletingPurchase ? <CircularProgress size={20} /> : <Delete />}>
              {deletingPurchase ? 'Deleting...' : 'Delete Purchase'}
            </Button>
          </DialogActions>
        </Dialog>

      </Box>
    </LocalizationProvider>
  );
};

export default VendorDetail;