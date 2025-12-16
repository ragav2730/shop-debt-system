import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Stack,
  Divider,
  IconButton,
  Alert,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  CircularProgress
} from '@mui/material';
import {
  ArrowBack,
  Delete,
  Phone,
  Email,
  LocationOn,
  Receipt,
  Payment as PaymentIcon,
  Description,
  Person
} from '@mui/icons-material';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  addDoc
} from 'firebase/firestore';
import { db } from '../../services/firebase';

const CustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openPaymentDialog, setOpenPaymentDialog] = useState(false);

  const [paymentData, setPaymentData] = useState({
    amount: '',
    paymentMode: 'Cash',
    notes: ''
  });

  /* ---------------- FETCH CUSTOMER ---------------- */
  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        const snap = await getDoc(doc(db, 'customers', id));
        if (snap.exists()) {
          setCustomer({ id: snap.id, ...snap.data() });
        } else {
          setError('Customer not found');
        }
      } catch {
        setError('Failed to load customer');
      } finally {
        setLoading(false);
      }
    };
    fetchCustomer();
  }, [id]);

  /* ---------------- TRANSACTIONS ---------------- */
  useEffect(() => {
    if (!id) return;
    return onSnapshot(
      query(collection(db, 'transactions'), where('customerId', '==', id)),
      snap => setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [id]);

  /* ---------------- PAYMENTS ---------------- */
  useEffect(() => {
    if (!id) return;
    return onSnapshot(
      query(collection(db, 'payments'), where('customerId', '==', id)),
      snap => setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [id]);

  const handleAddPayment = async () => {
    const amt = parseFloat(paymentData.amount);
    if (!amt || amt <= 0) return setError('Enter valid amount');

    const newBalance = (customer.balance || 0) - amt;

    await addDoc(collection(db, 'payments'), {
      customerId: id,
      customerName: customer.customerName,
      amount: amt,
      paymentMode: paymentData.paymentMode,
      previousBalance: customer.balance || 0,
      newBalance,
      notes: paymentData.notes,
      date: serverTimestamp(),
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db, 'customers', id), {
      balance: newBalance,
      status: newBalance > 0 ? 'pending' : 'paid',
      updatedAt: serverTimestamp()
    });

    setCustomer({ ...customer, balance: newBalance });
    setPaymentData({ amount: '', paymentMode: 'Cash', notes: '' });
    setOpenPaymentDialog(false);
    setSuccess('Payment recorded successfully');
  };

  const totalPurchases = transactions.reduce((t, x) => t + (x.amount || 0), 0);
  const totalPayments = payments.reduce((t, x) => t + (x.amount || 0), 0);

  if (loading) {
    return (
      <Box sx={{ minHeight: '60vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg">

      {/* ACTION BUTTONS */}
      <Box
        sx={{
          mt: 3,
          mb: 3,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2
        }}
      >
        <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => navigate('/')}>
          Back
        </Button>

        <Button
          variant="contained"
          startIcon={<PaymentIcon />}
          disabled={!customer.balance || customer.balance <= 0}
          onClick={() => setOpenPaymentDialog(true)}
        >
          Record Payment
        </Button>

        <IconButton color="error" onClick={() => deleteDoc(doc(db, 'customers', id)).then(() => navigate('/'))}>
          <Delete />
        </IconButton>
      </Box>

      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* CUSTOMER CARD */}
      <Paper sx={{ p: { xs: 2, sm: 4 }, mb: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  width: { xs: 45, sm: 60 },
                  height: { xs: 45, sm: 60 },
                  bgcolor: '#d32f2f',
                  borderRadius: '50%',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: '#fff'
                }}
              >
                <Person sx={{ fontSize: { xs: 24, sm: 32 } }} />
              </Box>

              <Box>
                <Typography sx={{ fontSize: { xs: '1.4rem', sm: '2rem' } }} color="primary">
                  {customer.customerName}
                </Typography>
                <Chip
                  size="small"
                  label={customer.status?.toUpperCase()}
                  color={customer.status === 'paid' ? 'success' : 'error'}
                />
              </Box>
            </Stack>

            <Grid container spacing={2} sx={{ mt: 2 }}>
              <Grid item xs={12} sm={6}>
                <Stack direction="row" spacing={1}><Phone />{customer.phone}</Stack>
              </Grid>
              {customer.email && (
                <Grid item xs={12} sm={6}>
                  <Stack direction="row" spacing={1}><Email />{customer.email}</Stack>
                </Grid>
              )}
              {customer.address && (
                <Grid item xs={12}>
                  <Stack direction="row" spacing={1}><LocationOn />{customer.address}</Stack>
                </Grid>
              )}
              {customer.description && (
                <Grid item xs={12}>
                  <Stack direction="row" spacing={1}><Description />{customer.description}</Stack>
                </Grid>
              )}
            </Grid>
          </Grid>

          {/* SUMMARY */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="primary">Financial Summary</Typography>
                <Divider sx={{ my: 2 }} />
                <Typography>Total Purchases: ₹{totalPurchases.toFixed(2)}</Typography>
                <Typography color="success.main">Payments: ₹{totalPayments.toFixed(2)}</Typography>
                <Typography
                  sx={{ fontSize: { xs: '1.6rem', sm: '2rem' } }}
                  color={(customer.balance || 0) > 0 ? 'error' : 'success.main'}
                >
                  Balance: ₹{(customer.balance || 0).toFixed(2)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* TRANSACTIONS */}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 2 }}>
            <Typography color="primary"><Receipt /> Purchases</Typography>
            <Divider sx={{ mb: 2 }} />

            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Category</TableCell>
                    <TableCell>Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.map(t => (
                    <TableRow key={t.id}>
                      <TableCell>{t.date?.toDate().toLocaleDateString()}</TableCell>
                      <TableCell>{t.productName}</TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{t.category}</TableCell>
                      <TableCell>₹{t.amount?.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* PAYMENTS */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 2 }}>
            <Typography color="primary"><PaymentIcon /> Payments</Typography>
            <Divider sx={{ mb: 2 }} />

            <Stack spacing={2}>
              {payments.map(p => (
                <Card key={p.id} variant="outlined">
                  <CardContent>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between">
                      <Typography>{p.date?.toDate().toLocaleDateString()}</Typography>
                      <Typography color="success.main">₹{p.amount}</Typography>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* PAYMENT DIALOG */}
      <Dialog open={openPaymentDialog} fullWidth maxWidth="sm">
        <DialogTitle>Record Payment</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Amount" name="amount" type="number" margin="normal"
            value={paymentData.amount}
            onChange={e => setPaymentData({ ...paymentData, amount: e.target.value })}
          />
          <TextField select fullWidth label="Mode" margin="normal"
            value={paymentData.paymentMode}
            onChange={e => setPaymentData({ ...paymentData, paymentMode: e.target.value })}
          >
            {['Cash', 'UPI', 'Bank Transfer', 'Card'].map(x => (
              <MenuItem key={x} value={x}>{x}</MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPaymentDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddPayment}>Save</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default CustomerDetail;
