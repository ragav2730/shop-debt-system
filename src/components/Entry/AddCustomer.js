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
  Snackbar,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  Person,
  Phone,
  CalendarToday,
  AttachMoney,
  Store,
  Add,
  Business,
  Delete,
  Receipt,
  CheckCircle,
  ListAlt,
  ReceiptLong,
  Tag
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

const generateTempId = () => Date.now() + Math.random().toString(36).substring(2, 9);

const AddCustomer = () => {
  const navigate = useNavigate();
  const submitLock = useRef(false);

  /* ─── ENTRY MODE ────────────────────────────────────────────────────────── */
  // 'items'  → existing multi-item table
  // 'bill'   → single bill-number + total amount (quick reference entry)
  const [mode, setMode] = useState('items');

  /* ─── COMMON STATE ──────────────────────────────────────────────────────── */
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');

  /* ─── ITEMS MODE STATE ──────────────────────────────────────────────────── */
  const [items, setItems] = useState([
    { id: generateTempId(), category: '', company: '', unit: '', quantity: '', price: '', amount: 0 }
  ]);

  /* ─── BILL MODE STATE ───────────────────────────────────────────────────── */
  const [billNo, setBillNo] = useState('');
  const [billAmount, setBillAmount] = useState('');

  /* ─── SNACKBAR ──────────────────────────────────────────────────────────── */
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  /* ─── DERIVED TOTAL (adapts to mode) ───────────────────────────────────── */
  const totalAmount =
    mode === 'items'
      ? items.reduce((sum, item) => sum + (item.amount || 0), 0)
      : Number(billAmount) || 0;

  /* ─── FETCH VENDORS ─────────────────────────────────────────────────────── */
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

  /* ─── FETCH PRODUCTS ────────────────────────────────────────────────────── */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  /* ─── AUTOCOMPLETE VENDOR ───────────────────────────────────────────────── */
  useEffect(() => {
    if (customerName.length >= 1 && !selectedVendor) {
      const term = customerName.toLowerCase();
      setSuggestions(
        vendors
          .filter(v =>
            v.vendorName.toLowerCase().startsWith(term) ||
            v.vendorName.toLowerCase().includes(term)
          )
          .slice(0, 8)
      );
    } else {
      setSuggestions([]);
    }
  }, [customerName, vendors, selectedVendor]);

  const selectVendor = v => {
    setSelectedVendor(v);
    setCustomerName(v.vendorName);
    setPhone(v.phone || '');
    setSuggestions([]);
  };

  const handleClearSelection = () => {
    setSelectedVendor(null);
    setCustomerName('');
    setPhone('');
  };

  /* ─── MODE SWITCH ───────────────────────────────────────────────────────── */
  const handleModeChange = (_, newMode) => {
    if (!newMode) return; // Don't allow deselecting
    setMode(newMode);
    // Reset the mode-specific fields when switching
    if (newMode === 'bill') {
      setBillNo('');
      setBillAmount('');
    } else {
      setItems([
        { id: generateTempId(), category: '', company: '', unit: '', quantity: '', price: '', amount: 0 }
      ]);
    }
  };

  /* ─── ITEMS MANAGEMENT ──────────────────────────────────────────────────── */
  const addItem = () => {
    setItems(prev => [
      ...prev,
      { id: generateTempId(), category: '', company: '', unit: '', quantity: '', price: '', amount: 0 }
    ]);
  };

  const removeItem = id => {
    setItems(prev => {
      if (prev.length === 1) {
        setSnackbar({ open: true, message: 'At least one item is required', severity: 'warning' });
        return prev;
      }
      return prev.filter(item => item.id !== id);
    });
  };

  const updateItem = (id, fields) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, ...fields };
        const qty = Number(updated.quantity);
        const price = Number(updated.price);
        updated.amount = qty > 0 && price > 0 ? qty * price : 0;
        return updated;
      })
    );
  };

  const getCategoriesForItem = () =>
    [...new Set(products.filter(p => p.active).map(p => p.category))];

  const getCompaniesForItem = category => {
    if (!category) return [];
    return [...new Set(
      products.filter(p => p.category === category && p.active).map(p => p.company)
    )];
  };

  const getUnitForItem = (category, company) => {
    if (!category || !company) return '';
    return products.find(p => p.category === category && p.company === company && p.active)?.unit || '';
  };

  /* ─── VENDOR EXISTENCE CHECK ────────────────────────────────────────────── */
  const checkVendorExists = name =>
    vendors.some(v => v.vendorName.toLowerCase() === name.toLowerCase());

  /* ─── VALIDATION ────────────────────────────────────────────────────────── */
  const validate = () => {
    if (!customerName) return 'Customer/Vendor name is required.';
    if (!checkVendorExists(customerName)) {
      setNewCustomerName(customerName);
      setShowNewCustomerDialog(true);
      return 'VENDOR_NOT_FOUND';
    }

    if (mode === 'bill') {
      if (!billAmount || Number(billAmount) <= 0)
        return 'Please enter a valid bill amount greater than zero.';
    } else {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const num = i + 1;
        if (!item.category) return `Category missing for item ${num}.`;
        if (!item.company)  return `Company missing for item ${num}.`;
        if (!item.quantity || Number(item.quantity) <= 0) return `Invalid quantity for item ${num}.`;
        if (!item.price    || Number(item.price)    <= 0) return `Invalid price for item ${num}.`;
      }
    }
    return '';
  };

  /* ─── DIALOG HANDLERS ───────────────────────────────────────────────────── */
  const handleGoToVendorList = () => navigate('/vendors');
  const handleCancelNewVendor = () => {
    setShowNewCustomerDialog(false);
    setNewCustomerName('');
    setCustomerName('');
  };

  /* ─── SUBMIT ────────────────────────────────────────────────────────────── */
  const handleSubmit = async e => {
    e.preventDefault();
    if (submitLock.current) return;

    const error = validate();
    if (error === 'VENDOR_NOT_FOUND') return;
    if (error) {
      setSnackbar({ open: true, message: error, severity: 'error' });
      return;
    }

    submitLock.current = true;
    setSaving(true);

    try {
      const vendor = vendors.find(
        v => v.vendorName.toLowerCase() === customerName.toLowerCase()
      );
      if (!vendor) {
        setSnackbar({ open: true, message: 'Vendor not found.', severity: 'error' });
        submitLock.current = false;
        setSaving(false);
        return;
      }

      const vendorId = vendor.id;
      const batch = writeBatch(db);
      const newBalance = (vendor.balance || 0) + totalAmount;

      // Update vendor balance
      batch.update(doc(db, 'vendors', vendorId), {
        balance: newBalance,
        updatedAt: serverTimestamp()
      });

      if (mode === 'bill') {
        /* ── Bill mode: single transaction ── */
        const billRef = doc(collection(db, 'transactions'));
        batch.set(billRef, {
          vendorId,
          vendorName: customerName,
          customerId: vendorId,
          customerName,
          phone,
          date: new Date(date),
          billNo: billNo.trim() || null,
          amount: Number(billAmount),
          remainingAmount: Number(billAmount),
          productName: billNo.trim() ? `Bill #${billNo.trim()}` : 'Bill Entry',
          type: 'customer_purchase',
          entryMode: 'bill',
          createdAt: serverTimestamp()
        });
      } else {
        /* ── Items mode: one transaction per item ── */
        items.forEach(item => {
          const docRef = doc(collection(db, 'transactions'));
          batch.set(docRef, {
            vendorId,
            vendorName: customerName,
            customerId: vendorId,
            customerName,
            phone,
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
            entryMode: 'items',
            createdAt: serverTimestamp()
          });
        });
      }

      await batch.commit();

      const successMsg =
        mode === 'bill'
          ? `Bill ${billNo ? `#${billNo}` : 'entry'} of ₹${Number(billAmount).toFixed(2)} recorded.`
          : `Purchase recorded! ${items.length} item(s) added.`;
      setSnackbar({ open: true, message: successMsg, severity: 'success' });

      // Reset form
      setCustomerName('');
      setPhone('');
      setDate(new Date().toISOString().slice(0, 10));
      setSelectedVendor(null);
      setBillNo('');
      setBillAmount('');
      setItems([
        { id: generateTempId(), category: '', company: '', unit: '', quantity: '', price: '', amount: 0 }
      ]);
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: 'Save failed: ' + err.message, severity: 'error' });
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  };

  /* ─── RENDER ────────────────────────────────────────────────────────────── */
  return (
    <Container maxWidth="xl">
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h5" fontWeight={700} mb={3}>
          Add Customer Purchase
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* ══════════════════ LEFT COLUMN ══════════════════ */}
              <Grid item xs={12} md={8}>

                {/* Vendor autocomplete */}
                <Box sx={{ position: 'relative' }}>
                  <TextField
                    fullWidth
                    label="Customer / Vendor Name"
                    value={customerName}
                    onChange={e => {
                      setCustomerName(e.target.value);
                      setSelectedVendor(null);
                    }}
                    required
                    autoComplete="off"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Business />
                        </InputAdornment>
                      ),
                      endAdornment: selectedVendor && (
                        <InputAdornment position="end">
                          <Button size="small" onClick={handleClearSelection} sx={{ mr: -1 }}>
                            Clear
                          </Button>
                        </InputAdornment>
                      )
                    }}
                    helperText="Start typing vendor name…"
                  />

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
                            '&:hover': { bgcolor: 'primary.light', color: 'primary.contrastText' }
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
                              <Chip label="Owes you" size="small" color="success" sx={{ height: 20, fontSize: '0.7rem' }} />
                            )}
                            {v.balance < 0 && (
                              <Chip label="You owe" size="small" color="error" sx={{ height: 20, fontSize: '0.7rem' }} />
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
                      <strong>{selectedVendor.vendorName}</strong> &nbsp;|&nbsp;
                      Phone: {selectedVendor.phone || 'N/A'} &nbsp;|&nbsp;
                      Current Balance: ₹{selectedVendor.balance || 0}
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
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Phone />
                          </InputAdornment>
                        )
                      }}
                      disabled={!!selectedVendor}
                      helperText={selectedVendor ? 'From vendor record' : 'Enter phone if new'}
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
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <CalendarToday />
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>
                </Grid>

                <Divider sx={{ my: 3 }} />

                {/* ── MODE TOGGLE ───────────────────────────────────────── */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Entry Mode
                  </Typography>
                  <ToggleButtonGroup
                    value={mode}
                    exclusive
                    onChange={handleModeChange}
                    size="medium"
                    sx={{ width: '100%' }}
                  >
                    <ToggleButton
                      value="items"
                      sx={{
                        flex: 1,
                        py: 1.5,
                        gap: 1,
                        '&.Mui-selected': {
                          bgcolor: 'primary.main',
                          color: 'white',
                          '&:hover': { bgcolor: 'primary.dark' }
                        }
                      }}
                    >
                      <ListAlt fontSize="small" />
                      <Box sx={{ textAlign: 'left' }}>
                        <Typography variant="body2" fontWeight={600} lineHeight={1.2}>
                          Add Items
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.85 }}>
                          Category · Company · Qty · Price
                        </Typography>
                      </Box>
                    </ToggleButton>

                    <ToggleButton
                      value="bill"
                      sx={{
                        flex: 1,
                        py: 1.5,
                        gap: 1,
                        '&.Mui-selected': {
                          bgcolor: 'secondary.main',
                          color: 'white',
                          '&:hover': { bgcolor: 'secondary.dark' }
                        }
                      }}
                    >
                      <ReceiptLong fontSize="small" />
                      <Box sx={{ textAlign: 'left' }}>
                        <Typography variant="body2" fontWeight={600} lineHeight={1.2}>
                          Bill Entry
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.85 }}>
                          Bill No · Total Amount only
                        </Typography>
                      </Box>
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                {/* ══════════════ ITEMS MODE ══════════════════════════════ */}
                {mode === 'items' && (
                  <>
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
                            <TableCell align="center">Del</TableCell>
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
                                  onChange={e =>
                                    updateItem(item.id, {
                                      category: e.target.value,
                                      company: '',
                                      unit: ''
                                    })
                                  }
                                >
                                  {getCategoriesForItem().map(cat => (
                                    <MenuItem key={cat} value={cat}>
                                      {cat}
                                    </MenuItem>
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
                                    const unit = getUnitForItem(item.category, e.target.value);
                                    updateItem(item.id, { company: e.target.value, unit });
                                  }}
                                  disabled={!item.category}
                                >
                                  {getCompaniesForItem(item.category).map(comp => (
                                    <MenuItem key={comp} value={comp}>
                                      {comp}
                                    </MenuItem>
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
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => removeItem(item.id)}
                                  disabled={items.length === 1}
                                >
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
                        • Select vendor first, then add items.<br />
                        • Each item becomes a separate purchase entry.<br />
                        • Vendor balance increases by the total amount.
                      </Typography>
                    </Alert>
                  </>
                )}

                {/* ══════════════ BILL ENTRY MODE ═════════════════════════ */}
                {mode === 'bill' && (
                  <>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      Bill Details
                    </Typography>

                    <Paper
                      variant="outlined"
                      sx={{ p: 3, borderRadius: 2, bgcolor: '#fafafa', mb: 2 }}
                    >
                      <Grid container spacing={3} alignItems="center">
                        {/* Bill Number */}
                        <Grid item xs={12} sm={5}>
                          <TextField
                            fullWidth
                            label="Bill Number"
                            placeholder="e.g. 1045 / INV-2024-001"
                            value={billNo}
                            onChange={e => setBillNo(e.target.value)}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Tag fontSize="small" />
                                </InputAdornment>
                              )
                            }}
                            helperText="Optional — for your reference only"
                          />
                        </Grid>

                        {/* Visual separator */}
                        <Grid
                          item
                          xs={12}
                          sm={2}
                          sx={{ textAlign: 'center', display: { xs: 'none', sm: 'block' } }}
                        >
                          <Typography color="text.secondary" fontWeight={600}>
                            —
                          </Typography>
                        </Grid>

                        {/* Total Amount */}
                        <Grid item xs={12} sm={5}>
                          <TextField
                            fullWidth
                            label="Total Amount *"
                            placeholder="0"
                            value={billAmount}
                            onChange={e => setBillAmount(e.target.value)}
                            type="number"
                            required
                            inputProps={{ min: 1 }}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Typography fontWeight={600}>₹</Typography>
                                </InputAdornment>
                              )
                            }}
                            helperText="Full bill amount to track as debt"
                            error={!!billAmount && Number(billAmount) <= 0}
                          />
                        </Grid>
                      </Grid>

                      {/* Preview row */}
                      {(billNo || (billAmount && Number(billAmount) > 0)) && (
                        <Box
                          sx={{
                            mt: 3,
                            p: 2,
                            bgcolor: 'secondary.50',
                            borderRadius: 2,
                            border: '1px dashed',
                            borderColor: 'secondary.main'
                          }}
                        >
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <ReceiptLong color="secondary" fontSize="small" />
                            <Typography variant="body2" color="text.secondary">
                              Will be saved as:
                            </Typography>
                            <Chip
                              label={
                                billNo.trim()
                                  ? `Bill #${billNo.trim()}`
                                  : 'Bill Entry'
                              }
                              size="small"
                              color="secondary"
                              variant="outlined"
                            />
                            {billAmount && Number(billAmount) > 0 && (
                              <>
                                <Typography variant="body2" color="text.secondary">
                                  —
                                </Typography>
                                <Typography variant="body2" fontWeight={700} color="secondary.main">
                                  ₹{Number(billAmount).toFixed(2)}
                                </Typography>
                              </>
                            )}
                          </Stack>
                        </Box>
                      )}
                    </Paper>

                    <Alert severity="info" sx={{ mt: 1 }}>
                      <Typography variant="body2">
                        • Use this when you already have a bill from your billing software.<br />
                        • The bill number is just a reference — it won't generate any itemised list.<br />
                        • The amount will be added to the vendor's outstanding balance.
                      </Typography>
                    </Alert>
                  </>
                )}
              </Grid>

              {/* ══════════════════ RIGHT COLUMN — SUMMARY ═══════════════ */}
              <Grid item xs={12} md={4}>
                <Card sx={{ position: 'sticky', top: 20, bgcolor: '#f8f9fa' }}>
                  <CardContent>
                    <Typography variant="h6" fontWeight={700} gutterBottom>
                      <Receipt sx={{ verticalAlign: 'middle', mr: 1 }} />
                      {mode === 'bill' ? 'Bill Summary' : 'Order Summary'}
                    </Typography>
                    <Divider sx={{ mb: 2 }} />

                    {mode === 'items' ? (
                      <Stack spacing={1}>
                        {items.map((item, idx) => (
                          <Box
                            key={item.id}
                            sx={{ display: 'flex', justifyContent: 'space-between' }}
                          >
                            <Typography variant="body2" color="text.secondary">
                              {item.company || `Item ${idx + 1}`} (×{item.quantity || 0})
                            </Typography>
                            <Typography variant="body2" fontWeight={500}>
                              ₹{item.amount.toFixed(2)}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    ) : (
                      <Stack spacing={1}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="text.secondary">
                            Bill No
                          </Typography>
                          <Typography variant="body2" fontWeight={500}>
                            {billNo.trim() ? `#${billNo.trim()}` : '—'}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="text.secondary">
                            Amount
                          </Typography>
                          <Typography variant="body2" fontWeight={600} color="secondary.main">
                            ₹{Number(billAmount || 0).toFixed(2)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" color="text.secondary">
                            Entries
                          </Typography>
                          <Chip label="1 transaction" size="small" variant="outlined" color="secondary" sx={{ height: 20 }} />
                        </Box>
                      </Stack>
                    )}

                    <Divider sx={{ my: 2 }} />

                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="h6" fontWeight={700}>Total</Typography>
                      <Typography
                        variant="h5"
                        fontWeight={700}
                        color={mode === 'bill' ? 'secondary.main' : 'primary.main'}
                      >
                        ₹{totalAmount.toFixed(2)}
                      </Typography>
                    </Stack>

                    {selectedVendor && (
                      <Box sx={{ mt: 2, p: 1.5, bgcolor: '#e3f2fd', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Current Balance
                        </Typography>
                        <Typography variant="h6" fontWeight={600}>
                          ₹{selectedVendor.balance || 0}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          After this {mode === 'bill' ? 'bill' : 'purchase'}:
                        </Typography>
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
                        color={mode === 'bill' ? 'secondary' : 'primary'}
                        disabled={
                          saving ||
                          !selectedVendor ||
                          totalAmount === 0 ||
                          (mode === 'items' && items.length === 0)
                        }
                        sx={{ py: 1.5 }}
                        startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <CheckCircle />}
                      >
                        {saving
                          ? 'Saving…'
                          : mode === 'bill'
                          ? `Save Bill${billNo ? ` #${billNo}` : ''}`
                          : `Save Purchase (${items.length} item${items.length > 1 ? 's' : ''})`}
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

      {/* Vendor Not Found Dialog */}
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
          <Alert severity="warning">
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
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default AddCustomer;