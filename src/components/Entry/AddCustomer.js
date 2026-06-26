import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Grid, // ✅ Import Grid from @mui/material
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
  Chip,
  IconButton,
  Card,
  CardContent,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableFooter,
  Snackbar
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
  Business,
  Delete,
  Receipt,
  CheckCircle
} from '@mui/icons-material';

import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  writeBatch
} from 'firebase/firestore';

import { db } from '../../services/firebase';

// Generate temporary ID for items
const generateTempId = () => Date.now() + Math.random().toString(36).substring(2, 9);

const AddCustomer = () => {
  const navigate = useNavigate();
  const submitLock = useRef(false);

  /* ---------------- STATE ---------------- */
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');

  // Common form fields
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');

  // Items array
  const [items, setItems] = useState([
    { id: generateTempId(), category: '', company: '', unit: '', quantity: '', price: '', amount: 0 }
  ]);

  // Computed total
  const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);

  // Snackbar for feedback
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  /* ---------------- FETCH VENDORS ---------------- */
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'vendors'), orderBy('vendorName')),
      snap => {
        const vendorsList = snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
          customerName: d.data().vendorName,
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

  /* ---------------- AUTOCOMPLETE VENDOR ---------------- */
  useEffect(() => {
    if (customerName.length >= 1 && !selectedVendor) {
      const searchTerm = customerName.toLowerCase();
      const match = vendors.filter(v =>
        v.vendorName.toLowerCase().startsWith(searchTerm) ||
        v.vendorName.toLowerCase().includes(searchTerm)
      );
      setSuggestions(match.slice(0, 8));
    } else {
      setSuggestions([]);
    }
  }, [customerName, vendors, selectedVendor]);

  const selectVendor = (v) => {
    setSelectedVendor(v);
    setCustomerName(v.vendorName);
    setPhone(v.phone || '');
    setSuggestions([]);
  };

  /* ---------------- CHECK IF VENDOR EXISTS ---------------- */
  const checkVendorExists = (vendorName) => {
    return vendors.some(v => v.vendorName.toLowerCase() === vendorName.toLowerCase());
  };

  /* ---------------- ITEM MANAGEMENT ---------------- */
  const addItem = () => {
    setItems(prevItems => [
      ...prevItems,
      { id: generateTempId(), category: '', company: '', unit: '', quantity: '', price: '', amount: 0 }
    ]);
  };

  const removeItem = (id) => {
    setItems(prevItems => {
      if (prevItems.length === 1) {
        setSnackbar({ open: true, message: 'At least one item is required', severity: 'warning' });
        return prevItems;
      }
      return prevItems.filter(item => item.id !== id);
    });
  };

  /**
   * FIX: updateItem now takes an object of fields to merge, and always
   * derives the next state from the functional `prevItems` updater form.
   * Previously this took a single (field, value) pair and read the
   * `items` variable captured in the surrounding closure. When a single
   * onChange handler called updateItem multiple times in a row (e.g. the
   * Category handler set category, then company, then unit), every call
   * recomputed its new array from the *same stale* `items` snapshot, so
   * each call overwrote the previous one's change — only the last call's
   * field actually stuck. That's why selecting a Category never "took":
   * the category value was being wiped out by the company/unit resets
   * that ran right after it in the same handler.
   */
  const updateItem = (id, fields) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, ...fields };
        // Auto-calculate amount
        const qty = Number(updated.quantity);
        const price = Number(updated.price);
        updated.amount = (qty > 0 && price > 0) ? qty * price : 0;
        return updated;
      }
      return item;
    }));
  };

  // Helper functions for item dropdowns
  const getCategoriesForItem = () => {
    return [...new Set(products.filter(p => p.active).map(p => p.category))];
  };

  const getCompaniesForItem = (category) => {
    if (!category) return [];
    const companies = products
      .filter(p => p.category === category && p.active)
      .map(p => p.company);
    return [...new Set(companies)];
  };

  const getUnitForItem = (category, company) => {
    if (!category || !company) return '';
    const product = products.find(
      p => p.category === category && p.company === company && p.active
    );
    return product?.unit || '';
  };

  /* ---------------- VALIDATION ---------------- */
  const validate = () => {
    if (!customerName) return 'Customer/Vendor name required';
    if (!checkVendorExists(customerName)) {
      setNewCustomerName(customerName);
      setShowNewCustomerDialog(true);
      return 'VENDOR_NOT_FOUND';
    }
    // Validate items
    for (let item of items) {
      if (!item.category) return `Category missing for item ${items.indexOf(item) + 1}`;
      if (!item.company) return `Company missing for item ${items.indexOf(item) + 1}`;
      if (!item.quantity || Number(item.quantity) <= 0) return `Invalid quantity for item ${items.indexOf(item) + 1}`;
      if (!item.price || Number(item.price) <= 0) return `Invalid price for item ${items.indexOf(item) + 1}`;
    }
    return '';
  };

  /* ---------------- HANDLE NEW VENDOR DIALOG ---------------- */
  const handleGoToVendorList = () => {
    navigate('/vendors');
  };

  const handleCancelNewVendor = () => {
    setShowNewCustomerDialog(false);
    setNewCustomerName('');
    setCustomerName('');
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
      setSnackbar({ open: true, message: error, severity: 'error' });
      return;
    }

    submitLock.current = true;
    setSaving(true);

    try {
      const vendor = vendors.find(v => v.vendorName.toLowerCase() === customerName.toLowerCase());
      if (!vendor) {
        setSnackbar({ open: true, message: 'Vendor not found. Please create vendor first.', severity: 'error' });
        submitLock.current = false;
        setSaving(false);
        return;
      }

      const vendorId = vendor.id;
      const batch = writeBatch(db);

      // Update vendor balance
      const newBalance = (vendor.balance || 0) + totalAmount;
      const vendorRef = doc(db, 'vendors', vendorId);
      batch.update(vendorRef, {
        balance: newBalance,
        updatedAt: serverTimestamp()
      });

      // Create a transaction for each item
      items.forEach(item => {
        const docRef = doc(collection(db, 'transactions'));
        batch.set(docRef, {
          vendorId,
          vendorName: customerName,
          customerId: vendorId,
          customerName: customerName,
          phone: phone,
          date: new Date(date),
          category: item.category,
          company: item.company,
          unit: item.unit,
          quantity: Number(item.quantity),
          price: Number(item.price),
          amount: item.amount,
          remainingAmount: item.amount,
          productName: `${item.company} ${item.category} (${item.quantity} ${item.unit})`,
          type: 'customer_purchase',
          createdAt: serverTimestamp()
        });
      });

      await batch.commit();

      setSnackbar({ open: true, message: `Purchase recorded! ${items.length} item(s) added.`, severity: 'success' });

      // Reset form
      setItems([
        { id: generateTempId(), category: '', company: '', unit: '', quantity: '', price: '', amount: 0 }
      ]);
      setCustomerName('');
      setPhone('');
      setDate(new Date().toISOString().slice(0, 10));
      setSelectedVendor(null);

    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: 'Save failed: ' + err.message, severity: 'error' });
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  };

  /* ---------------- CLEAR SELECTION ---------------- */
  const handleClearSelection = () => {
    setSelectedVendor(null);
    setCustomerName('');
    setPhone('');
  };

  return (
    <Container maxWidth="xl">
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h5" fontWeight={700} mb={3}>
          Add Customer Purchase (Multiple Items)
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Main Grid container */}
            <Grid container spacing={3}>
              {/* LEFT COLUMN */}
              <Grid item xs={12} md={8}>
                {/* Vendor Selection */}
                <Box sx={{ position: 'relative' }}>
                  <TextField
                    fullWidth
                    label="Customer/Vendor Name"
                    value={customerName}
                    onChange={e => {
                      setCustomerName(e.target.value);
                      setSelectedVendor(null);
                    }}
                    required
                    autoComplete="off"
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><Business /></InputAdornment>,
                      endAdornment: selectedVendor && (
                        <InputAdornment position="end">
                          <Button size="small" onClick={handleClearSelection} sx={{ mr: -1 }}>
                            Clear
                          </Button>
                        </InputAdornment>
                      )
                    }}
                    helperText="Start typing vendor name..."
                  />
                  {suggestions.length > 0 && !selectedVendor && (
                    <Paper sx={{
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
                    }}>
                      {suggestions.map(v => (
                        <Box key={v.id} sx={{ p: 1.5, cursor: 'pointer', borderBottom: '1px solid #eee', '&:last-child': { borderBottom: 0 }, '&:hover': { bgcolor: 'primary.light', color: 'primary.contrastText' } }} onClick={() => selectVendor(v)}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Person fontSize="small" />
                            <Box flex={1}>
                              <Typography fontWeight={600} variant="body2">{v.vendorName}</Typography>
                              <Typography variant="caption">{v.phone || 'No phone'} | Balance: ₹{v.balance || 0}</Typography>
                            </Box>
                            {v.balance > 0 && <Chip label="Owes you" size="small" color="success" sx={{ height: 20, fontSize: '0.7rem' }} />}
                            {v.balance < 0 && <Chip label="You owe" size="small" color="error" sx={{ height: 20, fontSize: '0.7rem' }} />}
                          </Stack>
                        </Box>
                      ))}
                    </Paper>
                  )}
                </Box>

                {selectedVendor && (
                  <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
                    <Typography variant="body2">
                      Selected: <strong>{selectedVendor.vendorName}</strong> | Phone: {selectedVendor.phone || 'N/A'} | Current Balance: ₹{selectedVendor.balance || 0}
                    </Typography>
                  </Alert>
                )}

                {/* Phone & Date */}
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Phone"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      InputProps={{ startAdornment: <InputAdornment position="start"><Phone /></InputAdornment> }}
                      disabled={!!selectedVendor}
                      helperText={selectedVendor ? "Phone from vendor record" : "Enter phone if new"}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="date"
                      label="Date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      InputProps={{ startAdornment: <InputAdornment position="start"><CalendarToday /></InputAdornment> }}
                    />
                  </Grid>
                </Grid>

                <Divider sx={{ my: 3 }} />

                {/* Items Table */}
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  Purchase Items
                </Typography>

                <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                        <TableCell>#</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Company</TableCell>
                        <TableCell>Qty</TableCell>
                        <TableCell>Unit</TableCell>
                        <TableCell>Price (₹)</TableCell>
                        <TableCell>Amount (₹)</TableCell>
                        <TableCell align="center">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {items.map((item, index) => (
                        <TableRow key={item.id} hover>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <TextField
                              select
                              fullWidth
                              size="small"
                              value={item.category}
                              onChange={e => {
                                const newCategory = e.target.value;
                                // FIX: merge category + company reset + unit reset
                                // into a single updateItem call so none of the
                                // fields clobber each other.
                                updateItem(item.id, { category: newCategory, company: '', unit: '' });
                              }}
                            >
                              {getCategoriesForItem().map(cat => (
                                <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                              ))}
                            </TextField>
                          </TableCell>
                          <TableCell>
                            <TextField
                              select
                              fullWidth
                              size="small"
                              value={item.company}
                              onChange={e => {
                                const newCompany = e.target.value;
                                // FIX: merge company + derived unit into one call
                                const unit = getUnitForItem(item.category, newCompany);
                                updateItem(item.id, { company: newCompany, unit });
                              }}
                              disabled={!item.category}
                            >
                              {getCompaniesForItem(item.category).map(comp => (
                                <MenuItem key={comp} value={comp}>{comp}</MenuItem>
                              ))}
                            </TextField>
                          </TableCell>
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              value={item.quantity}
                              onChange={e => updateItem(item.id, { quantity: e.target.value })}
                              disabled={!item.company}
                              InputProps={{ inputProps: { min: 0 } }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              value={item.unit}
                              InputProps={{ readOnly: true }}
                              disabled
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              value={item.price}
                              onChange={e => updateItem(item.id, { price: e.target.value })}
                              disabled={!item.company}
                              InputProps={{ inputProps: { min: 0 } }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>
                            ₹{item.amount.toFixed(2)}
                          </TableCell>
                          <TableCell align="center">
                            <IconButton size="small" color="error" onClick={() => removeItem(item.id)} disabled={items.length === 1}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={8}>
                          <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<Add />}
                            onClick={addItem}
                            sx={{ py: 0.5 }}
                          >
                            Add Item
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </TableContainer>

                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    • Select vendor first, then add items.<br/>
                    • Each item will be recorded as a separate purchase entry.<br/>
                    • Vendor balance will increase by total amount.
                  </Typography>
                </Alert>
              </Grid>

              {/* RIGHT COLUMN - Summary Card */}
              <Grid item xs={12} md={4}>
                <Card sx={{ position: 'sticky', top: 20, bgcolor: '#f8f9fa' }}>
                  <CardContent>
                    <Typography variant="h6" fontWeight={700} gutterBottom>
                      <Receipt sx={{ verticalAlign: 'middle', mr: 1 }} />
                      Order Summary
                    </Typography>
                    <Divider sx={{ mb: 2 }} />

                    <Stack spacing={1}>
                      {items.map((item, idx) => (
                        <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                          <Typography variant="body2" color="text.secondary">
                            {item.company || `Item ${idx+1}`} (x{item.quantity || 0})
                          </Typography>
                          <Typography variant="body2" fontWeight={500}>
                            ₹{item.amount.toFixed(2)}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>

                    <Divider sx={{ my: 2 }} />

                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="h6" fontWeight={700}>Total</Typography>
                      <Typography variant="h5" fontWeight={700} color="primary.main">
                        ₹{totalAmount.toFixed(2)}
                      </Typography>
                    </Stack>

                    {selectedVendor && (
                      <Box sx={{ mt: 2, p: 1.5, bgcolor: '#e3f2fd', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary">Current Balance</Typography>
                        <Typography variant="h6" fontWeight={600}>
                          ₹{selectedVendor.balance || 0}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">After purchase:</Typography>
                        <Typography variant="h6" fontWeight={600} color="success.main">
                          ₹{(selectedVendor.balance || 0) + totalAmount}
                        </Typography>
                      </Box>
                    )}

                    <Box sx={{ mt: 3 }}>
                      <Button
                        fullWidth
                        variant="contained"
                        type="submit"
                        disabled={saving || !selectedVendor || items.length === 0 || totalAmount === 0}
                        sx={{ py: 1.5 }}
                      >
                        {saving ? <CircularProgress size={24} /> : `Save Purchase (${items.length} items)`}
                      </Button>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<Add />}
                        onClick={() => navigate('/vendors')}
                        sx={{ mt: 1, py: 1 }}
                      >
                        Add New Vendor
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </form>
        )}
      </Paper>

      {/* New Vendor Dialog */}
      <Dialog open={showNewCustomerDialog} onClose={handleCancelNewVendor}>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Business />
            <Typography variant="h6" fontWeight={600}>Vendor Not Found</Typography>
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
          <Button onClick={handleCancelNewVendor}>Cancel & Clear</Button>
          <Button variant="contained" onClick={handleGoToVendorList} startIcon={<Add />}>
            Go to Vendor List
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default AddCustomer;