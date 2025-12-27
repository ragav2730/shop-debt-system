import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Grid,
  Box,
  Card,
  Stack,
  Divider,
  InputAdornment,
  useTheme,
  useMediaQuery,
  Chip,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';

import {
  Person,
  Phone,
  Store,
  AttachMoney,
  Description,
  Receipt,
  Add,
  Info,
  CheckCircle,
  Pending
} from '@mui/icons-material';

import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';

import { db } from '../../services/firebase';

/* ------------------ CATEGORY LIST ------------------ */
const categories = [
  { en: 'Cement', ta: 'சிமெண்டு' },
  { en: 'Bricks', ta: 'செங்கல்' },
  { en: 'Steel', ta: 'இரும்பு' },
  { en: 'Sheet', ta: 'ஷீட்' },
  { en: 'Pipes', ta: 'குழாய்கள்' },
  { en: 'Other', ta: 'மற்றவை' }
];

const AddCustomer = () => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    productName: '',
    category: '',
    amount: '',
    billNumber: '',
    description: ''
  });

  const [customers, setCustomers] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loading, setLoading] = useState(false); // ✅ ADDED: Loading state
  const [snackbar, setSnackbar] = useState({ // ✅ ADDED: Success/error messages
    open: false,
    message: '',
    severity: 'success'
  });

  /* ------------------ FETCH CUSTOMERS ------------------ */
  useEffect(() => {
    const fetchCustomers = async () => {
      const snap = await getDocs(collection(db, 'customers'));
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchCustomers();
  }, []);

  /* ------------------ SUGGESTIONS ------------------ */
  useEffect(() => {
    if (
      (formData.customerName.length >= 2 || formData.phone.length >= 3) &&
      !selectedCustomer
    ) {
      const filtered = customers.filter(c =>
        c.customerName.toLowerCase().includes(formData.customerName.toLowerCase()) ||
        c.phone.includes(formData.phone)
      );
      setSuggestions(filtered.slice(0, 5));
    } else {
      setSuggestions([]);
    }
  }, [formData.customerName, formData.phone, customers, selectedCustomer]);

  const handleChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectCustomer = customer => {
    setSelectedCustomer(customer);
    setFormData({
      customerName: customer.customerName,
      phone: customer.phone,
      productName: '',
      category: customer.category || '',
      amount: '',
      billNumber: '',
      description: ''
    });
    setSuggestions([]);
  };

  const resetCustomer = () => {
    setSelectedCustomer(null);
    setFormData({
      customerName: '',
      phone: '',
      productName: '',
      category: '',
      amount: '',
      billNumber: '',
      description: ''
    });
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  /* ------------------ SUBMIT WITH DOUBLE-CLICK PREVENTION ------------------ */
  const handleSubmit = async e => {
    e.preventDefault();
    
    // ✅ PREVENT DOUBLE CLICK
    if (loading) return;
    
    const amount = Number(formData.amount);
    if (!amount || amount <= 0) {
      showSnackbar('Please enter a valid amount', 'error');
      return;
    }

    // ✅ Validate required fields
    if (!formData.customerName.trim()) {
      showSnackbar('Please enter customer name', 'error');
      return;
    }

    if (!formData.phone.trim()) {
      showSnackbar('Please enter phone number', 'error');
      return;
    }

    if (!formData.productName.trim()) {
      showSnackbar('Please enter product name', 'error');
      return;
    }

    setLoading(true); // ✅ Set loading to true

    try {
      let customerRef;

      if (selectedCustomer) {
        customerRef = doc(db, 'customers', selectedCustomer.id);
        await updateDoc(customerRef, {
          balance: (selectedCustomer.balance || 0) + amount,
          updatedAt: serverTimestamp()
        });
      } else {
        customerRef = await addDoc(collection(db, 'customers'), {
          customerName: formData.customerName.trim(),
          phone: formData.phone.trim(),
          balance: amount,
          createdAt: serverTimestamp(),
          category: formData.category || ''
        });
      }

      await addDoc(collection(db, 'transactions'), {
        customerId: customerRef.id,
        customerName: formData.customerName.trim(),
        phone: formData.phone.trim(),
        productName: formData.productName.trim(),
        category: formData.category,
        amount: amount,
        billNumber: formData.billNumber.trim(),
        description: formData.description.trim(),
        date: serverTimestamp(),
        isExistingCustomer: !!selectedCustomer
      });

      // ✅ Show success message
      showSnackbar(
        selectedCustomer 
          ? `Entry added for existing customer: ${formData.customerName}`
          : `New customer created: ${formData.customerName}`,
        'success'
      );

      resetCustomer();
      
    } catch (error) {
      console.error('Error saving entry:', error);
      showSnackbar('Failed to save entry. Please try again.', 'error');
    } finally {
      setLoading(false); // ✅ Reset loading state
    }
  };

  /* ------------------ DESKTOP PANEL ------------------ */
  const DesktopPanel = () => (
    <Stack spacing={2}>
      <Card sx={{ p: 2 }}>
        <Typography fontWeight={700}>Live Preview</Typography>
        <Divider sx={{ my: 1 }} />
        <Typography>Name: {formData.customerName || '-'}</Typography>
        <Typography>Phone: {formData.phone || '-'}</Typography>
        <Typography>Category: {formData.category || '-'}</Typography>
        <Typography>Amount: ₹{formData.amount || 0}</Typography>

        {selectedCustomer && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography>
              Current Balance: ₹{selectedCustomer.balance || 0}
            </Typography>
            <Typography fontWeight={700} color="error.main">
              New Balance: ₹
              {(selectedCustomer.balance || 0) + Number(formData.amount || 0)}
            </Typography>
          </>
        )}
      </Card>

      {selectedCustomer && (
        <Card sx={{ p: 2, bgcolor: '#FFF5F5' }}>
          <Typography fontWeight={700}>Existing Customer</Typography>
          <Typography>{selectedCustomer.customerName}</Typography>
          <Typography variant="body2">{selectedCustomer.phone}</Typography>
          <Chip
            sx={{ mt: 1 }}
            label={selectedCustomer.balance > 0 ? 'Pending' : 'Paid'}
            icon={selectedCustomer.balance > 0 ? <Pending /> : <CheckCircle />}
            color={selectedCustomer.balance > 0 ? 'error' : 'success'}
          />
        </Card>
      )}

      <Card sx={{ p: 2 }}>
        <Stack direction="row" spacing={1}>
          <Info color="primary" />
          <Typography fontWeight={700}>Tips</Typography>
        </Stack>
        <Typography variant="body2" mt={1}>
          • Select existing customer to avoid duplicates
        </Typography>
        <Typography variant="body2">
          • Phone number gives faster matching
        </Typography>
      </Card>
    </Stack>
  );

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* ✅ Snackbar for success/error messages */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Grid container spacing={3}>
        {/* FORM */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={700} mb={2}>
              Add Customer Entry
            </Typography>

            {selectedCustomer && (
              <Card sx={{ mb: 2, p: 2, bgcolor: '#FFF5F5' }}>
                <Typography fontWeight={700}>
                  Existing Customer Selected
                </Typography>
                <Typography variant="body2">
                  {selectedCustomer.customerName} • {selectedCustomer.phone}
                </Typography>
                <Button size="small" onClick={resetCustomer}>
                  Change Customer
                </Button>
              </Card>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Customer Name"
                name="customerName"
                value={formData.customerName}
                onChange={handleChange}
                sx={{ mb: 1.5 }}
                disabled={loading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person />
                    </InputAdornment>
                  )
                }}
              />

              {suggestions.length > 0 && (
                <Box sx={{ mb: 2, border: '1px solid #eee' }}>
                  {suggestions.map(c => (
                    <Box
                      key={c.id}
                      onClick={() => !loading && handleSelectCustomer(c)}
                      sx={{ 
                        p: 1.5, 
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.7 : 1,
                        '&:hover': { bgcolor: loading ? 'transparent' : '#f5f5f5' }
                      }}
                    >
                      <Typography fontWeight={600}>{c.customerName}</Typography>
                      <Typography variant="caption">{c.phone}</Typography>
                    </Box>
                  ))}
                </Box>
              )}

              <TextField
                fullWidth
                label="Phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                sx={{ mb: 1.5 }}
                disabled={loading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Phone />
                    </InputAdornment>
                  )
                }}
              />

              <TextField
                fullWidth
                label="Product"
                name="productName"
                value={formData.productName}
                onChange={handleChange}
                sx={{ mb: 1.5 }}
                disabled={loading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Store />
                    </InputAdornment>
                  )
                }}
              />

              <Grid container spacing={1} sx={{ mb: 2 }}>
                {categories.map(c => (
                  <Grid item xs={6} key={c.en}>
                    <Button
                      fullWidth
                      variant={formData.category === c.en ? 'contained' : 'outlined'}
                      onClick={() => !loading && setFormData({ ...formData, category: c.en })}
                      disabled={loading}
                    >
                      {c.en} ({c.ta})
                    </Button>
                  </Grid>
                ))}
              </Grid>

              <TextField
                fullWidth
                label="Amount"
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                sx={{ mb: 1.5 }}
                disabled={loading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AttachMoney />
                    </InputAdornment>
                  )
                }}
              />

              <TextField
                fullWidth
                label="Bill Number"
                name="billNumber"
                value={formData.billNumber}
                onChange={handleChange}
                sx={{ mb: 1.5 }}
                disabled={loading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Receipt />
                    </InputAdornment>
                  )
                }}
              />

              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                sx={{ mb: 2 }}
                disabled={loading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Description />
                    </InputAdornment>
                  )
                }}
              />

              <Button
                fullWidth
                type="submit"
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Add />}
                variant="contained"
                disabled={loading}
                sx={{ 
                  py: 1.4, 
                  fontWeight: 700,
                  position: 'relative',
                  '&:disabled': {
                    bgcolor: 'primary.main',
                    opacity: 0.7
                  }
                }}
              >
                {loading ? 'SAVING...' : 'SAVE ENTRY'}
              </Button>

              {loading && (
                <Typography 
                  variant="caption" 
                  color="text.secondary" 
                  sx={{ 
                    display: 'block', 
                    textAlign: 'center', 
                    mt: 1 
                  }}
                >
                  Please wait while saving...
                </Typography>
              )}
            </form>
          </Paper>
        </Grid>

        {/* DESKTOP PANEL */}
        {isDesktop && (
          <Grid item md={5}>
            <DesktopPanel />
          </Grid>
        )}
      </Grid>
    </Container>
  );
};

export default AddCustomer;