import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Stack,
  Card,
  CardContent,
  Avatar,
  Chip,
  Button,
  IconButton,
  Divider,
  LinearProgress,
  Grid,
  Paper,
  useTheme,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Fab,
  useMediaQuery,
  Badge,
  Tabs,
  Tab,
  Fade
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Delete,
  Share,
  WhatsApp,
  Phone,
  Person,
  ShoppingBag,
  AccountBalanceWallet,
  Payment,
  Receipt,
  TrendingUp,
  AttachMoney,
  CalendarToday,
  Description,
  Category,
  LocalOffer,
  Money,
  CheckCircle,
  PendingActions,
  Download,
  Email,
  Print,
  MoreVert,
  Add,
  Refresh,
  History,
  TrendingDown,
  ArrowUpward,
  ArrowDownward
} from '@mui/icons-material';
import { doc, getDoc, deleteDoc, collection, query, where, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

const PRIMARY_BLUE = '#1976d2';

const PurchaseDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [purchase, setPurchase] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [newPayment, setNewPayment] = useState({ amount: '', notes: '', mode: 'Cash' });
  const [updating, setUpdating] = useState(false);

  /* -------------------- FETCH DATA -------------------- */
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch purchase
        const purchaseDoc = await getDoc(doc(db, 'transactions', id));
        if (!purchaseDoc.exists()) {
          setSnackbar({ open: true, message: 'Purchase not found', severity: 'error' });
          setLoading(false);
          return;
        }
        
        const purchaseData = { 
          id: purchaseDoc.id, 
          ...purchaseDoc.data(),
          date: purchaseDoc.data().date?.toDate?.() || purchaseDoc.data().date
        };
        setPurchase(purchaseData);

        // Fetch customer
        if (purchaseData.customerId) {
          const customerDoc = await getDoc(doc(db, 'customers', purchaseData.customerId));
          if (customerDoc.exists()) {
            const customerData = { id: customerDoc.id, ...customerDoc.data() };
            setCustomer(customerData);
            
            // Listen for customer updates
            const customerUnsub = onSnapshot(doc(db, 'customers', customerData.id), (doc) => {
              if (doc.exists()) {
                setCustomer({ id: doc.id, ...doc.data() });
              }
            });
            
            return () => customerUnsub();
          }
        }
      } catch (error) {
        console.error('Error fetching purchase:', error);
        setSnackbar({ open: true, message: 'Error loading purchase', severity: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  /* -------------------- REAL-TIME PAYMENT UPDATES -------------------- */
  useEffect(() => {
    if (!purchase) return;

    // Listen for payments related to this purchase
    const paymentsQuery = query(
      collection(db, 'payments'),
      where('transactionId', '==', purchase.id)
    );
    
    const unsubscribePayments = onSnapshot(paymentsQuery, (snapshot) => {
      const paymentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate?.() || doc.data().date
      }));
      setPayments(paymentsData);
      
      // Calculate updated remaining amount
      const totalPaid = paymentsData.reduce((sum, payment) => sum + (payment.amount || 0), 0);
      const purchaseAmount = purchase.amount || 0;
      const updatedRemaining = Math.max(0, purchaseAmount - totalPaid);
      
      // Update purchase remaining amount in local state
      setPurchase(prev => ({
        ...prev,
        calculatedRemaining: updatedRemaining,
        totalPaid,
        paymentCount: paymentsData.length
      }));
      
      // Update in Firebase if different
      if (purchase.remainingAmount !== updatedRemaining) {
        updatePurchaseRemaining(updatedRemaining);
      }
    });

    return () => unsubscribePayments();
  }, [purchase?.id]);

  /* -------------------- UPDATE PURCHASE REMAINING -------------------- */
  const updatePurchaseRemaining = async (newRemaining) => {
    try {
      await updateDoc(doc(db, 'transactions', purchase.id), {
        remainingAmount: newRemaining,
        lastUpdated: new Date()
      });
    } catch (error) {
      console.error('Error updating purchase:', error);
    }
  };

  /* -------------------- CALCULATIONS -------------------- */
  const calculatePurchaseStats = () => {
    if (!purchase) return {};
    
    const purchaseAmount = purchase.amount || 0;
    const remaining = purchase.calculatedRemaining || 
                     purchase.remainingAmount || 
                     purchase.amount || 0;
    const totalPaid = purchase.totalPaid || purchaseAmount - remaining;
    const isPaid = remaining === 0 && purchaseAmount > 0;
    const progress = purchaseAmount > 0 ? (totalPaid / purchaseAmount) * 100 : 100;
    const status = isPaid ? 'paid' : 
                  totalPaid > 0 ? 'partial' : 'pending';

    return {
      purchaseAmount,
      remaining,
      totalPaid,
      isPaid,
      progress,
      status,
      lastPayment: payments.length > 0 ? payments[payments.length - 1] : null
    };
  };

  /* -------------------- HANDLERS -------------------- */
  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this purchase? This action cannot be undone.')) {
      return;
    }
    
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'transactions', id));
      setSnackbar({ open: true, message: 'Purchase deleted successfully', severity: 'success' });
      setTimeout(() => navigate('/purchases'), 1500);
    } catch (error) {
      console.error('Error deleting purchase:', error);
      setSnackbar({ open: true, message: 'Failed to delete purchase', severity: 'error' });
      setDeleting(false);
    }
  };

  const handleAddPayment = async () => {
    if (!newPayment.amount || parseFloat(newPayment.amount) <= 0) {
      setSnackbar({ open: true, message: 'Please enter a valid amount', severity: 'error' });
      return;
    }

    setUpdating(true);
    try {
      const paymentData = {
        transactionId: purchase.id,
        customerId: purchase.customerId,
        amount: parseFloat(newPayment.amount),
        paymentMode: newPayment.mode,
        notes: newPayment.notes,
        date: new Date(),
        productName: purchase.productName,
        customerName: customer?.customerName || 'Unknown Customer'
      };

      // Add payment to Firebase
      const paymentRef = doc(collection(db, 'payments'));
      await updateDoc(paymentRef, paymentData);

      // Update customer balance
      if (customer) {
        const newBalance = Math.max(0, (customer.balance || 0) - parseFloat(newPayment.amount));
        await updateDoc(doc(db, 'customers', customer.id), {
          balance: newBalance
        });
      }

      setSnackbar({ open: true, message: 'Payment added successfully', severity: 'success' });
      setPaymentDialog(false);
      setNewPayment({ amount: '', notes: '', mode: 'Cash' });
    } catch (error) {
      console.error('Error adding payment:', error);
      setSnackbar({ open: true, message: 'Failed to add payment', severity: 'error' });
    } finally {
      setUpdating(false);
    }
  };

  const handleShareWhatsApp = () => {
    const stats = calculatePurchaseStats();
    const message = `*Purchase Details*\n\n` +
                   `Product: ${purchase.productName}\n` +
                   `Amount: ₹${stats.purchaseAmount}\n` +
                   `Paid: ₹${stats.totalPaid}\n` +
                   `Balance: ₹${stats.remaining}\n` +
                   `Status: ${stats.status.toUpperCase()}\n\n` +
                   `Generated from Shop Debt System`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  const handleDownloadReceipt = () => {
    // Generate receipt logic here
    setSnackbar({ open: true, message: 'Receipt generated for download', severity: 'info' });
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  /* -------------------- FORMATTERS -------------------- */
  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString('en-IN')}`;
  };

  /* -------------------- LOADING -------------------- */
  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: '#f5f7fb'
      }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!purchase) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fb', p: 3 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/purchases')}>
          Back to Purchases
        </Button>
        <Alert severity="error" sx={{ mt: 2 }}>
          Purchase not found
        </Alert>
      </Box>
    );
  }

  const stats = calculatePurchaseStats();

  /* -------------------- MOBILE UI -------------------- */
  if (isMobile) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fb', pb: 8 }}>
        {/* Fixed Header */}
        <Paper
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bgcolor: PRIMARY_BLUE,
            color: 'white',
            px: 2,
            py: 2,
            zIndex: 1100,
            borderRadius: 0,
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton onClick={() => navigate('/purchases')} sx={{ color: 'white' }}>
              <ArrowBack />
            </IconButton>
            <Box sx={{ flex: 1 }}>
              <Typography fontSize={16} fontWeight={700} noWrap>
                {purchase.productName}
              </Typography>
              <Typography fontSize={12} sx={{ opacity: 0.9 }}>
                {formatDate(purchase.date)}
              </Typography>
            </Box>
            <IconButton onClick={handleRefresh} sx={{ color: 'white' }}>
              <Refresh />
            </IconButton>
          </Stack>
        </Paper>

        {/* Content */}
        <Box sx={{ pt: '64px', p: 2 }}>
          {/* Status Card */}
          <Card sx={{ borderRadius: 3, mb: 2 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Chip
                  label={stats.status.toUpperCase()}
                  color={stats.isPaid ? 'success' : 'warning'}
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
                <Typography fontWeight={700} fontSize={20} color={PRIMARY_BLUE}>
                  {formatCurrency(stats.purchaseAmount)}
                </Typography>
              </Stack>

              {/* Progress */}
              <Box sx={{ mt: 2 }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography fontSize={12} color="text.secondary">
                    Payment Progress
                  </Typography>
                  <Typography fontSize={12} fontWeight={600}>
                    {stats.progress.toFixed(0)}%
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={stats.progress}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: 'rgba(0,0,0,0.08)',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: stats.isPaid ? '#4CAF50' : PRIMARY_BLUE,
                      borderRadius: 3
                    }
                  }}
                />
              </Box>

              {/* Amounts */}
              <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid item xs={6}>
                  <Card variant="outlined" sx={{ borderRadius: 2, p: 1.5, textAlign: 'center' }}>
                    <Typography fontSize={10} color="text.secondary">
                      Paid
                    </Typography>
                    <Typography fontWeight={700} color="success.main" fontSize={16}>
                      {formatCurrency(stats.totalPaid)}
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={6}>
                  <Card variant="outlined" sx={{ borderRadius: 2, p: 1.5, textAlign: 'center' }}>
                    <Typography fontSize={10} color="text.secondary">
                      Balance
                    </Typography>
                    <Typography fontWeight={700} color="error.main" fontSize={16}>
                      {formatCurrency(stats.remaining)}
                    </Typography>
                  </Card>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Paper sx={{ borderRadius: 3, mb: 2 }}>
            <Tabs
              value={activeTab}
              onChange={(e, newValue) => setActiveTab(newValue)}
              variant="fullWidth"
              sx={{
                '& .MuiTab-root': {
                  fontSize: 12,
                  minHeight: 48
                }
              }}
            >
              <Tab label="Details" icon={<Description />} iconPosition="start" />
              <Tab label="Payments" icon={<Payment />} iconPosition="start" />
              <Tab label="Customer" icon={<Person />} iconPosition="start" />
            </Tabs>
          </Paper>

          {/* Tab Content */}
          {activeTab === 0 && (
            <Card sx={{ borderRadius: 3, mb: 2 }}>
              <CardContent>
                <List dense>
                  <ListItem>
                    <ListItemIcon><Category /></ListItemIcon>
                    <ListItemText 
                      primary="Product Name" 
                      secondary={purchase.productName || 'N/A'}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemIcon><CalendarToday /></ListItemIcon>
                    <ListItemText 
                      primary="Purchase Date" 
                      secondary={formatDate(purchase.date)}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemIcon><LocalOffer /></ListItemIcon>
                    <ListItemText 
                      primary="Unit Price" 
                      secondary={formatCurrency(purchase.unitPrice || purchase.amount)}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemIcon><Money /></ListItemIcon>
                    <ListItemText 
                      primary="Quantity" 
                      secondary={purchase.quantity || '1'}
                    />
                  </ListItem>
                  {purchase.description && (
                    <>
                      <Divider />
                      <ListItem>
                        <ListItemIcon><Description /></ListItemIcon>
                        <ListItemText 
                          primary="Description" 
                          secondary={purchase.description}
                          secondaryTypographyProps={{ sx: { fontSize: 12 } }}
                        />
                      </ListItem>
                    </>
                  )}
                </List>
              </CardContent>
            </Card>
          )}

          {activeTab === 1 && (
            <Card sx={{ borderRadius: 3, mb: 2 }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography fontWeight={600}>Payment History</Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Add />}
                    onClick={() => setPaymentDialog(true)}
                    disabled={stats.isPaid}
                  >
                    Add Payment
                  </Button>
                </Stack>

                {payments.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Typography color="text.secondary">No payments yet</Typography>
                  </Box>
                ) : (
                  <Stack spacing={1}>
                    {payments.map((payment, index) => (
                      <Card key={payment.id} variant="outlined" sx={{ borderRadius: 2 }}>
                        <CardContent sx={{ py: 1.5, px: 2 }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Box>
                              <Typography fontSize={12} color="text.secondary">
                                {formatDate(payment.date)}
                              </Typography>
                              <Typography fontSize={10} color="text.secondary">
                                {payment.paymentMode}
                              </Typography>
                            </Box>
                            <Typography fontWeight={700} color="success.main">
                              {formatCurrency(payment.amount)}
                            </Typography>
                          </Stack>
                          {payment.notes && (
                            <Typography fontSize={10} color="text.secondary" sx={{ mt: 0.5 }}>
                              {payment.notes}
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 2 && customer && (
            <Card sx={{ borderRadius: 3, mb: 2 }}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                  <Avatar sx={{ bgcolor: PRIMARY_BLUE }}>
                    {customer.customerName?.[0]?.toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography fontWeight={600}>{customer.customerName}</Typography>
                    <Typography fontSize={12} color="text.secondary">
                      {customer.phone}
                    </Typography>
                  </Box>
                </Stack>

                <List dense>
                  <ListItem>
                    <ListItemIcon><Phone /></ListItemIcon>
                    <ListItemText primary={customer.phone} />
                  </ListItem>
                  {customer.email && (
                    <ListItem>
                      <ListItemIcon><Email /></ListItemIcon>
                      <ListItemText primary={customer.email} />
                    </ListItem>
                  )}
                  <ListItem>
                    <ListItemIcon><AccountBalanceWallet /></ListItemIcon>
                    <ListItemText 
                      primary="Current Balance"
                      secondary={formatCurrency(customer.balance || 0)}
                      secondaryTypographyProps={{
                        color: customer.balance > 0 ? 'error.main' : 'success.main',
                        fontWeight: 600
                      }}
                    />
                  </ListItem>
                </List>

                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => navigate(`/customers/${customer.id}`)}
                  sx={{ mt: 1 }}
                >
                  View Full Profile
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card sx={{ borderRadius: 3, mb: 2 }}>
            <CardContent>
              <Typography fontWeight={600} sx={{ mb: 2 }}>Quick Actions</Typography>
              <Stack spacing={1}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<Payment />}
                  onClick={() => setPaymentDialog(true)}
                  disabled={stats.isPaid}
                >
                  {stats.isPaid ? 'Fully Paid' : 'Make Payment'}
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<WhatsApp />}
                  onClick={handleShareWhatsApp}
                >
                  Share via WhatsApp
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Download />}
                  onClick={handleDownloadReceipt}
                >
                  Download Receipt
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  color="error"
                  startIcon={deleting ? <CircularProgress size={18} /> : <Delete />}
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  Delete Purchase
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* Payment Dialog */}
        <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)} fullScreen={isMobile}>
          <DialogTitle>Add Payment</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                label="Amount"
                type="number"
                value={newPayment.amount}
                onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>₹</Typography>
                }}
                helperText={`Balance: ${formatCurrency(stats.remaining)}`}
              />
              <TextField
                fullWidth
                label="Payment Mode"
                select
                value={newPayment.mode}
                onChange={(e) => setNewPayment({...newPayment, mode: e.target.value})}
                SelectProps={{
                  native: true,
                }}
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Card">Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
              </TextField>
              <TextField
                fullWidth
                label="Notes (Optional)"
                multiline
                rows={2}
                value={newPayment.notes}
                onChange={(e) => setNewPayment({...newPayment, notes: e.target.value})}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPaymentDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleAddPayment} 
              variant="contained"
              disabled={updating || !newPayment.amount}
            >
              {updating ? <CircularProgress size={20} /> : 'Add Payment'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar({...snackbar, open: false})}
          message={snackbar.message}
        />
      </Box>
    );
  }

  /* -------------------- DESKTOP UI -------------------- */
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fb', pb: 4 }}>
      {/* Header */}
      <Box sx={{
        bgcolor: PRIMARY_BLUE,
        color: 'white',
        px: 4,
        py: 3,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        position: 'relative'
      }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <IconButton onClick={() => navigate('/purchases')} sx={{ color: 'white' }}>
            <ArrowBack />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography fontSize={24} fontWeight={700}>
              Purchase Details
            </Typography>
            <Typography sx={{ opacity: 0.9 }}>
              {purchase.productName} • {formatDate(purchase.date)}
            </Typography>
          </Box>
          <IconButton onClick={handleRefresh} sx={{ color: 'white' }}>
            <Refresh />
          </IconButton>
          <IconButton onClick={handleShareWhatsApp} sx={{ color: 'white' }}>
            <Share />
          </IconButton>
        </Stack>
      </Box>

      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Grid container spacing={3}>
          {/* Left Column - Purchase Details */}
          <Grid item xs={12} md={8}>
            {/* Main Purchase Card */}
            <Card sx={{ borderRadius: 3, mb: 3, overflow: 'hidden' }}>
              <CardContent sx={{ p: 3 }}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Product Name
                        </Typography>
                        <Typography variant="h6" fontWeight={700}>
                          {purchase.productName}
                        </Typography>
                      </Box>
                      
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Purchase Date
                        </Typography>
                        <Typography fontWeight={600}>
                          {formatDate(purchase.date)}
                        </Typography>
                      </Box>
                      
                      {purchase.description && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary">
                            Description
                          </Typography>
                          <Typography>
                            {purchase.description}
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Box sx={{ 
                      p: 2, 
                      bgcolor: `${PRIMARY_BLUE}08`, 
                      borderRadius: 2,
                      height: '100%'
                    }}>
                      <Stack spacing={2}>
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary">
                            Amount
                          </Typography>
                          <Typography variant="h4" fontWeight={800} color={PRIMARY_BLUE}>
                            {formatCurrency(stats.purchaseAmount)}
                          </Typography>
                        </Box>
                        
                        <Box>
                          <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                            <Typography variant="subtitle2" color="text.secondary">
                              Payment Status
                            </Typography>
                            <Chip
                              label={stats.status.toUpperCase()}
                              color={stats.isPaid ? 'success' : 'warning'}
                              size="small"
                              sx={{ fontWeight: 600 }}
                            />
                          </Stack>
                          
                          <LinearProgress
                            variant="determinate"
                            value={stats.progress}
                            sx={{
                              height: 8,
                              borderRadius: 3,
                              bgcolor: 'rgba(0,0,0,0.08)',
                              '& .MuiLinearProgress-bar': {
                                bgcolor: stats.isPaid ? '#4CAF50' : PRIMARY_BLUE,
                                borderRadius: 3
                              }
                            }}
                          />
                        </Box>
                        
                        <Grid container spacing={1}>
                          <Grid item xs={6}>
                            <Card variant="outlined" sx={{ p: 1.5, borderRadius: 2, textAlign: 'center' }}>
                              <Typography variant="caption" color="text.secondary">
                                Paid Amount
                              </Typography>
                              <Typography variant="h6" fontWeight={700} color="success.main">
                                {formatCurrency(stats.totalPaid)}
                              </Typography>
                            </Card>
                          </Grid>
                          <Grid item xs={6}>
                            <Card variant="outlined" sx={{ p: 1.5, borderRadius: 2, textAlign: 'center' }}>
                              <Typography variant="caption" color="text.secondary">
                                Remaining
                              </Typography>
                              <Typography variant="h6" fontWeight={700} color="error.main">
                                {formatCurrency(stats.remaining)}
                              </Typography>
                            </Card>
                          </Grid>
                        </Grid>
                      </Stack>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Payment History */}
            <Card sx={{ borderRadius: 3, mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                  <Typography variant="h6" fontWeight={700}>
                    Payment History
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setPaymentDialog(true)}
                    disabled={stats.isPaid}
                  >
                    Add Payment
                  </Button>
                </Stack>

                {payments.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Payment sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                    <Typography color="text.secondary">No payments recorded yet</Typography>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {payments.map((payment) => (
                      <Card key={payment.id} variant="outlined" sx={{ borderRadius: 2 }}>
                        <CardContent>
                          <Grid container spacing={2} alignItems="center">
                            <Grid item xs={8}>
                              <Stack spacing={0.5}>
                                <Typography fontWeight={600}>
                                  {formatCurrency(payment.amount)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {formatDate(payment.date)} • {payment.paymentMode}
                                </Typography>
                                {payment.notes && (
                                  <Typography variant="caption" color="text.secondary">
                                    {payment.notes}
                                  </Typography>
                                )}
                              </Stack>
                            </Grid>
                            <Grid item xs={4} sx={{ textAlign: 'right' }}>
                              <Chip
                                label="Completed"
                                color="success"
                                size="small"
                                variant="outlined"
                              />
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Right Column - Actions & Customer Info */}
          <Grid item xs={12} md={4}>
            {/* Customer Card */}
            {customer && (
              <Card sx={{ borderRadius: 3, mb: 3, overflow: 'hidden' }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                    <Avatar sx={{ bgcolor: PRIMARY_BLUE, width: 48, height: 48 }}>
                      {customer.customerName?.[0]?.toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography fontWeight={700}>{customer.customerName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {customer.phone}
                      </Typography>
                    </Box>
                  </Stack>

                  <List dense sx={{ mb: 2 }}>
                    <ListItem>
                      <ListItemIcon sx={{ minWidth: 36 }}><Phone fontSize="small" /></ListItemIcon>
                      <ListItemText primary={customer.phone} />
                    </ListItem>
                    {customer.email && (
                      <ListItem>
                        <ListItemIcon sx={{ minWidth: 36 }}><Email fontSize="small" /></ListItemIcon>
                        <ListItemText primary={customer.email} />
                      </ListItem>
                    )}
                    <ListItem>
                      <ListItemIcon sx={{ minWidth: 36 }}><AccountBalanceWallet fontSize="small" /></ListItemIcon>
                      <ListItemText 
                        primary="Current Balance"
                        secondary={formatCurrency(customer.balance || 0)}
                        secondaryTypographyProps={{
                          color: customer.balance > 0 ? 'error.main' : 'success.main',
                          fontWeight: 600
                        }}
                      />
                    </ListItem>
                  </List>

                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => navigate(`/customers/${customer.id}`)}
                  >
                    View Customer Profile
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card sx={{ borderRadius: 3, mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                  Quick Actions
                </Typography>
                <Stack spacing={2}>
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    startIcon={<Payment />}
                    onClick={() => setPaymentDialog(true)}
                    disabled={stats.isPaid}
                  >
                    {stats.isPaid ? 'Fully Paid' : 'Make Payment'}
                  </Button>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<WhatsApp />}
                    onClick={handleShareWhatsApp}
                  >
                    Share via WhatsApp
                  </Button>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Download />}
                    onClick={handleDownloadReceipt}
                  >
                    Download Receipt
                  </Button>
                  <Button
                    fullWidth
                    variant="outlined"
                    color="error"
                    startIcon={<Delete />}
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting...' : 'Delete Purchase'}
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            {/* Purchase Info */}
            <Card sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                  Purchase Information
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="Quantity" 
                      secondary={purchase.quantity || '1'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Unit Price" 
                      secondary={formatCurrency(purchase.unitPrice || purchase.amount)}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Total Payments" 
                      secondary={payments.length}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Last Payment" 
                      secondary={stats.lastPayment ? formatDate(stats.lastPayment.date) : 'None'}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>

      {/* Payment Dialog */}
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Payment</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Purchase Amount: {formatCurrency(stats.purchaseAmount)}
              </Typography>
              <Typography variant="subtitle2" color="text.secondary">
                Remaining Balance: {formatCurrency(stats.remaining)}
              </Typography>
            </Box>
            
            <TextField
              fullWidth
              label="Payment Amount"
              type="number"
              value={newPayment.amount}
              onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>₹</Typography>
              }}
              helperText={`Maximum: ${formatCurrency(stats.remaining)}`}
            />
            
            <TextField
              fullWidth
              label="Payment Mode"
              select
              value={newPayment.mode}
              onChange={(e) => setNewPayment({...newPayment, mode: e.target.value})}
              SelectProps={{
                native: true,
              }}
            >
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
              <option value="Other">Other</option>
            </TextField>
            
            <TextField
              fullWidth
              label="Notes (Optional)"
              multiline
              rows={3}
              value={newPayment.notes}
              onChange={(e) => setNewPayment({...newPayment, notes: e.target.value})}
              placeholder="Add any additional notes about this payment..."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setPaymentDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleAddPayment} 
            variant="contained"
            disabled={updating || !newPayment.amount}
            sx={{ minWidth: 120 }}
          >
            {updating ? <CircularProgress size={20} /> : 'Add Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({...snackbar, open: false})}
        message={snackbar.message}
      />
    </Box>
  );
};

export default PurchaseDetails;