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
  IconButton,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  LinearProgress
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
  getDocs,
  writeBatch
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
  Business,
  Equalizer,
  Person,
  DoneAll
} from '@mui/icons-material';

import { Link as RouterLink } from 'react-router-dom';

const Payment = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorTransactions, setVendorTransactions] = useState([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [settleType, setSettleType] = useState('individual'); // 'individual' or 'normal'

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

  // Preview for normal settle
  const [distributionPreview, setDistributionPreview] = useState([]);

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
      
      // Clear distribution preview
      setDistributionPreview([]);
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

  /* ================= CALCULATE NORMAL DISTRIBUTION ================= */
  const calculateNormalDistribution = (amount, transactions) => {
    if (!transactions.length || !amount || Number(amount) <= 0) return [];
    
    const paymentAmt = Number(amount);
    const pendingTransactions = transactions.filter(t => t.remainingAmount > 0);
    
    if (pendingTransactions.length === 0) return [];
    
    // Calculate total pending
    const totalPending = pendingTransactions.reduce((sum, t) => sum + t.remainingAmount, 0);
    
    if (paymentAmt >= totalPending) {
      // If payment covers everything, distribute fully
      return pendingTransactions.map(t => ({
        ...t,
        allocatedAmount: t.remainingAmount,
        newRemaining: 0,
        status: 'paid'
      }));
    }
    
    // Calculate equal distribution
    const equalShare = paymentAmt / pendingTransactions.length;
    
    // First round: allocate equal shares
    let remainingToAllocate = paymentAmt;
    const distribution = pendingTransactions.map(t => {
      const allocated = Math.min(equalShare, t.remainingAmount);
      remainingToAllocate -= allocated;
      return {
        ...t,
        allocatedAmount: allocated,
        newRemaining: t.remainingAmount - allocated,
        status: allocated === t.remainingAmount ? 'paid' : 'partial'
      };
    });
    
    // Second round: distribute remaining amount (due to rounding)
    if (remainingToAllocate > 0.01) {
      for (let i = 0; i < distribution.length && remainingToAllocate > 0.01; i++) {
        const txn = distribution[i];
        const maxCanTake = txn.remainingAmount - txn.allocatedAmount;
        if (maxCanTake > 0) {
          const extra = Math.min(remainingToAllocate, maxCanTake);
          distribution[i].allocatedAmount += extra;
          distribution[i].newRemaining -= extra;
          remainingToAllocate -= extra;
        }
      }
    }
    
    return distribution;
  };

  /* ================= UPDATE PREVIEW WHEN AMOUNT OR SETTLE TYPE CHANGES ================= */
  useEffect(() => {
    if (settleType === 'normal' && selectedVendor && paymentAmount && Number(paymentAmount) > 0 && vendorTransactions.length > 0) {
      const preview = calculateNormalDistribution(paymentAmount, vendorTransactions);
      setDistributionPreview(preview);
    } else {
      setDistributionPreview([]);
    }
  }, [paymentAmount, settleType, vendorTransactions, selectedVendor]);

  /* ================= HANDLE VENDOR SELECTION ================= */
  const handleVendorSelect = (vendor) => {
    console.log('Selected vendor:', vendor);
    setSelectedVendor(vendor);
    setPaymentAmount('');
    setSelectedPurchase(null);
    setSettleType('individual'); // Reset to individual by default
    setDistributionPreview([]);
    
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

  /* ================= OPEN PAYMENT CONFIRMATION ================= */
  const openPaymentConfirmation = () => {
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

    if (vendorTransactions.length === 0) {
      setSnackbar({
        open: true,
        message: 'No pending purchases found for this vendor',
        severity: 'info'
      });
      return;
    }

    if (settleType === 'individual') {
      // For individual, open purchase selection dialog
      setSelectPurchaseDialog(true);
    } else {
      // For normal, go directly to payment confirmation
      handleNormalPayment();
    }
  };

  /* ================= HANDLE NORMAL PAYMENT ================= */
  const handleNormalPayment = async () => {
    if (!selectedVendor || !paymentAmount || distributionPreview.length === 0) return;

    const amt = Number(paymentAmount);
    if (amt <= 0) {
      setSnackbar({
        open: true,
        message: 'Please enter a valid payment amount',
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

    // Double confirmation for normal settle
    const confirmPayment = window.confirm(
      `⚠️ NORMAL SETTLE\n\n` +
      `Amount: ₹${amt}\n` +
      `Will be distributed across ${distributionPreview.length} purchases\n\n` +
      `Distribution:\n` +
      distributionPreview.map(d => 
        `• ${getProductName(d)}: ₹${d.allocatedAmount.toFixed(2)} (Remaining: ₹${d.newRemaining.toFixed(2)})`
      ).join('\n') +
      `\n\nProceed with this distribution?`
    );

    if (!confirmPayment) return;

    setProcessingPayment(true);

    try {
      const batch = writeBatch(db);
      
      // Calculate total allocated (should equal payment amount)
      const totalAllocated = distributionPreview.reduce((sum, d) => sum + d.allocatedAmount, 0);
      
      // Update each transaction
      distributionPreview.forEach(txn => {
        const transactionRef = doc(db, 'transactions', txn.id);
        batch.update(transactionRef, {
          remainingAmount: txn.newRemaining,
          status: txn.newRemaining <= 0 ? 'paid' : 'partial',
          lastPaymentDate: serverTimestamp()
        });
      });

      // Update vendor balance
      const vendorRef = doc(db, 'vendors', selectedVendor.id);
      const newVendorBalance = selectedVendor.balance - amt;
      batch.update(vendorRef, {
        balance: newVendorBalance,
        updatedAt: serverTimestamp()
      });

      // Create a single payment record
      const paymentData = {
        vendorId: selectedVendor.id,
        vendorName: selectedVendor.vendorName,
        amount: amt,
        paymentMode,
        previousBalance: selectedVendor.balance,
        newBalance: newVendorBalance,
        date: serverTimestamp(),
        settledType: 'normal',
        type: 'customer_payment',
        notes: `Normal settle distributed across ${distributionPreview.length} purchases`,
        distribution: distributionPreview.map(d => ({
          transactionId: d.id,
          productName: getProductName(d),
          allocatedAmount: d.allocatedAmount,
          newRemaining: d.newRemaining
        }))
      };

      const paymentRef = doc(collection(db, 'payments'));
      batch.set(paymentRef, paymentData);

      // Execute batch
      await batch.commit();

      // Success handling
      setShowSuccess(true);
      setSnackbar({
        open: true,
        message: `Payment of ₹${amt} distributed across ${distributionPreview.length} purchases`,
        severity: 'success'
      });

      // Reload vendor transactions
      loadVendorTransactions(selectedVendor.id);

      setTimeout(() => {
        setSelectedVendor(null);
        setVendorTransactions([]);
        setPaymentAmount('');
        setDistributionPreview([]);
        setProcessingPayment(false);
        setShowSuccess(false);
      }, 1500);

    } catch (error) {
      console.error('Normal payment error:', error);
      setSnackbar({
        open: true,
        message: 'Payment failed. Please try again.',
        severity: 'error'
      });
      setProcessingPayment(false);
    }
  };

  /* ================= HANDLE INDIVIDUAL PAYMENT ================= */
  const handleIndividualPayment = async () => {
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
        type: 'customer_payment'
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
          Payment Collection
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

                {/* Settle Type Selection */}
                <FormControl component="fieldset" sx={{ mt: 3 }}>
                  <FormLabel component="legend">Settlement Type</FormLabel>
                  <RadioGroup
                    row
                    value={settleType}
                    onChange={(e) => setSettleType(e.target.value)}
                  >
                    <FormControlLabel 
                      value="individual" 
                      control={<Radio />} 
                      label={
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Person fontSize="small" />
                          <span>Individual Settle</span>
                        </Stack>
                      } 
                    />
                    <FormControlLabel 
                      value="normal" 
                      control={<Radio />} 
                      label={
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Equalizer fontSize="small" />
                          <span>Normal Settle (Distribute Equally)</span>
                        </Stack>
                      } 
                    />
                  </RadioGroup>
                </FormControl>

                {/* Payment Amount */}
                <TextField
                  fullWidth
                  label="Payment Amount"
                  type="number"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  sx={{ mt: 2 }}
                  InputProps={{
                    startAdornment: <Typography sx={{ mr: 1 }}>₹</Typography>,
                  }}
                  helperText={`Enter amount up to ₹${selectedVendor.balance}`}
                />

                {/* Normal Settle Preview */}
                {settleType === 'normal' && distributionPreview.length > 0 && (
                  <Paper sx={{ mt: 3, p: 2, bgcolor: '#e8f5e8', borderRadius: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                      <DoneAll color="success" />
                      <Typography variant="subtitle2" fontWeight={600} color="success.dark">
                        Distribution Preview
                      </Typography>
                    </Stack>
                    
                    {distributionPreview.map((item, index) => (
                      <Box key={item.id} sx={{ mb: 1.5 }}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" fontWeight={500}>
                            {getProductName(item)}
                          </Typography>
                          <Typography variant="body2" fontWeight={600} color="success.main">
                            ₹{item.allocatedAmount.toFixed(2)}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" color="text.secondary">
                            Before: ₹{item.remainingAmount}
                          </Typography>
                          <Typography variant="caption" color="info.main">
                            After: ₹{item.newRemaining.toFixed(2)}
                          </Typography>
                        </Stack>
                        {index < distributionPreview.length - 1 && (
                          <Divider sx={{ mt: 1 }} />
                        )}
                      </Box>
                    ))}
                    
                    <Box sx={{ mt: 2, pt: 2, borderTop: '2px dashed #4caf50' }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography fontWeight={600}>Total Payment</Typography>
                        <Typography fontWeight={700} color="success.main">
                          ₹{distributionPreview.reduce((sum, d) => sum + d.allocatedAmount, 0).toFixed(2)}
                        </Typography>
                      </Stack>
                    </Box>
                  </Paper>
                )}

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
                  disabled={
                    processingPayment || 
                    !paymentAmount || 
                    Number(paymentAmount) <= 0 ||
                    (settleType === 'normal' && distributionPreview.length === 0)
                  }
                  startIcon={
                    processingPayment ? (
                      <CircularProgress size={18} />
                    ) : (
                      <PaymentIcon />
                    )
                  }
                  onClick={openPaymentConfirmation}
                >
                  {processingPayment 
                    ? 'Processing...' 
                    : settleType === 'individual' 
                      ? 'Select Purchase & Pay' 
                      : `Pay & Distribute to ${distributionPreview.length} Purchases`
                  }
                </Button>

                {processingPayment && (
                  <Box sx={{ width: '100%', mt: 2 }}>
                    <LinearProgress />
                  </Box>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* INDIVIDUAL PURCHASE SELECTION DIALOG */}
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
              onClick={handleIndividualPayment}
              disabled={!selectedPurchase || processingPayment || Number(paymentAmount) > selectedPurchase?.remainingAmount}
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
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                    {p.settledType === 'individual' ? (
                      <Chip 
                        label="Individual Settle" 
                        size="small" 
                        color="primary"
                        variant="outlined"
                      />
                    ) : (
                      <Chip 
                        label="Normal Settle" 
                        size="small" 
                        color="success"
                        variant="outlined"
                      />
                    )}
                    {p.distribution && (
                      <Chip 
                        label={`${p.distribution.length} purchases`} 
                        size="small" 
                        variant="outlined"
                      />
                    )}
                  </Stack>
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