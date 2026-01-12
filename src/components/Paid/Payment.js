import React, { useState, useEffect } from 'react';
import {
  Container,
  TextField,
  Button,
  Typography,
  Grid,
  Box,
  Alert,
  Autocomplete,
  Card,
  CardContent,
  Stack,
  Avatar,
  useTheme,
  useMediaQuery,
  CircularProgress,
  Snackbar,
  Fade,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Divider,
  IconButton
} from '@mui/material';

import {
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  orderBy,
  where,
  getDocs
} from 'firebase/firestore';

import { db } from '../../services/firebase';

import {
  AccountBalanceWallet,
  CheckCircle,
  AttachMoney,
  AccountBalance,
  CreditCard,
  Receipt,
  QrCode,
  Payment as PaymentIcon,
  Phone,
  Close,
  CalendarToday,
  Inventory,
  Business
} from '@mui/icons-material';

import { Link as RouterLink } from 'react-router-dom';

const Payment = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [vendors, setVendors] = useState([]); // Changed from customers to vendors
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorTransactions, setVendorTransactions] = useState([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [processingPayment, setProcessingPayment] = useState(false);

  const [allPayments, setAllPayments] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);

  const [filter, setFilter] = useState('thisMonth');

  const [showSuccess, setShowSuccess] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  const [selectPurchaseDialog, setSelectPurchaseDialog] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  /* ================= FETCH VENDORS ================= */
  useEffect(() => {
    // Fetch vendors with positive balance (they owe you money)
    const q1 = query(collection(db, 'vendors'));
    const unsub1 = onSnapshot(q1, snap => {
      const vendorsList = snap.docs
        .map(d => ({ 
          id: d.id, 
          ...d.data(),
          customerName: d.data().vendorName // Map for compatibility
        }))
        .filter(v => v.balance > 0); // Positive balance = vendor owes you money
      
      console.log('Vendors with positive balance:', vendorsList);
      setVendors(vendorsList);
    });

    // Fetch all payments
    const q2 = query(collection(db, 'payments'), orderBy('date', 'desc'));
    const unsub2 = onSnapshot(q2, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllPayments(data);
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  /* ================= LOAD VENDOR TRANSACTIONS ================= */
  const loadVendorTransactions = async (vendorId) => {
    if (!vendorId) return;
    
    setLoadingTransactions(true);
    try {
      // Get transactions for this vendor (customer purchases from this vendor)
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('vendorId', '==', vendorId)
      );
      
      const snapshot = await getDocs(transactionsQuery);
      const transactions = snapshot.docs.map(doc => {
        const data = doc.data();
        const remainingAmount = data.remainingAmount ?? data.amount;
        
        return {
          id: doc.id,
          ...data,
          amount: data.amount || 0,
          remainingAmount: remainingAmount || 0,
          date: data.date?.toDate?.() || data.date || new Date()
        };
      });
      
      // Filter only pending purchases (remainingAmount > 0)
      const pendingTransactions = transactions.filter(t => t.remainingAmount > 0);
      
      // Sort by date (oldest first)
      pendingTransactions.sort((a, b) => a.date - b.date);
      
      console.log('Loaded vendor pending transactions:', pendingTransactions);
      setVendorTransactions(pendingTransactions);
    } catch (error) {
      console.error('Error loading vendor transactions:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load purchases',
        severity: 'error'
      });
    } finally {
      setLoadingTransactions(false);
    }
  };

  /* ================= HANDLE VENDOR SELECTION ================= */
  const handleVendorSelect = (vendor) => {
    console.log('Selected vendor:', vendor);
    setSelectedVendor(vendor);
    setPaymentAmount('');
    setSelectedPurchase(null);
    
    if (vendor) {
      loadVendorTransactions(vendor.id);
    } else {
      setVendorTransactions([]);
    }
  };

  /* ================= FILTER PAYMENTS ================= */
  useEffect(() => {
    const now = new Date();
    let filtered = [];

    if (filter === 'thisMonth') {
      filtered = allPayments.filter(p => {
        const d = p.date?.toDate();
        return (
          d &&
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      });
    }

    if (filter === 'lastMonth') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      filtered = allPayments.filter(p => {
        const d = p.date?.toDate();
        return (
          d &&
          d.getMonth() === lastMonth.getMonth() &&
          d.getFullYear() === lastMonth.getFullYear()
        );
      });
    }

    if (filter === 'all') {
      filtered = allPayments;
    }

    setPaymentHistory(filtered.slice(0, 20));
  }, [filter, allPayments]);

  /* ================= DATE FORMAT ================= */
  const formatDate = timestamp => {
    if (!timestamp) return '';
    try {
      const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return '';
    }
  };

  /* ================= GET PRODUCT NAME ================= */
  const getProductName = (transaction) => {
    if (transaction.productName) {
      return transaction.productName;
    }
    
    // Construct from available fields
    const parts = [];
    if (transaction.company) parts.push(transaction.company);
    if (transaction.category) parts.push(transaction.category);
    
    let name = parts.join(' ');
    
    // Add quantity and unit if available
    if (transaction.quantity && transaction.unit) {
      name += ` (${transaction.quantity} ${transaction.unit})`;
    } else if (transaction.quantity) {
      name += ` (${transaction.quantity})`;
    }
    
    return name || `Purchase ${formatDate(transaction.date)}`;
  };

  /* ================= OPEN PURCHASE SELECTION DIALOG ================= */
  const openPurchaseSelection = () => {
    if (!selectedVendor || !paymentAmount || Number(paymentAmount) <= 0) {
      setSnackbar({
        open: true,
        message: 'Please select vendor and enter payment amount',
        severity: 'warning'
      });
      return;
    }

    const amt = Number(paymentAmount);
    if (amt > selectedVendor.balance) {
      setSnackbar({
        open: true,
        message: `Payment cannot exceed vendor balance of ₹${selectedVendor.balance}`,
        severity: 'error'
      });
      return;
    }

    console.log('Vendor pending purchases:', vendorTransactions);
    
    if (vendorTransactions.length === 0) {
      setSnackbar({
        open: true,
        message: 'No pending purchases found for this vendor',
        severity: 'info'
      });
      return;
    }

    setSelectPurchaseDialog(true);
  };

  /* ================= HANDLE PAYMENT ================= */
  const handlePayment = async () => {
    if (!selectedVendor || !selectedPurchase || !paymentAmount) return;

    const amt = Number(paymentAmount);
    if (amt <= 0) {
      setSnackbar({
        open: true,
        message: 'Please enter a valid payment amount',
        severity: 'error'
      });
      return;
    }

    if (amt > selectedPurchase.remainingAmount) {
      setSnackbar({
        open: true,
        message: `Payment cannot exceed remaining amount of ₹${selectedPurchase.remainingAmount}`,
        severity: 'error'
      });
      return;
    }

    if (amt > selectedVendor.balance) {
      setSnackbar({
        open: true,
        message: `Payment cannot exceed vendor balance of ₹${selectedVendor.balance}`,
        severity: 'error'
      });
      return;
    }

    setProcessingPayment(true);

    try {
      // Calculate new values
      const newRemaining = selectedPurchase.remainingAmount - amt;
      const newVendorBalance = selectedVendor.balance - amt;

      console.log('Payment details:', {
        vendorId: selectedVendor.id,
        vendorName: selectedVendor.vendorName,
        oldBalance: selectedVendor.balance,
        newBalance: newVendorBalance,
        purchaseId: selectedPurchase.id,
        oldRemaining: selectedPurchase.remainingAmount,
        newRemaining
      });

      // Update vendor balance
      await updateDoc(doc(db, 'vendors', selectedVendor.id), {
        balance: newVendorBalance,
        updatedAt: serverTimestamp()
      });

      // Update transaction
      await updateDoc(doc(db, 'transactions', selectedPurchase.id), {
        remainingAmount: newRemaining,
        status: newRemaining <= 0 ? 'paid' : 'partial',
        lastPaymentDate: serverTimestamp()
      });

      // Record payment
      await addDoc(collection(db, 'payments'), {
        vendorId: selectedVendor.id,
        vendorName: selectedVendor.vendorName,
        transactionId: selectedPurchase.id,
        productName: getProductName(selectedPurchase),
        amount: amt,
        paymentMode,
        previousBalance: selectedVendor.balance,
        newBalance: newVendorBalance,
        previousRemaining: selectedPurchase.remainingAmount,
        newRemaining: newRemaining,
        date: serverTimestamp(),
        settledType: 'individual',
        notes: `Individual settle for ${getProductName(selectedPurchase)}`,
        type: 'customer_payment' // Add type for filtering
      });

      // Reset everything
      setShowSuccess(true);
      setSelectPurchaseDialog(false);
      setSnackbar({
        open: true,
        message: `Payment of ₹${amt} applied to selected purchase`,
        severity: 'success'
      });

      // Reload vendor transactions
      loadVendorTransactions(selectedVendor.id);

      setTimeout(() => {
        setSelectedVendor(null);
        setVendorTransactions([]);
        setPaymentAmount('');
        setSelectedPurchase(null);
        setProcessingPayment(false);
        setShowSuccess(false);
      }, 1500);
    } catch (error) {
      console.error('Payment error:', error);
      setSnackbar({
        open: true,
        message: 'Payment failed. Please try again.',
        severity: 'error'
      });
      setProcessingPayment(false);
    }
  };

  const paymentModes = [
    { label: 'Cash', icon: <AttachMoney /> },
    { label: 'UPI', icon: <QrCode /> },
    { label: 'Bank', icon: <AccountBalance /> },
    { label: 'Card', icon: <CreditCard /> },
    { label: 'Cheque', icon: <Receipt /> }
  ];

  return (
    <Box sx={{ bgcolor: '#F2F2F7', minHeight: '100vh', pb: isMobile ? 8 : 2 }}>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>

      <Fade in={showSuccess}>
        <Box sx={{ position: 'fixed', top: 16, left: 16, right: 16, zIndex: 999 }}>
          <Alert icon={<CheckCircle />} severity="success">
            Payment Applied Successfully
          </Alert>
        </Box>
      </Fade>

      <Container sx={{ py: 2 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
          Payment Collection (Individual Settle)
        </Typography>

        {/* PAYMENT FORM */}
        <Card sx={{ borderRadius: 4, mb: 3 }}>
          <Box
            sx={{
              background: 'linear-gradient(135deg,#007AFF,#4DA3FF)',
              color: '#fff',
              p: 2.5,
              borderRadius: '16px 16px 0 0'
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <AccountBalanceWallet />
              <Typography fontWeight={600}>Record Payment</Typography>
            </Stack>
          </Box>

          <CardContent>
            <Autocomplete
              options={vendors}
              getOptionLabel={v => `${v.vendorName} - ₹${v.balance} pending`}
              value={selectedVendor}
              onChange={(_, v) => handleVendorSelect(v)}
              renderInput={params => (
                <TextField {...params} label="Select Vendor" size="small" />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Avatar sx={{ mr: 1 }}>{option.vendorName[0]}</Avatar>
                  <Box>
                    <Typography>{option.vendorName}</Typography>
                    {option.phone && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Phone sx={{ fontSize: 14 }} />
                        <Typography variant="caption">{option.phone}</Typography>
                      </Stack>
                    )}
                  </Box>
                </Box>
              )}
            />

            {selectedVendor && (
              <>
                {/* Vendor Info */}
                <Paper sx={{ p: 2, mt: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Total Balance Owed
                      </Typography>
                      <Typography variant="h5" color="error.main" fontWeight={700}>
                        ₹{selectedVendor.balance}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Pending Purchases
                      </Typography>
                      <Typography variant="h5" fontWeight={700}>
                        {vendorTransactions.length}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>

                {/* Payment Amount */}
                <TextField
                  fullWidth
                  label="Payment Amount"
                  type="number"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  sx={{ mt: 3 }}
                  InputProps={{
                    startAdornment: <Typography sx={{ mr: 1 }}>₹</Typography>,
                  }}
                  helperText={`Enter amount up to ₹${selectedVendor.balance}`}
                />

                {/* Payment Method */}
                <Typography sx={{ mt: 3, mb: 1 }} fontWeight={600}>
                  Payment Method
                </Typography>

                <Grid container spacing={1}>
                  {paymentModes.map(m => (
                    <Grid item xs={4} key={m.label}>
                      <Card
                        onClick={() => setPaymentMode(m.label)}
                        sx={{
                          textAlign: 'center',
                          p: 1.5,
                          borderRadius: 3,
                          cursor: 'pointer',
                          border:
                            paymentMode === m.label
                              ? '2px solid #007AFF'
                              : '1px solid #ddd'
                        }}
                      >
                        {m.icon}
                        <Typography variant="caption">{m.label}</Typography>
                      </Card>
                    </Grid>
                  ))}
                </Grid>

                {/* Record Payment Button */}
                <Button
                  fullWidth
                  sx={{
                    mt: 3,
                    py: 1.5,
                    borderRadius: 4,
                    background: 'linear-gradient(135deg,#007AFF,#4DA3FF)'
                  }}
                  variant="contained"
                  disabled={processingPayment || !paymentAmount || Number(paymentAmount) <= 0}
                  startIcon={
                    processingPayment ? (
                      <CircularProgress size={18} />
                    ) : (
                      <PaymentIcon />
                    )
                  }
                  onClick={openPurchaseSelection}
                >
                  {processingPayment ? 'Processing...' : 'Select Purchase & Pay'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* PURCHASE SELECTION DIALOG */}
        <Dialog
          open={selectPurchaseDialog}
          onClose={() => !processingPayment && setSelectPurchaseDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="h6" fontWeight={700}>
                Select Purchase to Settle
              </Typography>
              <IconButton 
                size="small" 
                onClick={() => !processingPayment && setSelectPurchaseDialog(false)}
                disabled={processingPayment}
              >
                <Close />
              </IconButton>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Vendor: {selectedVendor?.vendorName} • Amount: ₹{paymentAmount}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Select which purchase to apply this payment to:
            </Typography>
          </DialogTitle>

          <DialogContent>
            {loadingTransactions ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : vendorTransactions.length === 0 ? (
              <Box sx={{ textAlign: 'center', p: 4 }}>
                <Inventory sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography color="text.secondary">
                  No pending purchases found
                </Typography>
              </Box>
            ) : (
              <List>
                {vendorTransactions.map((txn, index) => {
                  const isSelected = selectedPurchase?.id === txn.id;
                  const canPay = Number(paymentAmount) <= txn.remainingAmount;
                  const productName = getProductName(txn);
                  
                  return (
                    <React.Fragment key={txn.id}>
                      <ListItem
                        button
                        selected={isSelected}
                        onClick={() => setSelectedPurchase(txn)}
                        sx={{
                          borderRadius: 2,
                          mb: 1,
                          border: isSelected ? '2px solid #007AFF' : '1px solid #e0e0e0',
                          bgcolor: isSelected ? '#e3f2fd' : 'white',
                        }}
                      >
                        <ListItemText
                          primary={
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Chip
                                label={`Purchase ${index + 1}`}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                              <Typography fontWeight={600}>
                                {productName}
                              </Typography>
                            </Stack>
                          }
                          secondary={
                            <>
                              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                                <CalendarToday sx={{ fontSize: 14 }} />
                                <Typography variant="caption">
                                  {formatDate(txn.date)}
                                </Typography>
                                {txn.category && (
                                  <>
                                    <Divider orientation="vertical" flexItem />
                                    <Typography variant="caption">
                                      Category: {txn.category}
                                    </Typography>
                                  </>
                                )}
                              </Stack>
                              <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                                <Typography variant="caption">
                                  Total: ₹{txn.amount}
                                </Typography>
                                <Typography variant="caption" color="error.main" fontWeight={600}>
                                  Remaining: ₹{txn.remainingAmount}
                                </Typography>
                              </Stack>
                              {!canPay && (
                                <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                                  ❌ Payment (₹{paymentAmount}) exceeds remaining (₹{txn.remainingAmount})
                                </Typography>
                              )}
                              {isSelected && (
                                <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 0.5 }}>
                                  ✅ Selected: Payment will reduce to ₹{txn.remainingAmount - Number(paymentAmount)}
                                </Typography>
                              )}
                            </>
                          }
                        />
                        <ListItemSecondaryAction>
                          <Stack alignItems="flex-end" spacing={0.5}>
                            <Chip
                              label={`₹${txn.remainingAmount}`}
                              size="small"
                              color={canPay ? (isSelected ? 'primary' : 'default') : 'error'}
                              variant={isSelected ? 'filled' : 'outlined'}
                            />
                            {!canPay && (
                              <Typography variant="caption" color="error">
                                Cannot pay
                              </Typography>
                            )}
                          </Stack>
                        </ListItemSecondaryAction>
                      </ListItem>
                      <Divider sx={{ mb: 1 }} />
                    </React.Fragment>
                  );
                })}
              </List>
            )}
          </DialogContent>

          <DialogActions sx={{ p: 3, pt: 0 }}>
            <Button
              onClick={() => setSelectPurchaseDialog(false)}
              disabled={processingPayment}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handlePayment}
              disabled={!selectedPurchase || processingPayment || Number(paymentAmount) > selectedPurchase.remainingAmount}
              startIcon={processingPayment ? <CircularProgress size={20} /> : <CheckCircle />}
            >
              {processingPayment ? 'Processing...' : `Pay ₹${paymentAmount}`}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ================= HISTORY FILTER ================= */}
        <Typography fontWeight={700} sx={{ mb: 1 }}>
          Payment History
        </Typography>

        <ToggleButtonGroup
          size="small"
          value={filter}
          exclusive
          onChange={(_, v) => v && setFilter(v)}
          sx={{ mb: 2 }}
        >
          <ToggleButton value="thisMonth">This Month</ToggleButton>
          <ToggleButton value="lastMonth">Last Month</ToggleButton>
          <ToggleButton value="all">All</ToggleButton>
        </ToggleButtonGroup>

        {/* ================= PAYMENT HISTORY ================= */}
        {paymentHistory.map(p => (
          <Card key={p.id} sx={{ mb: 1.5, borderRadius: 3 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between">
                <Box>
                  <Typography fontWeight={600}>
                    {p.vendorName || p.customerName}
                  </Typography>
                  <Typography variant="caption">
                    {p.paymentMode} • {formatDate(p.date)}
                  </Typography>
                  {p.productName && (
                    <Typography variant="caption" display="block">
                      {p.productName}
                    </Typography>
                  )}
                  {p.settledType === 'individual' && (
                    <Chip label="Individual Settle" size="small" sx={{ mt: 0.5 }} />
                  )}
                </Box>
                <Typography color="success.main" fontWeight={700}>
                  ₹{p.amount}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Container>

      {/* BOTTOM NAV (MOBILE) */}
      {isMobile && (
        <Paper
          elevation={5}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 8,
            right: 8,
            mb: 1,
            borderRadius: 4
          }}
        >
          <Stack direction="row" justifyContent="space-around" py={1}>
            <Button component={RouterLink} to="/">Home</Button>
            <Button component={RouterLink} to="/payment" sx={{ fontWeight: 700 }}>
              Payment
            </Button>
            <Button component={RouterLink} to="/vendors">Vendors</Button>
          </Stack>
        </Paper>
      )}
    </Box>
  );
};

export default Payment;