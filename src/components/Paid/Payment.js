import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Grid,
  Box,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Autocomplete,
  MenuItem,
  Card,
  CardContent,
  Stack,
  Divider,
  Chip,
  Avatar,
  useTheme,
  useMediaQuery,
  IconButton,
  Tooltip,
  Fade,
  Slide
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
  History,
  CheckCircle,
  AttachMoney,
  AccountBalance,
  CreditCard,
  Receipt,
  QrCode,
  TrendingUp,
  Payment as PaymentIcon,
  Person,
  CalendarMonth,
  MoreVert
} from '@mui/icons-material';

const Payment = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [success, setSuccess] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'customers'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const customersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCustomers(customersData.filter(c => c.balance > 0));
    });

    const paymentsQ = query(collection(db, 'payments'), orderBy('date', 'desc'));
    const unsubscribePayments = onSnapshot(paymentsQ, (snapshot) => {
      const paymentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPaymentHistory(paymentsData.slice(0, 10));
    });

    return () => {
      unsubscribe();
      unsubscribePayments();
    };
  }, []);

  const handlePayment = async () => {
    if (!selectedCustomer || !paymentAmount) return;

    try {
      const newBalance = selectedCustomer.balance - parseFloat(paymentAmount);

      // Update customer balance
      await updateDoc(doc(db, 'customers', selectedCustomer.id), {
        balance: newBalance,
        status: newBalance > 0 ? 'pending' : 'paid'
      });

      // Add payment record
      await addDoc(collection(db, 'payments'), {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.customerName,
        amount: parseFloat(paymentAmount),
        paymentMode,
        previousBalance: selectedCustomer.balance,
        newBalance,
        date: serverTimestamp()
      });

      setSuccess(true);
      setShowSuccess(true);
      
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedCustomer(null);
        setPaymentAmount('');
        setSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error processing payment:', error);
    }
  };

  const paymentModeIcons = {
    'Cash': <AttachMoney fontSize="small" />,
    'Bank Transfer': <AccountBalance fontSize="small" />,
    'UPI': <QrCode fontSize="small" />,
    'Cheque': <Receipt fontSize="small" />,
    'Card': <CreditCard fontSize="small" />
  };

  const getPaymentModeColor = (mode) => {
    const colors = {
      'Cash': '#4caf50',
      'Bank Transfer': '#2196f3',
      'UPI': '#ff9800',
      'Cheque': '#9c27b0',
      'Card': '#f44336'
    };
    return colors[mode] || '#757575';
  };

  const PaymentMethodCard = ({ method, icon, color, isSelected, onClick }) => (
    <Card 
      elevation={isSelected ? 4 : 1}
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        border: isSelected ? `2px solid ${color}` : '2px solid transparent',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 6
        },
        height: '100%',
        backgroundColor: isSelected ? `${color}10` : 'white'
      }}
    >
      <CardContent sx={{ textAlign: 'center', p: 2 }}>
        <Box sx={{ color, mb: 1 }}>
          {icon}
        </Box>
        <Typography variant="body2" fontWeight={isSelected ? 'bold' : 'normal'}>
          {method}
        </Typography>
      </CardContent>
    </Card>
  );

  return (
    <Container maxWidth="xl" sx={{ px: isMobile ? 1 : 3, py: isMobile ? 1 : 3 }}>
      {/* Success Animation */}
      <Fade in={showSuccess}>
        <Box sx={{ position: 'fixed', top: 20, right: 20, zIndex: 9999 }}>
          <Alert 
            severity="success" 
            icon={<CheckCircle fontSize="large" />}
            sx={{ 
              boxShadow: 6,
              borderRadius: 2,
              animation: 'slideIn 0.3s ease'
            }}
          >
            <Typography fontWeight="bold">Payment Recorded Successfully!</Typography>
          </Alert>
        </Box>
      </Fade>

      <Grid container spacing={3}>
        {/* Left Column - Payment Form */}
        <Grid item xs={12} lg={7}>
          <Slide in direction="right" timeout={300}>
            <Card 
              elevation={3} 
              sx={{ 
                borderRadius: 3,
                overflow: 'hidden',
                height: '100%',
                background: 'linear-gradient(135deg, #f5f5f5 0%, #ffffff 100%)'
              }}
            >
              <Box sx={{ 
                bgcolor: 'primary.main', 
                p: 3, 
                color: 'white',
                background: 'linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)'
              }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <AccountBalanceWallet sx={{ fontSize: 32 }} />
                  <Box>
                    <Typography variant="h5" fontWeight="bold">
                      Record Payment
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      Accept payments from customers with pending balances
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              <CardContent sx={{ p: 4 }}>
                {success && !showSuccess && (
                  <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
                    Payment recorded successfully!
                  </Alert>
                )}

                {/* Customer Selection */}
                <Box sx={{ mb: 4 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="primary">
                    Select Customer
                  </Typography>
                  <Autocomplete
                    options={customers}
                    getOptionLabel={(option) => `${option.customerName} - ₹${option.balance.toFixed(2)}`}
                    value={selectedCustomer}
                    onChange={(_, newValue) => {
                      setSelectedCustomer(newValue);
                      setPaymentAmount('');
                    }}
                    renderInput={(params) => (
                      <TextField 
                        {...params} 
                        label="Search customer by name..." 
                        fullWidth
                        size={isMobile ? "small" : "medium"}
                        sx={{ 
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2
                          }
                        }}
                      />
                    )}
                    renderOption={(props, option) => (
                      <Box component="li" {...props}>
                        <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%' }}>
                          <Avatar sx={{ bgcolor: 'primary.light', width: 36, height: 36 }}>
                            <Person fontSize="small" />
                          </Avatar>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="body1" fontWeight="medium">
                              {option.customerName}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="caption" color="text.secondary">
                                {option.phone}
                              </Typography>
                              <Box sx={{ width: 4, height: 4, bgcolor: 'text.secondary', borderRadius: '50%' }} />
                              <Typography variant="caption" color="error.main" fontWeight="bold">
                                ₹{option.balance.toFixed(2)}
                              </Typography>
                            </Stack>
                          </Box>
                        </Stack>
                      </Box>
                    )}
                  />
                </Box>

                {/* Payment Details */}
                {selectedCustomer && (
                  <Slide in direction="up" timeout={400}>
                    <Box>
                      {/* Customer Info Card */}
                      <Card variant="outlined" sx={{ mb: 4, borderRadius: 2 }}>
                        <CardContent>
                          <Stack direction={isMobile ? "column" : "row"} justifyContent="space-between" alignItems={isMobile ? "flex-start" : "center"}>
                            <Stack direction="row" alignItems="center" spacing={2}>
                              <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
                                <Person />
                              </Avatar>
                              <Box>
                                <Typography variant="h6" fontWeight="bold">
                                  {selectedCustomer.customerName}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {selectedCustomer.phone}
                                </Typography>
                              </Box>
                            </Stack>
                            <Box sx={{ textAlign: isMobile ? 'left' : 'right', mt: isMobile ? 2 : 0 }}>
                              <Typography variant="caption" color="text.secondary">
                                Current Balance
                              </Typography>
                              <Typography variant="h4" color="error.main" fontWeight="bold">
                                ₹{selectedCustomer.balance.toFixed(2)}
                              </Typography>
                            </Box>
                          </Stack>
                        </CardContent>
                      </Card>

                      {/* Payment Form */}
                      <Grid container spacing={3}>
                        {/* Payment Amount */}
                        <Grid item xs={12}>
                          <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="primary">
                            Payment Amount
                          </Typography>
                          <TextField
                            fullWidth
                            variant="outlined"
                            type="number"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            placeholder="Enter payment amount"
                            size={isMobile ? "small" : "medium"}
                            InputProps={{
                              startAdornment: (
                                <Box sx={{ mr: 1, color: 'primary.main' }}>
                                  <AttachMoney />
                                </Box>
                              ),
                              inputProps: { 
                                max: selectedCustomer.balance,
                                step: "0.01"
                              },
                              sx: { borderRadius: 2 }
                            }}
                            helperText={`Maximum: ₹${selectedCustomer.balance.toFixed(2)}`}
                          />
                        </Grid>

                        {/* Payment Method */}
                        <Grid item xs={12}>
                          <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="primary">
                            Payment Method
                          </Typography>
                          <Grid container spacing={2}>
                            {['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card'].map((method) => (
                              <Grid item xs={6} sm={4} md={2.4} key={method}>
                                <PaymentMethodCard
                                  method={method}
                                  icon={paymentModeIcons[method]}
                                  color={getPaymentModeColor(method)}
                                  isSelected={paymentMode === method}
                                  onClick={() => setPaymentMode(method)}
                                />
                              </Grid>
                            ))}
                          </Grid>
                        </Grid>

                        {/* Submit Button */}
                        <Grid item xs={12}>
                          <Button
                            fullWidth
                            variant="contained"
                            size="large"
                            onClick={handlePayment}
                            disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || parseFloat(paymentAmount) > selectedCustomer.balance}
                            startIcon={<PaymentIcon />}
                            sx={{
                              py: 2,
                              borderRadius: 2,
                              background: 'linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)',
                              fontSize: '1rem',
                              fontWeight: 'bold',
                              '&:hover': {
                                background: 'linear-gradient(135deg, #b71c1c 0%, #8b0000 100%)',
                                transform: 'translateY(-2px)',
                                boxShadow: 6
                              },
                              transition: 'all 0.3s ease'
                            }}
                          >
                            Record Payment of ₹{paymentAmount || '0.00'}
                          </Button>
                          
                          {paymentAmount && selectedCustomer.balance - parseFloat(paymentAmount) > 0 && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                              Remaining balance after payment: ₹{(selectedCustomer.balance - parseFloat(paymentAmount)).toFixed(2)}
                            </Typography>
                          )}
                        </Grid>
                      </Grid>
                    </Box>
                  </Slide>
                )}
              </CardContent>
            </Card>
          </Slide>
        </Grid>

        {/* Right Column - Recent Payments */}
        <Grid item xs={12} lg={5}>
          <Slide in direction="left" timeout={300}>
            <Card 
              elevation={3} 
              sx={{ 
                borderRadius: 3,
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <Box sx={{ 
                bgcolor: 'primary.dark', 
                p: 3, 
                color: 'white',
                background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)'
              }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <History sx={{ fontSize: 32 }} />
                  <Box>
                    <Typography variant="h5" fontWeight="bold">
                      Recent Payments
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      Last 10 payment transactions
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              <CardContent sx={{ p: 3, flexGrow: 1, overflow: 'auto' }}>
                {paymentHistory.length > 0 ? (
                  <Stack spacing={2}>
                    {paymentHistory.map((payment, index) => (
                      <Card 
                        key={payment.id} 
                        variant="outlined"
                        sx={{ 
                          borderRadius: 2,
                          borderLeft: `4px solid ${getPaymentModeColor(payment.paymentMode)}`,
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            transform: 'translateX(4px)',
                            boxShadow: 2
                          }
                        }}
                      >
                        <CardContent sx={{ py: 2, px: 2 }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Box sx={{ flexGrow: 1 }}>
                              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                <Avatar sx={{ 
                                  width: 32, 
                                  height: 32, 
                                  bgcolor: `${getPaymentModeColor(payment.paymentMode)}20`,
                                  color: getPaymentModeColor(payment.paymentMode)
                                }}>
                                  {paymentModeIcons[payment.paymentMode] || <PaymentIcon fontSize="small" />}
                                </Avatar>
                                <Box>
                                  <Typography variant="subtitle2" fontWeight="bold">
                                    {payment.customerName}
                                  </Typography>
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <Chip 
                                      label={payment.paymentMode}
                                      size="small"
                                      sx={{ 
                                        height: 20, 
                                        fontSize: '0.7rem',
                                        bgcolor: `${getPaymentModeColor(payment.paymentMode)}20`,
                                        color: getPaymentModeColor(payment.paymentMode)
                                      }}
                                    />
                                    <Typography variant="caption" color="text.secondary">
                                      {payment.date?.toDate().toLocaleDateString('en-IN', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric'
                                      })}
                                    </Typography>
                                  </Stack>
                                </Box>
                              </Stack>
                              
                              <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
                                <Box>
                                  <Typography variant="caption" color="text.secondary">
                                    Previous Balance
                                  </Typography>
                                  <Typography variant="body2">
                                    ₹{payment.previousBalance?.toFixed(2) || '0.00'}
                                  </Typography>
                                </Box>
                                <Box sx={{ textAlign: 'right' }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Payment Amount
                                  </Typography>
                                  <Typography variant="h6" color="success.main" fontWeight="bold">
                                    ₹{payment.amount?.toFixed(2)}
                                  </Typography>
                                </Box>
                              </Stack>
                            </Box>
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <History sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No Recent Payments
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Payment records will appear here
                    </Typography>
                  </Box>
                )}
              </CardContent>

              {/* Stats Footer */}
              <Divider />
              <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Total Today: ₹{paymentHistory
                      .filter(p => {
                        const paymentDate = p.date?.toDate();
                        const today = new Date();
                        return paymentDate?.toDateString() === today.toDateString();
                      })
                      .reduce((sum, p) => sum + (p.amount || 0), 0)
                      .toFixed(2)}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TrendingUp fontSize="small" color="success" />
                    <Typography variant="body2" fontWeight="medium">
                      {paymentHistory.length} transactions
                    </Typography>
                  </Stack>
                </Stack>
              </Box>
            </Card>
          </Slide>
        </Grid>
      </Grid>

      {/* Add CSS animations */}
      <style jsx="true">{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        
        .pulse-animation {
          animation: pulse 2s infinite;
        }
      `}</style>
    </Container>
  );
};

export default Payment;