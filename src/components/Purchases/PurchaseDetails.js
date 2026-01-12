import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Stack, Card, CardContent, Avatar, Chip,
  Button, IconButton, Divider, LinearProgress, Grid, Paper,
  CircularProgress, Alert, List, ListItem, ListItemIcon, ListItemText,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Snackbar, Tabs, Tab, useMediaQuery
} from '@mui/material';
import {
  ArrowBack, Delete, WhatsApp, Phone, Person,
  AccountBalanceWallet, Payment, Add, Refresh
} from '@mui/icons-material';

import {
  doc,
  getDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  addDoc
} from 'firebase/firestore';

import { db } from '../../services/firebase';

const PRIMARY_BLUE = '#1976d2';

const PurchaseDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width:900px)');

  const [purchase, setPurchase] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [paymentDialog, setPaymentDialog] = useState(false);
  const [newPayment, setNewPayment] = useState({ amount: '', mode: 'Cash', notes: '' });
  const [updating, setUpdating] = useState(false);

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  /* ---------------- FETCH PURCHASE ---------------- */
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);

      const snap = await getDoc(doc(db, 'transactions', id));
      if (!snap.exists()) {
        setSnackbar({ open: true, message: 'Purchase not found', severity: 'error' });
        setLoading(false);
        return;
      }

      const data = snap.data();
      setPurchase({ id: snap.id, ...data });

      if (data.customerId) {
        const cSnap = await getDoc(doc(db, 'customers', data.customerId));
        if (cSnap.exists()) {
          setCustomer({ id: cSnap.id, ...cSnap.data() });
        }
      }

      setLoading(false);
    };

    fetch();
  }, [id]);

  /* ---------------- PAYMENTS LISTENER ---------------- */
  useEffect(() => {
    if (!purchase) return;

    const q = query(
      collection(db, 'payments'),
      where('transactionId', '==', purchase.id)
    );

    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        date: d.data().date?.toDate?.() || d.data().date
      }));
      setPayments(list);
    });
  }, [purchase?.id]);

  /* ---------------- ADD PAYMENT (FIXED) ---------------- */
  const handleAddPayment = async () => {
    const amt = Number(newPayment.amount);
    if (!amt || amt <= 0) {
      setSnackbar({ open: true, message: 'Invalid amount', severity: 'error' });
      return;
    }

    setUpdating(true);

    try {
      // ✅ ADD PAYMENT (NOT updateDoc)
      await addDoc(collection(db, 'payments'), {
        transactionId: purchase.id,
        customerId: purchase.customerId,
        customerName: customer?.customerName || '',
        amount: amt,
        paymentMode: newPayment.mode,
        notes: newPayment.notes || '',
        date: new Date(),
        createdAt: new Date()
      });

      // ✅ UPDATE CUSTOMER BALANCE
      if (customer) {
        await updateDoc(doc(db, 'customers', customer.id), {
          balance: Math.max(0, (customer.balance || 0) - amt)
        });
      }

      setSnackbar({ open: true, message: 'Payment added', severity: 'success' });
      setPaymentDialog(false);
      setNewPayment({ amount: '', mode: 'Cash', notes: '' });

    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: 'Payment failed', severity: 'error' });
    } finally {
      setUpdating(false);
    }
  };

  /* ---------------- DELETE PURCHASE ---------------- */
  const handleDelete = async () => {
    if (!window.confirm('Delete this purchase?')) return;
    await deleteDoc(doc(db, 'transactions', id));
    navigate('/purchases');
  };

  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const remaining = Math.max(0, (purchase?.amount || 0) - totalPaid);
  const isPaid = remaining === 0;

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;
  }

  return (
    <Container maxWidth="md" sx={{ mt: 3 }}>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/purchases')}>
        Back
      </Button>

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700}>
            Purchase Amount: ₹{purchase.amount}
          </Typography>

          <Typography color="success.main">
            Paid: ₹{totalPaid}
          </Typography>

          <Typography color="error.main">
            Balance: ₹{remaining}
          </Typography>

          <LinearProgress
            value={(totalPaid / purchase.amount) * 100}
            variant="determinate"
            sx={{ mt: 2 }}
          />
        </CardContent>
      </Card>

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between">
            <Typography fontWeight={700}>Payments</Typography>
            <Button
              startIcon={<Add />}
              disabled={isPaid}
              onClick={() => setPaymentDialog(true)}
            >
              Add Payment
            </Button>
          </Stack>

          {payments.map(p => (
            <Box key={p.id} sx={{ mt: 1 }}>
              ₹{p.amount} • {p.paymentMode}
            </Box>
          ))}
        </CardContent>
      </Card>

      <Button
        fullWidth
        color="error"
        variant="outlined"
        sx={{ mt: 3 }}
        startIcon={<Delete />}
        onClick={handleDelete}
      >
        Delete Purchase
      </Button>

      {/* PAYMENT DIALOG */}
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)}>
        <DialogTitle>Add Payment</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Amount"
            type="number"
            sx={{ mt: 1 }}
            value={newPayment.amount}
            onChange={e => setNewPayment({ ...newPayment, amount: e.target.value })}
          />
          <TextField
            fullWidth
            select
            label="Mode"
            sx={{ mt: 2 }}
            value={newPayment.mode}
            onChange={e => setNewPayment({ ...newPayment, mode: e.target.value })}
            SelectProps={{ native: true }}
          >
            <option>Cash</option>
            <option>UPI</option>
            <option>Card</option>
            <option>Bank</option>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddPayment} disabled={updating}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        message={snackbar.message}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      />
    </Container>
  );
};

export default PurchaseDetails;
