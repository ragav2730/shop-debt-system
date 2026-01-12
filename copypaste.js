after adding cusotomer it is not updating in CustomerList.js and in Customer Details

import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Chip,
  TextField,
  MenuItem,
  Box,
  IconButton,
  Button,
  Card,
  CardContent,
  Stack,
  useTheme,
  useMediaQuery,
  Grid,
  Avatar,
  Divider,
  InputAdornment
} from '@mui/material';

import {
  PersonAdd,
  Search,
  FilterList,
  Phone,
  ArrowForward,
  Pending
} from '@mui/icons-material';

import { Link as RouterLink } from 'react-router-dom';
import {
  collection,
  query,
  onSnapshot,
  orderBy
} from 'firebase/firestore';
import { db } from '../../services/firebase';

const categories = ['All', 'Cement', 'Bricks', 'Steel', 'Sheet', 'Other'];

const CustomerList = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [customers, setCustomers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  /* ================= LOAD CUSTOMERS ================= */
  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'customers'), orderBy('createdAt', 'desc')),
      snap => {
        setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );
  }, []);

  /* ================= LOAD TRANSACTIONS ================= */
  useEffect(() => {
    return onSnapshot(
      collection(db, 'transactions'),
      snap => {
        setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );
  }, []);

  /* ================= FILTER LOGIC ================= */
  useEffect(() => {
    // Only customers with balance
    let activeCustomers = customers.filter(c => (c.balance || 0) > 0);

    // Category filter (BASED ON TRANSACTIONS)
    if (selectedCategory !== 'All') {
      const customerIdsWithCategory = new Set(
        transactions
          .filter(t =>
            t.category === selectedCategory &&
            (t.remainingAmount ?? t.amount) > 0
          )
          .map(t => t.customerId)
      );

      activeCustomers = activeCustomers.filter(c =>
        customerIdsWithCategory.has(c.id)
      );
    }

    // Search
    if (searchTerm) {
      activeCustomers = activeCustomers.filter(c =>
        c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm)
      );
    }

    setFilteredCustomers(activeCustomers);
  }, [customers, transactions, selectedCategory, searchTerm]);

  /* ================= HELPERS ================= */
  const getInitials = name =>
    name?.split(' ').map(n => n[0]).join('').slice(0, 2);

  const handlePhoneCall = phone => {
    window.location.href = `tel:${phone}`;
  };

  /* ================= CUSTOMER CARD ================= */
  const CustomerCard = ({ customer }) => (
    <Card sx={{ mb: 2, borderRadius: 4, bgcolor: '#FFF7F7', boxShadow: 'none' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between">
          <Stack direction="row" spacing={2}>
            <Avatar sx={{ bgcolor: '#C62828' }}>
              {getInitials(customer.customerName)}
            </Avatar>
            <Box>
              <Typography fontWeight={700}>
                {customer.customerName}
              </Typography>
              <Button
                onClick={() => handlePhoneCall(customer.phone)}
                startIcon={<Phone fontSize="small" />}
                sx={{ p: 0, textTransform: 'none', color: '#B71C1C' }}
              >
                {customer.phone}
              </Button>
            </Box>
          </Stack>

          <IconButton
            component={RouterLink}
            to={`/list/${customer.id}`}
            sx={{ bgcolor: '#FFECEC' }}
          >
            <ArrowForward />
          </IconButton>
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        <Stack direction="row" justifyContent="space-between">
          <Typography color="error.main" fontWeight={700}>
            ₹{customer.balance}
          </Typography>
          <Chip
            size="small"
            label="Pending"
            icon={<Pending />}
            sx={{ bgcolor: '#FFD6D6', color: '#C62828' }}
          />
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Container maxWidth="lg">
      <Paper sx={{ p: 3, borderRadius: 4 }}>
        <Stack direction="row" justifyContent="space-between" mb={3}>
          <Typography variant="h5" fontWeight={800} color="#C62828">
            Pending Customers
          </Typography>

          <Button
            component={RouterLink}
            to="/entry"
            startIcon={<PersonAdd />}
            variant="contained"
          >
            Add Customer
          </Button>
        </Stack>

        {/* SEARCH */}
        <TextField
          fullWidth
          size="small"
          label="Search"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            )
          }}
        />

        {/* CATEGORY */}
        <TextField
          fullWidth
          select
          size="small"
          label="Category"
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          sx={{ mb: 2 }}
        >
          {categories.map(c => (
            <MenuItem key={c} value={c}>{c}</MenuItem>
          ))}
        </TextField>

        {filteredCustomers.map(c => (
          <CustomerCard key={c.id} customer={c} />
        ))}

        {filteredCustomers.length === 0 && (
          <Typography align="center" color="text.secondary">
            No matching customers
          </Typography>
        )}
      </Paper>
    </Container>
  );
};

