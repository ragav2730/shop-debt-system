import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Paper, Typography, Box, Button, Card, CardContent,
  Stack, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, CircularProgress, Grid, Chip, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, InputAdornment, Tabs, Tab, Avatar,
  Divider, List, ListItem, ListItemText, ListItemSecondaryAction,
  Tooltip, useTheme, useMediaQuery
} from '@mui/material';
import {
  ArrowBack, Edit, Print, Download, FilterList,
  Search, CalendarToday, AttachMoney, Receipt, Paid, Pending,
  CheckCircle, Close, Payment, Refresh, BarChart,
  Visibility, Business, People, History,
  Inventory, Store, AccountBalance, LocalShipping, Payment as PaymentIcon,
  AccountBalanceWallet, Phone, Email
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  doc, getDoc, collection, query, where, onSnapshot,
  addDoc, updateDoc, serverTimestamp, orderBy, getDocs
} from 'firebase/firestore';
import { db } from '../../services/firebase';

const VendorDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const [vendor, setVendor] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  
  const [selectPurchaseDialog, setSelectPurchaseDialog] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [processingPayment, setProcessingPayment] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(isMobile ? 5 : 10);

  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    vendorName: '',
    phone: '',
    email: '',
    address: ''
  });

  const [notification, setNotification] = useState({
    show: false,
    message: '',
    type: 'success',
    amount: 0
  });

  // Fetch vendor details
  useEffect(() => {
    const fetchVendor = async () => {
      try {
        const snap = await getDoc(doc(db, 'vendors', id));
        if (!snap.exists()) {
          navigate('/vendors');
          return;
        }
        const vendorData = { id: snap.id, ...snap.data() };
        setVendor(vendorData);
        setEditForm({
          vendorName: vendorData.vendorName || '',
          phone: vendorData.phone || '',
          email: vendorData.email || '',
          address: vendorData.address || ''
        });
        setLoading(false);
      } catch (error) {
        console.error('Error fetching vendor:', error);
        setLoading(false);
      }
    };

    fetchVendor();
  }, [id, navigate]);

  // Fetch customer purchases
  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(
      query(
        collection(db, 'transactions'),
        where('vendorId', '==', id),
        orderBy('date', 'desc')
      ),
      (snap) => {
        const transactionsList = snap.docs.map(d => {
          const data = d.data();
          const remainingAmount = data.remainingAmount ?? data.amount ?? 0;
          return {
            id: d.id,
            ...data,
            amount: data.amount || 0,
            remainingAmount: remainingAmount,
            date: data.date?.toDate?.() || data.date || new Date()
          };
        });
        setTransactions(transactionsList);
      }
    );

    return () => unsubscribe();
  }, [id]);

  // Fetch payments
  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(
      query(
        collection(db, 'payments'),
        where('vendorId', '==', id),
        orderBy('date', 'desc')
      ),
      (snap) => {
        const paymentsList = snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
          date: d.data().date?.toDate?.() || d.data().date || new Date()
        }));
        setPayments(paymentsList);
      }
    );

    return () => unsubscribe();
  }, [id]);

  // Calculate stats
  const stats = {
    totalSales: transactions.reduce((sum, t) => sum + (t.amount || 0), 0),
    totalPending: transactions
      .filter(t => (t.remainingAmount || t.amount || 0) > 0)
      .reduce((sum, t) => sum + (t.remainingAmount || t.amount || 0), 0),
    totalPaid: payments
      .filter(p => p.type === 'customer_payment')
      .reduce((sum, p) => sum + (Math.abs(p.amount) || 0), 0),
    transactionCount: transactions.length,
    pendingCount: transactions.filter(t => (t.remainingAmount || t.amount || 0) > 0).length
  };

  // Filter transactions
  const filteredTransactions = transactions.filter(transaction => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        transaction.customerName?.toLowerCase().includes(term) ||
        transaction.productName?.toLowerCase().includes(term) ||
        transaction.category?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  // Filter pending transactions
  const pendingTransactions = filteredTransactions.filter(t => (t.remainingAmount || 0) > 0);

  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      const d = date.toDate ? date.toDate() : new Date(date);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short'
      });
    } catch (e) {
      return 'N/A';
    }
  };

  // Format full date
  const formatFullDate = (date) => {
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
  };

  // Get product name
  const getProductName = (transaction) => {
    if (transaction.productName) {
      return transaction.productName;
    }
    
    const parts = [];
    if (transaction.company) parts.push(transaction.company);
    if (transaction.category) parts.push(transaction.category);
    
    let name = parts.join(' ');
    
    if (transaction.quantity && transaction.unit) {
      name += ` (${transaction.quantity} ${transaction.unit})`;
    }
    
    return name || 'Product';
  };

  // Handle individual settle
  const openIndividualSettle = () => {
    if (!vendor || vendor.balance <= 0) {
      showNotification('No pending balance to settle', 'info');
      return;
    }
    
    if (pendingTransactions.length === 0) {
      showNotification('No pending purchases found', 'info');
      return;
    }
    
    setPaymentAmount(Math.min(vendor.balance, pendingTransactions[0].remainingAmount).toString());
    setSelectPurchaseDialog(true);
  };

  const handleIndividualPayment = async () => {
    if (!vendor || !selectedPurchase || !paymentAmount) return;

    const amt = Number(paymentAmount);
    if (amt <= 0) {
      showNotification('Please enter valid amount', 'error');
      return;
    }

    if (amt > selectedPurchase.remainingAmount) {
      showNotification(`Amount exceeds remaining ₹${selectedPurchase.remainingAmount}`, 'error');
      return;
    }

    if (amt > vendor.balance) {
      showNotification(`Amount exceeds vendor balance ₹${vendor.balance}`, 'error');
      return;
    }

    setProcessingPayment(true);

    try {
      const newRemaining = selectedPurchase.remainingAmount - amt;
      const newVendorBalance = vendor.balance - amt;

      await updateDoc(doc(db, 'vendors', id), {
        balance: newVendorBalance,
        updatedAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'transactions', selectedPurchase.id), {
        remainingAmount: newRemaining,
        status: newRemaining <= 0 ? 'paid' : 'partial',
        lastPaymentDate: serverTimestamp()
      });

      await addDoc(collection(db, 'payments'), {
        vendorId: id,
        vendorName: vendor.vendorName,
        customerId: selectedPurchase.customerId,
        customerName: selectedPurchase.customerName,
        transactionId: selectedPurchase.id,
        productName: getProductName(selectedPurchase),
        amount: amt,
        paymentMode,
        previousBalance: vendor.balance,
        newBalance: newVendorBalance,
        previousRemaining: selectedPurchase.remainingAmount,
        newRemaining: newRemaining,
        date: serverTimestamp(),
        settledType: 'individual',
        type: 'customer_payment',
        notes: `Individual settle for ${getProductName(selectedPurchase)}`
      });

      setVendor(prev => ({
        ...prev,
        balance: newVendorBalance
      }));

      showNotification(`Payment of ₹${amt} recorded`, 'success', amt);
      setSelectPurchaseDialog(false);
      setPaymentAmount('');
      setSelectedPurchase(null);
    } catch (error) {
      console.error('Payment error:', error);
      showNotification('Payment failed', 'error');
    } finally {
      setProcessingPayment(false);
    }
  };

  // Update vendor
  const handleUpdateVendor = async () => {
    if (!editForm.vendorName.trim()) {
      showNotification('Vendor name is required', 'error');
      return;
    }

    try {
      await updateDoc(doc(db, 'vendors', id), {
        vendorName: editForm.vendorName,
        phone: editForm.phone,
        email: editForm.email,
        address: editForm.address,
        updatedAt: serverTimestamp()
      });

      setVendor(prev => ({
        ...prev,
        vendorName: editForm.vendorName,
        phone: editForm.phone,
        email: editForm.email,
        address: editForm.address
      }));

      showNotification('Vendor updated', 'success');
      setOpenEditDialog(false);
    } catch (error) {
      console.error('Error updating vendor:', error);
      showNotification('Update failed', 'error');
    }
  };

  // Show notification
  const showNotification = (message, type = 'success', amount = 0) => {
    setNotification({
      show: true,
      message,
      type,
      amount
    });

    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  const paymentModes = ['Cash', 'UPI', 'Bank', 'Card', 'Cheque'];

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh'
      }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ 
        bgcolor: '#f5f5f5', 
        minHeight: '100vh',
        pb: isMobile ? 3 : 4
      }}>
        {/* Notification */}
        {notification.show && (
          <Alert
            severity={notification.type}
            sx={{
              position: 'fixed',
              top: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9999,
              width: isMobile ? '90%' : '400px',
              boxShadow: 3
            }}
            action={
              <IconButton
                size="small"
                onClick={() => setNotification(prev => ({ ...prev, show: false }))}
              >
                <Close fontSize="small" />
              </IconButton>
            }
          >
            {notification.message}
            {notification.amount > 0 && ` - ₹${notification.amount}`}
          </Alert>
        )}

        {/* Header */}
        <Box sx={{
          bgcolor: 'white',
          borderBottom: '1px solid #e0e0e0',
          py: 2
        }}>
          <Container maxWidth="lg">
            <Stack direction="row" alignItems="center" spacing={2}>
              <IconButton 
                onClick={() => navigate('/vendors')}
                sx={{ 
                  color: 'primary.main'
                }}
              >
                <ArrowBack />
              </IconButton>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5" fontWeight={600}>
                  {vendor.vendorName}
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
                  {vendor.phone && (
                    <Typography variant="body2" color="text.secondary">
                      <Phone sx={{ fontSize: 14, mr: 0.5 }} />
                      {vendor.phone}
                    </Typography>
                  )}
                  {vendor.email && (
                    <Typography variant="body2" color="text.secondary">
                      <Email sx={{ fontSize: 14, mr: 0.5 }} />
                      {vendor.email}
                    </Typography>
                  )}
                </Stack>
              </Box>
              <Stack direction="row" spacing={1}>
                <IconButton onClick={() => setOpenEditDialog(true)}>
                  <Edit />
                </IconButton>
              </Stack>
            </Stack>
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{ mt: 3 }}>
          {/* Balance Card */}
          <Paper sx={{ 
            mb: 3, 
            borderRadius: 2,
            overflow: 'hidden'
          }}>
            <Box sx={{
              bgcolor: vendor.balance > 0 ? 'error.main' : 'success.main',
              color: 'white',
              py: 2,
              px: 3
            }}>
              <Typography variant="h4" fontWeight={700}>
                ₹{vendor.balance}
              </Typography>
              <Typography variant="body2">
                {vendor.balance > 0 ? 'Total Balance Owed' : 'All Settled'}
              </Typography>
            </Box>
            <Box sx={{ p: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={6} sm={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Total Sales
                    </Typography>
                    <Typography variant="h6" fontWeight={600}>
                      ₹{stats.totalSales.toLocaleString()}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Pending
                    </Typography>
                    <Typography variant="h6" fontWeight={600} color="error.main">
                      ₹{stats.totalPending.toLocaleString()}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Received
                    </Typography>
                    <Typography variant="h6" fontWeight={600} color="success.main">
                      ₹{stats.totalPaid.toLocaleString()}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Purchases
                    </Typography>
                    <Typography variant="h6" fontWeight={600}>
                      {stats.transactionCount}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Paper>

          {/* Action Buttons */}
          <Paper sx={{ 
            p: 2, 
            mb: 3, 
            borderRadius: 2,
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: 2,
            alignItems: 'center'
          }}>
            <Button
              variant="contained"
              startIcon={<PaymentIcon />}
              onClick={openIndividualSettle}
              disabled={vendor.balance <= 0}
              sx={{ flex: isMobile ? 1 : 'none' }}
              fullWidth={isMobile}
            >
              Individual Settle
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<Receipt />}
              onClick={() => navigate('/payment')}
              sx={{ flex: isMobile ? 1 : 'none' }}
              fullWidth={isMobile}
            >
              Make Payment
            </Button>
            
            <Box sx={{ flex: 1 }} />
            
            <TextField
              placeholder="Search purchases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
              sx={{ 
                width: isMobile ? '100%' : 250 
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                )
              }}
            />
          </Paper>

          {/* Main Content Tabs */}
          <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Tabs 
              value={activeTab} 
              onChange={(e, val) => setActiveTab(val)}
              variant={isMobile ? "fullWidth" : "standard"}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label="Purchase History" />
              <Tab label="Payment History" />
              <Tab label="Reports" />
            </Tabs>

            {/* Purchase History Tab */}
            {activeTab === 0 && (
              <Box>
                {filteredTransactions.length === 0 ? (
                  <Box sx={{ 
                    textAlign: 'center', 
                    py: 8,
                    color: 'text.secondary'
                  }}>
                    <Inventory sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                    <Typography>No purchases found</Typography>
                  </Box>
                ) : (
                  <>
                    {isMobile ? (
                      // Mobile view - List
                      <List sx={{ p: 0 }}>
                        {filteredTransactions
                          .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                          .map((transaction) => {
                            const remaining = transaction.remainingAmount || 0;
                            const isPaid = remaining <= 0;
                            
                            return (
                              <React.Fragment key={transaction.id}>
                                <ListItem 
                                  sx={{ 
                                    borderBottom: '1px solid #f0f0f0',
                                    py: 2
                                  }}
                                >
                                  <ListItemText
                                    primary={
                                      <Typography fontWeight={600}>
                                        {transaction.customerName}
                                      </Typography>
                                    }
                                    secondary={
                                      <>
                                        <Typography variant="body2">
                                          {getProductName(transaction)}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          {formatDate(transaction.date)}
                                        </Typography>
                                        <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                                          <Typography variant="body2">
                                            ₹{transaction.amount}
                                          </Typography>
                                          <Typography 
                                            variant="body2" 
                                            color={remaining > 0 ? "error.main" : "success.main"}
                                            fontWeight={600}
                                          >
                                            ₹{remaining} remaining
                                          </Typography>
                                        </Stack>
                                      </>
                                    }
                                  />
                                  <ListItemSecondaryAction>
                                    <Chip
                                      label={isPaid ? 'Paid' : 'Pending'}
                                      size="small"
                                      color={isPaid ? 'success' : 'warning'}
                                    />
                                  </ListItemSecondaryAction>
                                </ListItem>
                              </React.Fragment>
                            );
                          })}
                      </List>
                    ) : (
                      // Desktop view - Table
                      <TableContainer>
                        <Table>
                          <TableHead>
                            <TableRow sx={{ bgcolor: '#fafafa' }}>
                              <TableCell>Date</TableCell>
                              <TableCell>Customer</TableCell>
                              <TableCell>Product</TableCell>
                              <TableCell>Category</TableCell>
                              <TableCell align="right">Quantity</TableCell>
                              <TableCell align="right">Price</TableCell>
                              <TableCell align="right">Total</TableCell>
                              <TableCell align="right">Remaining</TableCell>
                              <TableCell>Status</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {filteredTransactions
                              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                              .map((transaction) => {
                                const remaining = transaction.remainingAmount || 0;
                                const isPaid = remaining <= 0;
                                
                                return (
                                  <TableRow 
                                    key={transaction.id}
                                    hover
                                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                  >
                                    <TableCell>
                                      {formatDate(transaction.date)}
                                    </TableCell>
                                    <TableCell>
                                      <Typography fontWeight={500}>
                                        {transaction.customerName}
                                      </Typography>
                                    </TableCell>
                                    <TableCell>{getProductName(transaction)}</TableCell>
                                    <TableCell>{transaction.category}</TableCell>
                                    <TableCell align="right">
                                      {transaction.quantity} {transaction.unit}
                                    </TableCell>
                                    <TableCell align="right">₹{transaction.price}</TableCell>
                                    <TableCell align="right">
                                      <Typography fontWeight={600}>
                                        ₹{transaction.amount}
                                      </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                      <Typography 
                                        color={remaining > 0 ? "error.main" : "success.main"}
                                        fontWeight={600}
                                      >
                                        ₹{remaining}
                                      </Typography>
                                    </TableCell>
                                    <TableCell>
                                      <Chip
                                        label={isPaid ? 'Paid' : 'Pending'}
                                        size="small"
                                        color={isPaid ? 'success' : 'warning'}
                                      />
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                    
                    <TablePagination
                      rowsPerPageOptions={[5, 10, 25]}
                      component="div"
                      count={filteredTransactions.length}
                      rowsPerPage={rowsPerPage}
                      page={page}
                      onPageChange={(e, newPage) => setPage(newPage)}
                      onRowsPerPageChange={(e) => {
                        setRowsPerPage(parseInt(e.target.value, 10));
                        setPage(0);
                      }}
                    />
                  </>
                )}
              </Box>
            )}

            {/* Payment History Tab */}
            {activeTab === 1 && (
              <Box>
                {payments.length === 0 ? (
                  <Box sx={{ 
                    textAlign: 'center', 
                    py: 8,
                    color: 'text.secondary'
                  }}>
                    <History sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                    <Typography>No payment history found</Typography>
                  </Box>
                ) : (
                  <List sx={{ p: 0 }}>
                    {payments.map((payment) => {
                      const isRefund = payment.amount < 0;
                      const amount = Math.abs(payment.amount);
                      
                      return (
                        <React.Fragment key={payment.id}>
                          <ListItem 
                            sx={{ 
                              borderBottom: '1px solid #f0f0f0',
                              py: 2
                            }}
                          >
                            <ListItemText
                              primary={
                                <Typography fontWeight={600}>
                                  {payment.customerName || payment.vendorName}
                                </Typography>
                              }
                              secondary={
                                <>
                                  <Typography variant="body2">
                                    {formatFullDate(payment.date)} • {payment.paymentMode || 'Cash'}
                                  </Typography>
                                  {payment.productName && (
                                    <Typography variant="body2">
                                      {payment.productName}
                                    </Typography>
                                  )}
                                </>
                              }
                            />
                            <ListItemSecondaryAction>
                              <Stack alignItems="flex-end" spacing={0.5}>
                                <Typography 
                                  variant="h6" 
                                  color={isRefund ? 'error.main' : 'success.main'}
                                  fontWeight={600}
                                >
                                  {isRefund ? '-' : '+'}₹{amount}
                                </Typography>
                                <Chip
                                  label={isRefund ? 'Refund' : 'Payment'}
                                  size="small"
                                  color={isRefund ? 'error' : 'success'}
                                />
                              </Stack>
                            </ListItemSecondaryAction>
                          </ListItem>
                        </React.Fragment>
                      );
                    })}
                  </List>
                )}
              </Box>
            )}

            {/* Reports Tab */}
            {activeTab === 2 && (
              <Box sx={{ p: 3 }}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3, borderRadius: 2 }}>
                      <Typography variant="h6" gutterBottom fontWeight={600}>
                        Financial Summary
                      </Typography>
                      <Stack spacing={2}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography>Total Sales:</Typography>
                          <Typography fontWeight={600}>₹{stats.totalSales.toLocaleString()}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography>Total Received:</Typography>
                          <Typography fontWeight={600} color="success.main">₹{stats.totalPaid.toLocaleString()}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography>Pending Balance:</Typography>
                          <Typography fontWeight={600} color="error.main">₹{stats.totalPending.toLocaleString()}</Typography>
                        </Stack>
                      </Stack>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3, borderRadius: 2 }}>
                      <Typography variant="h6" gutterBottom fontWeight={600}>
                        Purchase Summary
                      </Typography>
                      <Stack spacing={2}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography>Total Purchases:</Typography>
                          <Typography fontWeight={600}>{stats.transactionCount}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography>Pending Purchases:</Typography>
                          <Typography fontWeight={600} color="warning.main">{stats.pendingCount}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography>Paid Purchases:</Typography>
                          <Typography fontWeight={600} color="success.main">{stats.transactionCount - stats.pendingCount}</Typography>
                        </Stack>
                      </Stack>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            )}
          </Paper>
        </Container>

        {/* Individual Settle Dialog */}
        <Dialog 
          open={selectPurchaseDialog} 
          onClose={() => !processingPayment && setSelectPurchaseDialog(false)} 
          maxWidth="sm" 
          fullWidth
        >
          <DialogTitle>
            <Typography variant="h6" fontWeight={600}>
              Individual Settle
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Vendor: {vendor?.vendorName} • Balance: ₹{vendor?.balance}
            </Typography>
          </DialogTitle>

          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                label="Payment Amount"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                }}
                helperText={`Maximum: ₹${vendor?.balance || 0}`}
              />

              <TextField
                select
                fullWidth
                label="Payment Mode"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
              >
                {paymentModes.map(mode => (
                  <MenuItem key={mode} value={mode}>{mode}</MenuItem>
                ))}
              </TextField>

              <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 2 }}>
                Select Purchase to Settle:
              </Typography>

              {pendingTransactions.length === 0 ? (
                <Alert severity="info">
                  No pending purchases found
                </Alert>
              ) : (
                <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {pendingTransactions.map((txn) => {
                    const isSelected = selectedPurchase?.id === txn.id;
                    const canPay = Number(paymentAmount) <= txn.remainingAmount;
                    
                    return (
                      <ListItem
                        key={txn.id}
                        button
                        selected={isSelected}
                        onClick={() => setSelectedPurchase(txn)}
                        sx={{
                          borderRadius: 1,
                          mb: 1,
                          border: isSelected ? '2px solid #1976d2' : '1px solid #e0e0e0',
                          bgcolor: isSelected ? '#e3f2fd' : 'white',
                        }}
                      >
                        <ListItemText
                          primary={
                            <Typography fontWeight={600}>
                              {getProductName(txn)}
                            </Typography>
                          }
                          secondary={
                            <>
                              <Typography variant="caption" display="block">
                                Customer: {txn.customerName} • {formatDate(txn.date)}
                              </Typography>
                              <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                                <Typography variant="caption">
                                  Total: ₹{txn.amount}
                                </Typography>
                                <Typography variant="caption" color="error.main" fontWeight={600}>
                                  Remaining: ₹{txn.remainingAmount}
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
                    );
                  })}
                </List>
              )}
            </Stack>
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
              disabled={!selectedPurchase || processingPayment || !paymentAmount || Number(paymentAmount) <= 0}
              startIcon={processingPayment ? <CircularProgress size={20} /> : <CheckCircle />}
            >
              {processingPayment ? 'Processing...' : `Pay ₹${paymentAmount}`}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Vendor Dialog */}
        <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            <Typography variant="h6" fontWeight={600}>
              Edit Vendor Details
            </Typography>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                label="Vendor Name *"
                value={editForm.vendorName}
                onChange={(e) => setEditForm({ ...editForm, vendorName: e.target.value })}
                required
              />
              <TextField
                fullWidth
                label="Phone Number"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                type="tel"
              />
              <TextField
                fullWidth
                label="Email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                type="email"
              />
              <TextField
                fullWidth
                label="Address"
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                multiline
                rows={2}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setOpenEditDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleUpdateVendor}
              startIcon={<CheckCircle />}
            >
              Update Vendor
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default VendorDetail;