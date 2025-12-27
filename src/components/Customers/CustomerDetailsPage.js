
import React, { useState, useEffect, useRef } from 'react';
import pdfService from '../../services/pdfService';
import { formatCurrency, formatIndianDate, safeText, getPDFSettings } from '../../utils/pdfUtils';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Stack,
  Divider,
  Button,
  Chip,
  IconButton,
  Tab,
  Tabs,
  CircularProgress,
  Alert,
  Avatar,
  Fab,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  alpha,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  LinearProgress,
  Badge,
  List,
  ListItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CardActions,
  Snackbar
} from '@mui/material';
import {
  ArrowBack,
  Phone,
  Email,
  LocationOn,
  AttachMoney,
  History,
  Receipt,
  Download,
  WhatsApp,
  PictureAsPdf,
  MoreVert,
  Edit,
  Print,
  Share,
  Timeline,
  CalendarMonth,
  AccountBalance,
  Payment,
  Store,
  Person,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  CreditCard,
  QrCode,
  AccountBalanceWallet,
  Close,
  Save,
  Restore,
  ContentCopy,
  LocalAtm,
  CheckCircle,
  PendingActions,
  Description,
  Warning
} from '@mui/icons-material';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  Timestamp
} from 'firebase/firestore';

import { db } from '../../services/firebase';

// Initialize jsPDF
let jsPDF;

// Dynamically import jsPDF to avoid SSR issues
if (typeof window !== 'undefined') {
  import('jspdf').then(module => {
    jsPDF = module.default;
  });
}

