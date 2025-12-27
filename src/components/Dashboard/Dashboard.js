import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Stack,
  Chip,
  Avatar,
  LinearProgress,
  useTheme,
  useMediaQuery,
  IconButton,
  Menu,
  MenuItem,
  alpha,
  Skeleton,
  Button,
  Divider,
  Container  // This was missing
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  People,
  AttachMoney,
  CheckCircle,
  Pending,
  Store,
  Receipt,
  History,
  MoreVert,
  ArrowUpward,
  ArrowDownward,
  CalendarToday,
  Payment,
  AccountBalanceWallet,
  ShoppingCart,
  Timeline,
  PieChart,
  BarChart
} from '@mui/icons-material';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalCustomers: 0,
    pendingCustomers: 0,
    totalDebt: 0,
    todayPayments: 0,
    todayCustomers: 0,
    monthlyCollection: 0,
    loading: true
  });

  const [recentCustomers, setRecentCustomers] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    const fetchDashboardData = () => {
      // Fetch customers data
      const customersQuery = query(collection(db, 'customers'));
      const unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
        let totalCustomers = 0;
        let pendingCustomers = 0;
        let totalDebt = 0;
        let todayCustomers = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const customersData = [];
        
        snapshot.forEach((doc) => {
          const customer = { id: doc.id, ...doc.data() };
          totalCustomers++;
          
          const balance = customer.balance || 0;
          if (balance > 0) {
            pendingCustomers++;
            totalDebt += balance;
          }

          // Check if customer was added today
          const customerDate = customer.createdAt?.toDate();
          if (customerDate && customerDate >= today) {
            todayCustomers++;
          }

          // Add to recent customers list
          if (customer.createdAt) {
            customersData.push(customer);
          }
        });

        // Sort by date and get recent 5
        customersData.sort((a, b) => b.createdAt?.toDate() - a.createdAt?.toDate());
        setRecentCustomers(customersData.slice(0, 5));

        setStats(prev => ({
          ...prev,
          totalCustomers,
          pendingCustomers,
          totalDebt,
          todayCustomers
        }));
      });

      // Fetch payments data
      const paymentsQuery = query(collection(db, 'payments'), orderBy('date', 'desc'));
      const unsubscribePayments = onSnapshot(paymentsQuery, (snapshot) => {
        let todayPayments = 0;
        let monthlyCollection = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        const paymentsData = [];
        
        snapshot.forEach((doc) => {
          const payment = { id: doc.id, ...doc.data() };
          const paymentDate = payment.date?.toDate();
          
          if (paymentDate >= today) {
            todayPayments++;
          }
          
          if (paymentDate >= firstDayOfMonth) {
            monthlyCollection += payment.amount || 0;
          }
          
          paymentsData.push(payment);
        });

        setRecentPayments(paymentsData.slice(0, 5));
        setStats(prev => ({
          ...prev,
          todayPayments,
          monthlyCollection,
          loading: false
        }));

        // Generate chart data (last 7 days)
        generateChartData(paymentsData);
      });

      return () => {
        unsubscribeCustomers();
        unsubscribePayments();
      };
    };

    fetchDashboardData();
  }, []);

  const generateChartData = (payments) => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push({
        date: date.toLocaleDateString('en-IN', { weekday: 'short' }),
        amount: 0
      });
    }

    payments.forEach(payment => {
      const paymentDate = payment.date?.toDate();
      if (paymentDate) {
        const dayIndex = Math.floor((Date.now() - paymentDate.getTime()) / (1000 * 60 * 60 * 24));
        if (dayIndex >= 0 && dayIndex < 7) {
          days[6 - dayIndex].amount += payment.amount || 0;
        }
      }
    });

    setChartData(days);
  };

  const formatCurrency = (amount) => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(1)}Cr`;
    } else if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    } else if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(1)}K`;
    }
    return `₹${amount.toFixed(0)}`;
  };

  const StatCard = ({ title, value, icon, color, trend, subtitle }) => (
    <Card 
      elevation={0}
      sx={{
        height: '100%',
        borderRadius: 2.5,
        border: `1px solid ${alpha(color, 0.2)}`,
        background: `linear-gradient(135deg, ${alpha(color, 0.05)} 0%, ${alpha(color, 0.02)} 100%)`,
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 8px 25px ${alpha(color, 0.15)}`,
          borderColor: alpha(color, 0.3)
        }
      }}
    >
      <CardContent sx={{ p: isMobile ? 2 : 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
              {title}
            </Typography>
            <Typography 
              variant="h5" 
              sx={{ 
                fontWeight: 700,
                color: color,
                mt: 0.5,
                fontSize: isMobile ? '1.25rem' : '1.5rem'
              }}
            >
              {stats.loading ? <Skeleton width={80} /> : value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mt: 0.5 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <Avatar 
            sx={{ 
              bgcolor: alpha(color, 0.1),
              color: color,
              width: isMobile ? 44 : 48,
              height: isMobile ? 44 : 48
            }}
          >
            {icon}
          </Avatar>
        </Stack>
        {trend && (
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 2 }}>
            {trend.value > 0 ? (
              <ArrowUpward sx={{ fontSize: 16, color: '#4caf50' }} />
            ) : (
              <ArrowDownward sx={{ fontSize: 16, color: '#f44336' }} />
            )}
            <Typography 
              variant="caption" 
              sx={{ 
                color: trend.value > 0 ? '#4caf50' : '#f44336',
                fontWeight: 600,
                fontSize: '0.75rem'
              }}
            >
              {trend.label}
            </Typography>
          </Stack>
        )}
      </CardContent>
    </Card>
  );

  const RecentActivityCard = ({ title, items, type, emptyMessage }) => (
    <Card 
      elevation={0}
      sx={{
        height: '100%',
        borderRadius: 2.5,
        border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
        background: 'white'
      }}
    >
      <CardContent sx={{ p: isMobile ? 2 : 2.5, height: '100%' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {title}
          </Typography>
          <Button 
            size="small" 
            onClick={() => navigate(type === 'customers' ? '/' : '/paid')}
            sx={{ 
              color: theme.palette.primary.main,
              fontSize: '0.75rem',
              textTransform: 'none'
            }}
          >
            View All
          </Button>
        </Stack>

        {stats.loading ? (
          <Stack spacing={2}>
            {[1, 2, 3, 4, 5].map(i => (
              <Stack key={i} direction="row" spacing={2} alignItems="center">
                <Skeleton variant="circular" width={40} height={40} />
                <Box sx={{ flexGrow: 1 }}>
                  <Skeleton width="60%" height={20} />
                  <Skeleton width="40%" height={16} />
                </Box>
              </Stack>
            ))}
          </Stack>
        ) : items.length > 0 ? (
          <Stack spacing={2}>
            {items.slice(0, 5).map((item, index) => (
              <Box 
                key={item.id || index}
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.03),
                    borderColor: alpha(theme.palette.primary.main, 0.2)
                  },
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  if (type === 'customers' && item.id) {
                    navigate(`/list/${item.id}`);
                  }
                }}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar 
                    sx={{ 
                      width: 40, 
                      height: 40,
                      bgcolor: type === 'customers' ? 
                        (item.balance > 0 ? alpha('#f44336', 0.1) : alpha('#4caf50', 0.1)) : 
                        alpha(theme.palette.primary.main, 0.1),
                      color: type === 'customers' ? 
                        (item.balance > 0 ? '#f44336' : '#4caf50') : 
                        theme.palette.primary.main
                    }}
                  >
                    {type === 'customers' ? 
                      (item.customerName?.[0]?.toUpperCase() || 'C') : 
                      '₹'
                    }
                  </Avatar>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={500} noWrap>
                      {type === 'customers' ? item.customerName || 'Unknown Customer' : item.customerName || 'Payment'}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        {type === 'customers' ? item.phone || 'No Phone' : 
                          item.date?.toDate().toLocaleDateString('en-IN', { 
                            day: 'numeric', 
                            month: 'short' 
                          })}
                      </Typography>
                      <Box sx={{ width: 3, height: 3, bgcolor: 'text.secondary', borderRadius: '50%' }} />
                      <Typography 
                        variant="caption" 
                        fontWeight={600}
                        color={type === 'customers' ? 
                          (item.balance > 0 ? 'error.main' : 'success.main') : 
                          'primary.main'
                        }
                      >
                        {type === 'customers' ? 
                          `₹${item.balance?.toFixed(0) || '0'}` : 
                          `₹${item.amount?.toFixed(0) || '0'}`
                        }
                      </Typography>
                    </Stack>
                  </Box>
                  {type === 'customers' && (
                    <Chip
                      label={item.balance > 0 ? 'Pending' : 'Paid'}
                      size="small"
                      color={item.balance > 0 ? 'warning' : 'success'}
                      sx={{ fontSize: '0.65rem', height: 20 }}
                    />
                  )}
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : (
          <Box sx={{ 
            textAlign: 'center', 
            py: 4,
            color: 'text.secondary'
          }}>
            {type === 'customers' ? 
              <People sx={{ fontSize: 48, opacity: 0.5, mb: 1.5 }} /> :
              <Receipt sx={{ fontSize: 48, opacity: 0.5, mb: 1.5 }} />
            }
            <Typography variant="body2" fontWeight={500} gutterBottom>
              {emptyMessage}
            </Typography>
            <Button 
              variant="outlined" 
              size="small" 
              onClick={() => navigate(type === 'customers' ? '/entry' : '/paid')}
              sx={{ mt: 1 }}
            >
              Add {type === 'customers' ? 'Customer' : 'Payment'}
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  const ChartCard = () => (
    <Card 
      elevation={0}
      sx={{
        borderRadius: 2.5,
        border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
        background: 'white',
        height: '100%'
      }}
    >
      <CardContent sx={{ p: isMobile ? 2 : 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              Weekly Collection
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Last 7 days payment trend
            </Typography>
          </Box>
          <Chip 
            icon={<TrendingUp />} 
            label="+12% this week" 
            size="small" 
            color="success"
            sx={{ fontSize: '0.75rem' }}
          />
        </Stack>

        {stats.loading ? (
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
        ) : (
          <Box sx={{ height: 200, position: 'relative' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ height: '100%' }}>
              {chartData.map((day, index) => {
                const maxAmount = Math.max(...chartData.map(d => d.amount));
                const height = maxAmount > 0 ? (day.amount / maxAmount) * 150 : 0;
                
                return (
                  <Box key={index} sx={{ textAlign: 'center', flex: 1 }}>
                    <Box
                      sx={{
                        height: `${height}px`,
                        bgcolor: alpha(theme.palette.primary.main, 0.2),
                        borderRadius: 1,
                        mx: 0.5,
                        position: 'relative',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.4)
                        }
                      }}
                    >
                      <Typography 
                        variant="caption" 
                        sx={{
                          position: 'absolute',
                          top: -25,
                          left: 0,
                          right: 0,
                          fontWeight: 600,
                          color: theme.palette.primary.main
                        }}
                      >
                        {day.amount > 0 ? formatCurrency(day.amount) : ''}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      {day.date}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', display: 'block' }}>
              Total this week: {formatCurrency(chartData.reduce((sum, day) => sum + day.amount, 0))}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  const QuickActions = () => (
    <Card 
      elevation={0}
      sx={{
        borderRadius: 2.5,
        border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
        background: 'white',
        height: '100%'
      }}
    >
      <CardContent sx={{ p: isMobile ? 2 : 2.5 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Quick Actions
        </Typography>
        
        <Grid container spacing={1.5}>
          {[
            { 
              label: 'Add Customer', 
              icon: <People />, 
              color: theme.palette.primary.main,
              path: '/entry',
              description: 'Add new customer'
            },
            { 
              label: 'Record Payment', 
              icon: <Payment />, 
              color: '#4caf50',
              path: '/paid',
              description: 'Receive payment'
            },
            { 
              label: 'View All Customers', 
              icon: <Store />, 
              color: '#2196f3',
              path: '/',
              description: 'Browse customers'
            },
            { 
              label: 'Check Pending', 
              icon: <Pending />, 
              color: '#ff9800',
              path: '/?filter=pending',
              description: 'View pending debts'
            }
          ].map((action, index) => (
            <Grid item xs={6} key={index}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={action.icon}
                onClick={() => navigate(action.path)}
                sx={{
                  p: 2,
                  height: '100%',
                  borderRadius: 1.5,
                  borderColor: alpha(action.color, 0.3),
                  color: action.color,
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  '&:hover': {
                    borderColor: action.color,
                    bgcolor: alpha(action.color, 0.04)
                  }
                }}
              >
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {action.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {action.description}
                  </Typography>
                </Box>
              </Button>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ 
      pb: isMobile ? 7 : 0,
      bgcolor: '#fafafa',
      minHeight: '100vh'
    }}>
      <Container maxWidth="xl" sx={{ px: isMobile ? 1.5 : 3, py: isMobile ? 1.5 : 3 }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" fontWeight={700} color="text.primary" gutterBottom>
            Dashboard Overview
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Welcome back! Here's what's happening with your store today.
          </Typography>
        </Box>

        {/* Stats Grid */}
        <Grid container spacing={isMobile ? 2 : 3} sx={{ mb: isMobile ? 2 : 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Total Customers"
              value={stats.totalCustomers}
              icon={<People />}
              color="#d32f2f"
              trend={{ value: 12, label: '+5 this week' }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Pending Debt"
              value={formatCurrency(stats.totalDebt)}
              icon={<Pending />}
              color="#f44336"
              subtitle={`${stats.pendingCustomers} customers pending`}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Today's Payments"
              value={formatCurrency(stats.todayPayments)}
              icon={<AccountBalanceWallet />}
              color="#4caf50"
              trend={{ value: 8, label: '+2 today' }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Monthly Collection"
              value={formatCurrency(stats.monthlyCollection)}
              icon={<TrendingUp />}
              color="#2196f3"
              subtitle={`${stats.todayCustomers} new customers`}
            />
          </Grid>
        </Grid>

        {/* Main Content Grid */}
        <Grid container spacing={isMobile ? 2 : 3}>
          {/* Left Column */}
          <Grid item xs={12} lg={8}>
            <Grid container spacing={isMobile ? 2 : 3}>
              {/* Chart */}
              <Grid item xs={12}>
                <ChartCard />
              </Grid>
              
              {/* Recent Customers */}
              <Grid item xs={12} md={6}>
                <RecentActivityCard
                  title="Recent Customers"
                  items={recentCustomers}
                  type="customers"
                  emptyMessage="No customers yet"
                />
              </Grid>

              {/* Recent Payments */}
              <Grid item xs={12} md={6}>
                <RecentActivityCard
                  title="Recent Payments"
                  items={recentPayments}
                  type="payments"
                  emptyMessage="No payments yet"
                />
              </Grid>
            </Grid>
          </Grid>

          {/* Right Column */}
          <Grid item xs={12} lg={4}>
            <Stack spacing={isMobile ? 2 : 3}>
              {/* Quick Actions */}
              <QuickActions />

              {/* Summary Card */}
              <Card 
                elevation={0}
                sx={{
                  borderRadius: 2.5,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`
                }}
              >
                <CardContent sx={{ p: isMobile ? 2 : 2.5 }}>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2, color: theme.palette.primary.main }}>
                    Performance Summary
                  </Typography>
                  
                  <Stack spacing={2}>
                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Collection Rate
                        </Typography>
                        <Typography variant="caption" fontWeight={600} color="primary">
                          {stats.totalCustomers > 0 ? 
                            Math.round(((stats.totalCustomers - stats.pendingCustomers) / stats.totalCustomers) * 100) : 0
                          }%
                        </Typography>
                      </Stack>
                      <LinearProgress 
                        variant="determinate" 
                        value={stats.totalCustomers > 0 ? 
                          ((stats.totalCustomers - stats.pendingCustomers) / stats.totalCustomers) * 100 : 0
                        } 
                        sx={{ 
                          height: 6,
                          borderRadius: 3,
                          bgcolor: alpha(theme.palette.primary.main, 0.1)
                        }}
                      />
                    </Box>

                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Avg. Payment
                        </Typography>
                        <Typography variant="caption" fontWeight={600} color="primary">
                          {recentPayments.length > 0 ? 
                            formatCurrency(recentPayments.reduce((sum, p) => sum + (p.amount || 0), 0) / recentPayments.length) : 
                            '₹0'
                          }
                        </Typography>
                      </Stack>
                    </Box>

                    <Divider />

                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        Active Since
                      </Typography>
                      <Chip 
                        label="Today" 
                        size="small" 
                        sx={{ 
                          bgcolor: alpha('#4caf50', 0.1),
                          color: '#4caf50',
                          fontWeight: 600
                        }}
                      />
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Dashboard;