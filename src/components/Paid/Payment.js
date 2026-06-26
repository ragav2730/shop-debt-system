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
  LinearProgress,
  SwipeableDrawer,
  BottomNavigation,
  BottomNavigationAction
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
  Equalizer,
  Person,
  DoneAll,
  Home as HomeIcon,
  Store as StoreIcon,
  History as HistoryIcon,
  FilterList,
  ArrowBack,
  AccountBalance as InitialBalanceIcon,
  InfoOutlined
} from '@mui/icons-material';

import { useNavigate } from 'react-router-dom';

const Payment = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorTransactions, setVendorTransactions] = useState([]);
  const [vendorInitialBalance, setVendorInitialBalance] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [processingPayment, setProcessingPayment] = useState(false);
  // FIX: default settleType set properly in loadVendorTransactions, not hardcoded here
  const [settleType, setSettleType] = useState('individual');

  const [allPayments, setAllPayments] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);

  const [filter, setFilter] = useState('thisMonth');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  const [showSuccess, setShowSuccess] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  const [selectPurchaseDialog, setSelectPurchaseDialog] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const [distributionPreview, setDistributionPreview] = useState([]);
  const [navValue, setNavValue] = useState(1);

  /* ================= FETCH VENDORS ================= */
  useEffect(() => {
    const q1 = query(collection(db, 'vendors'));
    const unsub1 = onSnapshot(q1, snap => {
      const vendorsList = snap.docs
        .map(d => ({
          id: d.id,
          ...d.data(),
          customerName: d.data().vendorName
        }))
        .filter(v => v.balance > 0);
      setVendors(vendorsList);
    });

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
  const loadVendorTransactions = async (vendorId, vendorData) => {
    if (!vendorId) return;

    setLoadingTransactions(true);
    try {
      // FIX: Read initialBalance from vendorData reliably
      const initialBal = Number(vendorData?.initialBalance) || 0;
      setVendorInitialBalance(initialBal);

      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('vendorId', '==', vendorId)
      );

      const snapshot = await getDocs(transactionsQuery);
      const transactions = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const remainingAmount = data.remainingAmount ?? data.amount;
        return {
          id: docSnap.id,
          ...data,
          amount: data.amount || 0,
          remainingAmount: remainingAmount || 0,
          date: data.date?.toDate?.() || data.date || new Date()
        };
      });

      const pendingTransactions = transactions.filter(t => t.remainingAmount > 0);
      pendingTransactions.sort((a, b) => a.date - b.date);

      setVendorTransactions(pendingTransactions);

      // FIX: Auto-select the correct settle type based on what's actually available
      // If no pending bills but vendor has initial balance → must use 'initial'
      if (pendingTransactions.length === 0 && initialBal > 0) {
        setSettleType('initial');
      } else if (pendingTransactions.length > 0) {
        // Has bills → default to individual
        setSettleType('individual');
      }
      // Edge case: no bills AND no initial → both are unavailable, keep current state

      setDistributionPreview([]);
    } catch (error) {
      console.error('Error loading vendor transactions:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load purchases. Please try again.',
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

    const totalPending = pendingTransactions.reduce((sum, t) => sum + t.remainingAmount, 0);

    if (paymentAmt >= totalPending) {
      return pendingTransactions.map(t => ({
        ...t,
        allocatedAmount: t.remainingAmount,
        newRemaining: 0,
        status: 'paid'
      }));
    }

    const equalShare = paymentAmt / pendingTransactions.length;
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

    // Second pass: distribute leftover from rounding
    if (remainingToAllocate > 0.01) {
      for (let i = 0; i < distribution.length && remainingToAllocate > 0.01; i++) {
        const maxCanTake = distribution[i].remainingAmount - distribution[i].allocatedAmount;
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

  /* ================= UPDATE PREVIEW WHEN AMOUNT / SETTLE TYPE CHANGES ================= */
  useEffect(() => {
    if (
      settleType === 'normal' &&
      selectedVendor &&
      paymentAmount &&
      Number(paymentAmount) > 0 &&
      vendorTransactions.length > 0
    ) {
      const preview = calculateNormalDistribution(paymentAmount, vendorTransactions);
      setDistributionPreview(preview);
    } else {
      setDistributionPreview([]);
    }
  }, [paymentAmount, settleType, vendorTransactions, selectedVendor]);

  /* ================= HANDLE VENDOR SELECTION ================= */
  const handleVendorSelect = (vendor) => {
    setSelectedVendor(vendor);
    setPaymentAmount('');
    setSelectedPurchase(null);
    setDistributionPreview([]);

    if (vendor) {
      // FIX: Do NOT force settleType here — loadVendorTransactions will set
      // the correct default based on what's actually available for this vendor.
      setVendorInitialBalance(Number(vendor.initialBalance) || 0);
      loadVendorTransactions(vendor.id, vendor);
    } else {
      // Vendor cleared — reset everything
      setVendorTransactions([]);
      setVendorInitialBalance(0);
      setSettleType('individual');
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
    } else if (filter === 'lastMonth') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      filtered = allPayments.filter(p => {
        const d = p.date?.toDate();
        return (
          d &&
          d.getMonth() === lastMonth.getMonth() &&
          d.getFullYear() === lastMonth.getFullYear()
        );
      });
    } else if (filter === 'all') {
      filtered = allPayments;
    }

    setPaymentHistory(filtered.slice(0, isMobile ? 10 : 20));
  }, [filter, allPayments, isMobile]);

  /* ================= DATE FORMAT ================= */
  const formatDate = timestamp => {
    if (!timestamp) return '';
    try {
      const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        ...(isMobile ? { year: '2-digit' } : { year: 'numeric' })
      });
    } catch {
      return '';
    }
  };

  /* ================= GET PRODUCT NAME ================= */
  const getProductName = transaction => {
    if (transaction.productName) {
      return isMobile && transaction.productName.length > 20
        ? transaction.productName.substring(0, 18) + '...'
        : transaction.productName;
    }

    const parts = [];
    if (transaction.company) parts.push(transaction.company);
    if (transaction.category) parts.push(transaction.category);

    let name = parts.join(' ');

    if (transaction.quantity && transaction.unit) {
      name += ` (${transaction.quantity} ${transaction.unit})`;
    } else if (transaction.quantity) {
      name += ` (${transaction.quantity})`;
    }

    if (isMobile && name.length > 25) name = name.substring(0, 23) + '...';

    return name || `Purchase ${formatDate(transaction.date)}`;
  };

  /* ================= DERIVE MAX PAYMENT AMOUNT ================= */
  // FIX: Compute the correct maximum based on the selected settle type
  const getMaxAmount = () => {
    if (settleType === 'initial') return vendorInitialBalance;
    if (settleType === 'individual' && selectedPurchase)
      return selectedPurchase.remainingAmount;
    return selectedVendor?.balance || 0;
  };

  const getAmountHelperText = () => {
    if (settleType === 'initial')
      return `Max: ₹${vendorInitialBalance} (Initial Balance only)`;
    if (settleType === 'individual' && selectedPurchase)
      return `Max: ₹${selectedPurchase.remainingAmount} (Selected purchase due)`;
    return `Max: ₹${selectedVendor?.balance || 0} (Total outstanding balance)`;
  };

  /* ================= OPEN PAYMENT CONFIRMATION ================= */
  const openPaymentConfirmation = () => {
    if (!selectedVendor || !paymentAmount || Number(paymentAmount) <= 0) {
      setSnackbar({
        open: true,
        message: 'Please select a vendor and enter a valid payment amount.',
        severity: 'warning'
      });
      return;
    }

    const amt = Number(paymentAmount);

    // Global guard: never pay more than total vendor balance
    if (amt > selectedVendor.balance) {
      setSnackbar({
        open: true,
        message: `Amount cannot exceed vendor balance of ₹${selectedVendor.balance}.`,
        severity: 'error'
      });
      return;
    }

    if (settleType === 'individual') {
      if (vendorTransactions.length === 0) {
        // FIX: Auto-switch to initial if available instead of dead-end error
        if (vendorInitialBalance > 0) {
          setSettleType('initial');
          setSnackbar({
            open: true,
            message: 'No pending bills found. Switched to Initial Balance payment.',
            severity: 'info'
          });
        } else {
          setSnackbar({
            open: true,
            message: 'No pending purchases found for this vendor.',
            severity: 'info'
          });
        }
        return;
      }
      setSelectPurchaseDialog(true);
    } else if (settleType === 'normal') {
      if (vendorTransactions.length === 0) {
        setSnackbar({
          open: true,
          message: 'No pending purchases available for Normal settle.',
          severity: 'info'
        });
        return;
      }
      if (distributionPreview.length === 0) {
        setSnackbar({
          open: true,
          message: 'Unable to calculate distribution. Check the payment amount.',
          severity: 'error'
        });
        return;
      }
      handleNormalPayment();
    } else if (settleType === 'initial') {
      if (vendorInitialBalance <= 0) {
        setSnackbar({
          open: true,
          message: 'No initial balance available for this vendor.',
          severity: 'info'
        });
        return;
      }
      // FIX: guard against paying more than initial balance (separate from total balance)
      if (amt > vendorInitialBalance) {
        setSnackbar({
          open: true,
          message: `Amount cannot exceed initial balance of ₹${vendorInitialBalance}.`,
          severity: 'error'
        });
        return;
      }
      handleInitialBalancePayment();
    }
  };

  /* ================= HANDLE INITIAL BALANCE PAYMENT ================= */
  const handleInitialBalancePayment = async () => {
    if (!selectedVendor || !paymentAmount) return;

    const amt = Number(paymentAmount);
    // Double-check guards inside the handler
    if (amt <= 0 || amt > vendorInitialBalance || amt > selectedVendor.balance) return;

    const confirmMessage = isMobile
      ? `Pay ₹${amt} towards Initial Balance?\nRemaining after: ₹${vendorInitialBalance - amt}`
      : `⚠️ INITIAL BALANCE SETTLEMENT\n\n` +
        `Amount: ₹${amt}\n` +
        `Current Initial Balance: ₹${vendorInitialBalance}\n` +
        `Remaining Initial Balance: ₹${vendorInitialBalance - amt}\n\n` +
        `Proceed with this payment?`;

    if (!window.confirm(confirmMessage)) return;

    setProcessingPayment(true);

    try {
      const newInitialBalance = vendorInitialBalance - amt;
      const newVendorBalance = selectedVendor.balance - amt;

      await updateDoc(doc(db, 'vendors', selectedVendor.id), {
        balance: newVendorBalance,
        initialBalance: newInitialBalance,
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'payments'), {
        vendorId: selectedVendor.id,
        vendorName: selectedVendor.vendorName,
        amount: amt,
        paymentMode,
        previousBalance: selectedVendor.balance,
        newBalance: newVendorBalance,
        previousInitialBalance: vendorInitialBalance,
        newInitialBalance,
        date: serverTimestamp(),
        settledType: 'initial',
        type: 'customer_payment',
        notes: `Payment towards initial balance`
      });

      setShowSuccess(true);
      setSnackbar({
        open: true,
        message: `₹${amt} payment applied to initial balance successfully.`,
        severity: 'success'
      });

      setTimeout(() => {
        setSelectedVendor(null);
        setVendorTransactions([]);
        setVendorInitialBalance(0);
        setPaymentAmount('');
        setProcessingPayment(false);
        setShowSuccess(false);
        setSettleType('individual');
      }, 1500);
    } catch (error) {
      console.error('Initial balance payment error:', error);
      setSnackbar({
        open: true,
        message: 'Payment failed. Please try again.',
        severity: 'error'
      });
      setProcessingPayment(false);
    }
  };

  /* ================= HANDLE NORMAL PAYMENT ================= */
  const handleNormalPayment = async () => {
    if (!selectedVendor || !paymentAmount || distributionPreview.length === 0) return;

    const amt = Number(paymentAmount);
    if (amt <= 0 || amt > selectedVendor.balance) return;

    const confirmMessage = isMobile
      ? `NORMAL SETTLE\nAmount: ₹${amt}\nDistribute across ${distributionPreview.length} purchases?`
      : `⚠️ NORMAL SETTLE\n\n` +
        `Amount: ₹${amt}\n` +
        `Will be distributed across ${distributionPreview.length} purchases\n\n` +
        `Distribution:\n${distributionPreview
          .map(
            d =>
              `• ${getProductName(d)}: ₹${d.allocatedAmount.toFixed(2)} (Remaining: ₹${d.newRemaining.toFixed(2)})`
          )
          .join('\n')}\n\nProceed with this distribution?`;

    if (!window.confirm(confirmMessage)) return;

    setProcessingPayment(true);

    try {
      const batch = writeBatch(db);

      distributionPreview.forEach(txn => {
        batch.update(doc(db, 'transactions', txn.id), {
          remainingAmount: txn.newRemaining,
          status: txn.newRemaining <= 0 ? 'paid' : 'partial',
          lastPaymentDate: serverTimestamp()
        });
      });

      const newVendorBalance = selectedVendor.balance - amt;
      batch.update(doc(db, 'vendors', selectedVendor.id), {
        balance: newVendorBalance,
        updatedAt: serverTimestamp()
      });

      const paymentRef = doc(collection(db, 'payments'));
      batch.set(paymentRef, {
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
      });

      await batch.commit();

      setShowSuccess(true);
      setSnackbar({
        open: true,
        message: `₹${amt} distributed across ${distributionPreview.length} purchases.`,
        severity: 'success'
      });

      setTimeout(() => {
        setSelectedVendor(null);
        setVendorTransactions([]);
        setVendorInitialBalance(0);
        setPaymentAmount('');
        setDistributionPreview([]);
        setProcessingPayment(false);
        setShowSuccess(false);
        setSettleType('individual');
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
    if (amt <= 0 || amt > selectedPurchase.remainingAmount || amt > selectedVendor.balance) return;

    setProcessingPayment(true);

    try {
      const newRemaining = selectedPurchase.remainingAmount - amt;
      const newVendorBalance = selectedVendor.balance - amt;

      await updateDoc(doc(db, 'vendors', selectedVendor.id), {
        balance: newVendorBalance,
        updatedAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'transactions', selectedPurchase.id), {
        remainingAmount: newRemaining,
        status: newRemaining <= 0 ? 'paid' : 'partial',
        lastPaymentDate: serverTimestamp()
      });

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
        newRemaining,
        date: serverTimestamp(),
        settledType: 'individual',
        notes: `Individual settle for ${getProductName(selectedPurchase)}`,
        type: 'customer_payment'
      });

      setShowSuccess(true);
      setSelectPurchaseDialog(false);
      setSnackbar({
        open: true,
        message: `₹${amt} payment applied to selected purchase.`,
        severity: 'success'
      });

      setTimeout(() => {
        setSelectedVendor(null);
        setVendorTransactions([]);
        setVendorInitialBalance(0);
        setPaymentAmount('');
        setSelectedPurchase(null);
        setProcessingPayment(false);
        setShowSuccess(false);
        setSettleType('individual');
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

  /* ================= PAYMENT MODES ================= */
  const paymentModes = [
    { label: 'Cash', icon: <AttachMoney /> },
    { label: 'UPI', icon: <QrCode /> },
    { label: 'Bank', icon: <AccountBalance /> },
    { label: 'Card', icon: <CreditCard /> },
    { label: 'Cheque', icon: <Receipt /> }
  ];

  /* ================= DERIVED: IS PAY BUTTON DISABLED ================= */
  // FIX: Comprehensive disabled logic covering all settle types and edge cases
  const isPayButtonDisabled = () => {
    if (processingPayment) return true;
    if (!paymentAmount || Number(paymentAmount) <= 0) return true;

    if (settleType === 'individual') {
      // Disabled if no pending transactions exist (nothing to pay against)
      return vendorTransactions.length === 0;
    }
    if (settleType === 'normal') {
      // Disabled if no transactions OR distribution hasn't been computed yet
      return vendorTransactions.length === 0 || distributionPreview.length === 0;
    }
    if (settleType === 'initial') {
      // Disabled if no initial balance OR amount exceeds it
      return vendorInitialBalance <= 0 || Number(paymentAmount) > vendorInitialBalance;
    }
    return true;
  };

  /* ================= MOBILE HEADER ================= */
  const MobileHeader = () => (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        bgcolor: 'white',
        borderBottom: '1px solid #e0e0e0',
        py: 1,
        px: 2
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton onClick={() => navigate(-1)} edge="start">
          <ArrowBack />
        </IconButton>
        <Typography variant="h6" fontWeight={600} sx={{ flex: 1 }}>
          Payment Collection
        </Typography>
        <IconButton onClick={() => setShowFilterDrawer(true)}>
          <FilterList />
        </IconButton>
      </Stack>
    </Box>
  );

  /* ================= PAYMENT MODE UI ================= */
  const paymentModesGrid = isMobile ? (
    <Box
      sx={{
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        py: 1,
        '&::-webkit-scrollbar': { display: 'none' }
      }}
    >
      <Stack direction="row" spacing={1}>
        {paymentModes.map(m => (
          <Chip
            key={m.label}
            icon={m.icon}
            label={m.label}
            onClick={() => setPaymentMode(m.label)}
            color={paymentMode === m.label ? 'primary' : 'default'}
            variant={paymentMode === m.label ? 'filled' : 'outlined'}
            sx={{ borderRadius: 2, '& .MuiChip-icon': { fontSize: 18 } }}
          />
        ))}
      </Stack>
    </Box>
  ) : (
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
              border: paymentMode === m.label ? '2px solid #007AFF' : '1px solid #ddd'
            }}
          >
            {m.icon}
            <Typography variant="caption">{m.label}</Typography>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  /* ================= FILTER DRAWER ================= */
  const FilterDrawer = () => (
    <SwipeableDrawer
      anchor="bottom"
      open={showFilterDrawer}
      onClose={() => setShowFilterDrawer(false)}
      onOpen={() => setShowFilterDrawer(true)}
      disableSwipeToOpen={false}
      PaperProps={{
        sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, pb: 2 }
      }}
    >
      <Box sx={{ p: 3 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 2 }}
        >
          <Typography variant="h6" fontWeight={600}>
            Filter Payments
          </Typography>
          <IconButton onClick={() => setShowFilterDrawer(false)}>
            <Close />
          </IconButton>
        </Stack>
        <Typography variant="subtitle2" gutterBottom>
          Select Period
        </Typography>
        <ToggleButtonGroup
          size="large"
          value={filter}
          exclusive
          onChange={(_, v) => {
            if (v) {
              setFilter(v);
              setShowFilterDrawer(false);
            }
          }}
          orientation="vertical"
          sx={{ width: '100%' }}
        >
          <ToggleButton value="thisMonth" sx={{ justifyContent: 'flex-start', py: 1.5 }}>
            This Month
          </ToggleButton>
          <ToggleButton value="lastMonth" sx={{ justifyContent: 'flex-start', py: 1.5 }}>
            Last Month
          </ToggleButton>
          <ToggleButton value="all" sx={{ justifyContent: 'flex-start', py: 1.5 }}>
            All Time
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
    </SwipeableDrawer>
  );

  /* ================= RENDER ================= */
  return (
    <Box sx={{ bgcolor: '#F2F2F7', minHeight: '100vh', pb: isMobile ? 7 : 2 }}>
      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Success overlay */}
      <Fade in={showSuccess}>
        <Box sx={{ position: 'fixed', top: 16, left: 16, right: 16, zIndex: 9999 }}>
          <Alert icon={<CheckCircle />} severity="success">
            Payment Applied Successfully
          </Alert>
        </Box>
      </Fade>

      {isMobile && <MobileHeader />}

      <Container sx={{ py: isMobile ? 1 : 2 }}>
        {!isMobile && (
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
            Payment Collection
          </Typography>
        )}

        {/* ===== PAYMENT FORM CARD ===== */}
        <Card sx={{ borderRadius: isMobile ? 3 : 4, mb: 3, boxShadow: isMobile ? 2 : 1 }}>
          <Box
            sx={{
              background: 'linear-gradient(135deg,#007AFF,#4DA3FF)',
              color: '#fff',
              p: isMobile ? 2 : 2.5,
              borderRadius: isMobile ? '12px 12px 0 0' : '16px 16px 0 0'
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <AccountBalanceWallet />
              <Typography fontWeight={600}>Record Payment</Typography>
            </Stack>
          </Box>

          <CardContent sx={{ p: isMobile ? 2 : 3 }}>
            {/* Vendor selector */}
            <Autocomplete
              options={vendors}
              getOptionLabel={v => `${v.vendorName} - ₹${v.balance}`}
              value={selectedVendor}
              onChange={(_, v) => handleVendorSelect(v)}
              renderInput={params => (
                <TextField
                  {...params}
                  label="Select Vendor"
                  size={isMobile ? 'small' : 'medium'}
                  fullWidth
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props} sx={{ py: isMobile ? 1 : 1.5 }}>
                  <Avatar sx={{ mr: 1, width: 32, height: 32 }}>
                    {option.vendorName[0]}
                  </Avatar>
                  <Box>
                    <Typography variant={isMobile ? 'body2' : 'body1'}>
                      {option.vendorName}
                    </Typography>
                    {option.phone && (
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Phone sx={{ fontSize: 12 }} />
                        <Typography variant="caption">{option.phone}</Typography>
                      </Stack>
                    )}
                  </Box>
                </Box>
              )}
            />

            {selectedVendor && (
              <>
                {/* Vendor balance summary */}
                <Paper sx={{ p: isMobile ? 1.5 : 2, mt: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
                  <Stack
                    direction={isMobile ? 'column' : 'row'}
                    justifyContent="space-between"
                    spacing={isMobile ? 1 : 0}
                  >
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Total Balance Owed
                      </Typography>
                      <Typography
                        variant={isMobile ? 'h6' : 'h5'}
                        color="error.main"
                        fontWeight={700}
                      >
                        ₹{selectedVendor.balance}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Pending Purchases
                      </Typography>
                      <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight={700}>
                        {loadingTransactions ? '...' : vendorTransactions.length}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>

                {/* Initial balance card */}
                {vendorInitialBalance > 0 && (
                  <Paper
                    sx={{
                      p: isMobile ? 1.5 : 2,
                      mt: 2,
                      bgcolor: '#e3f2fd',
                      borderRadius: 2,
                      border: '2px solid #1976d2'
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <InitialBalanceIcon color="primary" />
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Initial Balance
                          </Typography>
                          <Typography
                            variant={isMobile ? 'h6' : 'h5'}
                            color="primary.main"
                            fontWeight={700}
                          >
                            ₹{vendorInitialBalance}
                          </Typography>
                        </Box>
                      </Stack>
                      <Chip
                        label="From Vendor Creation"
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </Stack>
                  </Paper>
                )}

                {/* FIX: Informational banner when only initial balance is available */}
                {!loadingTransactions &&
                  vendorTransactions.length === 0 &&
                  vendorInitialBalance > 0 && (
                    <Alert
                      icon={<InfoOutlined />}
                      severity="info"
                      sx={{ mt: 2, borderRadius: 2 }}
                    >
                      No pending bills found. You can collect payment against the{' '}
                      <strong>Initial Balance</strong> of ₹{vendorInitialBalance}.
                    </Alert>
                  )}

                {/* FIX: Banner when vendor has no bills AND no initial balance */}
                {!loadingTransactions &&
                  vendorTransactions.length === 0 &&
                  vendorInitialBalance <= 0 && (
                    <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
                      This vendor has no pending bills and no initial balance to settle.
                    </Alert>
                  )}

                {/* Settlement Type Radio Group */}
                <FormControl component="fieldset" sx={{ mt: isMobile ? 2 : 3 }}>
                  <FormLabel
                    component="legend"
                    sx={{ fontSize: isMobile ? '0.9rem' : '1rem' }}
                  >
                    Settlement Type
                  </FormLabel>
                  <RadioGroup
                    row={!isMobile}
                    value={settleType}
                    onChange={e => {
                      setSettleType(e.target.value);
                      setPaymentAmount(''); // Reset amount when switching type
                    }}
                  >
                    <FormControlLabel
                      value="individual"
                      control={<Radio size={isMobile ? 'small' : 'medium'} />}
                      label={
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Person fontSize="small" />
                          <span>Individual</span>
                        </Stack>
                      }
                      disabled={vendorTransactions.length === 0}
                    />
                    <FormControlLabel
                      value="normal"
                      control={<Radio size={isMobile ? 'small' : 'medium'} />}
                      label={
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Equalizer fontSize="small" />
                          <span>Normal</span>
                        </Stack>
                      }
                      disabled={vendorTransactions.length === 0}
                    />
                    <FormControlLabel
                      value="initial"
                      control={<Radio size={isMobile ? 'small' : 'medium'} />}
                      label={
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <InitialBalanceIcon fontSize="small" />
                          <span>Initial Balance</span>
                        </Stack>
                      }
                      disabled={vendorInitialBalance <= 0}
                    />
                  </RadioGroup>

                  {/* Contextual hints */}
                  {vendorTransactions.length === 0 && vendorInitialBalance > 0 && (
                    <Typography
                      variant="caption"
                      color="primary.main"
                      sx={{ display: 'block', mt: 0.5 }}
                    >
                      ✅ Only "Initial Balance" payment is available for this vendor.
                    </Typography>
                  )}
                  {vendorInitialBalance <= 0 && settleType === 'initial' && (
                    <Typography
                      variant="caption"
                      color="error"
                      sx={{ display: 'block', mt: 0.5 }}
                    >
                      ❌ No initial balance available for this vendor.
                    </Typography>
                  )}
                </FormControl>

                {/* Payment Amount field */}
                <TextField
                  fullWidth
                  label="Payment Amount"
                  type="number"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  sx={{ mt: isMobile ? 1.5 : 2 }}
                  size={isMobile ? 'small' : 'medium'}
                  inputProps={{ min: 1, max: getMaxAmount() }}
                  InputProps={{
                    startAdornment: <Typography sx={{ mr: 0.5 }}>₹</Typography>
                  }}
                  // FIX: Helper text shows the correct max for the current settle type
                  helperText={getAmountHelperText()}
                  error={
                    !!paymentAmount &&
                    Number(paymentAmount) > getMaxAmount()
                  }
                />

                {/* Normal settle distribution preview */}
                {settleType === 'normal' && distributionPreview.length > 0 && (
                  <Paper
                    sx={{
                      mt: isMobile ? 2 : 3,
                      p: isMobile ? 1.5 : 2,
                      bgcolor: '#e8f5e8',
                      borderRadius: 2
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                      <DoneAll color="success" />
                      <Typography variant="subtitle2" fontWeight={600}>
                        Distribution Preview
                      </Typography>
                    </Stack>

                    {distributionPreview.map((item, index) => (
                      <Box key={item.id} sx={{ mb: 1 }}>
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

                    <Box sx={{ mt: 2, pt: 1, borderTop: '2px dashed #4caf50' }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography fontWeight={600}>Total</Typography>
                        <Typography fontWeight={700} color="success.main">
                          ₹
                          {distributionPreview
                            .reduce((sum, d) => sum + d.allocatedAmount, 0)
                            .toFixed(2)}
                        </Typography>
                      </Stack>
                    </Box>
                  </Paper>
                )}

                {/* Payment Method */}
                <Typography sx={{ mt: isMobile ? 2 : 3, mb: 1 }} fontWeight={600}>
                  Payment Method
                </Typography>
                {paymentModesGrid}

                {/* Submit button */}
                {/* FIX: Uses isPayButtonDisabled() which correctly handles all cases */}
                <Button
                  fullWidth
                  sx={{
                    mt: isMobile ? 2 : 3,
                    py: isMobile ? 1.2 : 1.5,
                    borderRadius: isMobile ? 3 : 4,
                    background: 'linear-gradient(135deg,#007AFF,#4DA3FF)',
                    fontSize: isMobile ? '0.9rem' : '1rem'
                  }}
                  variant="contained"
                  disabled={isPayButtonDisabled()}
                  startIcon={
                    processingPayment ? (
                      <CircularProgress size={18} color="inherit" />
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
                    : settleType === 'normal'
                    ? 'Pay & Distribute'
                    : 'Pay Initial Balance'}
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

        {/* ===== PAYMENT HISTORY ===== */}
        <Box sx={{ px: isMobile ? 1 : 0 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 1 }}
          >
            <Typography fontWeight={700}>Payment History</Typography>
            {!isMobile && (
              <ToggleButtonGroup
                size="small"
                value={filter}
                exclusive
                onChange={(_, v) => v && setFilter(v)}
              >
                <ToggleButton value="thisMonth">This Month</ToggleButton>
                <ToggleButton value="lastMonth">Last Month</ToggleButton>
                <ToggleButton value="all">All</ToggleButton>
              </ToggleButtonGroup>
            )}
          </Stack>

          {isMobile && (
            <Stack direction="row" spacing={1} sx={{ mb: 2, overflowX: 'auto', pb: 1 }}>
              {['thisMonth', 'lastMonth', 'all'].map(f => (
                <Chip
                  key={f}
                  label={f === 'thisMonth' ? 'This Month' : f === 'lastMonth' ? 'Last Month' : 'All'}
                  onClick={() => setFilter(f)}
                  color={filter === f ? 'primary' : 'default'}
                  variant={filter === f ? 'filled' : 'outlined'}
                />
              ))}
            </Stack>
          )}

          {paymentHistory.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 2 }}>
              <HistoryIcon
                sx={{ fontSize: 48, color: 'text.secondary', mb: 1, opacity: 0.5 }}
              />
              <Typography color="text.secondary">No payment history</Typography>
            </Paper>
          ) : (
            paymentHistory.map(p => (
              <Card key={p.id} sx={{ mb: 1.5, borderRadius: 2 }}>
                <CardContent sx={{ p: isMobile ? 1.5 : 2 }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontWeight={600} noWrap>
                        {p.vendorName || p.customerName}
                      </Typography>
                      <Typography variant="caption" display="block">
                        {p.paymentMode} • {formatDate(p.date)}
                      </Typography>
                      {p.productName && p.settledType !== 'initial' && (
                        <Typography variant="caption" display="block" noWrap>
                          {p.productName}
                        </Typography>
                      )}
                      {p.settledType === 'initial' && (
                        <Typography
                          variant="caption"
                          display="block"
                          color="primary.main"
                        >
                          Initial Balance Payment
                        </Typography>
                      )}
                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}
                      >
                        <Chip
                          label={
                            p.settledType === 'individual'
                              ? 'Individual'
                              : p.settledType === 'normal'
                              ? 'Normal'
                              : 'Initial'
                          }
                          size="small"
                          color={
                            p.settledType === 'individual'
                              ? 'primary'
                              : p.settledType === 'normal'
                              ? 'success'
                              : 'info'
                          }
                          variant="outlined"
                          sx={{
                            height: 20,
                            '& .MuiChip-label': { px: 1, fontSize: '0.7rem' }
                          }}
                        />
                        {p.distribution && (
                          <Chip
                            label={`${p.distribution.length} items`}
                            size="small"
                            variant="outlined"
                            sx={{
                              height: 20,
                              '& .MuiChip-label': { px: 1, fontSize: '0.7rem' }
                            }}
                          />
                        )}
                      </Stack>
                    </Box>
                    <Typography color="success.main" fontWeight={700} sx={{ ml: 1 }}>
                      ₹{p.amount}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            ))
          )}
        </Box>
      </Container>

      {/* Filter drawer (mobile only) */}
      {isMobile && <FilterDrawer />}

      {/* Bottom navigation (mobile only) */}
      {isMobile && (
        <Paper
          elevation={3}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            borderRadius: '16px 16px 0 0',
            overflow: 'hidden'
          }}
        >
          <BottomNavigation
            showLabels
            value={navValue}
            onChange={(_, newValue) => {
              setNavValue(newValue);
              if (newValue === 0) navigate('/');
              if (newValue === 1) navigate('/payment');
              if (newValue === 2) navigate('/vendors');
            }}
          >
            <BottomNavigationAction label="Home" icon={<HomeIcon />} />
            <BottomNavigationAction label="Payment" icon={<PaymentIcon />} />
            <BottomNavigationAction label="Vendors" icon={<StoreIcon />} />
          </BottomNavigation>
        </Paper>
      )}

      {/* Individual purchase selection dialog */}
      <Dialog
        open={selectPurchaseDialog}
        onClose={() => !processingPayment && setSelectPurchaseDialog(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: isMobile
            ? { borderRadius: 0, height: '100%', maxHeight: '100%', margin: 0 }
            : {}
        }}
      >
        <DialogTitle sx={{ p: isMobile ? 2 : 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight={700}>
              Select Purchase
            </Typography>
            <IconButton
              size="small"
              onClick={() => !processingPayment && setSelectPurchaseDialog(false)}
              disabled={processingPayment}
            >
              <Close />
            </IconButton>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {selectedVendor?.vendorName} • Paying ₹{paymentAmount}
          </Typography>
        </DialogTitle>

        <DialogContent dividers sx={{ p: isMobile ? 1 : 2 }}>
          {loadingTransactions ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : vendorTransactions.length === 0 ? (
            <Box sx={{ textAlign: 'center', p: 4 }}>
              <Inventory
                sx={{ fontSize: 48, color: 'text.secondary', mb: 2, opacity: 0.5 }}
              />
              <Typography color="text.secondary">No pending purchases</Typography>
            </Box>
          ) : (
            <List>
              {vendorTransactions.map((txn, index) => {
                const isSelected = selectedPurchase?.id === txn.id;
                const canPay = Number(paymentAmount) <= txn.remainingAmount;

                return (
                  <React.Fragment key={txn.id}>
                    <ListItem
                      button
                      selected={isSelected}
                      onClick={() => setSelectedPurchase(txn)}
                      sx={{
                        borderRadius: 2,
                        mb: 1,
                        p: isMobile ? 1.5 : 2,
                        border: isSelected ? '2px solid #007AFF' : '1px solid #e0e0e0',
                        bgcolor: isSelected ? '#e3f2fd' : 'white'
                      }}
                    >
                      <ListItemText
                        primary={
                          <Typography
                            fontWeight={600}
                            variant={isMobile ? 'body2' : 'body1'}
                          >
                            {getProductName(txn)}
                          </Typography>
                        }
                        secondary={
                          <>
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                              sx={{ mt: 0.5 }}
                            >
                              <CalendarToday sx={{ fontSize: 12 }} />
                              <Typography variant="caption">
                                {formatDate(txn.date)}
                              </Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                              <Typography variant="caption">
                                Total: ₹{txn.amount}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="error.main"
                                fontWeight={600}
                              >
                                Due: ₹{txn.remainingAmount}
                              </Typography>
                            </Stack>
                          </>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Chip
                          label={`₹${txn.remainingAmount}`}
                          size="small"
                          color={canPay ? (isSelected ? 'primary' : 'default') : 'error'}
                          variant={isSelected ? 'filled' : 'outlined'}
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < vendorTransactions.length - 1 && (
                      <Divider sx={{ my: 1 }} />
                    )}
                  </React.Fragment>
                );
              })}
            </List>
          )}
        </DialogContent>

        <DialogActions sx={{ p: isMobile ? 2 : 3 }}>
          <Button
            onClick={() => setSelectPurchaseDialog(false)}
            disabled={processingPayment}
            size={isMobile ? 'small' : 'medium'}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleIndividualPayment}
            disabled={
              !selectedPurchase ||
              processingPayment ||
              Number(paymentAmount) > (selectedPurchase?.remainingAmount ?? 0)
            }
            startIcon={processingPayment ? <CircularProgress size={20} /> : null}
            size={isMobile ? 'small' : 'medium'}
          >
            {processingPayment ? 'Processing...' : `Pay ₹${paymentAmount}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Payment;
