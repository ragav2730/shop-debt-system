import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Button,
  Stack,
  Divider,
  CircularProgress,
  Alert,
  Chip,
  TextField,
  MenuItem,
  IconButton,
  Checkbox,
  FormControlLabel,
  Fab,
  Tooltip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  PictureAsPdf,
  WhatsApp,
  Download,
  CheckCircle,
  Warning,
  Search,
  FilterList,
  SelectAll,
  ClearAll,
  Send,
  Refresh,
  ArrowBack,
  Visibility
} from '@mui/icons-material';
import {
  collection,
  query,
  onSnapshot,
  where,
  orderBy,
  getDocs
} from 'firebase/firestore';
// Correct: Go up ONE level (to components), then to services
import { auth, db } from '../../services/firebase';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Initialize jsPDF
let jsPDFInstance;

// Dynamically import jsPDF to avoid SSR issues
if (typeof window !== 'undefined') {
  import('jspdf').then(module => {
    jsPDFInstance = module.default;
  });
}

// Helper to get PDF instance
const getPDF = () => {
  if (typeof window === 'undefined') return null;
  return window.jsPDF || jsPDFInstance;
};

// Initialize PDF
const initializePDF = async () => {
  if (typeof window !== 'undefined' && !window.jsPDF) {
    try {
      const jsPDFModule = await import('jspdf');
      window.jsPDF = jsPDFModule.default;
    } catch (error) {
      console.error('Failed to load jsPDF:', error);
    }
  }
};

// Call it immediately
initializePDF();

