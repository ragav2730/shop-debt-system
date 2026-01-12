import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Grid,
  Typography,
  MenuItem,
  InputAdornment,
  Box,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Chip
} from '@mui/material';

import {
  Person,
  Phone,
  CalendarToday,
  Numbers,
  AttachMoney,
  Category as CategoryIcon,
  Store,
  Add,
  Business
} from '@mui/icons-material';

import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';

import { db } from '../../services/firebase';

const AddCustomer = () => {
  const navigate = useNavigate();
  const submitLock = useRef(false);

  /* ---------------- STATE ---------------- */
  const [vendors, setVendors] = useState([]); // Using vendors as customers
  const [products, setProducts] = useState([]);
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');

  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    date: new Date().toISOString().slice(0, 10),
    category: '',
    company: '',
    unit: '',
    quantity: '',
    price: '',
    amount: 0
  });

  /* ---------------- FETCH VENDORS (AS CUSTOMERS) ---------------- */
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'vendors'), orderBy('vendorName')),
      snap => {
        const vendorsList = snap.docs.map(d => ({ 
          id: d.id, 
          ...d.data(),
          customerName: d.data().vendorName, // Map for compatibility
          balance: d.data().balance || 0
        }));
        setVendors(vendorsList);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  /* ---------------- FETCH PRODUCTS ---------------- */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  /* ---------------- FILTER COMPANIES BY CATEGORY ---------------- */
  useEffect(() => {
    if (!form.category) {
      setFilteredCompanies([]);
      return;
    }

    const companies = products
      .filter(p => p.category === form.category && p.active)
      .map(p => p.company);

    setFilteredCompanies([...new Set(companies)]);
  }, [form.category, products]);

  /* ---------------- AUTOCOMPLETE VENDOR - FROM FIRST LETTER ---------------- */
  useEffect(() => {
    if (form.customerName.length >= 1 && !selectedVendor) {
      const searchTerm = form.customerName.toLowerCase();
      const match = vendors.filter(v =>
        v.vendorName.toLowerCase().startsWith(searchTerm) ||
        v.vendorName.toLowerCase().includes(searchTerm)
      );
      setSuggestions(match.slice(0, 8));
    } else {
      setSuggestions([]);
    }
  }, [form.customerName, vendors, selectedVendor]);

  const selectVendor = (v) => {
    setSelectedVendor(v);
    setForm(f => ({
      ...f,
      customerName: v.vendorName,
      phone: v.phone || ''
    }));
    setSuggestions([]);
  };

  /* ---------------- CHECK IF VENDOR EXISTS ---------------- */
  const checkVendorExists = (vendorName) => {
    return vendors.some(v => 
      v.vendorName.toLowerCase() === vendorName.toLowerCase()
    );
  };

  /* ---------------- AUTO CALCULATE AMOUNT ---------------- */
  useEffect(() => {
    const qty = Number(form.quantity);
    const price = Number(form.price);
    setForm(f => ({
      ...f,
      amount: qty > 0 && price > 0 ? qty * price : 0
    }));
  }, [form.quantity, form.price]);

  /* ---------------- COMPANY SELECT ---------------- */
  const handleCompanySelect = company => {
    const product = products.find(
      p => p.category === form.category && p.company === company
    );

    setForm(f => ({
      ...f,
      company,
      unit: product?.unit || ''
    }));
  };

  /* ---------------- GET CATEGORIES ---------------- */
  const categories = [...new Set(products.filter(p => p.active).map(p => p.category))];

  /* ---------------- VALIDATION ---------------- */
  const validate = () => {
    if (!form.customerName) return 'Customer/Vendor name required';
    
    if (!checkVendorExists(form.customerName)) {
      setNewCustomerName(form.customerName);
      setShowNewCustomerDialog(true);
      return 'VENDOR_NOT_FOUND';
    }
    
    if (!form.category) return 'Select category';
    if (!form.company) return 'Select company';
    if (!form.quantity || form.quantity <= 0) return 'Invalid quantity';
    if (!form.price || form.price <= 0) return 'Invalid price';
    return '';
  };

  /* ---------------- HANDLE NEW VENDOR DIALOG ---------------- */
  const handleGoToVendorList = () => {
    navigate('/vendors');
  };

  const handleCancelNewVendor = () => {
    setShowNewCustomerDialog(false);
    setNewCustomerName('');
    setForm(f => ({ ...f, customerName: '' }));
  };

  /* ---------------- SUBMIT ---------------- */
  const handleSubmit = async e => {
    e.preventDefault();
    if (submitLock.current) return;

    const error = validate();
    if (error === 'VENDOR_NOT_FOUND') {
      return;
    }
    if (error) {
      alert(error);
      return;
    }

    submitLock.current = true;
    setSaving(true);

    try {
      let vendorId;
      const vendor = vendors.find(v => 
        v.vendorName.toLowerCase() === form.customerName.toLowerCase()
      );

      if (vendor) {
        vendorId = vendor.id;
        
        // Update vendor balance (vendor owes you money - positive balance)
        const newBalance = (vendor.balance || 0) + form.amount;
        await updateDoc(doc(db, 'vendors', vendorId), {
          balance: newBalance,
          updatedAt: serverTimestamp()
        });
      } else {
        alert('Vendor not found. Please create vendor in Vendor List first.');
        submitLock.current = false;
        setSaving(false);
        return;
      }

      // Add transaction - IMPORTANT: Save as vendor record
      await addDoc(collection(db, 'transactions'), {
        vendorId,
        vendorName: form.customerName,
        customerId: vendorId, // Also save as customerId for compatibility
        customerName: form.customerName,
        phone: form.phone,
        date: new Date(form.date),
        category: form.category,
        company: form.company,
        unit: form.unit,
        quantity: Number(form.quantity),
        price: Number(form.price),
        amount: form.amount,
        remainingAmount: form.amount,
        productName: `${form.company} ${form.category} (${form.quantity} ${form.unit})`,
        type: 'customer_purchase',
        createdAt: serverTimestamp()
      });

      alert('Customer purchase recorded successfully!');

      // Reset form but keep customer if they want to add more purchases
      setForm({
        ...form,
        date: new Date().toISOString().slice(0, 10),
        category: '',
        company: '',
        unit: '',
        quantity: '',
        price: '',
        amount: 0
      });
      setSelectedVendor(null);

    } catch (err) {
      console.error(err);
      alert('Save failed: ' + err.message);
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  };

  /* ---------------- CLEAR SELECTION ---------------- */
  const handleClearSelection = () => {
    setSelectedVendor(null);
    setForm(f => ({ ...f, customerName: '', phone: '' }));
  };

  /* ---------------- UI ---------------- */
  return (
    <Container maxWidth="md">
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={700} mb={2}>
          Add Customer Purchase
        </Typography>

        {loading ? (
          <Box sx={{ textAlign: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Customer/Vendor Name Field */}
            <Box sx={{ position: 'relative' }}>
              <TextField
                fullWidth
                label="Customer/Vendor Name"
                value={form.customerName}
                onChange={e => {
                  setForm({ ...form, customerName: e.target.value });
                  setSelectedVendor(null);
                }}
                required
                autoComplete="off"
                InputProps={{ 
                  startAdornment: <InputAdornment position="start"><Business /></InputAdornment>,
                  endAdornment: selectedVendor && (
                    <InputAdornment position="end">
                      <Button
                        size="small"
                        onClick={handleClearSelection}
                        sx={{ mr: -1 }}
                      >
                        Clear
                      </Button>
                    </InputAdornment>
                  )
                }}
                helperText="Start typing vendor name..."
              />

              {/* Vendor Suggestions Dropdown */}
              {suggestions.length > 0 && !selectedVendor && (
                <Paper 
                  sx={{ 
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    mt: 0.5,
                    maxHeight: 300,
                    overflow: 'auto',
                    border: 1,
                    borderColor: 'divider',
                    boxShadow: 3
                  }}
                >
                  {suggestions.map(v => (
                    <Box 
                      key={v.id} 
                      sx={{ 
                        p: 1.5, 
                        cursor: 'pointer',
                        borderBottom: '1px solid #eee',
                        '&:last-child': { borderBottom: 0 },
                        '&:hover': { 
                          bgcolor: 'primary.light',
                          color: 'primary.contrastText'
                        }
                      }} 
                      onClick={() => selectVendor(v)}
                    >
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Person fontSize="small" />
                        <Box flex={1}>
                          <Typography fontWeight={600} variant="body2">
                            {v.vendorName}
                          </Typography>
                          <Typography variant="caption">
                            {v.phone || 'No phone'} | Balance: ₹{v.balance || 0}
                          </Typography>
                        </Box>
                        {v.balance > 0 && (
                          <Chip 
                            label="Owes you" 
                            size="small" 
                            color="success" 
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                        {v.balance < 0 && (
                          <Chip 
                            label="You owe" 
                            size="small" 
                            color="error" 
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                      </Stack>
                    </Box>
                  ))}
                </Paper>
              )}
            </Box>

            {selectedVendor && (
              <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
                <Typography variant="body2">
                  Selected: <strong>{selectedVendor.vendorName}</strong> | 
                  Phone: {selectedVendor.phone || 'N/A'} | 
                  Current Balance: ₹{selectedVendor.balance || 0}
                </Typography>
              </Alert>
            )}

            <TextField 
              fullWidth 
              label="Phone" 
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              sx={{ mt: 2 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Phone /></InputAdornment> }}
              disabled={!!selectedVendor}
              helperText={selectedVendor ? "Phone from vendor record" : "Enter phone if new"}
            />

            <TextField 
              fullWidth 
              type="date" 
              label="Date" 
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
              sx={{ mt: 2 }} 
              InputLabelProps={{ shrink: true }}
              InputProps={{ startAdornment: <InputAdornment position="start"><CalendarToday /></InputAdornment> }}
            />

            <TextField 
              select 
              fullWidth 
              label="Category" 
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value, company: '', unit: '' })}
              sx={{ mt: 2 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><CategoryIcon /></InputAdornment> }}
            >
              {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>

            <TextField 
              select 
              fullWidth 
              label="Company" 
              value={form.company}
              onChange={e => handleCompanySelect(e.target.value)}
              sx={{ mt: 2 }}
              disabled={!form.category}
              InputProps={{ startAdornment: <InputAdornment position="start"><Store /></InputAdornment> }}
            >
              {filteredCompanies.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>

            <Grid container spacing={2} sx={{ mt: 2 }}>
              <Grid item xs={6}>
                <TextField 
                  fullWidth 
                  label={`Quantity (${form.unit || 'unit'})`} 
                  type="number"
                  value={form.quantity}
                  onChange={e => setForm({ ...form, quantity: e.target.value })}
                  disabled={!form.company}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Numbers /></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField 
                  fullWidth 
                  label="Price" 
                  type="number"
                  value={form.price}
                  onChange={e => setForm({ ...form, price: e.target.value })}
                  disabled={!form.company}
                  InputProps={{ startAdornment: <InputAdornment position="start"><AttachMoney /></InputAdornment> }}
                />
              </Grid>
            </Grid>

            <TextField 
              fullWidth 
              label="Total Amount" 
              value={form.amount}
              sx={{ mt: 2 }} 
              InputProps={{ 
                readOnly: true,
                startAdornment: <InputAdornment position="start">₹</InputAdornment>
              }}
            />

            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<Add />}
                onClick={() => navigate('/vendors')}
                sx={{ py: 1.2 }}
              >
                Add New Vendor
              </Button>
              <Button 
                fullWidth 
                variant="contained" 
                type="submit"
                sx={{ py: 1.2 }} 
                disabled={saving || !selectedVendor}
              >
                {saving ? 'Saving...' : 'Save Purchase'}
              </Button>
            </Stack>

            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                • Only existing vendors can make purchases<br/>
                • Select vendor from dropdown (starts showing from first letter)<br/>
                • Vendor balance will increase when purchase is recorded
              </Typography>
            </Alert>
          </form>
        )}
      </Paper>

      {/* New Vendor Dialog */}
      <Dialog open={showNewCustomerDialog} onClose={handleCancelNewVendor}>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Business />
            <Typography variant="h6" fontWeight={600}>
              Vendor Not Found
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" paragraph>
            Vendor <strong>"{newCustomerName}"</strong> does not exist in the system.
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            You need to create this vendor in the Vendor List before recording a purchase.
          </Typography>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Purchase cannot be recorded for non-existent vendors.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleCancelNewVendor}>
            Cancel & Clear
          </Button>
          <Button 
            variant="contained" 
            onClick={handleGoToVendorList}
            startIcon={<Add />}
          >
            Go to Vendor List
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AddCustomer;