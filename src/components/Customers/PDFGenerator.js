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
  Tooltip
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
  ArrowBack
} from '@mui/icons-material';
import {
  collection,
  query,
  onSnapshot,
  where,
  orderBy
} from 'firebase/firestore';
// Correct: Go up ONE level (to components), then to services
import { auth, db } from '../../services/firebase';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const PDFGenerator = () => {
  const navigate = useNavigate();
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
        
        // Generate PDF (you can reuse the generateSimpleBill function)
        const doc = generateCustomerBill(customer, [], [], billSettings);
        const pdfBlob = doc.output('blob');
        
        // Download PDF
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = pdfUrl;
        downloadLink.download = `Bill_${customer.customerName}_${Date.now()}.pdf`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Prepare WhatsApp message
        setTimeout(() => {
          const message = encodeURIComponent(
            `*Bill for ${customer.customerName}*\n\n` +
            `Current Balance: ₹${customer.balance?.toFixed(2) || 0}\n` +
            `Phone: ${customer.phone || 'N/A'}\n\n` +
            `Please find attached bill.\n` +
            `Generated from Shop Debt System`
          );
          
          window.open(`https://wa.me/?text=${message}`, '_blank');
        }, 1000);
        
        // Small delay between customers
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      setSelectedCustomers([]);
    } catch (error) {
      console.error('Error generating PDFs:', error);
      alert('Error generating PDFs. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const generateCustomerBill = (customer, transactions = [], payments = [], settings = {}) => {
    const defaultSettings = {
      companyName: 'Shop Name',
      companyAddress: '123 Main Street',
      companyPhone: '+91 9876543210',
      footerText: 'Thank you for your business!',
      ...settings
    };

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(211, 47, 47);
    doc.text(defaultSettings.companyName, 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(defaultSettings.companyAddress, 105, 28, { align: 'center' });
    doc.text(`Phone: ${defaultSettings.companyPhone}`, 105, 34, { align: 'center' });

    // Customer Info
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text('BILL', 105, 45, { align: 'center' });

    const customerInfo = [
      ['Customer:', customer.customerName || 'N/A'],
      ['Phone:', customer.phone || 'N/A'],
      ['Balance:', `₹${(customer.balance || 0).toFixed(2)}`],
      ['Date:', new Date().toLocaleDateString('en-IN')],
      ['Status:', customer.balance > 0 ? 'Pending' : 'Paid']
    ];

    doc.autoTable({
      startY: 50,
      body: customerInfo,
      theme: 'grid',
      headStyles: { fillColor: [211, 47, 47], textColor: 255 },
      margin: { top: 55 }
    });

    // Footer
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(defaultSettings.footerText, 105, finalY, { align: 'center' });
    doc.text('This is a computer generated bill', 105, finalY + 6, { align: 'center' });

    return doc;
  };

  if (loading) {
    return (
      <Container sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <IconButton onClick={() => navigate(-1)}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h5" fontWeight={700}>
            Generate PDF Bills
          </Typography>
          <Chip 
            label={`${selectedCustomers.length} selected`}
            color="primary"
            size="small"
          />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Select customers to generate and share bills via WhatsApp
        </Typography>
      </Box>

      {/* Filters and Search */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              select
              size="small"
              label="Filter by Status"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              InputProps={{
                startAdornment: <FilterList sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            >
              <MenuItem value="all">All Customers</MenuItem>
              <MenuItem value="pending">Pending Balance</MenuItem>
              <MenuItem value="paid">Fully Paid</MenuItem>
            </TextField>
          </Grid>
        </Grid>

        {/* Actions */}
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button
            startIcon={<SelectAll />}
            onClick={handleSelectAll}
            variant="outlined"
            size="small"
          >
            {selectedCustomers.length === filteredCustomers.length ? 'Deselect All' : 'Select All'}
          </Button>
          <Button
            startIcon={<ClearAll />}
            onClick={() => setSelectedCustomers([])}
            variant="outlined"
            size="small"
            disabled={selectedCustomers.length === 0}
          >
            Clear Selection
          </Button>
          <Button
            startIcon={<Refresh />}
            onClick={() => window.location.reload()}
            variant="outlined"
            size="small"
          >
            Refresh
          </Button>
        </Stack>
      </Paper>

      {/* Customer List */}
      {filteredCustomers.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No customers found matching your criteria
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {filteredCustomers.map((customer) => (
            <Grid item xs={12} key={customer.id}>
              <Card 
                sx={{ 
                  borderRadius: 2,
                  border: selectedCustomers.includes(customer.id) ? '2px solid #d32f2f' : '1px solid #e0e0e0',
                  bgcolor: selectedCustomers.includes(customer.id) ? '#fff5f5' : 'white'
                }}
              >
                <CardContent sx={{ p: 2 }}>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selectedCustomers.includes(customer.id)}
                          onChange={() => handleSelectCustomer(customer.id)}
                          color="primary"
                        />
                      }
                      label={
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle1" fontWeight={600}>
                            {customer.customerName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {customer.phone}
                          </Typography>
                        </Box>
                      }
                    />
                    
                    <Box sx={{ ml: 'auto' }}>
                      <Chip
                        label={`₹${(customer.balance || 0).toFixed(2)}`}
                        color={customer.balance > 0 ? 'error' : 'success'}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    </Box>
                    
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => navigate(`/customers/${customer.id}`)}
                    >
                      View
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Generate Button */}
      {selectedCustomers.length > 0 && (
        <Box sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000 }}>
          <Tooltip title={`Generate PDFs for ${selectedCustomers.length} customers`}>
            <Fab
              color="primary"
              variant="extended"
              onClick={handleGeneratePDFs}
              disabled={generating}
              sx={{
                bgcolor: '#d32f2f',
                '&:hover': {
                  bgcolor: '#b71c1c'
                }
              }}
            >
              {generating ? (
                <CircularProgress size={24} color="inherit" sx={{ mr: 1 }} />
              ) : (
                <Send sx={{ mr: 1 }} />
              )}
              {generating ? 'Generating...' : `Send ${selectedCustomers.length} Bills`}
            </Fab>
          </Tooltip>
        </Box>
      )}

      {/* Instructions */}
      <Alert 
        severity="info" 
        sx={{ 
          mt: 2, 
          borderRadius: 2,
          bgcolor: '#e3f2fd'
        }}
      >
        <Typography variant="body2">
          <strong>How to use:</strong>
          <br />1. Select customers from the list
          <br />2. Click "Send X Bills" button
          <br />3. PDFs will download automatically
          <br />4. WhatsApp will open for sharing
        </Typography>
      </Alert>
    </Container>
  );
};

export default PDFGenerator;