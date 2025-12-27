import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
// Remove or comment out the logo import
// import logo from '../../assets/logo.jpg';
import { 
  Box, 
  AppBar, 
  Toolbar, 
  Typography, 
  Container, 
  Drawer, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText, 
  Divider,
  IconButton,
  useTheme,
  useMediaQuery,
  CssBaseline,
  Avatar,
  Badge,
  Menu,
  MenuItem,
  Stack,
  Chip,
  Tooltip,
  Fade,
  LinearProgress,
  Button,
  Skeleton,
  Alert
} from '@mui/material';
import { 
  PersonAdd, 
  ListAlt, 
  Payment, 
  AttachMoney, 
  People,
  Menu as MenuIcon,
  Notifications,
  AccountCircle,
  Logout,
  Settings,
  Brightness4,
  Brightness7,
  Search,
  Dashboard,
  TrendingUp,
  Store,
  PictureAsPdf,
  ReceiptLong
} from '@mui/icons-material';
import { signOut } from 'firebase/auth';

// CORRECT IMPORT PATH
// Correct: Go up ONE level (to components), then to services
import { auth, db } from '../../services/firebase';

import { collection, query, onSnapshot, where, orderBy } from 'firebase/firestore';

const drawerWidth = 240;

const Layout = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [notificationsAnchor, setNotificationsAnchor] = useState(null);
  const [time, setTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    pendingCustomers: 0,
    totalDebt: 0,
    recentPayments: 0,
    recentTransactions: 0,
    loading: true
  });
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch real customer data from Firebase
  useEffect(() => {
    let unsubscribeCustomers = null;
    let unsubscribePayments = null;
    let unsubscribeTransactions = null;

    const fetchStats = async () => {
      try {
        // Fetch customers data
        const customersQuery = query(collection(db, 'customers'));
        unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
          let totalCustomers = 0;
          let pendingCustomers = 0;
          let totalDebt = 0;

          snapshot.forEach((doc) => {
            const customer = doc.data();
            totalCustomers++;
            
            const balance = customer.balance || 0;
            if (balance > 0) {
              pendingCustomers++;
              totalDebt += balance;
            }
          });

          setStats(prev => ({
            ...prev,
            totalCustomers,
            pendingCustomers,
            totalDebt,
            loading: false
          }));

          generateNotifications(pendingCustomers, totalDebt);
        });

        // Fetch recent payments for today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const paymentsQuery = query(
          collection(db, 'payments'),
          where('date', '>=', today),
          orderBy('date', 'desc')
        );
        
        unsubscribePayments = onSnapshot(paymentsQuery, (snapshot) => {
          let totalPaymentsToday = 0;
          snapshot.forEach((doc) => {
            totalPaymentsToday++;
          });

          setStats(prev => ({
            ...prev,
            recentPayments: totalPaymentsToday
          }));
        });

        // Fetch recent transactions for today
        const transactionsQuery = query(
          collection(db, 'transactions'),
          where('date', '>=', today),
          orderBy('date', 'desc')
        );
        
        unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
          let totalTransactionsToday = 0;
          snapshot.forEach((doc) => {
            totalTransactionsToday++;
          });

          setStats(prev => ({
            ...prev,
            recentTransactions: totalTransactionsToday
          }));
        });

      } catch (error) {
        console.error('Error fetching stats:', error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    };

    fetchStats();

    return () => {
      if (unsubscribeCustomers) unsubscribeCustomers();
      if (unsubscribePayments) unsubscribePayments();
      if (unsubscribeTransactions) unsubscribeTransactions();
    };
  }, []);

  // Generate notifications
  const generateNotifications = (pendingCount, totalDebt) => {
    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short' 
    });
    
    const newNotifications = [];
    
    if (pendingCount > 0) {
      newNotifications.push({
        id: 1,
        text: `${pendingCount} customer${pendingCount > 1 ? 's have' : ' has'} pending payments`,
        time: 'Today',
        type: 'payment',
        icon: '⚠️',
        action: () => navigate('/customers?filter=pending')
      });
    }

    if (totalDebt > 0) {
      const formattedDebt = formatLargeCurrency(totalDebt);
      newNotifications.push({
        id: 2,
        text: `Total pending debt: ${formattedDebt}`,
        time: 'Today',
        type: 'debt',
        icon: '💰',
        action: () => navigate('/customers')
      });
    }

    if (stats.recentPayments > 0) {
      newNotifications.push({
        id: 3,
        text: `${stats.recentPayments} payment${stats.recentPayments > 1 ? 's' : ''} received today`,
        time: 'Today',
        type: 'payment',
        icon: '✅',
        action: () => navigate('/paid')
      });
    }

    if (stats.recentTransactions > 0) {
      newNotifications.push({
        id: 4,
        text: `${stats.recentTransactions} new sale${stats.recentTransactions > 1 ? 's' : ''} today`,
        time: 'Today',
        type: 'sale',
        icon: '🛒',
        action: () => navigate('/')
      });
    }

    newNotifications.push({
      id: 5,
      text: `System running smoothly • ${formattedDate}`,
      time: 'Just now',
      type: 'system',
      icon: '⚙️',
      action: null
    });

    if (pendingCount > 0) {
      newNotifications.push({
        id: 6,
        text: `Generate bills for ${pendingCount} pending customer${pendingCount > 1 ? 's' : ''}`,
        time: 'Reminder',
        type: 'pdf',
        icon: '📄',
        action: () => navigate('/customers')
      });
    }

    setNotifications(newNotifications);
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

  const formatLargeCurrency = (amount) => {
    if (amount === 0) return '₹0';
    
    const formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    
    return formatter.format(amount);
  };

  const menuItems = [
    { text: 'Dashboard', icon: <Dashboard />, path: '/' },
    { text: 'Add Customer', icon: <PersonAdd />, path: '/entry' },
    { text: 'Customer List', icon: <ListAlt />, path: '/customers' },
    { text: 'Payments', icon: <Payment />, path: '/paid' },
    { text: 'Product Prices', icon: <AttachMoney />, path: '/price' },
    { text: 'Generate PDF', icon: <PictureAsPdf />, path: '/generate-pdf' },
    { text: 'Users', icon: <People />, path: '/users' },
  ];

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleNavigation = (path) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationsOpen = (event) => {
    setNotificationsAnchor(event.currentTarget);
  };

  const handleNotificationsClose = () => {
    setNotificationsAnchor(null);
  };

  const handleNotificationClick = (notification) => {
    if (notification.action) {
      notification.action();
    }
    handleNotificationsClose();
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('setupComplete');
      localStorage.removeItem('billSettings');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/customers?search=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getPageTitle = () => {
    const currentItem = menuItems.find(item => item.path === location.pathname);
    if (currentItem) return currentItem.text;
    
    if (location.pathname.includes('/list/')) return 'Customer Details';
    if (location.pathname.includes('/generate-pdf')) return 'PDF Generator';
    
    if (location.pathname === '/') return 'Dashboard';
    
    return 'Dashboard';
  };

  const calculateProgress = () => {
    if (stats.totalCustomers === 0) return 0;
    const paidCustomers = stats.totalCustomers - stats.pendingCustomers;
    return Math.round((paidCustomers / stats.totalCustomers) * 100);
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo Section - Updated with placeholder */}
      <Box 
        sx={{ 
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(211, 47, 47, 0.05)',
          borderBottom: '1px solid rgba(211, 47, 47, 0.1)',
          cursor: 'pointer',
          '&:hover': {
            bgcolor: 'rgba(211, 47, 47, 0.08)'
          }
        }}
        onClick={() => navigate('/')}
      >
        {/* Placeholder Logo using MUI Avatar */}
        <Avatar
          sx={{
            width: 100,
            height: 100,
            mb: 2,
            bgcolor: '#d32f2f',
            fontSize: '2rem',
            fontWeight: 'bold'
          }}
        >
          SD
        </Avatar>
        <Typography 
          variant="subtitle1" 
          sx={{ 
            fontWeight: 'bold',
            color: '#d32f2f',
            textAlign: 'center',
            fontSize: { xs: '0.9rem', md: '1rem' }
          }}
        >
          Shop Debt CRM
        </Typography>
        <Typography 
          variant="caption" 
          sx={{ 
            color: 'text.secondary',
            textAlign: 'center',
            mt: 0.5
          }}
        >
          Professional Debt Management
        </Typography>
      </Box>

      {/* Navigation Menu */}
      <Box sx={{ flexGrow: 1, p: 2 }}>
        <List sx={{ py: 0 }}>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            
            return (
              <ListItem 
                button 
                key={item.text} 
                onClick={() => handleNavigation(item.path)}
                sx={{
                  py: { xs: 1.25, md: 1.5 },
                  px: 2,
                  mb: 1,
                  borderRadius: 2,
                  backgroundColor: isActive ? 'rgba(211, 47, 47, 0.12)' : 'transparent',
                  '&:hover': {
                    backgroundColor: isActive ? 'rgba(211, 47, 47, 0.15)' : 'rgba(211, 47, 47, 0.08)',
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                <ListItemIcon sx={{ 
                  minWidth: { xs: 40, md: 44 },
                  color: isActive ? '#d32f2f' : 'text.secondary'
                }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: { xs: '0.875rem', md: '0.95rem' },
                    fontWeight: isActive ? 'bold' : 'medium',
                    color: isActive ? '#d32f2f' : 'text.primary'
                  }}
                />
                {isActive && (
                  <Box sx={{ 
                    width: 4, 
                    height: 24, 
                    bgcolor: '#d32f2f',
                    borderRadius: 2,
                    ml: 1
                  }} />
                )}
              </ListItem>
            );
          })}
        </List>
      </Box>

      {/* Bottom Section - Real Stats */}
      <Box sx={{ p: 2, bgcolor: 'rgba(211, 47, 47, 0.03)', borderTop: '1px solid rgba(211, 47, 47, 0.1)' }}>
        <Stack spacing={1}>
          {stats.loading ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Skeleton width="60%" height={20} />
                <Skeleton width="20%" height={32} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Skeleton width="60%" height={20} />
                <Skeleton width="20%" height={32} />
              </Box>
              <Skeleton variant="rectangular" height={6} sx={{ borderRadius: 3 }} />
            </>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">
                  Total Customers
                </Typography>
                <Chip 
                  label={stats.totalCustomers} 
                  size="small" 
                  color="primary" 
                  sx={{ fontWeight: 'bold' }} 
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">
                  Pending Customers
                </Typography>
                <Chip 
                  label={stats.pendingCustomers} 
                  size="small" 
                  color="warning" 
                  sx={{ fontWeight: 'bold' }} 
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">
                  Total Pending
                </Typography>
                <Chip 
                  label={formatLargeCurrency(stats.totalDebt)} 
                  size="small" 
                  color="error" 
                  sx={{ fontWeight: 'bold', fontSize: '0.75rem' }} 
                />
              </Box>
              <Box sx={{ mt: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Collection Progress
                  </Typography>
                  <Typography variant="caption" fontWeight="bold" color="primary">
                    {calculateProgress()}%
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={calculateProgress()} 
                  sx={{ 
                    height: 6, 
                    borderRadius: 3,
                    bgcolor: 'rgba(211, 47, 47, 0.1)',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: '#d32f2f'
                    }
                  }} 
                />
              </Box>
            </>
          )}
        </Stack>
      </Box>
    </Box>
  );

  return (
    <>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        {/* Enhanced AppBar/Navbar */}
        <AppBar 
          position="fixed" 
          elevation={1}
          sx={{ 
            zIndex: theme => theme.zIndex.drawer + (isMobile ? 0 : 1),
            bgcolor: 'white',
            color: 'text.primary',
            width: { md: `calc(100% - ${drawerWidth}px)` },
            ml: { md: `${drawerWidth}px` },
            borderBottom: '1px solid rgba(211, 47, 47, 0.1)',
            boxShadow: '0 2px 12px rgba(211, 47, 47, 0.08)'
          }}
        >
          <Toolbar sx={{ minHeight: { xs: 64, md: 72 }, px: { xs: 2, md: 3 } }}>
            {/* Mobile Menu Button */}
            {isMobile && (
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ 
                  mr: 2,
                  color: '#d32f2f'
                }}
              >
                <MenuIcon />
              </IconButton>
            )}

            {/* Page Title & Breadcrumb */}
            <Box sx={{ flexGrow: 1 }}>
              <Typography 
                variant="h6" 
                noWrap 
                sx={{ 
                  fontSize: { xs: '1.1rem', sm: '1.3rem', md: '1.4rem' },
                  fontWeight: 'bold',
                  color: '#d32f2f',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                {getPageTitle() === 'PDF Generator' ? <PictureAsPdf sx={{ fontSize: { xs: 20, md: 24 } }} /> : 
                 getPageTitle() === 'Customer List' ? <ListAlt sx={{ fontSize: { xs: 20, md: 24 } }} /> :
                 getPageTitle() === 'Customer Details' ? <People sx={{ fontSize: { xs: 20, md: 24 } }} /> :
                 <Store sx={{ fontSize: { xs: 20, md: 24 } }} />}
                {getPageTitle()}
              </Typography>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'text.secondary',
                  display: { xs: 'none', sm: 'block' }
                }}
              >
                {formatDate(time)} • {formatTime(time)}
                {stats.pendingCustomers > 0 && ` • ${stats.pendingCustomers} pending`}
              </Typography>
            </Box>

            {/* Search Bar (Desktop Only) */}
            {!isMobile && (
              <Fade in timeout={300}>
                <Box sx={{ 
                  position: 'relative', 
                  width: 300, 
                  mx: 2,
                  display: { xs: 'none', md: 'block' }
                }}>
                  <Search 
                    sx={{ 
                      position: 'absolute', 
                      left: 12, 
                      top: '50%', 
                      transform: 'translateY(-50%)',
                      color: 'text.secondary',
                      fontSize: 20
                    }} 
                  />
                  <input
                    type="text"
                    placeholder="Search customers, products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleSearch}
                    style={{
                      width: '100%',
                      padding: '10px 16px 10px 40px',
                      borderRadius: '20px',
                      border: '1px solid rgba(211, 47, 47, 0.2)',
                      fontSize: '0.9rem',
                      outline: 'none',
                      transition: 'all 0.3s ease',
                      backgroundColor: '#f9f9f9'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#d32f2f'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(211, 47, 47, 0.2)'}
                  />
                </Box>
              </Fade>
            )}

            {/* Action Icons */}
            <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 2 }}>
              {/* Notifications */}
              <Tooltip title="Notifications" arrow>
                <IconButton 
                  onClick={handleNotificationsOpen}
                  sx={{ 
                    position: 'relative',
                    color: 'text.secondary',
                    '&:hover': { color: '#d32f2f' }
                  }}
                >
                  <Badge 
                    badgeContent={notifications.filter(n => n.type !== 'system').length} 
                    color="error"
                    sx={{
                      '& .MuiBadge-badge': {
                        fontSize: '0.6rem',
                        height: 16,
                        minWidth: 16
                      }
                    }}
                  >
                    <Notifications />
                  </Badge>
                </IconButton>
              </Tooltip>

              {/* Quick Stats Chip */}
              {!stats.loading && stats.totalDebt > 0 && (
                <Chip
                  icon={<TrendingUp />}
                  label={formatCurrency(stats.totalDebt)}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(211, 47, 47, 0.1)',
                    color: '#d32f2f',
                    fontWeight: 'bold',
                    display: { xs: 'none', sm: 'flex' }
                  }}
                  onClick={() => navigate('/customers')}
                  clickable
                />
              )}

              {/* Theme Toggle */}
              <Tooltip title={darkMode ? "Light Mode" : "Dark Mode"} arrow>
                <IconButton 
                  onClick={() => setDarkMode(!darkMode)}
                  sx={{ 
                    color: 'text.secondary',
                    '&:hover': { color: '#d32f2f' }
                  }}
                >
                  {darkMode ? <Brightness7 /> : <Brightness4 />}
                </IconButton>
              </Tooltip>

              {/* Quick PDF Button */}
              {stats.pendingCustomers > 0 && !isMobile && (
                <Tooltip title="Generate Bills for Pending Customers" arrow>
                  <Button
                    startIcon={<PictureAsPdf />}
                    variant="contained"
                    size="small"
                    sx={{
                      bgcolor: '#d32f2f',
                      '&:hover': {
                        bgcolor: '#b71c1c'
                      },
                      textTransform: 'none',
                      fontWeight: 'bold'
                    }}
                    onClick={() => navigate('/generate-pdf')}
                  >
                    Generate Bills
                  </Button>
                </Tooltip>
              )}

              {/* User Profile */}
              <Tooltip title="Account Settings" arrow>
                <IconButton 
                  onClick={handleMenuOpen}
                  sx={{ 
                    p: 0,
                    ml: 1
                  }}
                >
                  <Avatar 
                    sx={{ 
                      width: 36, 
                      height: 36,
                      bgcolor: '#d32f2f',
                      fontSize: '0.9rem'
                    }}
                  >
                    {auth.currentUser?.email?.[0]?.toUpperCase() || 'A'}
                  </Avatar>
                </IconButton>
              </Tooltip>
            </Stack>

            {/* Notifications Menu */}
            <Menu
              anchorEl={notificationsAnchor}
              open={Boolean(notificationsAnchor)}
              onClose={handleNotificationsClose}
              PaperProps={{
                elevation: 3,
                sx: {
                  width: 320,
                  maxHeight: 400,
                  mt: 1.5,
                  borderRadius: 2,
                  border: '1px solid rgba(211, 47, 47, 0.1)'
                }
              }}
            >
              <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  Notifications ({notifications.filter(n => n.type !== 'system').length})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Based on your store data
                </Typography>
              </Box>
              {notifications.filter(n => n.type !== 'system').map((notification) => (
                <MenuItem 
                  key={notification.id} 
                  onClick={() => handleNotificationClick(notification)}
                  sx={{ 
                    py: 1.5,
                    borderBottom: '1px solid rgba(0,0,0,0.05)',
                    '&:hover': { bgcolor: 'rgba(211, 47, 47, 0.05)' }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
                    <Box sx={{ 
                      width: 32, 
                      height: 32, 
                      mr: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.2rem'
                    }}>
                      {notification.icon}
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2">
                        {notification.text}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {notification.time}
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
              ))}
              {notifications.length === 0 && (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No notifications yet
                  </Typography>
                </Box>
              )}
              <Divider />
              <Box sx={{ p: 1.5, textAlign: 'center' }}>
                <Button 
                  size="small" 
                  color="primary"
                  onClick={handleNotificationsClose}
                  sx={{ textTransform: 'none' }}
                >
                  Close
                </Button>
              </Box>
            </Menu>

            {/* User Menu */}
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              PaperProps={{
                elevation: 3,
                sx: {
                  width: 220,
                  mt: 1.5,
                  borderRadius: 2,
                  border: '1px solid rgba(211, 47, 47, 0.1)'
                }
              }}
            >
              <Box sx={{ p: 2, textAlign: 'center', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  {auth.currentUser?.email || 'Shop Owner'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Owner • Active
                </Typography>
              </Box>
              <MenuItem onClick={handleMenuClose}>
                <ListItemIcon><AccountCircle fontSize="small" /></ListItemIcon>
                <ListItemText>Profile</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => { handleMenuClose(); navigate('/settings'); }}>
                <ListItemIcon><Settings fontSize="small" /></ListItemIcon>
                <ListItemText>Settings</ListItemText>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout} sx={{ color: '#d32f2f' }}>
                <ListItemIcon><Logout fontSize="small" sx={{ color: '#d32f2f' }} /></ListItemIcon>
                <ListItemText>Logout</ListItemText>
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        {/* Drawer/Sidebar */}
        <Box
          component="nav"
          sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        >
          {isMobile ? (
            <Drawer
              variant="temporary"
              open={mobileOpen}
              onClose={handleDrawerToggle}
              ModalProps={{
                keepMounted: true,
              }}
              sx={{
                display: { xs: 'block', md: 'none' },
                '& .MuiDrawer-paper': {
                  boxSizing: 'border-box',
                  width: drawerWidth,
                  borderRight: '1px solid rgba(211, 47, 47, 0.1)'
                },
              }}
            >
              {drawerContent}
            </Drawer>
          ) : (
            <Drawer
              variant="permanent"
              sx={{
                display: { xs: 'none', md: 'block' },
                '& .MuiDrawer-paper': {
                  boxSizing: 'border-box',
                  width: drawerWidth,
                  borderRight: '1px solid rgba(211, 47, 47, 0.1)'
                },
              }}
              open
            >
              {drawerContent}
            </Drawer>
          )}
        </Box>

        {/* Main Content Area */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: { xs: 2, sm: 3 },
            width: { md: `calc(100% - ${drawerWidth}px)` },
            minHeight: '100vh',
            backgroundColor: '#fafafa'
          }}
        >
          {/* Spacer for AppBar height */}
          <Toolbar 
            sx={{ 
              minHeight: { xs: 64, sm: 72, md: 72 } 
            }} 
          />
          
          {/* PDF Generation Alert */}
          {stats.pendingCustomers > 0 && location.pathname === '/' && (
            <Alert 
              severity="info" 
              sx={{ 
                mb: 2, 
                borderRadius: 2,
                bgcolor: 'rgba(211, 47, 47, 0.1)',
                border: '1px solid rgba(211, 47, 47, 0.2)'
              }}
              action={
                <Button 
                  color="primary" 
                  size="small" 
                  startIcon={<PictureAsPdf />}
                  onClick={() => navigate('/generate-pdf')}
                >
                  Generate Bills
                </Button>
              }
            >
              You have {stats.pendingCustomers} customer{stats.pendingCustomers > 1 ? 's' : ''} with pending payments. 
              Generate bills to send reminders.
            </Alert>
          )}
          
          <Container 
            maxWidth="xl" 
            sx={{ 
              mt: { xs: 1, md: 2 },
              p: { xs: 0, sm: 1 }
            }}
          >
            <Outlet />
          </Container>
        </Box>
      </Box>
    </>
  );
};

export default Layout;