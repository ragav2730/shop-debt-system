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
  ToggleButtonGroup
} from '@mui/material';

import {
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  orderBy
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
  Phone
} from '@mui/icons-material';

import { Link as RouterLink } from 'react-router-dom';

const Payment = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
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

  /* ================= FETCH DATA ================= */
  useEffect(() => {
    const q1 = query(collection(db, 'customers'));
    const unsub1 = onSnapshot(q1, snap => {
      setCustomers(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(c => c.balance > 0)
      );
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
    const d = timestamp.toDate();
    return (
      d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }) +
      ' · ' +
      d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit'
      })
    );
  };

  /* ================= HANDLE PAYMENT ================= */
  const handlePayment = async () => {
    if (!selectedCustomer || !paymentAmount) return;

    const amt = Number(paymentAmount);
    if (amt <= 0 || amt > selectedCustomer.balance) {
      setSnackbar({
        open: true,
        message: 'Invalid amount',
        severity: 'error'
      });
      return;
    }

    setProcessingPayment(true);

    try {
      const newBalance = selectedCustomer.balance - amt;

      await updateDoc(doc(db, 'customers', selectedCustomer.id), {
        balance: newBalance,
        status: newBalance > 0 ? 'pending' : 'paid',
        lastPaymentDate: serverTimestamp()
      });

      await addDoc(collection(db, 'payments'), {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.customerName,
        phone: selectedCustomer.phone,
        amount: amt,
        paymentMode,
        previousBalance: selectedCustomer.balance,
        newBalance,
        date: serverTimestamp()
      });

      setShowSuccess(true);
      setSnackbar({
        open: true,
        message: 'Payment recorded successfully',
        severity: 'success'
      });

      setTimeout(() => {
        setSelectedCustomer(null);
        setPaymentAmount('');
        setProcessingPayment(false);
        setShowSuccess(false);
      }, 1500);
    } catch {
      setSnackbar({
        open: true,
        message: 'Payment failed',
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
            Payment Successful
          </Alert>
        </Box>
      </Fade>

      <Container sx={{ py: 2 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
          Payment Collection
        </Typography>

        {/* PAYMENT FORM (UNCHANGED) */}
        <Card sx={{ borderRadius: 4, mb: 3 }}>
          <Box
            sx={{
              background: 'linear-gradient(135deg,#007AFF,#4DA3FF)',
              color: '#fff',
              p: 2.5,
              borderRadius: '16px 16px 0 0'
            }}
          >
            <Stack direction="row" spacing={1}>
              <AccountBalanceWallet />
              <Typography fontWeight={600}>Record Payment</Typography>
            </Stack>
          </Box>

          <CardContent>
            <Autocomplete
              options={customers}
              getOptionLabel={o => `${o.customerName} - ₹${o.balance}`}
              value={selectedCustomer}
              onChange={(_, v) => {
                setSelectedCustomer(v);
                setPaymentAmount('');
              }}
              renderInput={params => (
                <TextField {...params} label="Select Customer" size="small" />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Avatar sx={{ mr: 1 }}>{option.customerName[0]}</Avatar>
                  <Box>
                    <Typography>{option.customerName}</Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Phone sx={{ fontSize: 14 }} />
                      <Typography variant="caption">{option.phone}</Typography>
                    </Stack>
                  </Box>
                </Box>
              )}
            />

            {selectedCustomer && (
              <>
                <TextField
                  fullWidth
                  label="Payment Amount"
                  type="number"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  sx={{ mt: 3 }}
                />

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

                <Button
                  fullWidth
                  sx={{
                    mt: 3,
                    py: 1.5,
                    borderRadius: 4,
                    background: 'linear-gradient(135deg,#007AFF,#4DA3FF)'
                  }}
                  variant="contained"
                  disabled={processingPayment}
                  startIcon={
                    processingPayment ? (
                      <CircularProgress size={18} />
                    ) : (
                      <PaymentIcon />
                    )
                  }
                  onClick={handlePayment}
                >
                  Record Payment
                </Button>
              </>
            )}
          </CardContent>
        </Card>

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
                  <Typography fontWeight={600}>{p.customerName}</Typography>
                  <Typography variant="caption">
                    {p.paymentMode} • {formatDate(p.date)}
                  </Typography>
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
            <Button component={RouterLink} to="/list">Customers</Button>
          </Stack>
        </Paper>
      )}
    </Box>
  );
};

export default Payment;
