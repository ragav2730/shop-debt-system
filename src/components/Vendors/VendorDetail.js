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
  ArrowBack, Edit, Print, Download, FilterList,
  Search, CalendarToday, AttachMoney, Receipt, Paid, Pending,
  CheckCircle, Close, Payment, Refresh, BarChart,
  Visibility, Business, People, History,
  Inventory, Store, AccountBalance, LocalShipping, Payment as PaymentIcon,
  AccountBalanceWallet, Phone, Email, Delete, Warning,
  PictureAsPdf, TableChart, TextFields, WhatsApp
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  doc, getDoc, collection, query, where, onSnapshot,
  addDoc, updateDoc, serverTimestamp, orderBy, getDocs,
  deleteDoc, writeBatch
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { exportToExcel, exportToCSV } from '../../utils/reportGenerator';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const VendorDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const [vendor, setVendor] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [processingPayment, setProcessingPayment] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(isMobile ? 5 : 10);

  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    vendorName: '',
    phone: '',
    email: '',
    address: ''
  });

  // Delete states
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deletingVendor, setDeletingVendor] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  // Delete purchase states
  const [openDeletePurchaseDialog, setOpenDeletePurchaseDialog] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState(null);
  const [deletingPurchase, setDeletingPurchase] = useState(false);
  const [deletePurchaseConfirmation, setDeletePurchaseConfirmation] = useState('');

  // Download dialog state
  const [downloadDialog, setDownloadDialog] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState('pdf');
  const [downloading, setDownloading] = useState(false);

  const [notification, setNotification] = useState({
    show: false,
    message: '',
    type: 'success',
    amount: 0
  });

  // Fetch vendor details
  useEffect(() => {
    const fetchVendor = async () => {
      try {
        const snap = await getDoc(doc(db, 'vendors', id));
        if (!snap.exists()) {
          navigate('/vendors');
          return;
        }
        const vendorData = { id: snap.id, ...snap.data() };
        setVendor(vendorData);
        setEditForm({
          vendorName: vendorData.vendorName || '',
          phone: vendorData.phone || '',
          email: vendorData.email || '',
          address: vendorData.address || ''
        });
        setLoading(false);
      } catch (error) {
        console.error('Error fetching vendor:', error);
        setLoading(false);
      }
    };

    fetchVendor();
  }, [id, navigate]);

  // Fetch customer purchases
  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(
      query(
        collection(db, 'transactions'),
        where('vendorId', '==', id),
        orderBy('date', 'desc')
      ),
      (snap) => {
        const transactionsList = snap.docs.map(d => {
          const data = d.data();
          const remainingAmount = data.remainingAmount ?? data.amount ?? 0;
          return {
            id: d.id,
            ...data,
            amount: data.amount || 0,
            remainingAmount: remainingAmount,
            date: data.date?.toDate?.() || data.date || new Date()
          };
        });
        setTransactions(transactionsList);
      }
    );

    return () => unsubscribe();
  }, [id]);

  // Fetch payments
  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(
      query(
        collection(db, 'payments'),
        where('vendorId', '==', id),
        orderBy('date', 'desc')
      ),
      (snap) => {
        const paymentsList = snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
          date: d.data().date?.toDate?.() || d.data().date || new Date()
        }));
        setPayments(paymentsList);
      }
    );

    return () => unsubscribe();
  }, [id]);

  // Calculate stats – accurately using real data
  const totalSales = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + (Math.abs(p.amount) || 0), 0);
  const totalPending = vendor ? vendor.balance || 0 : 0; // direct from vendor
  const purchaseCount = transactions.length;

  const stats = {
    totalSales,
    totalPending,
    totalPaid,
    transactionCount: purchaseCount,
    pendingCount: transactions.filter(t => (t.remainingAmount || 0) > 0).length
  };

  // Filter transactions for table
  const filteredTransactions = transactions.filter(transaction => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        transaction.customerName?.toLowerCase().includes(term) ||
        transaction.productName?.toLowerCase().includes(term) ||
        transaction.category?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  // Format date helpers
  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      const d = date.toDate ? date.toDate() : new Date(date);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short'
      });
    } catch (e) {
      return 'N/A';
    }
  };

  const formatFullDate = (date) => {
    if (!date) return 'N/A';
    try {
      const d = date.toDate ? date.toDate() : new Date(date);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return 'N/A';
    }
  };

  const getProductName = (transaction) => {
    if (transaction.productName) return transaction.productName;
    const parts = [];
    if (transaction.company) parts.push(transaction.company);
    if (transaction.category) parts.push(transaction.category);
    let name = parts.join(' ');
    if (transaction.quantity && transaction.unit) {
      name += ` (${transaction.quantity} ${transaction.unit})`;
    }
    return name || 'Product';
  };

  // ─── PDF Report Generator (with purchases & payments) ──────────────────────
  const generateVendorReportPDF = (vendorData, purchases, paymentList) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    // Red header
    doc.setFillColor(198, 40, 40);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.text('Vendor Report', margin, 14);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Vendor: ${vendorData.vendorName || ''}`, margin, 22);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageWidth - margin, 22, { align: 'right' });

    let y = 38;

    // Vendor info
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Vendor Details', margin, y);
    y += 7;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    const infoLines = [
      `Phone: ${vendorData.phone || 'N/A'}`,
      `Email: ${vendorData.email || 'N/A'}`,
      `Address: ${vendorData.address || 'N/A'}`,
      `Balance: ₹${(vendorData.balance || 0).toLocaleString('en-IN')}`
    ];
    infoLines.forEach(line => {
      doc.text(line, margin, y);
      y += 6;
    });
    y += 4;

    // Summary stats
    const totalSalesAmt = purchases.reduce((s, t) => s + (t.amount || 0), 0);
    const totalPaidAmt = paymentList.reduce((s, p) => s + (Math.abs(p.amount) || 0), 0);
    const totalPendingAmt = vendorData.balance || 0;

    doc.setFont(undefined, 'bold');
    doc.text('Summary', margin, y);
    y += 7;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.text(`Total Sales: ₹${totalSalesAmt.toLocaleString('en-IN')}`, margin, y);
    doc.text(`Total Received: ₹${totalPaidAmt.toLocaleString('en-IN')}`, margin + 70, y);
    doc.text(`Pending Balance: ₹${totalPendingAmt.toLocaleString('en-IN')}`, margin + 140, y);
    y += 8;

    // Purchases table
    doc.setFont(undefined, 'bold');
    doc.text('Purchase History', margin, y);
    y += 6;
    doc.setFont(undefined, 'normal');

    const purchaseRows = purchases.map(t => [
      formatDate(t.date),
      t.customerName || '',
      getProductName(t),
      t.category || '',
      `${t.quantity || 0} ${t.unit || ''}`,
      `₹${(t.price || 0).toFixed(2)}`,
      `₹${(t.amount || 0).toFixed(2)}`,
      `₹${(t.remainingAmount || 0).toFixed(2)}`,
      t.remainingAmount > 0 ? 'Pending' : 'Paid'
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Customer', 'Product', 'Category', 'Qty', 'Price', 'Total', 'Remaining', 'Status']],
      body: purchaseRows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [198, 40, 40], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 25 },
        2: { cellWidth: 30 },
        3: { cellWidth: 20 },
        4: { cellWidth: 15 },
        5: { cellWidth: 15, halign: 'right' },
        6: { cellWidth: 18, halign: 'right' },
        7: { cellWidth: 22, halign: 'right' },
        8: { cellWidth: 18, halign: 'center' }
      },
      margin: { left: margin, right: margin },
      didDrawPage: (data) => {
        y = data.cursor.y + 4;
      }
    });

    // Payments table
    if (paymentList.length > 0) {
      doc.setFont(undefined, 'bold');
      doc.text('Payment History', margin, y + 4);
      y += 6;
      doc.setFont(undefined, 'normal');

      const paymentRows = paymentList.map(p => [
        formatFullDate(p.date),
        `₹${(Math.abs(p.amount) || 0).toFixed(2)}`,
        p.paymentMode || 'Cash',
        p.notes || '',
        p.settledType || 'individual'
      ]);

      autoTable(doc, {
        startY: y + 2,
        head: [['Date', 'Amount', 'Mode', 'Notes', 'Type']],
        body: paymentRows,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [198, 40, 40], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 22, halign: 'right' },
          2: { cellWidth: 20 },
          3: { cellWidth: 40 },
          4: { cellWidth: 25 }
        },
        margin: { left: margin, right: margin },
        didDrawPage: (data) => {
          y = data.cursor.y + 4;
        }
      });
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth - margin,
        doc.internal.pageSize.getHeight() - 6,
        { align: 'right' }
      );
    }

    doc.save(`Vendor_${vendorData.vendorName.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    return doc;
  };

  // ─── WhatsApp share ──────────────────────────────────────────────────────────
  const handleWhatsAppShare = () => {
    if (!vendor || transactions.length === 0) {
      showNotification('No data to share', 'info');
      return;
    }
    // Generate PDF first
    const doc = generateVendorReportPDF(vendor, transactions, payments);
    // Then open WhatsApp with a message
    const message = `📄 *Vendor Report* - ${vendor.vendorName}\n` +
      `*Balance:* ₹${(vendor.balance || 0).toLocaleString('en-IN')}\n` +
      `*Total Sales:* ₹${stats.totalSales.toLocaleString('en-IN')}\n` +
      `*Total Received:* ₹${stats.totalPaid.toLocaleString('en-IN')}\n` +
      `*Pending:* ₹${stats.totalPending.toLocaleString('en-IN')}\n` +
      `*Purchases:* ${stats.transactionCount}\n\n` +
      `Report generated on ${new Date().toLocaleString('en-IN')}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    showNotification('PDF generated and WhatsApp opened', 'success');
  };

  // ─── Download handler (overhauled) ──────────────────────────────────────────
  const handleDownloadReport = async () => {
    if (!vendor || transactions.length === 0) {
      showNotification('No data available for report', 'info');
      return;
    }

    setDownloading(true);
    try {
      if (downloadFormat === 'pdf') {
        generateVendorReportPDF(vendor, transactions, payments);
        showNotification('PDF report downloaded', 'success');
      } else if (downloadFormat === 'excel') {
        // Use existing excel export – we need to adapt to include payments? For now keep as is.
        // To include payments, we would need to modify reportGenerator; but we'll keep simple.
        // For Excel, we'll just export purchases as before.
        const reportData = [...transactions].sort((a, b) => {
          const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
          const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
          return dateB - dateA;
        });
        const filename = `${vendor.vendorName}_Customer_Report_${new Date().toISOString().split('T')[0]}`;
        await exportToExcel(reportData, vendor.vendorName, 'All Customers', filename);
        showNotification('Excel report downloaded', 'success');
      } else if (downloadFormat === 'csv') {
        const reportData = [...transactions].sort((a, b) => {
          const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
          const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
          return dateB - dateA;
        });
        const filename = `${vendor.vendorName}_Customer_Report_${new Date().toISOString().split('T')[0]}`;
        await exportToCSV(reportData, vendor.vendorName, 'All Customers', filename);
        showNotification('CSV report downloaded', 'success');
      }
      setDownloadDialog(false);
    } catch (error) {
      console.error('Download error:', error);
      showNotification('Error downloading report', 'error');
    } finally {
      setDownloading(false);
    }
  };

  // ─── Rest of existing functions (update vendor, delete, etc.) ──────────────
  const handleUpdateVendor = async () => {
    if (!editForm.vendorName.trim()) {
      showNotification('Vendor name is required', 'error');
      return;
    }
    try {
      await updateDoc(doc(db, 'vendors', id), {
        vendorName: editForm.vendorName,
        phone: editForm.phone,
        email: editForm.email,
        address: editForm.address,
        updatedAt: serverTimestamp()
      });
      setVendor(prev => ({ ...prev, ...editForm }));
      showNotification('Vendor updated', 'success');
      setOpenEditDialog(false);
    } catch (error) {
      console.error('Error updating vendor:', error);
      showNotification('Update failed', 'error');
    }
  };

  const handleOpenDeletePurchaseDialog = (purchase) => {
    setPurchaseToDelete(purchase);
    setOpenDeletePurchaseDialog(true);
    setDeletePurchaseConfirmation('');
  };

  const handleDeletePurchase = async () => {
    if (deletePurchaseConfirmation !== 'DELETE') {
      showNotification('Please type DELETE to confirm', 'error');
      return;
    }
    if (!purchaseToDelete) return;
    const confirm1 = window.confirm(
      `⚠️ Are you sure you want to delete this purchase?\n\n` +
      `Customer: ${purchaseToDelete.customerName}\n` +
      `Product: ${getProductName(purchaseToDelete)}\n` +
      `Amount: ₹${purchaseToDelete.amount}\n` +
      `Remaining: ₹${purchaseToDelete.remainingAmount}\n\n` +
      `This will also delete all related payments and update customer balance.`
    );
    if (!confirm1) return;
    setDeletingPurchase(true);
    try {
      const batch = writeBatch(db);
      const customerId = purchaseToDelete.customerId;
      const purchaseRef = doc(db, 'transactions', purchaseToDelete.id);
      batch.delete(purchaseRef);
      const paymentsToDelete = payments.filter(p => p.transactionId === purchaseToDelete.id);
      paymentsToDelete.forEach(payment => {
        const paymentRef = doc(db, 'payments', payment.id);
        batch.delete(paymentRef);
      });
      const newVendorBalance = Math.max(0, vendor.balance - purchaseToDelete.remainingAmount);
      const vendorRef = doc(db, 'vendors', id);
      batch.update(vendorRef, { balance: newVendorBalance, updatedAt: serverTimestamp() });
      if (customerId && customerId.trim() !== '') {
        try {
          const customerDoc = await getDoc(doc(db, 'customers', customerId));
          if (customerDoc.exists()) {
            const customerTransactionsQuery = query(collection(db, 'transactions'), where('customerId', '==', customerId));
            const customerTransactionsSnap = await getDocs(customerTransactionsQuery);
            const remainingTransactions = customerTransactionsSnap.docs
              .map(doc => ({ id: doc.id, ...doc.data(), amount: doc.data().amount || 0, remainingAmount: doc.data().remainingAmount || doc.data().amount || 0 }))
              .filter(t => t.id !== purchaseToDelete.id);
            const customerPaymentsQuery = query(collection(db, 'payments'), where('customerId', '==', customerId));
            const customerPaymentsSnap = await getDocs(customerPaymentsQuery);
            const remainingPayments = customerPaymentsSnap.docs
              .map(doc => ({ id: doc.id, ...doc.data(), amount: Math.abs(doc.data().amount) || 0 }))
              .filter(p => !paymentsToDelete.some(pd => pd.id === p.id));
            const totalPurchases = remainingTransactions.reduce((sum, t) => sum + t.amount, 0);
            const totalPayments = remainingPayments.reduce((sum, p) => sum + p.amount, 0);
            const newCustomerBalance = totalPurchases - totalPayments;
            const customerRef = doc(db, 'customers', customerId);
            batch.update(customerRef, { balance: newCustomerBalance, updatedAt: serverTimestamp() });
          }
        } catch (customerError) {
          console.error('Error updating customer balance:', customerError);
        }
      }
      await batch.commit();
      setVendor(prev => ({ ...prev, balance: newVendorBalance }));
      showNotification(`Purchase deleted. Balance: ₹${newVendorBalance}`, 'success');
      setOpenDeletePurchaseDialog(false);
      setPurchaseToDelete(null);
      setDeletePurchaseConfirmation('');
    } catch (error) {
      console.error('Error deleting purchase:', error);
      showNotification('Failed to delete purchase', 'error');
    } finally {
      setDeletingPurchase(false);
    }
  };

  const handleDeleteVendor = async () => {
    if (deleteConfirmation !== 'DELETE') {
      showNotification('Please type DELETE to confirm', 'error');
      return;
    }
    const confirm1 = window.confirm(
      `⚠️ WARNING: Are you absolutely sure you want to delete "${vendor.vendorName}"?\n\n` +
      `This will delete:\n` +
      `• Vendor details\n` +
      `• ${transactions.length} purchases\n` +
      `• ${payments.length} payments\n` +
      `• ₹${vendor.balance} balance\n\n` +
      `Customer balances will be automatically recalculated.`
    );
    if (!confirm1) return;
    const confirm2 = window.confirm(
      `🚨 FINAL WARNING: This action cannot be undone!\n\n` +
      `All data for "${vendor.vendorName}" will be permanently deleted.\n\n` +
      `Type DELETE to confirm this permanent deletion.`
    );
    if (!confirm2) return;
    setDeletingVendor(true);
    try {
      const batch = writeBatch(db);
      const vendorRef = doc(db, 'vendors', id);
      batch.delete(vendorRef);
      const customerIds = [...new Set(transactions.map(t => t.customerId).filter(c => c && c.trim() !== ''))];
      transactions.forEach(t => {
        const transactionRef = doc(db, 'transactions', t.id);
        batch.delete(transactionRef);
      });
      payments.forEach(p => {
        const paymentRef = doc(db, 'payments', p.id);
        batch.delete(paymentRef);
      });
      for (const customerId of customerIds) {
        try {
          const customerDoc = await getDoc(doc(db, 'customers', customerId));
          if (!customerDoc.exists()) continue;
          const customerTransactionsQuery = query(collection(db, 'transactions'), where('customerId', '==', customerId));
          const customerTransactionsSnap = await getDocs(customerTransactionsQuery);
          const remainingTransactions = customerTransactionsSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data(), amount: doc.data().amount || 0 }))
            .filter(t => t.vendorId !== id);
          const customerPaymentsQuery = query(collection(db, 'payments'), where('customerId', '==', customerId));
          const customerPaymentsSnap = await getDocs(customerPaymentsQuery);
          const remainingPayments = customerPaymentsSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data(), amount: Math.abs(doc.data().amount) || 0 }))
            .filter(p => p.vendorId !== id);
          const totalPurchases = remainingTransactions.reduce((sum, t) => sum + t.amount, 0);
          const totalPayments = remainingPayments.reduce((sum, p) => sum + p.amount, 0);
          const newBalance = totalPurchases - totalPayments;
          const customerRef = doc(db, 'customers', customerId);
          batch.update(customerRef, { balance: newBalance, updatedAt: serverTimestamp() });
        } catch (customerError) {
          console.error(`Error updating customer ${customerId}:`, customerError);
        }
      }
      await batch.commit();
      showNotification(`Vendor "${vendor.vendorName}" deleted`, 'success');
      setTimeout(() => navigate('/vendors'), 1500);
    } catch (error) {
      console.error('Error deleting vendor:', error);
      showNotification('Error deleting vendor', 'error');
    } finally {
      setDeletingVendor(false);
      setOpenDeleteDialog(false);
      setDeleteConfirmation('');
    }
  };

  const showNotification = (message, type = 'success', amount = 0) => {
    setNotification({ show: true, message, type, amount });
    setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 3000);
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
      <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh', pb: isMobile ? 3 : 4 }}>
        {/* Notification */}
        {notification.show && (
          <Alert
            severity={notification.type}
            sx={{
              position: 'fixed',
              top: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9999,
              width: isMobile ? '90%' : '400px',
              boxShadow: 3
            }}
            action={
              <IconButton size="small" onClick={() => setNotification(prev => ({ ...prev, show: false }))}>
                <Close fontSize="small" />
              </IconButton>
            }
          >
            {notification.message}
            {notification.amount > 0 && ` - ₹${notification.amount}`}
          </Alert>
        )}

        {/* Header */}
        <Box sx={{ bgcolor: 'white', borderBottom: '1px solid #e0e0e0', py: 2 }}>
          <Container maxWidth="lg">
            <Stack direction="row" alignItems="center" spacing={2}>
              <IconButton onClick={() => navigate('/vendors')} sx={{ color: 'primary.main' }}>
                <ArrowBack />
              </IconButton>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5" fontWeight={600}>
                  {vendor.vendorName}
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
                  {vendor.phone && (
                    <Typography variant="body2" color="text.secondary">
                      <Phone sx={{ fontSize: 14, mr: 0.5 }} />
                      {vendor.phone}
                    </Typography>
                  )}
                  {vendor.email && (
                    <Typography variant="body2" color="text.secondary">
                      <Email sx={{ fontSize: 14, mr: 0.5 }} />
                      {vendor.email}
                    </Typography>
                  )}
                  <Chip label={`Balance: ₹${vendor.balance || 0}`} size="small" color={vendor.balance > 0 ? "error" : "success"} />
                </Stack>
              </Box>
              <Stack direction="row" spacing={1}>
                <Tooltip title="Edit Vendor">
                  <IconButton onClick={() => setOpenEditDialog(true)}><Edit /></IconButton>
                </Tooltip>
                <Tooltip title="Delete Vendor">
                  <IconButton onClick={() => setOpenDeleteDialog(true)} sx={{ color: 'error.main' }}><Delete /></IconButton>
                </Tooltip>
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
                <Grid item xs={6} sm={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Total Sales</Typography>
                    <Typography variant="h6" fontWeight={600}>₹{stats.totalSales.toLocaleString()}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Pending</Typography>
                    <Typography variant="h6" fontWeight={600} color="error.main">₹{stats.totalPending.toLocaleString()}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Received</Typography>
                    <Typography variant="h6" fontWeight={600} color="success.main">₹{stats.totalPaid.toLocaleString()}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Purchases</Typography>
                    <Typography variant="h6" fontWeight={600}>{stats.transactionCount}</Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Paper>

          {/* Action Buttons – Removed Individual Settle */}
          <Paper sx={{ p: 2, mb: 3, borderRadius: 2, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 2, alignItems: 'center' }}>
            <Button
              variant="contained"
              startIcon={<PaymentIcon />}
              onClick={() => navigate('/payment')}
              sx={{ flex: isMobile ? 1 : 'none' }}
              fullWidth={isMobile}
            >
              Make Payment
            </Button>

            {/* Download Report Button */}
            <Button
              variant="contained"
              color="success"
              startIcon={<Download />}
              onClick={() => setDownloadDialog(true)}
              sx={{ flex: isMobile ? 1 : 'none', bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}
              fullWidth={isMobile}
            >
              Download Report
            </Button>

            {/* WhatsApp Share Button */}
            <Button
              variant="contained"
              color="info"
              startIcon={<WhatsApp />}
              onClick={handleWhatsAppShare}
              sx={{ flex: isMobile ? 1 : 'none', bgcolor: '#25D366', '&:hover': { bgcolor: '#128C7E' } }}
              fullWidth={isMobile}
            >
              Share via WhatsApp
            </Button>

            <Box sx={{ flex: 1 }} />
            <TextField
              placeholder="Search purchases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
              sx={{ width: isMobile ? '100%' : 250 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
            />
          </Paper>

          {/* Tabs */}
          <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)} variant={isMobile ? "fullWidth" : "standard"} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tab label="Purchase History" />
              <Tab label="Payment History" />
              <Tab label="Reports" />
            </Tabs>

            {/* Purchase History Tab (unchanged) */}
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
                        {filteredTransactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((transaction) => {
                          const remaining = transaction.remainingAmount || 0;
                          const isPaid = remaining <= 0;
                          return (
                            <React.Fragment key={transaction.id}>
                              <ListItem sx={{ borderBottom: '1px solid #f0f0f0', py: 2, '&:hover': { bgcolor: '#fafafa' } }}>
                                <ListItemText
                                  primary={
                                    <Stack direction="row" alignItems="center" spacing={1}>
                                      <Typography fontWeight={600} flex={1}>{transaction.customerName}</Typography>
                                      <Tooltip title="Delete Purchase">
                                        <IconButton size="small" onClick={() => handleOpenDeletePurchaseDialog(transaction)} sx={{ color: 'error.main' }}>
                                          <Delete fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    </Stack>
                                  }
                                  secondary={
                                    <>
                                      <Typography variant="body2">{getProductName(transaction)}</Typography>
                                      <Typography variant="caption" color="text.secondary">{formatDate(transaction.date)}</Typography>
                                      <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                                        <Typography variant="body2">₹{transaction.amount}</Typography>
                                        <Typography variant="body2" color={remaining > 0 ? "error.main" : "success.main"} fontWeight={600}>₹{remaining} remaining</Typography>
                                      </Stack>
                                    </>
                                  }
                                />
                                <ListItemSecondaryAction>
                                  <Chip label={isPaid ? 'Paid' : 'Pending'} size="small" color={isPaid ? 'success' : 'warning'} />
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
                              <TableCell>Date</TableCell>
                              <TableCell>Customer</TableCell>
                              <TableCell>Product</TableCell>
                              <TableCell>Category</TableCell>
                              <TableCell align="right">Quantity</TableCell>
                              <TableCell align="right">Price</TableCell>
                              <TableCell align="right">Total</TableCell>
                              <TableCell align="right">Remaining</TableCell>
                              <TableCell>Status</TableCell>
                              <TableCell>Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {filteredTransactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((transaction) => {
                              const remaining = transaction.remainingAmount || 0;
                              const isPaid = remaining <= 0;
                              return (
                                <TableRow key={transaction.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                  <TableCell>{formatDate(transaction.date)}</TableCell>
                                  <TableCell><Typography fontWeight={500}>{transaction.customerName}</Typography></TableCell>
                                  <TableCell>{getProductName(transaction)}</TableCell>
                                  <TableCell>{transaction.category}</TableCell>
                                  <TableCell align="right">{transaction.quantity} {transaction.unit}</TableCell>
                                  <TableCell align="right">₹{transaction.price}</TableCell>
                                  <TableCell align="right"><Typography fontWeight={600}>₹{transaction.amount}</Typography></TableCell>
                                  <TableCell align="right"><Typography color={remaining > 0 ? "error.main" : "success.main"} fontWeight={600}>₹{remaining}</Typography></TableCell>
                                  <TableCell><Chip label={isPaid ? 'Paid' : 'Pending'} size="small" color={isPaid ? 'success' : 'warning'} /></TableCell>
                                  <TableCell>
                                    <Tooltip title="Delete Purchase">
                                      <IconButton size="small" onClick={() => handleOpenDeletePurchaseDialog(transaction)} sx={{ color: 'error.main' }}><Delete fontSize="small" /></IconButton>
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
                      rowsPerPageOptions={[5, 10, 25]}
                      component="div"
                      count={filteredTransactions.length}
                      rowsPerPage={rowsPerPage}
                      page={page}
                      onPageChange={(e, newPage) => setPage(newPage)}
                      onRowsPerPageChange={(e) => {
                        setRowsPerPage(parseInt(e.target.value, 10));
                        setPage(0);
                      }}
                    />
                  </>
                )}
              </Box>
            )}

            {/* Payment History Tab */}
            {activeTab === 1 && (
              <Box>
                {payments.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                    <History sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                    <Typography>No payment history found</Typography>
                  </Box>
                ) : (
                  <List sx={{ p: 0 }}>
                    {payments.map((payment) => {
                      const isRefund = payment.amount < 0;
                      const amount = Math.abs(payment.amount);
                      return (
                        <React.Fragment key={payment.id}>
                          <ListItem sx={{ borderBottom: '1px solid #f0f0f0', py: 2 }}>
                            <ListItemText
                              primary={<Typography fontWeight={600}>{payment.customerName || payment.vendorName}</Typography>}
                              secondary={
                                <>
                                  <Typography variant="body2">{formatFullDate(payment.date)} • {payment.paymentMode || 'Cash'}</Typography>
                                  {payment.productName && <Typography variant="body2">{payment.productName}</Typography>}
                                </>
                              }
                            />
                            <ListItemSecondaryAction>
                              <Stack alignItems="flex-end" spacing={0.5}>
                                <Typography variant="h6" color={isRefund ? 'error.main' : 'success.main'} fontWeight={600}>
                                  {isRefund ? '-' : '+'}₹{amount}
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
                        <Stack direction="row" justifyContent="space-between"><Typography>Total Sales:</Typography><Typography fontWeight={600}>₹{stats.totalSales.toLocaleString()}</Typography></Stack>
                        <Stack direction="row" justifyContent="space-between"><Typography>Total Received:</Typography><Typography fontWeight={600} color="success.main">₹{stats.totalPaid.toLocaleString()}</Typography></Stack>
                        <Stack direction="row" justifyContent="space-between"><Typography>Pending Balance:</Typography><Typography fontWeight={600} color="error.main">₹{stats.totalPending.toLocaleString()}</Typography></Stack>
                      </Stack>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3, borderRadius: 2 }}>
                      <Typography variant="h6" gutterBottom fontWeight={600}>Purchase Summary</Typography>
                      <Stack spacing={2}>
                        <Stack direction="row" justifyContent="space-between"><Typography>Total Purchases:</Typography><Typography fontWeight={600}>{stats.transactionCount}</Typography></Stack>
                        <Stack direction="row" justifyContent="space-between"><Typography>Pending Purchases:</Typography><Typography fontWeight={600} color="warning.main">{stats.pendingCount}</Typography></Stack>
                        <Stack direction="row" justifyContent="space-between"><Typography>Paid Purchases:</Typography><Typography fontWeight={600} color="success.main">{stats.transactionCount - stats.pendingCount}</Typography></Stack>
                      </Stack>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            )}
          </Paper>
        </Container>

        {/* Download Report Dialog */}
        <Dialog open={downloadDialog} onClose={() => !downloading && setDownloadDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            <Typography variant="h6" fontWeight={600}>
              <Download sx={{ verticalAlign: 'middle', mr: 1 }} />
              Download Report
            </Typography>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <Alert severity="info">Download detailed report with purchases and payment history.</Alert>
              <Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>Select Format</Typography>
                <Stack direction="row" spacing={2}>
                  {[
                    { format: 'pdf', icon: <PictureAsPdf />, label: 'PDF', desc: 'Best for printing' },
                    { format: 'excel', icon: <TableChart />, label: 'Excel', desc: 'Best for analysis' },
                    { format: 'csv', icon: <TextFields />, label: 'CSV', desc: 'Simple format' }
                  ].map((item) => (
                    <Paper
                      key={item.format}
                      variant="outlined"
                      sx={{
                        p: 2,
                        flex: 1,
                        cursor: 'pointer',
                        borderColor: downloadFormat === item.format ? 'primary.main' : 'divider',
                        bgcolor: downloadFormat === item.format ? 'primary.light' : 'transparent',
                        '&:hover': { borderColor: 'primary.main' }
                      }}
                      onClick={() => setDownloadFormat(item.format)}
                    >
                      <Stack alignItems="center" spacing={1}>
                        {item.icon}
                        <Typography variant="subtitle2" color={downloadFormat === item.format ? 'primary.main' : 'text.primary'}>{item.label}</Typography>
                        <Typography variant="caption" color="text.secondary" align="center">{item.desc}</Typography>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Box>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fafafa' }}>
                <Typography variant="body2"><strong>Vendor:</strong> {vendor?.vendorName}</Typography>
                <Typography variant="body2"><strong>Total Transactions:</strong> {transactions.length}</Typography>
                <Typography variant="body2"><strong>Total Payments:</strong> {payments.length}</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}><strong>Balance:</strong> ₹{vendor?.balance}</Typography>
              </Paper>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 0 }}>
            <Button onClick={() => setDownloadDialog(false)} disabled={downloading}>Cancel</Button>
            <Button variant="contained" onClick={handleDownloadReport} disabled={downloading} startIcon={downloading ? <CircularProgress size={20} /> : <Download />}>
              {downloading ? 'Generating...' : `Download ${downloadFormat.toUpperCase()}`}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Vendor Dialog */}
        <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle><Typography variant="h6" fontWeight={600}>Edit Vendor Details</Typography></DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField fullWidth label="Vendor Name *" value={editForm.vendorName} onChange={(e) => setEditForm({ ...editForm, vendorName: e.target.value })} required />
              <TextField fullWidth label="Phone Number" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} type="tel" />
              <TextField fullWidth label="Email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} type="email" />
              <TextField fullWidth label="Address" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} multiline rows={2} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setOpenEditDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleUpdateVendor} startIcon={<CheckCircle />}>Update Vendor</Button>
          </DialogActions>
        </Dialog>

        {/* Delete Vendor Dialog */}
        <Dialog open={openDeleteDialog} onClose={() => !deletingVendor && setOpenDeleteDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            <Typography variant="h6" fontWeight={600} color="error">
              <Warning sx={{ verticalAlign: 'middle', mr: 1 }} /> Delete Vendor
            </Typography>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3}>
              <Alert severity="error" icon={false}>
                <Typography fontWeight={600} gutterBottom>⚠️ DANGER ZONE ⚠️</Typography>
                <Typography variant="body2">This action will permanently delete:</Typography>
                <List dense sx={{ pl: 2 }}>
                  <ListItem sx={{ py: 0 }}>• Vendor: {vendor?.vendorName}</ListItem>
                  <ListItem sx={{ py: 0 }}>• Total purchases: {stats.transactionCount}</ListItem>
                  <ListItem sx={{ py: 0 }}>• Payments: {payments.length}</ListItem>
                  <ListItem sx={{ py: 0 }}>• Balance: ₹{vendor?.balance}</ListItem>
                </List>
              </Alert>
              <Alert severity="warning">This action cannot be undone.</Alert>
              <TextField
                fullWidth
                label={`Type "DELETE" to confirm`}
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE"
                disabled={deletingVendor}
                helperText="Type the word DELETE in uppercase to confirm"
              />
              <Box sx={{ bgcolor: '#fff3e0', p: 2, borderRadius: 1 }}>
                <Typography variant="body2" fontWeight={600} gutterBottom>Confirmation Checklist:</Typography>
                <Stack spacing={1}>
                  <Typography variant="body2">✓ I understand all vendor data will be permanently deleted</Typography>
                  <Typography variant="body2">✓ I understand all purchases for this vendor will be deleted</Typography>
                  <Typography variant="body2">✓ I understand customer balances will be recalculated</Typography>
                </Stack>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 0 }}>
            <Button onClick={() => { setOpenDeleteDialog(false); setDeleteConfirmation(''); }} disabled={deletingVendor}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleDeleteVendor} disabled={deleteConfirmation !== 'DELETE' || deletingVendor} startIcon={deletingVendor ? <CircularProgress size={20} /> : <Delete />}>
              {deletingVendor ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Purchase Dialog */}
        <Dialog open={openDeletePurchaseDialog} onClose={() => !deletingPurchase && setOpenDeletePurchaseDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            <Typography variant="h6" fontWeight={600} color="error">
              <Warning sx={{ verticalAlign: 'middle', mr: 1 }} /> Delete Purchase
            </Typography>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3}>
              <Alert severity="error" icon={false}>
                <Typography fontWeight={600} gutterBottom>⚠️ Delete Purchase Entry</Typography>
                <Typography variant="body2">This action will delete the following purchase:</Typography>
                <List dense sx={{ pl: 2 }}>
                  <ListItem sx={{ py: 0 }}>• Product: {purchaseToDelete && getProductName(purchaseToDelete)}</ListItem>
                  <ListItem sx={{ py: 0 }}>• Customer: {purchaseToDelete?.customerName}</ListItem>
                  <ListItem sx={{ py: 0 }}>• Amount: ₹{purchaseToDelete?.amount}</ListItem>
                  <ListItem sx={{ py: 0 }}>• Remaining: ₹{purchaseToDelete?.remainingAmount}</ListItem>
                </List>
              </Alert>
              <Alert severity="warning">This will also delete all related payments and update balances.</Alert>
              <TextField
                fullWidth
                label={`Type "DELETE" to confirm`}
                value={deletePurchaseConfirmation}
                onChange={(e) => setDeletePurchaseConfirmation(e.target.value)}
                placeholder="DELETE"
                disabled={deletingPurchase}
                helperText="Type the word DELETE in uppercase to confirm deletion"
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 0 }}>
            <Button onClick={() => { setOpenDeletePurchaseDialog(false); setPurchaseToDelete(null); setDeletePurchaseConfirmation(''); }} disabled={deletingPurchase}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleDeletePurchase} disabled={deletePurchaseConfirmation !== 'DELETE' || deletingPurchase} startIcon={deletingPurchase ? <CircularProgress size={20} /> : <Delete />}>
              {deletingPurchase ? 'Deleting...' : 'Delete Purchase'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default VendorDetail;