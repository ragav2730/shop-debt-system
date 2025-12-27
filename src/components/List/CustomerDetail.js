import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Chip,
  Button,
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
  CircularProgress,
  Avatar,
  Snackbar,
  Fab,
  Fade,
  Slide
} from '@mui/material';

import {
  ArrowBack,
  Delete,
  Phone,
  Receipt,
  Payment as PaymentIcon,
  Person,
  AttachMoney,
  History,
  CheckCircle,
  Close,
  Notifications,
  Warning
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
  
  const isProcessingRef = useRef(false);
  const lastPaymentTimeRef = useRef(0);

  const [customer, setCustomer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openPaymentDialog, setOpenPaymentDialog] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  
  const [notification, setNotification] = useState({
    show: false,
    message: '',
    type: 'success',
    amount: 0,
    productName: ''
  });

  const [paymentData, setPaymentData] = useState({
    amount: '',
    paymentMode: 'Cash',
    notes: ''
  });

  /* ---------- FETCH CUSTOMER ---------- */
  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        const snap = await getDoc(doc(db, 'customers', id));
        if (snap.exists()) {
          setCustomer({ id: snap.id, ...snap.data() });
        } else {
          showNotification('Customer not found', 'error');
          setTimeout(() => navigate('/customers'), 1500);
        }
      } catch {
        showNotification('Failed to load customer', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchCustomer();
  }, [id]);

  /* ---------- TRANSACTIONS ---------- */
  useEffect(() => {
    if (!id) return;
    return onSnapshot(
      query(collection(db, 'transactions'), where('customerId', '==', id)),
      snap => setTransactions(snap.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        remainingAmount: d.data().remainingAmount || d.data().amount || 0
      })))
    );
  }, [id]);

  /* ---------- PAYMENTS ---------- */
  useEffect(() => {
    if (!id) return;
    return onSnapshot(
      query(collection(db, 'payments'), where('customerId', '==', id)),
      snap => setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [id]);

  const showNotification = (message, type = 'success', amount = 0, productName = '') => {
    setNotification({
      show: true,
      message,
      type,
      amount,
      productName
    });

    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const validatePaymentAmount = (amount, transaction) => {
    const amt = parseFloat(amount);
    
    // Check if amount is a valid number
    if (isNaN(amt)) {
      showNotification('Please enter a valid number', 'error');
      return false;
    }
    
    // Prevent negative payments
    if (amt < 0) {
      showNotification('Amount cannot be negative', 'error');
      return false;
    }
    
    // Prevent zero payments
    if (amt === 0) {
      showNotification('Amount cannot be 0', 'error');
      return false;
    }
    
    // Minimum payment of ₹1
    if (amt < 1) {
      showNotification('Minimum payment is ₹1', 'error');
      return false;
    }
    
    // Maximum payment check - cannot exceed remaining amount
    const remaining = transaction.remainingAmount || transaction.amount || 0;
    if (amt > remaining) {
      showNotification(`Cannot exceed remaining amount of ₹${remaining.toFixed(2)}`, 'error');
      return false;
    }
    
    return true;
  };

  const canProcessPayment = () => {
    const now = Date.now();
    const timeSinceLastPayment = now - lastPaymentTimeRef.current;
    
    if (isProcessingRef.current) {
      showNotification('Payment is already being processed', 'warning');
      return false;
    }
    
    if (timeSinceLastPayment < 3000) {
      showNotification('Please wait before making another payment', 'warning');
      return false;
    }
    
    return true;
  };

  const handleProductPayment = async (transaction) => {
    // Prevent double-click
    if (!canProcessPayment()) return;
    
    // Validate amount with strict checks
    if (!validatePaymentAmount(paymentData.amount, transaction)) return;

    const amt = parseFloat(paymentData.amount);
    const remaining = transaction.remainingAmount || transaction.amount || 0;
    
    // Final validation - amount should be between 1 and remaining amount
    if (amt < 1) {
      showNotification('Payment must be at least ₹1', 'error');
      return;
    }
    
    if (amt > remaining) {
      showNotification(`Payment cannot exceed remaining balance of ₹${remaining.toFixed(2)}`, 'error');
      return;
    }

    // Set processing flags
    isProcessingRef.current = true;
    lastPaymentTimeRef.current = Date.now();
    setProcessingPayment(true);

    try {
      const newRemaining = remaining - amt;
      const newBalance = (customer.balance || 0) - amt;

      // Check for duplicate payment
      const recentPayments = await Promise.resolve(payments);
      const recentSimilarPayment = recentPayments.find(p => 
        p.transactionId === transaction.id && 
        p.amount === amt &&
        Date.now() - p.date?.toDate().getTime() < 5000
      );

      if (recentSimilarPayment) {
        showNotification('Similar payment was just recorded', 'warning');
        return;
      }

      // Record payment
      await addDoc(collection(db, 'payments'), {
        customerId: id,
        customerName: customer.customerName,
        transactionId: transaction.id,
        productName: transaction.productName,
        amount: amt,
        paymentMode: paymentData.paymentMode,
        previousBalance: customer.balance || 0,
        newBalance,
        notes: `For ${transaction.productName}: ${paymentData.notes}`,
        paymentType: 'product',
        date: serverTimestamp(),
        createdAt: serverTimestamp(),
        processedAt: Date.now()
      });

      // Update transaction
      await updateDoc(doc(db, 'transactions', transaction.id), {
        remainingAmount: Math.max(0, newRemaining),
        status: newRemaining <= 0 ? 'paid' : 'partial',
        lastPaymentDate: serverTimestamp()
      });

      // Update customer
      await updateDoc(doc(db, 'customers', id), {
        balance: newBalance,
        status: newBalance > 0 ? 'pending' : 'paid',
        updatedAt: serverTimestamp()
      });

      // Update local state
      setCustomer({ ...customer, balance: newBalance });
      setPaymentData({ amount: '', paymentMode: 'Cash', notes: '' });
      setOpenPaymentDialog(false);
      
      // Show success notification
      showNotification(
        `Payment of ₹${amt.toFixed(2)} recorded successfully`,
        'success',
        amt,
        transaction.productName
      );

    } catch (err) {
      console.error('Payment error:', err);
      showNotification('Payment failed. Please try again.', 'error');
    } finally {
      setTimeout(() => {
        isProcessingRef.current = false;
        setProcessingPayment(false);
      }, 2000);
    }
  };

  const handleAmountChange = (e) => {
    const value = e.target.value;
    
    // Prevent negative numbers and multiple decimal points
    if (value === '-' || value.startsWith('-')) {
      setPaymentData({ ...paymentData, amount: '' });
      return;
    }
    
    // Remove any non-numeric characters except decimal point
    const cleanValue = value.replace(/[^0-9.]/g, '');
    
    // Prevent multiple decimal points
    const parts = cleanValue.split('.');
    if (parts.length > 2) {
      return;
    }
    
    // Limit to 2 decimal places
    if (parts[1] && parts[1].length > 2) {
      return;
    }
    
    setPaymentData({ ...paymentData, amount: cleanValue });
  };

  const getAmountError = () => {
    if (!selectedTransaction || !paymentData.amount) return '';
    
    const amt = parseFloat(paymentData.amount);
    const remaining = selectedTransaction.remainingAmount || selectedTransaction.amount || 0;
    
    if (isNaN(amt)) return 'Enter a valid number';
    if (amt < 1) return 'Minimum payment is ₹1';
    if (amt > remaining) return `Cannot exceed ₹${remaining.toFixed(2)}`;
    return '';
  };

  const isAmountValid = () => {
    if (!paymentData.amount || !selectedTransaction) return false;
    
    const amt = parseFloat(paymentData.amount);
    const remaining = selectedTransaction.remainingAmount || selectedTransaction.amount || 0;
    
    return !isNaN(amt) && amt >= 1 && amt <= remaining;
  };

  const openPaymentDialogForProduct = (transaction) => {
    if (openPaymentDialog || processingPayment) return;
    
    const remaining = transaction.remainingAmount || transaction.amount || 0;
    
    setSelectedTransaction(transaction);
    setPaymentData({
      amount: remaining > 0 ? remaining.toString() : '',
      paymentMode: 'Cash',
      notes: `Payment for ${transaction.productName}`
    });
    setOpenPaymentDialog(true);
  };

  const handleDeleteCustomer = async () => {
    if (window.confirm('Delete this customer? All transactions will be lost.')) {
      try {
        await deleteDoc(doc(db, 'customers', id));
        showNotification('Customer deleted successfully', 'success');
        setTimeout(() => navigate('/customers'), 1500);
      } catch (err) {
        showNotification('Failed to delete customer', 'error');
      }
    }
  };

  const totalPurchases = transactions.reduce((t, x) => t + (x.amount || 0), 0);
  const totalPayments = payments.reduce((t, x) => t + (x.amount || 0), 0);
  const totalPendingByProduct = transactions.reduce((t, x) => t + (x.remainingAmount || x.amount || 0), 0);

  if (loading) {
    return (
      <Box sx={{ 
        minHeight: '60vh', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        p: 2
      }}>
        <CircularProgress size={40} />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      pb: 7,
      bgcolor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      {/* Payment Success Notification */}
      <Fade in={notification.show}>
        <Box
          sx={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2000,
            width: '90%',
            maxWidth: 400
          }}
        >
          <Slide direction="down" in={notification.show} mountOnEnter unmountOnExit>
            <Card
              elevation={4}
              sx={{
                borderRadius: 2,
                borderLeft: `4px solid ${notification.type === 'success' ? '#4caf50' : '#f44336'}`,
                bgcolor: 'white',
                animation: notification.type === 'success' ? 'pulse 2s infinite' : 'none'
              }}
            >
              <CardContent sx={{ p: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar
                    sx={{
                      bgcolor: notification.type === 'success' ? '#4caf5010' : '#f4433610',
                      color: notification.type === 'success' ? '#4caf50' : '#f44336'
                    }}
                  >
                    {notification.type === 'success' ? <CheckCircle /> : <Warning />}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {notification.message}
                    </Typography>
                    {notification.amount > 0 && (
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Amount:
                        </Typography>
                        <Typography variant="caption" fontWeight={700} color="success.main">
                          ₹{notification.amount.toFixed(2)}
                        </Typography>
                        {notification.productName && (
                          <>
                            <Divider orientation="vertical" flexItem />
                            <Typography variant="caption" color="text.secondary">
                              {notification.productName}
                            </Typography>
                          </>
                        )}
                      </Stack>
                    )}
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => setNotification(prev => ({ ...prev, show: false }))}
                  >
                    <Close fontSize="small" />
                  </IconButton>
                </Stack>
              </CardContent>
            </Card>
          </Slide>
        </Box>
      </Fade>

      {/* HEADER */}
      <Paper 
        sx={{ 
          p: 2, 
          borderRadius: 0,
          borderBottom: '1px solid #e0e0e0',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          bgcolor: 'white'
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton onClick={() => navigate(-1)} size="small">
            <ArrowBack />
          </IconButton>
          
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={600} noWrap>
              {customer.customerName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {customer.phone}
            </Typography>
          </Box>
          
          <IconButton 
            size="small" 
            color="error"
            onClick={handleDeleteCustomer}
            disabled={processingPayment}
          >
            <Delete fontSize="small" />
          </IconButton>
        </Stack>
      </Paper>

      {/* MAIN CONTENT */}
      <Container maxWidth="md" sx={{ px: 2, py: 2 }}>
        {/* BALANCE CARD */}
        <Card sx={{ 
          mb: 2, 
          borderRadius: 2,
          border: `2px solid ${customer.balance > 0 ? '#d32f2f' : '#4caf50'}`,
          bgcolor: 'white'
        }}>
          <CardContent sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Total Balance
                </Typography>
                <Typography 
                  variant="h4" 
                  fontWeight={700}
                  color={customer.balance > 0 ? '#d32f2f' : '#4caf50'}
                >
                  ₹{(customer.balance || 0).toFixed(0)}
                </Typography>
              </Box>
              
              <Chip
                label={customer.balance > 0 ? 'நிலுவை' : 'செலுத்தி'}
                size="small"
                color={customer.balance > 0 ? 'error' : 'success'}
                sx={{ fontWeight: 600 }}
              />
            </Stack>
          </CardContent>
        </Card>

        {/* QUICK STATS */}
        <Box sx={{ 
          display: 'flex', 
          gap: 1.5, 
          mb: 2,
          overflowX: 'auto',
          '&::-webkit-scrollbar': { display: 'none' }
        }}>
          <Card sx={{ 
            minWidth: 120, 
            p: 1.5, 
            borderRadius: 2,
            bgcolor: '#f0f7ff'
          }}>
            <Typography variant="caption" color="text.secondary">
              Purchases
            </Typography>
            <Typography variant="h6" fontWeight={600}>
              ₹{totalPurchases.toFixed(0)}
            </Typography>
          </Card>
          
          <Card sx={{ 
            minWidth: 120, 
            p: 1.5, 
            borderRadius: 2,
            bgcolor: '#f0f8f0'
          }}>
            <Typography variant="caption" color="text.secondary">
              Payments
            </Typography>
            <Typography variant="h6" fontWeight={600} color="success.main">
              ₹{totalPayments.toFixed(0)}
            </Typography>
          </Card>
          
          <Card sx={{ 
            minWidth: 120, 
            p: 1.5, 
            borderRadius: 2,
            bgcolor: '#fff0f0'
          }}>
            <Typography variant="caption" color="text.secondary">
              Remaining
            </Typography>
            <Typography variant="h6" fontWeight={600} color="error">
              ₹{totalPendingByProduct.toFixed(0)}
            </Typography>
          </Card>
        </Box>

        {/* PRODUCTS LIST */}
        <Card sx={{ mb: 2, borderRadius: 2 }}>
          <CardContent sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Receipt fontSize="small" color="primary" />
              <Typography variant="subtitle2" fontWeight={600}>
                Products (பொருட்கள்)
              </Typography>
              <Chip 
                label={transactions.length} 
                size="small" 
                sx={{ ml: 'auto' }}
              />
            </Stack>

            {transactions.length === 0 ? (
              <Box sx={{ py: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No products purchased
                </Typography>
              </Box>
            ) : (
              <Stack spacing={1.5}>
                {transactions.map(t => {
                  const remaining = t.remainingAmount || t.amount || 0;
                  const isPaid = remaining <= 0;
                  
                  return (
                    <Paper 
                      key={t.id}
                      sx={{ 
                        p: 1.5, 
                        borderRadius: 1.5,
                        borderLeft: `3px solid ${isPaid ? '#4caf50' : '#ff9800'}`,
                        bgcolor: 'white'
                      }}
                    >
                      <Stack spacing={1}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" fontWeight={600}>
                              {t.productName || 'Product'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {t.date?.toDate().toLocaleDateString('ta-IN')}
                            </Typography>
                          </Box>
                          
                          <Chip
                            label={isPaid ? 'செலுத்தி' : 'நிலுவை'}
                            size="small"
                            color={isPaid ? 'success' : 'warning'}
                            sx={{ height: 20, fontSize: '0.65rem' }}
                          />
                        </Stack>

                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Total
                            </Typography>
                            <Typography variant="body2">
                              ₹{(t.amount || 0).toFixed(0)}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="caption" color="text.secondary">
                              Remaining
                            </Typography>
                            <Typography 
                              variant="body2" 
                              fontWeight={600}
                              color={remaining > 0 ? 'error' : 'success.main'}
                            >
                              ₹{remaining.toFixed(0)}
                            </Typography>
                          </Box>
                        </Stack>

                        {!isPaid && (
                          <Button
                            fullWidth
                            variant="contained"
                            size="small"
                            disabled={processingPayment}
                            startIcon={
                              processingPayment && selectedTransaction?.id === t.id ? 
                              <CircularProgress size={16} color="inherit" /> : 
                              <AttachMoney />
                            }
                            onClick={() => {
                              if (!processingPayment) {
                                openPaymentDialogForProduct(t);
                              }
                            }}
                            sx={{ 
                              mt: 1,
                              borderRadius: 1,
                              py: 0.5,
                              fontSize: '0.75rem'
                            }}
                          >
                            {processingPayment && selectedTransaction?.id === t.id ? 
                              'Processing...' : 
                              `Settle ₹${remaining.toFixed(0)}`
                            }
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

        {/* PAYMENT HISTORY */}
        <Card sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <History fontSize="small" color="primary" />
              <Typography variant="subtitle2" fontWeight={600}>
                Payment History (செலுத்துதல் வரலாறு)
              </Typography>
              <Chip 
                label={payments.length} 
                size="small" 
                sx={{ ml: 'auto' }}
              />
            </Stack>

            {payments.length === 0 ? (
              <Box sx={{ py: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No payments yet
                </Typography>
              </Box>
            ) : (
              <Stack spacing={1}>
                {payments.slice(0, 5).map(p => (
                  <Paper 
                    key={p.id}
                    sx={{ 
                      p: 1.5, 
                      borderRadius: 1.5,
                      borderLeft: `3px solid #4caf50`,
                      bgcolor: '#f8fff8'
                    }}
                  >
                    <Stack spacing={0.5}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" fontWeight={600} color="success.main">
                          ₹{p.amount?.toFixed(0)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {p.date?.toDate().toLocaleDateString('ta-IN')}
                        </Typography>
                      </Stack>
                      
                      <Typography variant="caption">
                        {p.paymentMode}
                        {p.productName && ` • ${p.productName}`}
                      </Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Container>

      {/* PAYMENT DIALOG */}
      <Dialog 
        fullScreen 
        open={openPaymentDialog} 
        onClose={() => {
          if (!processingPayment) {
            setOpenPaymentDialog(false);
          }
        }}
        PaperProps={{
          sx: { 
            bgcolor: '#f5f5f5'
          }
        }}
      >
        <Box sx={{ 
          bgcolor: 'white',
          p: 2,
          borderBottom: '1px solid #e0e0e0',
          position: 'sticky',
          top: 0,
          zIndex: 1
        }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton 
              size="small" 
              onClick={() => {
                if (!processingPayment) {
                  setOpenPaymentDialog(false);
                }
              }}
              disabled={processingPayment}
            >
              <ArrowBack />
            </IconButton>
            <Typography variant="h6" fontWeight={600}>
              {selectedTransaction ? `Pay for ${selectedTransaction.productName}` : 'Record Payment'}
            </Typography>
          </Stack>
        </Box>

        <DialogContent sx={{ px: 2, py: 3 }}>
          {selectedTransaction && (
            <Card sx={{ mb: 3, borderRadius: 2 }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Product Details
                </Typography>
                <Stack spacing={1}>
                  <Typography variant="body1" fontWeight={600}>
                    {selectedTransaction.productName}
                  </Typography>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">
                      Total Amount
                    </Typography>
                    <Typography>₹{(selectedTransaction.amount || 0).toFixed(2)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">
                      Remaining
                    </Typography>
                    <Typography color="error" fontWeight={600}>
                      ₹{(selectedTransaction.remainingAmount || selectedTransaction.amount || 0).toFixed(2)}
                    </Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          )}

          <TextField
            fullWidth
            label="Amount"
            type="text"
            value={paymentData.amount}
            onChange={handleAmountChange}
            disabled={processingPayment}
            InputProps={{
              startAdornment: <Typography sx={{ mr: 1 }}>₹</Typography>,
              sx: { borderRadius: 2 }
            }}
            helperText={getAmountError() || `Enter amount between ₹1 and ₹${selectedTransaction ? (selectedTransaction.remainingAmount || selectedTransaction.amount || 0).toFixed(2) : '0'}`}
            error={!!getAmountError()}
            sx={{ mb: 2 }}
          />

          <TextField
            select
            fullWidth
            label="Payment Mode"
            value={paymentData.paymentMode}
            onChange={e => setPaymentData({ ...paymentData, paymentMode: e.target.value })}
            disabled={processingPayment}
            sx={{ mb: 2 }}
            SelectProps={{
              MenuProps: {
                PaperProps: {
                  sx: { maxHeight: 200 }
                }
              }
            }}
          >
            {['Cash', 'UPI', 'Bank Transfer', 'Card'].map(x => (
              <MenuItem key={x} value={x}>{x}</MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth
            label="Notes (Optional)"
            multiline
            rows={2}
            value={paymentData.notes}
            onChange={e => setPaymentData({ ...paymentData, notes: e.target.value })}
            disabled={processingPayment}
            sx={{ mb: 3 }}
          />
        </DialogContent>

        <Box sx={{ 
          p: 2, 
          bgcolor: 'white',
          borderTop: '1px solid #e0e0e0',
          position: 'sticky',
          bottom: 0
        }}>
          <Button
            fullWidth
            variant="contained"
            size="large"
            disabled={
              !isAmountValid() || 
              processingPayment
            }
            onClick={() => handleProductPayment(selectedTransaction)}
            sx={{ 
              borderRadius: 2,
              py: 1.5,
              fontWeight: 600
            }}
          >
            {processingPayment ? (
              <>
                <CircularProgress 
                  size={24} 
                  color="inherit" 
                  sx={{ mr: 1 }}
                />
                Processing...
              </>
            ) : (
              `Pay ₹${paymentData.amount || '0'}`
            )}
          </Button>
          
          {!isAmountValid() && paymentData.amount && (
            <Alert 
              severity="warning" 
              sx={{ mt: 2, borderRadius: 1 }}
              icon={<Warning />}
            >
              {getAmountError() || 'Please enter a valid amount'}
            </Alert>
          )}
        </Box>
      </Dialog>

      {/* FLOATING ACTION BUTTON */}
      {customer?.balance > 0 && !processingPayment && (
        <Fab
          color="primary"
          onClick={() => {
            const pendingTransaction = transactions.find(t => (t.remainingAmount || t.amount || 0) > 0);
            if (pendingTransaction) {
              openPaymentDialogForProduct(pendingTransaction);
            }
          }}
          disabled={processingPayment}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 1000
          }}
        >
          {processingPayment ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            <PaymentIcon />
          )}
        </Fab>
      )}

      {/* Add CSS animation */}
      <style jsx="true">{`
        @keyframes pulse {
          0% { transform: translateX(-50%) scale(1); }
          50% { transform: translateX(-50%) scale(1.02); }
          100% { transform: translateX(-50%) scale(1); }
        }
      `}</style>
    </Box>
  );
};

export default CustomerDetail;