const PDFGenerator = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [customers, setCustomers] = useState([]);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'customers'),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCustomers(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredCustomers = customers.filter(customer => {
    if (filter === 'pending' && customer.balance <= 0) return false;
    if (filter === 'paid' && customer.balance > 0) return false;
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        customer.customerName?.toLowerCase().includes(searchLower) ||
        customer.phone?.includes(searchTerm)
      );
    }
    
    return true;
  });

  const handleSelectCustomer = (customerId) => {
    setSelectedCustomers(prev => 
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const handleSelectAll = () => {
    if (selectedCustomers.length === filteredCustomers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(filteredCustomers.map(c => c.id));
    }
  };

  // Format date for display (same as CustomerDetailsPage)
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      if (timestamp.toDate) {
        return timestamp.toDate().toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      }
      if (timestamp instanceof Date) {
        return timestamp.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      }
      return new Date(timestamp).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Generate Simple Bill for a customer (same as CustomerDetailsPage)
  const generateSimpleBill = (customer, settings = {}) => {
    const jsPDF = getPDF();
    if (!customer || !jsPDF) return null;

    const defaultSettings = {
      companyName: 'Shop Debt System',
      companyAddress: '123 Main Street, Chennai',
      companyPhone: '+91 9876543210',
      footerText: 'Thank you for your business!',
      ...settings
    };

    try {
      // Create PDF with proper settings
      const doc = new jsPDF({
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      
      // Set font BEFORE adding any text
      doc.setFont('helvetica');
      doc.setFontSize(isMobile ? 14 : 18);
      doc.setTextColor(211, 47, 47);
      doc.text('BILL', 105, 20, { align: 'center' });
      
      doc.setFontSize(isMobile ? 8 : 10);
      doc.setTextColor(100, 100, 100);
      doc.text(defaultSettings.companyName, 105, 28, { align: 'center' });
      doc.text(defaultSettings.companyPhone, 105, 34, { align: 'center' });

      // Customer Info
      doc.setFontSize(isMobile ? 10 : 12);
      doc.setTextColor(40, 40, 40);
      
      const customerName = customer.customerName || 'N/A';
      const phone = customer.phone || 'N/A';
      
      doc.text(`Customer: ${customerName}`, 20, 45);
      doc.text(`Phone: ${phone}`, 20, 52);
      doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 20, 59);

      // Summary
      let yPos = 70;
      doc.text('Summary:', 20, yPos);
      yPos += 8;
      
      const totalAmount = `₹${(customer.balance || 0).toFixed(2)}`;
      const balanceDue = `₹${(customer.balance || 0).toFixed(2)}`;
      
      doc.text('Current Balance:', 25, yPos);
      doc.text(totalAmount, 150, yPos, { align: 'right' });
      
      doc.text('Balance Due:', 25, yPos + 8);
      doc.text(balanceDue, 150, yPos + 8, { align: 'right' });

      yPos += 35;

      // Footer
      doc.setFontSize(isMobile ? 8 : 10);
      doc.setTextColor(100, 100, 100);
      doc.text('Thank you for your business!', 105, yPos, { align: 'center' });
      doc.text('This is a computer generated bill', 105, yPos + 6, { align: 'center' });

      return doc;
    } catch (error) {
      console.error('Error in generateSimpleBill:', error);
      return null;
    }
  };

  // Fetch transactions and payments for a customer
  const getCustomerHistory = async (customerId) => {
    try {
      const transactionsSnap = await getDocs(
        query(collection(db, 'transactions'), where('customerId', '==', customerId))
      );
      const paymentsSnap = await getDocs(
        query(collection(db, 'payments'), where('customerId', '==', customerId))
      );

      const transactions = transactionsSnap.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        date: d.data().date
      }));

      const payments = paymentsSnap.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        date: d.data().date
      }));

      return { transactions, payments };
    } catch (error) {
      console.error('Error fetching customer history:', error);
      return { transactions: [], payments: [] };
    }
  };

  // NEW: Modified handleGeneratePDFs to work like "Download Simple Bill"
  const handleGeneratePDFs = async () => {
    if (selectedCustomers.length === 0) return;
    
    setGenerating(true);
    
    try {
      // Load bill settings
      const billSettings = JSON.parse(localStorage.getItem('billSettings') || '{}');
      
      // For each selected customer, generate and send PDF
      for (const customerId of selectedCustomers) {
        const customer = customers.find(c => c.id === customerId);
        if (!customer) continue;
        
        // Get customer history for WhatsApp message
        const history = await getCustomerHistory(customerId);
        const { transactions, payments } = history;
        
        // Calculate total purchases and payments
        const totalPurchases = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
        const totalPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const remainingBalance = customer.balance || 0;
        
        // Generate PDF (Simple Bill - same as CustomerDetailsPage)
        const pdfDoc = generateSimpleBill(customer, billSettings);
        
        if (pdfDoc) {
          // Create blob
          const pdfBlob = pdfDoc.output('blob');
          const pdfUrl = URL.createObjectURL(pdfBlob);
          
          // Download the PDF
          const downloadLink = document.createElement('a');
          downloadLink.href = pdfUrl;
          downloadLink.download = `Bill_${customer.customerName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          
          // Prepare WhatsApp message with complete history (same as CustomerDetailsPage)
          setTimeout(() => {
            // Format purchase history
            let purchaseHistory = '';
            if (transactions.length > 0) {
              purchaseHistory = '*Purchase History:*\n';
              transactions.forEach((t, index) => {
                const date = formatDate(t.date);
                const product = t.productName || 'Product';
                const amount = t.amount || 0;
                purchaseHistory += `${index + 1}. ${date} - ${product}: ₹${amount.toFixed(2)}\n`;
              });
            } else {
              purchaseHistory = '*Purchase History:* No purchases found\n';
            }
            
            // Format payment history
            let paymentHistory = '';
            if (payments.length > 0) {
              paymentHistory = '*Payment History:*\n';
              payments.forEach((p, index) => {
                const date = formatDate(p.date);
                const mode = p.paymentMode || 'Cash';
                const amount = p.amount || 0;
                const notes = p.notes ? ` (${p.notes})` : '';
                paymentHistory += `${index + 1}. ${date} - ${mode}: ₹${amount.toFixed(2)}${notes}\n`;
              });
            } else {
              paymentHistory = '*Payment History:* No payments made\n';
            }
            
            // Create comprehensive message
const message = encodeURIComponent(
  `*BILL STATEMENT (பில் விவரம்)*\n` +
  `━━━━━━━━━━━━━━━━━━━━━━\n\n` +

  `*CUSTOMER DETAILS (வாடிக்கையாளர் விவரம்)*\n` +
  `━━━━━━━━━━━━━━━━━━━━━━\n` +
  `Name (பெயர்)   : ${customer.customerName.toUpperCase()}\n` +
  `Phone (மொபைல்): ${customer.phone || 'N/A'}\n` +
  `Date (தேதி)    : ${new Date().toLocaleDateString('en-IN')}\n\n` +

  `*ACCOUNT SUMMARY (கணக்கு சுருக்கம்)*\n` +
  `━━━━━━━━━━━━━━━━━━━━━━\n` +
  `Total Purchases (மொத்த வாங்கல்): ₹${totalPurchases.toFixed(2)}\n` +
  `Total Payments  (மொத்த செலுத்தியது): ₹${totalPayments.toFixed(2)}\n` +
  `Balance Due     (மீதம்): ₹${remainingBalance.toFixed(2)}\n` +
  `Status (நிலை)  : ${remainingBalance > 0 ? 'PENDING (நிலுவை)' : 'PAID (செலுத்தப்பட்டது)'}\n\n` +

  `*PURCHASE HISTORY (வாங்கிய விவரம்)*\n` +
  `━━━━━━━━━━━━━━━━━━━━━━\n` +
  `${transactions.length > 0
    ? transactions.slice(0, 10).map((t, i) => {
        const date = formatDate(t.date);
        const product = t.productName || 'Product';
        const amount = t.amount || 0;
        return `${i + 1}. ${date} - ${product} : ₹${amount.toFixed(2)}`;
      }).join('\n') +
      (transactions.length > 10
        ? `\nMore ${transactions.length - 10} purchases`
        : '')
    : 'No purchase records'}
  \n\n` +

  `*PAYMENT HISTORY (செலுத்திய விவரம்)*\n` +
  `━━━━━━━━━━━━━━━━━━━━━━\n` +
  `${payments.length > 0
    ? payments.slice(0, 10).map((p, i) => {
        const date = formatDate(p.date);
        const mode = p.paymentMode || 'Cash';
        const amount = p.amount || 0;
        const notes = p.notes ? ` (${p.notes})` : '';
        return `${i + 1}. ${date} - ${mode} : ₹${amount.toFixed(2)}${notes}`;
      }).join('\n') +
      (payments.length > 10
        ? `\nMore ${payments.length - 10} payments`
        : '')
    : 'No payment records'}
  \n\n` +

  `*PAYMENT PROGRESS (செலுத்திய நிலை)*\n` +
  `━━━━━━━━━━━━━━━━━━━━━━\n` +
  `Progress (முன்னேற்றம்): ${
    totalPurchases > 0
      ? Math.round((totalPayments / totalPurchases) * 100)
      : 0
  }%\n` +
  `Remaining (மீதம்): ₹${Math.max(totalPurchases - totalPayments, 0).toFixed(2)}\n\n` +

  `*SUMMARY (சுருக்கம்)*\n` +
  `━━━━━━━━━━━━━━━━━━━━━━\n` +
  `Total Items (பொருட்கள்): ${transactions.length}\n` +
  `Total Bill  (மொத்தம்): ₹${totalPurchases.toFixed(2)}\n` +
  `Paid Amount (செலுத்தியது): ₹${totalPayments.toFixed(2)}\n` +
  `Balance Due (மீதம்): ₹${remainingBalance.toFixed(2)}\n\n` +

  `━━━━━━━━━━━━━━━━━━━━━━\n` +
  `SHOP DEBT SYSTEM (கடை கணக்கு அமைப்பு)\n` +
  `Contact (தொடர்பு): +91 9876543210\n` +
  `Generated Date (தேதி): ${new Date().toLocaleDateString('en-IN')}\n\n` +

  `*PAYMENT INSTRUCTIONS (செலுத்தும் வழிமுறை)*\n` +
  `━━━━━━━━━━━━━━━━━━━━━━\n` +
  `UPI ID : shopname@upi\n` +
  `Bank   : SBI\n` +
  `Note   : Please mention your Name (பெயர்)\n\n` +

  `Note (குறிப்பு): This is an automated message.\n` +
  `Thank you for your business!`
);

            
            // Open WhatsApp with pre-filled message
            window.open(`https://wa.me/?text=${message}`, '_blank');
          }, 1000);
          
          // Small delay between customers
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      setSelectedCustomers([]);
      alert(`Successfully sent ${selectedCustomers.length} bills via WhatsApp!`);
    } catch (error) {
      console.error('Error generating PDFs:', error);
      alert('Failed to generate bills. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <Container sx={{ py: 4, px: isMobile ? 1 : 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: isMobile ? 1 : 2, px: isMobile ? 1 : 2 }}>
      {/* Header - Mobile Responsive */}
      <Box sx={{ mb: isMobile ? 2 : 3 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton onClick={() => navigate(-1)} size={isMobile ? "small" : "medium"}>
            <ArrowBack fontSize={isMobile ? "small" : "medium"} />
          </IconButton>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography 
              variant={isMobile ? "h6" : "h5"} 
              fontWeight={700}
              noWrap={isMobile}
            >
              Generate PDF Bills
            </Typography>
            <Typography 
              variant="caption" 
              color="text.secondary" 
              sx={{ 
                mt: 0.5,
                display: 'block',
                fontSize: isMobile ? '0.7rem' : '0.875rem'
              }}
            >
              Select customers to generate and share Simple Bills via WhatsApp
            </Typography>
          </Box>
          {!isMobile && (
            <Chip 
              label={`${selectedCustomers.length} selected`}
              color="primary"
              size="small"
            />
          )}
        </Stack>
        
        {isMobile && selectedCustomers.length > 0 && (
          <Chip 
            label={`${selectedCustomers.length} selected`}
            color="primary"
            size="small"
            sx={{ mt: 1 }}
          />
        )}
      </Box>

      {/* Filters and Search - Mobile Responsive */}
      <Paper sx={{ 
        p: isMobile ? 1.5 : 2, 
        mb: isMobile ? 2 : 2,
        borderRadius: isMobile ? 2 : 2
      }}>
        <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size={isMobile ? "small" : "small"}
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ 
                  mr: 1, 
                  color: 'text.secondary',
                  fontSize: isMobile ? '1rem' : '1.25rem'
                }} />
              }}
              sx={{
                '& .MuiInputBase-root': {
                  fontSize: isMobile ? '0.875rem' : '0.9rem'
                }
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              select
              size={isMobile ? "small" : "small"}
              label="Filter by Status"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              InputProps={{
                startAdornment: <FilterList sx={{ 
                  mr: 1, 
                  color: 'text.secondary',
                  fontSize: isMobile ? '1rem' : '1.25rem'
                }} />
              }}
              sx={{
                '& .MuiInputBase-root': {
                  fontSize: isMobile ? '0.875rem' : '0.9rem'
                }
              }}
            >
              <MenuItem value="all">All Customers</MenuItem>
              <MenuItem value="pending">Pending Balance</MenuItem>
              <MenuItem value="paid">Fully Paid</MenuItem>
            </TextField>
          </Grid>
        </Grid>

        {/* Actions - Mobile Responsive */}
        <Stack 
          direction={isMobile ? "column" : "row"} 
          spacing={isMobile ? 1 : 1} 
          sx={{ mt: isMobile ? 1.5 : 2 }}
        >
          <Button
            startIcon={<SelectAll />}
            onClick={handleSelectAll}
            variant="outlined"
            size={isMobile ? "small" : "small"}
            fullWidth={isMobile}
          >
            {selectedCustomers.length === filteredCustomers.length ? 'Deselect All' : 'Select All'}
          </Button>
          <Button
            startIcon={<ClearAll />}
            onClick={() => setSelectedCustomers([])}
            variant="outlined"
            size={isMobile ? "small" : "small"}
            disabled={selectedCustomers.length === 0}
            fullWidth={isMobile}
          >
            Clear Selection
          </Button>
          <Button
            startIcon={<Refresh />}
            onClick={() => window.location.reload()}
            variant="outlined"
            size={isMobile ? "small" : "small"}
            fullWidth={isMobile}
          >
            Refresh
          </Button>
        </Stack>
      </Paper>

      {/* Customer List - Mobile Responsive */}
      {filteredCustomers.length === 0 ? (
        <Paper sx={{ 
          p: isMobile ? 3 : 4, 
          textAlign: 'center',
          borderRadius: 2
        }}>
          <Typography color="text.secondary" variant={isMobile ? "body2" : "body1"}>
            No customers found matching your criteria
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={isMobile ? 1 : 2}>
          {filteredCustomers.map((customer) => (
            <Grid item xs={12} key={customer.id}>
              <Card 
                sx={{ 
                  borderRadius: 2,
                  border: selectedCustomers.includes(customer.id) ? '2px solid #d32f2f' : '1px solid #e0e0e0',
                  bgcolor: selectedCustomers.includes(customer.id) ? '#fff5f5' : 'white'
                }}
              >
                <CardContent sx={{ p: isMobile ? 1.5 : 2 }}>
                  <Stack 
                    direction={isMobile ? "column" : "row"} 
                    alignItems={isMobile ? "stretch" : "center"} 
                    spacing={isMobile ? 1.5 : 2}
                  >
                    {/* Checkbox and Customer Info */}
                    <Stack 
                      direction="row" 
                      alignItems="center" 
                      spacing={isMobile ? 1.5 : 2}
                      sx={{ width: '100%' }}
                    >
                      <Checkbox
                        checked={selectedCustomers.includes(customer.id)}
                        onChange={() => handleSelectCustomer(customer.id)}
                        color="primary"
                        size={isMobile ? "small" : "medium"}
                      />
                      
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography 
                          variant={isMobile ? "subtitle2" : "subtitle1"} 
                          fontWeight={600}
                          noWrap={isMobile}
                        >
                          {customer.customerName}
                        </Typography>
                        <Typography 
                          variant="caption" 
                          color="text.secondary"
                          sx={{ 
                            display: 'block',
                            fontSize: isMobile ? '0.7rem' : '0.875rem'
                          }}
                        >
                          {customer.phone}
                        </Typography>
                      </Box>
                    </Stack>
                    
                    {/* Balance Chip and View Button */}
                    <Stack 
                      direction="row" 
                      justifyContent="space-between" 
                      alignItems="center"
                      sx={{ width: '100%' }}
                    >
                      <Chip
                        label={`₹${(customer.balance || 0).toFixed(2)}`}
                        color={customer.balance > 0 ? 'error' : 'success'}
                        size={isMobile ? "small" : "small"}
                        sx={{ 
                          fontWeight: 600,
                          fontSize: isMobile ? '0.7rem' : '0.875rem'
                        }}
                      />
                      
                      <Button
                        size={isMobile ? "small" : "small"}
                        variant="outlined"
                        onClick={() => navigate(`/customers/${customer.id}`)}
                        startIcon={isMobile ? <Visibility fontSize="small" /> : null}
                        sx={{
                          minWidth: isMobile ? 'auto' : '64px',
                          px: isMobile ? 1 : 2
                        }}
                      >
                        {isMobile ? '' : 'View'}
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Generate Button - Mobile Responsive */}
      {selectedCustomers.length > 0 && (
        <Box sx={{ 
          position: 'fixed', 
          bottom: isMobile ? 8 : 16, 
          right: isMobile ? 8 : 16, 
          zIndex: 1000 
        }}>
          <Tooltip title={`Generate Simple Bills for ${selectedCustomers.length} customers`}>
            <Fab
              color="primary"
              variant={isMobile ? "circular" : "extended"}
              onClick={handleGeneratePDFs}
              disabled={generating}
              sx={{
                bgcolor: '#d32f2f',
                '&:hover': {
                  bgcolor: '#b71c1c'
                },
                width: isMobile ? 56 : 'auto',
                height: isMobile ? 56 : 48,
                borderRadius: isMobile ? '50%' : '24px'
              }}
            >
              {generating ? (
                <CircularProgress size={isMobile ? 20 : 24} color="inherit" sx={{ mr: isMobile ? 0 : 1 }} />
              ) : (
                <>
                  <Send sx={{ mr: isMobile ? 0 : 1 }} />
                  {!isMobile && `Send ${selectedCustomers.length} Bills`}
                </>
              )}
              {isMobile && !generating && <Send />}
            </Fab>
          </Tooltip>
        </Box>
      )}

      {/* Instructions - Mobile Responsive */}
      <Alert 
        severity="info" 
        sx={{ 
          mt: isMobile ? 2 : 2, 
          mb: isMobile ? 8 : 2,
          borderRadius: 2,
          bgcolor: '#e3f2fd',
          fontSize: isMobile ? '0.75rem' : '0.875rem'
        }}
      >
        <Typography variant={isMobile ? "caption" : "body2"}>
          <strong>How to use:</strong>
          <br />1. Select customers from the list
          <br />2. Click {isMobile ? "Send Button" : `"Send ${selectedCustomers.length > 0 ? selectedCustomers.length : 'X'} Bills"`}
          <br />3. Simple PDF bills will download automatically
          <br />4. WhatsApp will open for sharing (with complete history)
        </Typography>
      </Alert>
    </Container>
  );
};

export default PDFGenerator;