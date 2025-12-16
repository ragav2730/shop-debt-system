import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import logo from '../assets/logo.jpg';
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
  Button  // ADD THIS IMPORT
} from '@mui/material';
import { 
  Home, 
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
  AccessTime,
  Phone,
  Store
} from '@mui/icons-material';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase'; // FIXED PATH: Changed '../services' to '../../services'

const drawerWidth = 240;

const Layout = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [notificationsAnchor, setNotificationsAnchor] = useState(null);
  const [time, setTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const menuItems = [
    { text: 'Dashboard', icon: <Dashboard />, path: '/' },
    { text: 'Add Customer', icon: <PersonAdd />, path: '/entry' },
    { text: 'Customer List', icon: <ListAlt />, path: '/' },
    { text: 'Payments', icon: <Payment />, path: '/paid' },
    { text: 'Product Prices', icon: <AttachMoney />, path: '/price' },
    { text: 'Users', icon: <People />, path: '/users' },
  ];

  const notifications = [
    { id: 1, text: 'Ramesh has ₹5,000 pending', time: '2 hours ago', type: 'payment' },
    { id: 2, text: '3 customers added today', time: '4 hours ago', type: 'customer' },
    { id: 3, text: 'Stock running low for Cement', time: '1 day ago', type: 'stock' },
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

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('isLoggedIn');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery)}`);
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
    return 'Dashboard';
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo Section */}
      <Box 
        sx={{ 
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(211, 47, 47, 0.05)',
          borderBottom: '1px solid rgba(211, 47, 47, 0.1)'
        }}
      >
        <img
          src={logo}
          alt="Shop Debt System Logo"
          style={{
            width: '100%',
            maxWidth: '160px',
            height: 'auto',
            objectFit: 'contain',
            marginBottom: '12px',
            borderRadius: '8px'
          }}
        />
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
            const isActive = location.pathname === item.path || 
                            (item.path === '/' && location.pathname === '/');
            
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

      {/* Bottom Section - Stats */}
      <Box sx={{ p: 2, bgcolor: 'rgba(211, 47, 47, 0.03)', borderTop: '1px solid rgba(211, 47, 47, 0.1)' }}>
        <Stack spacing={1}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="caption" color="text.secondary">
              Active Customers
            </Typography>
            <Chip label="48" size="small" color="primary" sx={{ fontWeight: 'bold' }} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="caption" color="text.secondary">
              Pending Amount
            </Typography>
            <Chip label="₹2.4L" size="small" color="error" sx={{ fontWeight: 'bold' }} />
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={65} 
            sx={{ 
              height: 6, 
              borderRadius: 3,
              bgcolor: 'rgba(211, 47, 47, 0.1)',
              '& .MuiLinearProgress-bar': {
                bgcolor: '#d32f2f'
              }
            }} 
          />
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
                <Store sx={{ fontSize: { xs: 20, md: 24 } }} />
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
                    badgeContent={notifications.length} 
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
              <Chip
                icon={<TrendingUp />}
                label="₹2.4L Pending"
                size="small"
                sx={{
                  bgcolor: 'rgba(211, 47, 47, 0.1)',
                  color: '#d32f2f',
                  fontWeight: 'bold',
                  display: { xs: 'none', sm: 'flex' }
                }}
              />

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
                  Notifications ({notifications.length})
                </Typography>
              </Box>
              {notifications.map((notification) => (
                <MenuItem 
                  key={notification.id} 
                  sx={{ 
                    py: 1.5,
                    borderBottom: '1px solid rgba(0,0,0,0.05)',
                    '&:hover': { bgcolor: 'rgba(211, 47, 47, 0.05)' }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
                    <Avatar 
                      sx={{ 
                        width: 32, 
                        height: 32, 
                        mr: 2,
                        bgcolor: notification.type === 'payment' ? '#d32f2f' : 
                                notification.type === 'customer' ? '#1976d2' : '#ed6c02'
                      }}
                    >
                      {notification.type === 'payment' ? '₹' : 
                       notification.type === 'customer' ? '👤' : '📦'}
                    </Avatar>
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
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Button 
                  size="small" 
                  color="primary"
                  onClick={handleNotificationsClose}
                >
                  Mark all as read
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
              <MenuItem onClick={handleMenuClose}>
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