export default CustomerList;

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Paper, Typography, Box, Button, Card, CardContent,
  Stack, IconButton, Dialog, DialogContent, TextField,
  MenuItem, CircularProgress, Grid, Divider, Chip,
  Alert, Avatar, Slide
} from '@mui/material';

import {
  ArrowBack, AttachMoney, Payment as PaymentIcon, Replay,
  Receipt, History, Paid, PendingActions, Close
} from '@mui/icons-material';

import {
  doc, getDoc, collection, query, where,
  onSnapshot, updateDoc, addDoc, serverTimestamp,
  orderBy, getDocs, runTransaction
} from 'firebase/firestore';

import { db } from '../../services/firebase';

const CustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const lockRef = useRef(false);

  const [customer, setCustomer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openPay, setOpenPay] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [payData, setPayData] = useState({ amount: '', mode: 'Cash' });
  const [processing, setProcessing] = useState(false);

  const [refundDialog, setRefundDialog] = useState(false);
  const [refundPayment, setRefundPayment] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundProcessing, setRefundProcessing] = useState(false); // Added

  const [notification, setNotification] = useState({
    show: false,
    message: '',
    type: 'success',
    amount: 0
  });

  // Helper function to get product name
  const getProductName = useCallback((transaction) => {
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
    
    return name || 'Product';
  }, []);

  /* ================= CUSTOMER ================= */
  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        const snap = await getDoc(doc(db, 'customers', id));
        if (!snap.exists()) {
          navigate('/customers');
          return;
        }
        setCustomer({ id: snap.id, ...snap.data() });
        setLoading(false);
      } catch (error) {
        console.error('Error fetching customer:', error);
        setLoading(false);
      }
    };
    
    fetchCustomer();
  }, [id, navigate]);

  /* ================= TRANSACTIONS ================= */
  useEffect(() => {
    if (!id) return;
    
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'transactions'), 
        where('customerId', '==', id), 
        orderBy('date', 'desc')
      ),
      (snap) => {
        const updatedTransactions = snap.docs.map(d => {
          const data = d.data();
          // Ensure we have valid remainingAmount
          const amount = data.amount || 0;
          const remainingAmount = data.remainingAmount ?? amount;
          
          return {
            id: d.id,
            ...data,
            amount,
            remainingAmount,
            date: data.date?.toDate?.() || data.date || new Date()
          };
        });
        
        console.log('Transactions updated:', updatedTransactions);
        setTransactions(updatedTransactions);
      },
      (error) => {
        console.error('Error listening to transactions:', error);
      }
    );
    
    return () => unsubscribe();
  }, [id]);

  /* ================= PAYMENTS ================= */
  useEffect(() => {
    if (!id) return;
    
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'payments'),
        where('customerId', '==', id),
        orderBy('date', 'desc') // Changed from 'createdAt' to 'date'
      ),
      (snap) => {
        const updatedPayments = snap.docs.map(d => ({ 
          id: d.id, 
          ...d.data(),
          // Ensure date is properly handled
          date: d.data().date?.toDate?.() || d.data().date || new Date()
        }));
        
        console.log('Payments updated:', updatedPayments);
        setPayments(updatedPayments);
      },
      (error) => {
        console.error('Error listening to payments:', error);
      }
    );
    
    return () => unsubscribe();
  }, [id]);

  const showNotification = (message, type = 'success', amount = 0) => {
    setNotification({
      show: true,
      message,
      type,
      amount
    });

    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  /* ================= PAY ================= */
  const handlePay = async () => {
    if (lockRef.current || !selectedTxn || !customer) {
      showNotification('Payment cannot be processed', 'error');
      return;
    }

    const amt = Number(payData.amount);
    if (amt <= 0 || amt > selectedTxn.remainingAmount) {
      showNotification('Invalid amount', 'error');
      return;
    }

    if (amt > customer.balance) {
      showNotification(`Cannot exceed customer balance of ₹${customer.balance}`, 'error');
      return;
    }

    lockRef.current = true;
    setProcessing(true);

    try {
      // Calculate new values
      const newRemaining = selectedTxn.remainingAmount - amt;
      const newBalance = customer.balance - amt;
      
      console.log('Payment details:', {
        customerId: id,
        transactionId: selectedTxn.id,
        amount: amt,
        oldRemaining: selectedTxn.remainingAmount,
        newRemaining,
        oldBalance: customer.balance,
        newBalance
      });

      // Update customer
      await updateDoc(doc(db, 'customers', id), {
        balance: newBalance,
        status: newBalance > 0 ? 'pending' : 'paid',
        updatedAt: serverTimestamp()
      });

      // Update transaction
      await updateDoc(doc(db, 'transactions', selectedTxn.id), {
        remainingAmount: newRemaining,
        status: newRemaining <= 0 ? 'paid' : 'partial',
        lastPaymentDate: serverTimestamp()
      });

      // If balance becomes 0, mark all transactions as paid
      if (newBalance === 0) {
        const allTxnsQuery = query(
          collection(db, 'transactions'), 
          where('customerId', '==', id)
        );
        const allTxnsSnapshot = await getDocs(allTxnsQuery);
        
        const updatePromises = [];
        allTxnsSnapshot.forEach((docSnap) => {
          const txn = docSnap.data();
          const remaining = txn.remainingAmount || txn.amount || 0;
          
          if (remaining > 0 && docSnap.id !== selectedTxn.id) {
            updatePromises.push(
              updateDoc(docSnap.ref, {
                remainingAmount: 0,
                status: 'paid',
                lastPaymentDate: serverTimestamp()
              })
            );
          }
        });
        
        await Promise.all(updatePromises);
      }

      // Record payment - Use consistent field names
      const paymentData = {
        customerId: id,
        customerName: customer.customerName,
        transactionId: selectedTxn.id,
        productName: getProductName(selectedTxn),
        amount: amt,
        paymentMode: payData.mode,
        previousBalance: customer.balance,
        newBalance: newBalance,
        type: 'payment',
        notes: `Payment for ${getProductName(selectedTxn)}`,
        date: serverTimestamp(), // Use 'date' field consistently
        createdAt: serverTimestamp()
      };
      
      console.log('Saving payment:', paymentData);
      await addDoc(collection(db, 'payments'), paymentData);

      // Update local state immediately for better UX
      setCustomer(prev => ({
        ...prev,
        balance: newBalance,
        status: newBalance > 0 ? 'pending' : 'paid'
      }));

      // Update transactions in local state
      setTransactions(prev => prev.map(t => {
        if (t.id === selectedTxn.id) {
          return {
            ...t,
            remainingAmount: newRemaining,
            status: newRemaining <= 0 ? 'paid' : 'partial'
          };
        }
        // If balance is 0, mark all as paid
        if (newBalance === 0) {
          return {
            ...t,
            remainingAmount: 0,
            status: 'paid'
          };
        }
        return t;
      }));

      setOpenPay(false);
      setPayData({ amount: '', mode: 'Cash' });
      
      if (newBalance === 0) {
        showNotification(`All products fully paid! Customer balance is now ₹0`, 'success', amt);
      } else {
        showNotification(`Payment of ₹${amt} recorded successfully`, 'success', amt);
      }
      
    } catch (err) {
      console.error('Payment error:', err);
      showNotification(err.message || 'Payment failed. Please try again.', 'error');
    } finally {
      setTimeout(() => {
        lockRef.current = false;
        setProcessing(false);
      }, 1000);
    }
  };

  /* ================= REFUND ================= */
  const handleRefund = async () => {
    // Prevent concurrent refund processing
    if (lockRef.current || refundProcessing) {
      showNotification('Another operation is in progress', 'error');
      return;
    }

    const amt = Number(refundAmount);
    if (amt <= 0) {
      showNotification('Invalid refund amount', 'error');
      return;
    }

    if (!refundPayment) {
      showNotification('No payment selected for refund', 'error');
      return;
    }

    lockRef.current = true;
    setRefundProcessing(true);

    try {
      // Find the transaction for this refund
      const transaction = transactions.find(t => t.id === refundPayment.transactionId);
      if (!transaction) {
        showNotification('Original transaction not found', 'error');
        return;
      }

      const txnRemaining = transaction.remainingAmount || transaction.amount || 0;
      const txnAmount = transaction.amount || 0;
      
      // Validate refund doesn't exceed original amount
      if (amt + txnRemaining > txnAmount) {
        showNotification(`Refund cannot exceed original transaction amount of ₹${txnAmount}`, 'error');
        return;
      }

      const newRemaining = txnRemaining + amt;
      const newBalance = customer.balance + amt;

      // Update customer
      await updateDoc(doc(db, 'customers', id), {
        balance: newBalance,
        status: newBalance > 0 ? 'pending' : 'paid',
        updatedAt: serverTimestamp()
      });

      // Update transaction
      await updateDoc(doc(db, 'transactions', refundPayment.transactionId), {
        remainingAmount: newRemaining,
        status: newRemaining >= txnAmount ? 'pending' : 'partial',
        lastPaymentDate: serverTimestamp()
      });

      // Record refund payment
      const refundData = {
        customerId: id,
        customerName: customer.customerName,
        transactionId: refundPayment.transactionId,
        productName: refundPayment.productName || getProductName(refundPayment),
        amount: -amt,
        paymentMode: refundPayment.paymentMode,
        previousBalance: customer.balance,
        newBalance: newBalance,
        type: 'refund',
        notes: `Refund for ${refundPayment.productName || getProductName(refundPayment)}`,
        date: serverTimestamp(),
        createdAt: serverTimestamp()
      };
      
      console.log('Saving refund:', refundData);
      await addDoc(collection(db, 'payments'), refundData);

      // Update local state
      setCustomer(prev => ({
        ...prev,
        balance: newBalance,
        status: newBalance > 0 ? 'pending' : 'paid'
      }));

      setTransactions(prev => prev.map(t => {
        if (t.id === refundPayment.transactionId) {
          return {
            ...t,
            remainingAmount: newRemaining,
            status: newRemaining >= txnAmount ? 'pending' : 'partial'
          };
        }
        return t;
      }));

      setRefundDialog(false);
      setRefundPayment(null);
      setRefundAmount('');
      
      showNotification(`Refund of ₹${amt} processed successfully`, 'success', amt);
      
    } catch (err) {
      console.error('Refund error:', err);
      showNotification(err.message || 'Refund failed. Please try again.', 'error');
    } finally {
      setTimeout(() => {
        lockRef.current = false;
        setRefundProcessing(false);
      }, 1000);
    }
  };

  const formatDate = useCallback((date) => {
    if (!date) return 'N/A';
    try {
      const d = date.toDate ? date.toDate() : new Date(date);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return 'N/A';
    }
  }, []);

  // Calculate statistics
  const totalPurchases = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalPayments = payments
    .filter(p => p.type === 'payment')
    .reduce((sum, p) => sum + (Math.abs(p.amount) || 0), 0);
  const totalRefunds = payments
    .filter(p => p.type === 'refund')
    .reduce((sum, p) => sum + (Math.abs(p.amount) || 0), 0);
  const netPayments = totalPayments - totalRefunds;
  const customerBalance = customer?.balance || 0;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      {/* Notification */}
      <Slide direction="down" in={notification.show} mountOnEnter unmountOnExit>
        <Box sx={{ 
          position: 'fixed', 
          top: 20, 
          left: '50%', 
          transform: 'translateX(-50%)', 
          zIndex: 2000, 
          width: '90%', 
          maxWidth: 400 
        }}>
          <Alert
            severity={notification.type}
            action={
              <IconButton 
                size="small" 
                onClick={() => setNotification(prev => ({ ...prev, show: false }))}
              >
                <Close fontSize="small" />
              </IconButton>
            }
          >
            <Typography variant="body2" fontWeight={600}>
              {notification.message}
              {notification.amount > 0 && (
                <Typography component="span" color="inherit" fontWeight={700}>
                  {' '}₹{notification.amount}
                </Typography>
              )}
            </Typography>
          </Alert>
        </Box>
      </Slide>

      {/* Header */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <IconButton onClick={() => navigate(-1)}><ArrowBack /></IconButton>
        <Box>
          <Typography variant="h5" fontWeight={700}>{customer.customerName}</Typography>
          <Typography variant="body2" color="text.secondary">{customer.phone}</Typography>
        </Box>
      </Stack>

      {/* Balance Card */}
      <Card sx={{ mb: 3, borderRadius: 2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="body2" color="text.secondary">Total Balance</Typography>
              <Typography variant="h3" color={customerBalance > 0 ? 'error.main' : 'success.main'}>
                ₹{customerBalance}
              </Typography>
            </Box>
            <Chip
              label={customerBalance > 0 ? 'Pending' : 'Paid'}
              color={customerBalance > 0 ? 'error' : 'success'}
              icon={customerBalance > 0 ? <PendingActions /> : <Paid />}
            />
          </Stack>
          
          {/* Quick Stats */}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">Purchases</Typography>
              <Typography variant="h6">₹{totalPurchases}</Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">Payments</Typography>
              <Typography variant="h6" color="success.main">₹{netPayments}</Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">Pending</Typography>
              <Typography variant="h6" color="error.main">₹{customerBalance}</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Products Purchased Section */}
      <Card sx={{ mb: 3, borderRadius: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <Receipt color="primary" />
            <Typography variant="h6" fontWeight={700}>Products Purchased ({transactions.length})</Typography>
          </Stack>
          
          {transactions.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              No products purchased yet
            </Typography>
          ) : (
            <Stack spacing={2}>
              {transactions.map(t => {
                const remaining = t.remainingAmount || 0;
                const isPaid = remaining <= 0;
                const canSettle = remaining > 0 && customerBalance > 0;
                const productName = getProductName(t);
                
                return (
                  <Paper 
                    key={t.id} 
                    sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      borderLeft: `4px solid ${isPaid ? '#4caf50' : '#ff9800'}` 
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="subtitle1" fontWeight={600}>
                            {productName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(t.date)}
                          </Typography>
                          {t.category && t.company && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {t.category} • {t.company}
                            </Typography>
                          )}
                        </Box>
                        <Chip
                          label={isPaid ? 'Paid' : 'Pending'}
                          size="small"
                          color={isPaid ? 'success' : 'warning'}
                        />
                      </Stack>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">Total</Typography>
                          <Typography variant="body1">₹{t.amount || 0}</Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">Paid</Typography>
                          <Typography variant="body1" color="success.main">
                            ₹{((t.amount || 0) - remaining)}
                          </Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">Remaining</Typography>
                          <Typography variant="body1" color="error.main" fontWeight={600}>
                            ₹{remaining}
                          </Typography>
                        </Grid>
                      </Grid>
                      
                      {!isPaid && (
                        <Button
                          variant="contained"
                          color="error"
                          fullWidth
                          startIcon={<AttachMoney />}
                          disabled={!canSettle || processing || refundProcessing}
                          onClick={() => {
                            setSelectedTxn(t);
                            setPayData({ 
                              amount: Math.min(remaining, customerBalance), 
                              mode: 'Cash' 
                            });
                            setOpenPay(true);
                          }}
                          size="small"
                        >
                          SETTLE ₹{Math.min(remaining, customerBalance)}
                        </Button>
                      )}
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Payment History Section */}
      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <History color="primary" />
            <Typography variant="h6" fontWeight={700}>Payment History ({payments.length})</Typography>
          </Stack>
          
          {payments.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              No payment history yet
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              {payments.map(p => {
                const paymentProductName = p.productName || getProductName(p);
                const isRefund = p.amount < 0;
                const amount = Math.abs(p.amount);
                
                return (
                  <Paper 
                    key={p.id} 
                    sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      borderLeft: `4px solid ${isRefund ? '#f44336' : '#4caf50'}` 
                    }}
                  >
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography 
                          variant="body1" 
                          fontWeight={600} 
                          color={isRefund ? 'error.main' : 'success.main'}
                        >
                          {isRefund ? '🔙 Refund' : '💰 Payment'}: ₹{amount}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(p.date)}
                        </Typography>
                      </Stack>
                      
                      <Typography variant="body2">
                        {paymentProductName} • {p.paymentMode}
                      </Typography>
                      
                      {p.notes && (
                        <Typography variant="caption" color="text.secondary">
                          {p.notes}
                        </Typography>
                      )}
                      
                      {!isRefund && (
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          startIcon={<Replay />}
                          onClick={() => {
                            setRefundPayment(p);
                            setRefundAmount(amount);
                            setRefundDialog(true);
                          }}
                          disabled={processing || refundProcessing} // Added disabled state
                          sx={{ mt: 1, alignSelf: 'flex-start' }}
                        >
                          Reverse Payment
                        </Button>
                      )}
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Pay Dialog */}
      <Dialog 
        open={openPay} 
        onClose={() => !processing && !refundProcessing && setOpenPay(false)} 
        maxWidth="xs" 
        fullWidth
      >
        <DialogContent>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Settle Payment
          </Typography>
          
          {selectedTxn && (
            <Paper sx={{ p: 2, mb: 3, bgcolor: '#fff8e1' }}>
              <Typography variant="subtitle2" fontWeight={600}>
                {getProductName(selectedTxn)}
              </Typography>
              <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                <Typography variant="caption">Remaining:</Typography>
                <Typography variant="body2" fontWeight={600} color="error.main">
                  ₹{selectedTxn.remainingAmount}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption">Customer Balance:</Typography>
                <Typography variant="body2" fontWeight={600}>
                  ₹{customerBalance}
                </Typography>
              </Stack>
            </Paper>
          )}
          
          <TextField
            fullWidth
            label="Amount"
            type="number"
            value={payData.amount}
            onChange={e => setPayData({ ...payData, amount: e.target.value })}
            InputProps={{
              startAdornment: <Typography sx={{ mr: 1 }}>₹</Typography>,
            }}
            sx={{ mb: 2 }}
            disabled={processing || refundProcessing}
          />
          
          <TextField
            select
            fullWidth
            label="Payment Mode"
            value={payData.mode}
            onChange={e => setPayData({ ...payData, mode: e.target.value })}
            sx={{ mb: 3 }}
            disabled={processing || refundProcessing}
          >
            {['Cash', 'UPI', 'Bank Transfer', 'Card', 'Cheque'].map(m => (
              <MenuItem key={m} value={m}>{m}</MenuItem>
            ))}
          </TextField>
          
          <Button
            fullWidth
            variant="contained"
            color="error"
            size="large"
            startIcon={processing ? <CircularProgress size={20} color="inherit" /> : <PaymentIcon />}
            onClick={handlePay}
            disabled={processing || refundProcessing || !payData.amount || Number(payData.amount) <= 0}
          >
            {processing ? 'Processing...' : 'Confirm Payment'}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog 
        open={refundDialog} 
        onClose={() => !refundProcessing && setRefundDialog(false)} 
        maxWidth="xs" 
        fullWidth
      >
        <DialogContent>
          <Typography variant="h6" fontWeight={700} color="error" gutterBottom>
            Reverse Payment
          </Typography>
          
          {refundPayment && (
            <Paper sx={{ p: 2, mb: 3, bgcolor: '#ffebee' }}>
              <Typography variant="subtitle2" fontWeight={600}>
                {refundPayment.productName || getProductName(refundPayment)}
              </Typography>
              <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                <Typography variant="caption">Original Amount:</Typography>
                <Typography variant="body2" fontWeight={600}>
                  ₹{Math.abs(refundPayment.amount)}
                </Typography>
              </Stack>
            </Paper>
          )}
          
          <TextField
            fullWidth
            label="Refund Amount"
            type="number"
            value={refundAmount}
            onChange={e => setRefundAmount(e.target.value)}
            InputProps={{
              startAdornment: <Typography sx={{ mr: 1 }}>₹</Typography>,
            }}
            sx={{ mb: 3 }}
            disabled={refundProcessing || processing}
          />
          
          <Button
            fullWidth
            variant="contained"
            color="error"
            size="large"
            onClick={handleRefund}
            disabled={refundProcessing || processing || !refundAmount || Number(refundAmount) <= 0}
            startIcon={refundProcessing ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {refundProcessing ? 'Processing Refund...' : 'Confirm Refund'}
          </Button>
        </DialogContent>
      </Dialog>
    </Container>
  );
};

export default CustomerDetail;

correct it accordingly without any logic error there should immediate updation in everything 