// Bill Customizer Component
const BillCustomizer = ({ open, onClose, onSave, currentSettings }) => {
  const [settings, setSettings] = useState({
    companyName: 'Shop Name',
    companyAddress: '123 Main Street, City, State',
    companyPhone: '+91 9876543210',
    companyEmail: 'shop@example.com',
    gstNumber: 'GSTIN: 27XXXXX1234X1Z5',
    footerText: 'Thank you for your business!',
    showLogo: false,
    logoUrl: '',
    showTerms: true,
    termsText: '• Goods once sold will not be taken back\n• Payment within 15 days\n• Subject to jurisdiction',
    headerColor: '#d32f2f',
    textColor: '#000000'
  });

  useEffect(() => {
    if (currentSettings) {
      setSettings(currentSettings);
    } else {
      const saved = localStorage.getItem('billSettings');
      if (saved) {
        setSettings(JSON.parse(saved));
      }
    }
  }, [currentSettings]);

  const handleChange = (field) => (e) => {
    setSettings(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };

  const handleSwitchChange = (field) => (e) => {
    setSettings(prev => ({
      ...prev,
      [field]: e.target.checked
    }));
  };

  const handleSave = () => {
    localStorage.setItem('billSettings', JSON.stringify(settings));
    onSave(settings);
    onClose();
  };

  const handleReset = () => {
    const defaultSettings = {
      companyName: 'Shop Name',
      companyAddress: '123 Main Street, City, State',
      companyPhone: '+91 9876543210',
      companyEmail: 'shop@example.com',
      gstNumber: 'GSTIN: 27XXXXX1234X1Z5',
      footerText: 'Thank you for your business!',
      showLogo: false,
      logoUrl: '',
      showTerms: true,
      termsText: '• Goods once sold will not be taken back\n• Payment within 15 days\n• Subject to jurisdiction',
      headerColor: '#d32f2f',
      textColor: '#000000'
    };
    setSettings(defaultSettings);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Customize Bill Template</Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent dividers>
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" gutterBottom color="primary">
              Company Details
            </Typography>
            <TextField
              fullWidth
              label="Company Name"
              value={settings.companyName}
              onChange={handleChange('companyName')}
              size="small"
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth
              label="Company Address"
              value={settings.companyAddress}
              onChange={handleChange('companyAddress')}
              size="small"
              multiline
              rows={2}
              sx={{ mb: 2 }}
            />
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  value={settings.companyPhone}
                  onChange={handleChange('companyPhone')}
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Email"
                  value={settings.companyEmail}
                  onChange={handleChange('companyEmail')}
                  size="small"
                />
              </Grid>
            </Grid>
            
            <TextField
              fullWidth
              label="GST Number"
              value={settings.gstNumber}
              onChange={handleChange('gstNumber')}
              size="small"
              sx={{ mt: 2 }}
            />
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" gutterBottom color="primary">
              Bill Styling
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Header Color"
                  type="color"
                  value={settings.headerColor}
                  onChange={handleChange('headerColor')}
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <Box 
                        sx={{ 
                          width: 20, 
                          height: 20, 
                          bgcolor: settings.headerColor,
                          borderRadius: '4px',
                          mr: 1,
                          border: '1px solid #ddd'
                        }}
                      />
                    )
                  }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Text Color"
                  type="color"
                  value={settings.textColor}
                  onChange={handleChange('textColor')}
                  size="small"
                />
              </Grid>
            </Grid>
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" gutterBottom color="primary">
              Footer Section
            </Typography>
            <TextField
              fullWidth
              label="Footer Text"
              value={settings.footerText}
              onChange={handleChange('footerText')}
              size="small"
              multiline
              rows={2}
              sx={{ mb: 2 }}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={settings.showTerms}
                  onChange={handleSwitchChange('showTerms')}
                  size="small"
                />
              }
              label="Show Terms & Conditions"
            />
            
            {settings.showTerms && (
              <TextField
                fullWidth
                label="Terms & Conditions"
                value={settings.termsText}
                onChange={handleChange('termsText')}
                size="small"
                multiline
                rows={3}
                sx={{ mt: 1 }}
              />
            )}
          </Box>

          <Divider />

          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.showLogo}
                  onChange={handleSwitchChange('showLogo')}
                  size="small"
                />
              }
              label="Show Company Logo"
            />
            
            {settings.showLogo && (
              <TextField
                fullWidth
                label="Logo URL"
                value={settings.logoUrl}
                onChange={handleChange('logoUrl')}
                size="small"
                placeholder="https://example.com/logo.png"
                helperText="Enter URL of your company logo"
                sx={{ mt: 2 }}
              />
            )}
          </Box>
        </Stack>
      </DialogContent>
      
      <DialogActions sx={{ p: 2 }}>
        <Button
          startIcon={<Restore />}
          onClick={handleReset}
          color="warning"
          variant="outlined"
        >
          Reset
        </Button>
        <Button
          startIcon={<Save />}
          onClick={handleSave}
          variant="contained"
          color="primary"
        >
          Save Settings
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Main Customer Details Component
const CustomerDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [customer, setCustomer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [billSettings, setBillSettings] = useState({});
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [pdfType, setPdfType] = useState('bill');
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  // Load bill settings
  useEffect(() => {
    const savedSettings = localStorage.getItem('billSettings');
    if (savedSettings) {
      setBillSettings(JSON.parse(savedSettings));
    }
  }, []);

  // Fetch customer data
  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        const snap = await getDoc(doc(db, 'customers', id));
        if (snap.exists()) {
          setCustomer({ id: snap.id, ...snap.data() });
        } else {
          console.error('Customer not found');
          showSnackbar('Customer not found', 'error');
        }
      } catch (error) {
        console.error('Error fetching customer:', error);
        showSnackbar('Error loading customer', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomer();
  }, [id]);

  // Fetch transactions - SIMPLIFIED QUERY to avoid index error
  useEffect(() => {
    if (!id) return;
    
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'transactions'), 
        where('customerId', '==', id)
      ),
      snap => {
        const data = snap.docs.map(d => ({ 
          id: d.id, 
          ...d.data(),
          date: d.data().date || Timestamp.now()
        }));
        // Sort locally
        data.sort((a, b) => {
          const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
          const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
          return dateB - dateA;
        });
        setTransactions(data);
      },
      error => {
        console.error('Error fetching transactions:', error);
        if (error.code === 'failed-precondition') {
          console.log('Firebase index error. Please create composite index in Firebase Console.');
        }
      }
    );

    return () => unsubscribe();
  }, [id]);

  // Fetch payments - SIMPLIFIED QUERY to avoid index error
  useEffect(() => {
    if (!id) return;
    
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'payments'), 
        where('customerId', '==', id)
      ),
      snap => {
        const data = snap.docs.map(d => ({ 
          id: d.id, 
          ...d.data(),
          date: d.data().date || Timestamp.now()
        }));
        // Sort locally
        data.sort((a, b) => {
          const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
          const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
          return dateB - dateA;
        });
        setPayments(data);
      },
      error => {
        console.error('Error fetching payments:', error);
        if (error.code === 'failed-precondition') {
          console.log('Firebase index error. Please create composite index in Firebase Console.');
        }
      }
    );

    return () => unsubscribe();
  }, [id]);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // Format date for display
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      if (timestamp.toDate) {
        return timestamp.toDate().toLocaleDateString('en-IN');
      }
      if (timestamp instanceof Date) {
        return timestamp.toLocaleDateString('en-IN');
      }
      return new Date(timestamp).toLocaleDateString('en-IN');
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Calculate statistics
  const calculateStats = () => {
    const totalPurchases = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const remainingBalance = customer?.balance || 0;
    const paidAmount = totalPurchases - remainingBalance;
    const paymentPercentage = totalPurchases > 0 ? (paidAmount / totalPurchases) * 100 : 0;

    return {
      totalPurchases,
      totalPayments,
      remainingBalance,
      paidAmount,
      paymentPercentage: Math.min(100, Math.max(0, paymentPercentage)),
      totalTransactions: transactions.length,
      totalPaymentsCount: payments.length
    };
  };

  // FIXED: Generate Simple PDF with proper font encoding
  const generateSimpleBill = () => {
    if (!customer || !jsPDF) return null;

    const stats = calculateStats();
    const settings = {
      companyName: 'AVR Shop Debt System',
      companyAddress: '123 Main Street, Chennai',
      companyPhone: '+91 9876543210',
      footerText: 'Thank you for your business!',
      ...billSettings
    };

    try {
      // Create PDF with proper settings
      const doc = new jsPDF({
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      
      // Set font BEFORE adding any text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(18);
      doc.setTextColor(211, 47, 47);
      doc.text('BILL', 105, 20, null, null, 'center');
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(settings.companyName, 105, 28, null, null, 'center');
      doc.text(settings.companyPhone, 105, 34, null, null, 'center');

      // Customer Info
      doc.setFontSize(12);
      doc.setTextColor(40, 40, 40);
      
      // Ensure customer name is a string
      const customerName = String(customer.customerName || 'N/A');
      const phone = String(customer.phone || 'N/A');
      
      doc.text(`Customer: ${customerName}`, 20, 45);
      doc.text(`Phone: ${phone}`, 20, 52);
      doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 20, 59);

      // Summary
      let yPos = 70;
      doc.text('Summary:', 20, yPos);
      yPos += 8;
      
      // Format numbers properly
      const totalAmount = `₹${stats.totalPurchases.toFixed(2)}`;
      const paidAmount = `₹${stats.totalPayments.toFixed(2)}`;
      const balanceDue = `₹${stats.remainingBalance.toFixed(2)}`;
      
      doc.text('Total Amount:', 25, yPos);
      doc.text(totalAmount, 150, yPos, null, null, 'right');
      
      doc.text('Paid Amount:', 25, yPos + 8);
      doc.text(paidAmount, 150, yPos + 8, null, null, 'right');
      
      doc.text('Balance Due:', 25, yPos + 16);
      doc.text(balanceDue, 150, yPos + 16, null, null, 'right');

      yPos += 35;

      // Footer
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Thank you for your business!', 105, yPos, null, null, 'center');
      doc.text('This is a computer generated bill', 105, yPos + 6, null, null, 'center');

      return doc;
    } catch (error) {
      console.error('Error in generateSimpleBill:', error);
      return null;
    }
  };

  // FIXED: Generate Detailed Bill with proper font encoding
  const generateDetailedBill = () => {
    if (!customer || !jsPDF) return null;

    const stats = calculateStats();
    const settings = {
      companyName: 'Shop Debt System',
      companyAddress: '123 Main Street, Chennai',
      companyPhone: '+91 9876543210',
      companyEmail: 'shop@debt.com',
      gstNumber: 'GSTIN: 27ABCDE1234F1Z5',
      footerText: 'Thank you for your business!',
      ...billSettings
    };

    try {
      const doc = new jsPDF({
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      
      // Set font
      doc.setFont('helvetica', 'normal');
      
      // Header
      doc.setFontSize(20);
      doc.setTextColor(211, 47, 47);
      doc.text(settings.companyName, 105, 20, null, null, 'center');
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(settings.companyAddress, 105, 28, null, null, 'center');
      doc.text(`Phone: ${settings.companyPhone} | Email: ${settings.companyEmail}`, 105, 34, null, null, 'center');
      doc.text(settings.gstNumber, 105, 40, null, null, 'center');

      // Bill Info
      doc.setFontSize(16);
      doc.setTextColor(40, 40, 40);
      doc.text('CUSTOMER BILL STATEMENT', 105, 50, null, null, 'center');

      // Customer Info
      let yPos = 60;
      doc.setFontSize(12);
      doc.text(`Customer: ${String(customer.customerName || 'N/A')}`, 20, yPos);
      yPos += 8;
      doc.text(`Phone: ${String(customer.phone || 'N/A')}`, 20, yPos);
      yPos += 8;
      doc.text(`Balance: ₹${stats.remainingBalance.toFixed(2)}`, 20, yPos);
      yPos += 12;

      // Purchase History Section
      doc.setFontSize(14);
      doc.text('PURCHASE HISTORY', 20, yPos);
      yPos += 10;

      if (transactions.length > 0) {
        transactions.forEach((t, index) => {
          if (yPos > 250) {
            doc.addPage();
            yPos = 20;
          }
          doc.setFontSize(10);
          const productName = String(t.productName || 'Product');
          doc.text(`${formatDate(t.date)} - ${productName}: ₹${(t.amount || 0).toFixed(2)}`, 20, yPos);
          yPos += 6;
        });
      } else {
        doc.text('No purchases found', 20, yPos);
        yPos += 6;
      }

      yPos += 10;

      // Payment History Section
      doc.setFontSize(14);
      doc.text('PAYMENT HISTORY', 20, yPos);
      yPos += 10;

      if (payments.length > 0) {
        payments.forEach((p, index) => {
          if (yPos > 250) {
            doc.addPage();
            yPos = 20;
          }
          doc.setFontSize(10);
          const paymentMode = String(p.paymentMode || 'Cash');
          doc.text(`${formatDate(p.date)} - ${paymentMode}: ₹${(p.amount || 0).toFixed(2)}`, 20, yPos);
          yPos += 6;
        });
      } else {
        doc.text('No payments found', 20, yPos);
        yPos += 6;
      }

      yPos += 10;

      // Summary Section
      doc.setFontSize(14);
      doc.text('ACCOUNT SUMMARY', 20, yPos);
      yPos += 10;

      doc.setFontSize(11);
      doc.text(`Total Purchases: ₹${stats.totalPurchases.toFixed(2)}`, 20, yPos);
      yPos += 7;
      doc.text(`Total Payments: ₹${stats.totalPayments.toFixed(2)}`, 20, yPos);
      yPos += 7;
      doc.text(`Remaining Balance: ₹${stats.remainingBalance.toFixed(2)}`, 20, yPos);
      yPos += 7;
      doc.text(`Status: ${stats.remainingBalance > 0 ? 'PENDING' : 'PAID'}`, 20, yPos);

      yPos += 15;

      // Footer
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(settings.footerText, 105, yPos, null, null, 'center');
      doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 105, yPos + 6, null, null, 'center');

      return doc;
    } catch (error) {
      console.error('Error in generateDetailedBill:', error);
      return null;
    }
  };

  // Handle PDF Generation
  const handleGeneratePDF = async (type = 'detailed') => {
    if (!customer) return;
    
    // Wait for jsPDF to load if not already loaded
    if (!jsPDF) {
      showSnackbar('PDF library loading, please try again...', 'warning');
      return;
    }
    
    setGeneratingPDF(true);
    try {
      let pdfDoc;
      
      if (type === 'detailed') {
        pdfDoc = generateDetailedBill();
        setPdfType('history');
      } else {
        pdfDoc = generateSimpleBill();
        setPdfType('bill');
      }
      
      if (pdfDoc) {
        // Create blob
        const pdfBlob = pdfDoc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        // Download the PDF
        const downloadLink = document.createElement('a');
        downloadLink.href = pdfUrl;
        downloadLink.download = `${String(customer.customerName).replace(/\s+/g, '_')}_${
          type === 'detailed' ? 'Detailed_Bill' : 'Bill'
        }_${Date.now()}.pdf`;
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Prepare WhatsApp message
        setTimeout(() => {
          const stats = calculateStats();
          const message = encodeURIComponent(
            `*${type === 'detailed' ? 'Detailed Bill' : 'Bill'} for ${customer.customerName}*\n\n` +
            `Total Purchases: ₹${stats.totalPurchases.toFixed(2)}\n` +
            `Total Payments: ₹${stats.totalPayments.toFixed(2)}\n` +
            `Balance Due: ₹${stats.remainingBalance.toFixed(2)}\n\n` +
            `Phone: ${customer.phone || 'N/A'}\n` +
            `Generated from Shop Debt System`
          );
          
          // Open WhatsApp with pre-filled message
          window.open(`https://wa.me/?text=${message}`, '_blank');
        }, 1000);
        
        showSnackbar(`${type === 'detailed' ? 'Detailed' : 'Simple'} bill generated successfully!`, 'success');
      } else {
        showSnackbar('Failed to generate PDF', 'error');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      showSnackbar('Failed to generate PDF. Please try again.', 'error');
    } finally {
      setGeneratingPDF(false);
      handleMenuClose();
    }
  };

  // Handle Settings Save
  const handleSaveSettings = (settings) => {
    setBillSettings(settings);
    localStorage.setItem('billSettings', JSON.stringify(settings));
    showSnackbar('Bill settings saved successfully!', 'success');
  };

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: '#f5f5f5'
      }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!customer) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="error">
          Customer not found
        </Alert>
        <Button 
          startIcon={<ArrowBack />} 
          onClick={() => navigate('/customers')}
          sx={{ mt: 2 }}
        >
          Back to Customers
        </Button>
      </Container>
    );
  }

  const stats = calculateStats();

  return (
    <Box sx={{ 
      bgcolor: '#f5f5f5',
      minHeight: '100vh',
      pb: 8
    }}>
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          severity={snackbar.severity} 
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Header */}
      <Paper 
        elevation={0}
        sx={{ 
          p: 2,
          borderBottom: '1px solid #e0e0e0',
          bgcolor: 'white',
          position: 'sticky',
          top: 0,
          zIndex: 1000
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <IconButton onClick={() => navigate('/customers')}>
            <ArrowBack />
          </IconButton>
          
          <Avatar
            sx={{ 
              bgcolor: customer.balance > 0 ? '#ff9800' : '#4caf50',
              width: 48,
              height: 48
            }}
          >
            <Person />
          </Avatar>
          
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={600}>
              {customer.customerName}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Phone sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {customer.phone}
              </Typography>
              {customer.email && (
                <>
                  <Email sx={{ fontSize: 14, color: 'text.secondary', ml: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    {customer.email}
                  </Typography>
                </>
              )}
            </Stack>
          </Box>
          
          <Tooltip title="More options">
            <IconButton onClick={handleMenuOpen}>
              <MoreVert />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      {/* Balance Overview Card */}
      <Container sx={{ py: 2 }}>
        <Card sx={{ 
          borderRadius: 2,
          mb: 2,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  Current Balance
                </Typography>
                <Typography variant="h3" fontWeight={800} sx={{ mt: 1 }}>
                  ₹{stats.remainingBalance.toFixed(0)}
                </Typography>
                <Typography variant="caption" sx={{ mt: 1, display: 'block', opacity: 0.8 }}>
                  {stats.remainingBalance > 0 ? 'Payment Pending' : 'All Payments Cleared'}
                </Typography>
              </Box>
              
              <Avatar sx={{ 
                width: 60, 
                height: 60,
                bgcolor: 'rgba(255,255,255,0.2)',
                border: '2px solid rgba(255,255,255,0.3)'
              }}>
                <AccountBalanceWallet sx={{ fontSize: 32 }} />
              </Avatar>
            </Stack>
            
            {/* Progress Bar */}
            <Box sx={{ mt: 3 }}>
              <LinearProgress 
                variant="determinate" 
                value={stats.paymentPercentage}
                sx={{ 
                  height: 8, 
                  borderRadius: 4,
                  bgcolor: 'rgba(255,255,255,0.2)',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: '#4caf50'
                  }
                }} 
              />
              <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                <Typography variant="caption">Paid {stats.paymentPercentage.toFixed(1)}%</Typography>
                <Typography variant="caption">₹{stats.paidAmount.toFixed(0)} / ₹{stats.totalPurchases.toFixed(0)}</Typography>
              </Stack>
            </Box>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6}>
            <Card sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <ShoppingCart sx={{ color: '#2196f3', fontSize: 20 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Total Purchases
                    </Typography>
                    <Typography variant="h6" fontWeight={700}>
                      ₹{stats.totalPurchases.toFixed(0)}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={6}>
            <Card sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CreditCard sx={{ color: '#4caf50', fontSize: 20 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Total Payments
                    </Typography>
                    <Typography variant="h6" fontWeight={700} color="success.main">
                      ₹{stats.totalPayments.toFixed(0)}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={6}>
            <Card sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Description sx={{ color: '#ff9800', fontSize: 20 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Transactions
                    </Typography>
                    <Typography variant="h6" fontWeight={700}>
                      {stats.totalTransactions}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={6}>
            <Card sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <History sx={{ color: '#9c27b0', fontSize: 20 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Payments Made
                    </Typography>
                    <Typography variant="h6" fontWeight={700} color="secondary.main">
                      {stats.totalPaymentsCount}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs Navigation */}
        <Paper sx={{ mb: 2, borderRadius: 2 }}>
          <Tabs 
            value={activeTab} 
            onChange={(e, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab icon={<ShoppingCart />} label="Purchases" />
            <Tab icon={<CreditCard />} label="Payments" />
            <Tab icon={<History />} label="History" />
            <Tab icon={<Description />} label="Summary" />
          </Tabs>
        </Paper>

        {/* Tab Content */}
        {activeTab === 0 && (
          <Card sx={{ borderRadius: 2, mb: 2 }}>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ p: 2, borderBottom: '1px solid #f0f0f0' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle1" fontWeight={600}>
                    Purchase History ({transactions.length})
                  </Typography>
                  <Chip 
                    label={`Total: ₹${stats.totalPurchases.toFixed(2)}`} 
                    size="small" 
                    color="primary"
                  />
                </Stack>
              </Box>
              
              {transactions.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <ShoppingCart sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography color="text.secondary">No purchases found</Typography>
                </Box>
              ) : (
                <Box sx={{ p: 2 }}>
                  <Stack spacing={2}>
                    {transactions.map((t) => (
                      <Paper 
                        key={t.id}
                        sx={{ 
                          p: 2, 
                          borderRadius: 2,
                          borderLeft: '4px solid #2196f3',
                          bgcolor: '#f5f5f5'
                        }}
                      >
                        <Stack spacing={1}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="subtitle2" fontWeight={600}>
                              {t.productName || 'Product'}
                            </Typography>
                            <Typography variant="h6" color="primary">
                              ₹{(t.amount || 0).toFixed(2)}
                            </Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(t.date)} • {t.category || 'General'}
                          </Typography>
                          {t.description && (
                            <Typography variant="body2">
                              {t.description}
                            </Typography>
                          )}
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 1 && (
          <Card sx={{ borderRadius: 2, mb: 2 }}>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ p: 2, borderBottom: '1px solid #f0f0f0' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle1" fontWeight={600}>
                    Payment History ({payments.length})
                  </Typography>
                  <Chip 
                    label={`Total: ₹${stats.totalPayments.toFixed(2)}`} 
                    size="small" 
                    color="success"
                  />
                </Stack>
              </Box>
              
              {payments.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <CreditCard sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography color="text.secondary">No payments found</Typography>
                </Box>
              ) : (
                <Box sx={{ p: 2 }}>
                  <Stack spacing={2}>
                    {payments.map((p) => (
                      <Paper 
                        key={p.id}
                        sx={{ 
                          p: 2, 
                          borderRadius: 2,
                          borderLeft: '4px solid #4caf50',
                          bgcolor: '#f5f5f5'
                        }}
                      >
                        <Stack spacing={1}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="subtitle2" fontWeight={600} color="success.main">
                              ₹{(p.amount || 0).toFixed(2)}
                            </Typography>
                            <Chip
                              label={p.paymentMode || 'Cash'}
                              size="small"
                              color="success"
                              variant="outlined"
                            />
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(p.date)}
                          </Typography>
                          {p.notes && (
                            <Typography variant="body2">
                              {p.notes}
                            </Typography>
                          )}
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 2 && (
          <Card sx={{ borderRadius: 2, mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Complete History
              </Typography>
              
              <Stack spacing={2}>
                {/* Combine and sort all transactions */}
                {[...transactions, ...payments]
                  .sort((a, b) => {
                    const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                    const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                    return dateB - dateA;
                  })
                  .slice(0, 10)
                  .map((item, index) => (
                    <Paper 
                      key={item.id || index}
                      sx={{ 
                        p: 2, 
                        borderRadius: 2,
                        borderLeft: `4px solid ${item.amount ? '#2196f3' : '#4caf50'}`,
                        bgcolor: '#fafafa'
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {item.productName || item.notes || 'Transaction'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(item.date)} • {item.paymentMode || item.category || ''}
                          </Typography>
                        </Box>
                        <Typography 
                          variant="h6" 
                          fontWeight={700}
                          color={item.amount ? 'primary' : 'success.main'}
                        >
                          {item.amount ? '₹' : '+ ₹'}{Math.abs(item.amount || 0).toFixed(2)}
                        </Typography>
                      </Stack>
                    </Paper>
                  ))}
              </Stack>
            </CardContent>
          </Card>
        )}

        {activeTab === 3 && (
          <Card sx={{ borderRadius: 2, mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Account Summary
              </Typography>
              
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Payment Status
                  </Typography>
                  <Chip
                    label={stats.remainingBalance > 0 ? 'PENDING PAYMENT' : 'ALL PAID'}
                    color={stats.remainingBalance > 0 ? 'warning' : 'success'}
                    sx={{ fontWeight: 600 }}
                    icon={stats.remainingBalance > 0 ? <PendingActions /> : <CheckCircle />}
                  />
                </Box>
                
                <Divider />
                
                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography>Total Purchases:</Typography>
                    <Typography fontWeight={600}>₹{stats.totalPurchases.toFixed(2)}</Typography>
                  </Stack>
                  
                  <Stack direction="row" justifyContent="space-between">
                    <Typography>Total Payments:</Typography>
                    <Typography fontWeight={600} color="success.main">
                      ₹{stats.totalPayments.toFixed(2)}
                    </Typography>
                  </Stack>
                  
                  <Stack direction="row" justifyContent="space-between">
                    <Typography>Remaining Balance:</Typography>
                    <Typography fontWeight={600} color="error">
                      ₹{stats.remainingBalance.toFixed(2)}
                    </Typography>
                  </Stack>
                  
                  <Stack direction="row" justifyContent="space-between">
                    <Typography>Payment Progress:</Typography>
                    <Typography fontWeight={600} color="primary">
                      {stats.paymentPercentage.toFixed(1)}%
                    </Typography>
                  </Stack>
                </Stack>
                
                <Divider />
                
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Payment Timeline
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={stats.paymentPercentage}
                    sx={{ 
                      height: 8, 
                      borderRadius: 4,
                      bgcolor: '#e0e0e0'
                    }}
                  />
                  <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Start: {transactions.length > 0 ? formatDate(transactions[transactions.length - 1]?.date) : 'N/A'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Current
                    </Typography>
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        )}
      </Container>

      {/* PDF Generation FAB */}
      <Fab
        color="primary"
        variant="extended"
        onClick={handleMenuOpen}
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 1000,
          bgcolor: '#d32f2f'
        }}
        disabled={generatingPDF}
      >
        {generatingPDF ? (
          <CircularProgress size={24} color="inherit" sx={{ mr: 1 }} />
        ) : (
          <PictureAsPdf sx={{ mr: 1 }} />
        )}
        {generatingPDF ? 'Generating...' : 'Generate PDF'}
      </Fab>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            width: 280,
            borderRadius: 2
          }
        }}
      >
        <MenuItem onClick={() => handleGeneratePDF('detailed')} disabled={generatingPDF}>
          <ListItemIcon>
            <Description fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary="Detailed Bill with History"
            secondary="Complete transaction history"
          />
        </MenuItem>
        
        <MenuItem onClick={() => handleGeneratePDF('simple')} disabled={generatingPDF}>
          <ListItemIcon>
            <Receipt fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary="Simple Bill"
            secondary="Current balance summary"
          />
        </MenuItem>
        
        <Divider />
        
        <MenuItem onClick={() => { setShowCustomizer(true); handleMenuClose(); }}>
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          <ListItemText>Customize Bill Template</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => navigate(`/list/${id}`)}>
          <ListItemIcon>
            <Payment fontSize="small" />
          </ListItemIcon>
          <ListItemText>Record Payment</ListItemText>
        </MenuItem>
        
        <Divider />
        
        <MenuItem onClick={() => {
          navigator.clipboard.writeText(customer.phone || '');
          showSnackbar('Phone number copied to clipboard!', 'success');
          handleMenuClose();
        }}>
          <ListItemIcon>
            <ContentCopy fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy Phone Number</ListItemText>
        </MenuItem>
      </Menu>

      {/* Bill Customizer Modal */}
      <BillCustomizer
        open={showCustomizer}
        onClose={() => setShowCustomizer(false)}
        onSave={handleSaveSettings}
        currentSettings={billSettings}
      />

      {/* WhatsApp Sharing Alert */}
      <Alert 
        severity="info" 
        sx={{ 
          mx: 2, 
          mb: 2, 
          borderRadius: 2,
          position: 'fixed',
          bottom: 80,
          left: 0,
          right: 0,
          zIndex: 999,
          display: { xs: 'flex', md: 'none' }
        }}
      >
        <Typography variant="body2">
          PDF will download automatically. WhatsApp will open to share it.
        </Typography>
      </Alert>
    </Box>
  );
};

export default CustomerDetailsPage;