import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Stack,
  Card,
  Skeleton,
  Fade,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
  Alert,
  Grid,
  Chip,
  Fab,
  BottomNavigation,
  BottomNavigationAction,
  Paper
} from '@mui/material';
import {
  Add,
  Sort,
  CalendarToday,
  AccountBalance,
  ArrowDownward,
  ArrowUpward,
  Refresh,
  Warning,
  Search,
  FilterList,
  ViewList,
  Dashboard
} from '@mui/icons-material';
import { collection, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';

import PurchaseCard from './PurchaseCard';
import SearchBar from '../Shared/SearchBar';
import PremiumCard from '../Shared/PremiumCard';

const PRIMARY_BLUE = '#1976d2';

const PurchasesPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const [purchases, setPurchases] = useState([]);
  const [filteredPurchases, setFilteredPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [anchorEl, setAnchorEl] = useState(null);
  const [error, setError] = useState(null);
  const [payments, setPayments] = useState([]);
  const [mobileView, setMobileView] = useState('list'); // 'list' or 'stats'

  const [stats, setStats] = useState({
    totalPurchases: 0,
    totalAmount: 0,
    pendingAmount: 0,
    completedPurchases: 0,
    partiallyPaid: 0
  });

  /* -------------------- FETCH DATA -------------------- */
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch purchases
        const purchasesQuery = query(collection(db, 'transactions'), orderBy('date', 'desc'));
        const purchasesSnapshot = await getDocs(purchasesQuery);
        const purchasesData = purchasesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Fetch payments to calculate actual paid amounts
        const paymentsQuery = query(collection(db, 'payments'));
        const paymentsSnapshot = await getDocs(paymentsQuery);
        const paymentsData = paymentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setPayments(paymentsData);

        // Enrich purchases with payment calculations
   // In PurchasesPage.js, when fetching data, ensure you're calculating and passing:
const enrichedPurchases = purchasesData.map(purchase => {
  // Calculate real-time payment data
  const purchasePayments = paymentsData.filter(
    payment => payment.transactionId === purchase.id
  );
  
  const totalPaidForPurchase = purchasePayments.reduce(
    (sum, payment) => sum + (payment.amount || 0),
    0
  );
  
  const purchaseAmount = purchase.amount || 0;
  let calculatedRemaining = purchaseAmount - totalPaidForPurchase;
  
  return {
    ...purchase,
    totalPaid: totalPaidForPurchase, // CRITICAL: Pass this
    calculatedRemaining: Math.max(0, calculatedRemaining), // CRITICAL: Pass this
    paymentCount: purchasePayments.length, // CRITICAL: Pass this
    status: calculatedRemaining === 0 ? 'paid' : 
            totalPaidForPurchase > 0 ? 'partial' : 'pending'
  };
});

        setPurchases(enrichedPurchases);
        setFilteredPurchases(enrichedPurchases);

        // Calculate stats
        const totalAmount = enrichedPurchases.reduce(
          (sum, p) => sum + (p.amount || 0),
          0
        );

        const pendingAmount = enrichedPurchases.reduce(
          (sum, p) => sum + (p.calculatedRemaining || 0),
          0
        );

        const completedPurchases = enrichedPurchases.filter(
          p => p.calculatedRemaining === 0
        ).length;

        const partiallyPaid = enrichedPurchases.filter(
          p => p.status === 'partial'
        ).length;

        setStats({
          totalPurchases: enrichedPurchases.length,
          totalAmount,
          pendingAmount,
          completedPurchases,
          partiallyPaid
        });

        setLoading(false);
      } catch (err) {
        console.error('Error fetching purchases:', err);
        setError('Failed to load purchase data');
        setLoading(false);
      }
    };

    fetchData();

    // Set up real-time listener for updates
    const unsubscribeTransactions = onSnapshot(
      query(collection(db, 'transactions'), orderBy('date', 'desc')),
      () => {
        fetchData(); // Refresh when transactions change
      }
    );

    const unsubscribePayments = onSnapshot(
      query(collection(db, 'payments')),
      () => {
        fetchData(); // Refresh when payments change
      }
    );

    return () => {
      unsubscribeTransactions();
      unsubscribePayments();
    };
  }, []);

  /* -------------------- FILTER + SORT -------------------- */
  useEffect(() => {
    let list = [...purchases];

    // Search
    if (searchTerm) {
      list = list.filter(p =>
        p.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.customerId?.includes(searchTerm) ||
        p.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter (FIXED LOGIC)
    if (statusFilter !== 'all') {
      list = list.filter(p => {
        const remaining = p.calculatedRemaining || 0;
        const amount = p.amount || 0;
        
        switch (statusFilter) {
          case 'pending':
            return remaining > 0;
          case 'paid':
            return remaining === 0 && amount > 0;
          case 'partial':
            return p.status === 'partial';
          case 'unpaid':
            return (p.paymentCount || 0) === 0 && amount > 0;
          default:
            return true;
        }
      });
    }

    // Sort
    list.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'date':
          aValue = new Date(a.date?.toDate?.() || a.date || 0);
          bValue = new Date(b.date?.toDate?.() || b.date || 0);
          break;
        case 'amount':
          aValue = a.amount || 0;
          bValue = b.amount || 0;
          break;
        case 'remaining':
          aValue = a.calculatedRemaining || 0;
          bValue = b.calculatedRemaining || 0;
          break;
        case 'customer':
          aValue = a.customerName?.toLowerCase() || '';
          bValue = b.customerName?.toLowerCase() || '';
          break;
        default:
          aValue = 0;
          bValue = 0;
      }
      
      const comparison = sortOrder === 'desc' 
        ? bValue > aValue ? 1 : -1
        : aValue > bValue ? 1 : -1;
      
      if (comparison === 0) {
        const aDate = new Date(a.date?.toDate?.() || a.date || 0);
        const bDate = new Date(b.date?.toDate?.() || b.date || 0);
        return sortOrder === 'desc' ? bDate - aDate : aDate - bDate;
      }
      
      return comparison;
    });

    setFilteredPurchases(list);
  }, [searchTerm, statusFilter, sortBy, sortOrder, purchases]);

  /* -------------------- HELPER FUNCTIONS -------------------- */
  const handleSortChange = (newSortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
    setAnchorEl(null);
  };

  const handleRefresh = () => {
    window.location.reload();
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

  /* -------------------- LOADING -------------------- */
  if (loading) {
    return (
      <Box sx={{ 
        minHeight: '100vh', 
        bgcolor: '#f5f7fb',
        pt: isMobile ? '56px' : '64px'
      }}>
        {/* Mobile Top Bar */}
        {isMobile && (
          <Box
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bgcolor: PRIMARY_BLUE,
              py: 2,
              px: 2,
              zIndex: 1100
            }}
          >
            <Typography
              fontSize={18}
              fontWeight={700}
              color="white"
            >
              Purchase History
            </Typography>
          </Box>
        )}

        <Box sx={{ p: 2 }}>
          <Skeleton 
            variant="rectangular" 
            height={isMobile ? 100 : 150} 
            sx={{ 
              borderRadius: 3, 
              mb: 2,
              bgcolor: 'rgba(0,0,0,0.08)'
            }} 
          />
          
          {[1, 2, 3].map(i => (
            <Skeleton 
              key={i} 
              variant="rectangular" 
              height={isMobile ? 80 : 110} 
              sx={{ 
                borderRadius: 3, 
                mb: 2,
                bgcolor: 'rgba(0,0,0,0.06)'
              }} 
            />
          ))}
        </Box>
      </Box>
    );
  }

  /* -------------------- MOBILE VIEW SWITCHER -------------------- */
  const renderMobileView = () => {
    switch (mobileView) {
      case 'stats':
        return (
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Purchase Statistics
            </Typography>
            <Grid container spacing={2}>
              {[
                { label: 'Total', value: stats.totalPurchases, color: PRIMARY_BLUE },
                { label: 'Amount', value: formatCurrency(stats.totalAmount), color: '#4CAF50' },
                { label: 'Pending', value: formatCurrency(stats.pendingAmount), color: '#FF9800' },
                { label: 'Completed', value: stats.completedPurchases, color: '#9C27B0' },
                { label: 'Partial', value: stats.partiallyPaid, color: '#FF5722' },
                { label: 'Pending %', 
                  value: stats.totalPurchases > 0 
                    ? `${Math.round((stats.completedPurchases / stats.totalPurchases) * 100)}%` 
                    : '0%', 
                  color: '#607D8B' 
                }
              ].map((s, i) => (
                <Grid item xs={6} key={i}>
                  <PremiumCard
                    sx={{
                      textAlign: 'center',
                      borderRadius: 2,
                      p: 2,
                      border: `1px solid ${s.color}20`,
                      bgcolor: `${s.color}08`,
                      height: '100%'
                    }}
                  >
                    <Typography 
                      fontWeight={700} 
                      fontSize={16}
                      color={s.color}
                    >
                      {s.value}
                    </Typography>
                    <Typography 
                      fontSize={10} 
                      color="text.secondary"
                      sx={{ mt: 0.5 }}
                    >
                      {s.label}
                    </Typography>
                  </PremiumCard>
                </Grid>
              ))}
            </Grid>
          </Box>
        );
      
      case 'list':
      default:
        return (
          <Box sx={{ p: 2 }}>
            {/* Mobile Filter Chips */}
            <Box sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 1 }}>
                {['all', 'pending', 'paid', 'partial', 'unpaid'].map((filter) => (
                  <Chip
                    key={filter}
                    label={filter.charAt(0).toUpperCase() + filter.slice(1)}
                    size="small"
                    onClick={() => setStatusFilter(filter)}
                    color={statusFilter === filter ? "primary" : "default"}
                    variant={statusFilter === filter ? "filled" : "outlined"}
                    sx={{
                      fontSize: 12,
                      fontWeight: statusFilter === filter ? 600 : 400
                    }}
                  />
                ))}
              </Stack>
            </Box>

            {/* Purchase List */}
            <Stack spacing={2}>
              {filteredPurchases.map(p => (
                <PurchaseCard
                  key={p.id}
                  purchase={p}
                  onClick={() => navigate(`/purchases/${p.id}`)}
                  isMobile={isMobile}
                />
              ))}
            </Stack>
          </Box>
        );
    }
  };

  /* -------------------- MOBILE UI -------------------- */
  if (isMobile) {
    return (
      <Box sx={{ 
        minHeight: '100vh', 
        bgcolor: '#f5f7fb',
        pb: 8
      }}>
        {/* Fixed Header */}
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bgcolor: PRIMARY_BLUE,
            py: 2,
            px: 2,
            zIndex: 1100,
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}
        >
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography
              fontSize={18}
              fontWeight={700}
              color="white"
              sx={{ flex: 1 }}
            >
              Purchase History
            </Typography>
            
            <IconButton
              onClick={handleRefresh}
              sx={{
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.2)',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.3)'
                }
              }}
              size="small"
            >
              <Refresh fontSize="small" />
            </IconButton>

            <IconButton
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.2)',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.3)'
                }
              }}
              size="small"
            >
              <Sort fontSize="small" />
            </IconButton>
          </Stack>
        </Box>

        {/* Content Area */}
        <Box sx={{ pt: '56px' }}>
          {/* Search Bar */}
          <Box sx={{ p: 2 }}>
            <SearchBar
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search purchases..."
              fullWidth
              size="small"
            />
          </Box>

          {/* Active Filters */}
          <Box sx={{ px: 2, mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary">
                {filteredPurchases.length} items
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Chip
                label={statusFilter}
                size="small"
                variant="outlined"
                sx={{ fontSize: 10 }}
              />
              {searchTerm && (
                <Chip
                  label={`Search: ${searchTerm}`}
                  size="small"
                  variant="outlined"
                  onDelete={() => setSearchTerm('')}
                  sx={{ fontSize: 10 }}
                />
              )}
            </Stack>
          </Box>

          {/* Error Alert */}
          {error && (
            <Box sx={{ px: 2, mb: 2 }}>
              <Alert 
                severity="error" 
                onClose={() => setError(null)}
                sx={{ borderRadius: 2 }}
                size="small"
              >
                {error}
              </Alert>
            </Box>
          )}

          {/* Data Quality Warning */}
          {purchases.some(p => typeof p.remainingAmount !== 'number') && (
            <Box sx={{ px: 2, mb: 2 }}>
              <Alert 
                severity="warning" 
                icon={<Warning fontSize="small" />}
                sx={{ borderRadius: 2 }}
                size="small"
              >
                Calculated amounts shown
              </Alert>
            </Box>
          )}

          {/* Mobile Content */}
          {renderMobileView()}

          {/* No Results */}
          {filteredPurchases.length === 0 && !loading && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                {searchTerm 
                  ? `No purchases found for "${searchTerm}"`
                  : statusFilter !== 'all'
                  ? `No ${statusFilter} purchases found`
                  : 'No purchases found'}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Mobile Bottom Navigation */}
        <Paper 
          sx={{ 
            position: 'fixed', 
            bottom: 0, 
            left: 0, 
            right: 0,
            zIndex: 1000,
            borderTop: '1px solid #e0e0e0'
          }} 
          elevation={3}
        >
          <BottomNavigation
            value={mobileView}
            onChange={(event, newValue) => {
              setMobileView(newValue);
            }}
            showLabels
          >
            <BottomNavigationAction 
              label="List" 
              value="list" 
              icon={<ViewList />}
              sx={{ 
                minWidth: 'auto',
                '&.Mui-selected': { color: PRIMARY_BLUE }
              }}
            />
            <BottomNavigationAction 
              label="Stats" 
              value="stats" 
              icon={<Dashboard />}
              sx={{ 
                minWidth: 'auto',
                '&.Mui-selected': { color: PRIMARY_BLUE }
              }}
            />
            <BottomNavigationAction 
              label="Filter" 
              icon={<FilterList />}
              onClick={() => {
                // Show filter menu
                setStatusFilter(statusFilter === 'all' ? 'pending' : 
                              statusFilter === 'pending' ? 'paid' :
                              statusFilter === 'paid' ? 'partial' :
                              statusFilter === 'partial' ? 'unpaid' : 'all');
              }}
              sx={{ 
                minWidth: 'auto',
                '&.Mui-selected': { color: PRIMARY_BLUE }
              }}
            />
          </BottomNavigation>
        </Paper>

        {/* Mobile Floating Add Button */}
        <Fab
          onClick={() => navigate('/purchases/new')}
          sx={{
            position: 'fixed',
            bottom: 72,
            right: 16,
            bgcolor: PRIMARY_BLUE,
            color: 'white',
            '&:hover': {
              bgcolor: '#1565c0'
            }
          }}
          size="medium"
        >
          <Add />
        </Fab>

        {/* Sort Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          PaperProps={{
            sx: {
              mt: 1,
              borderRadius: 2,
              minWidth: 150
            }
          }}
        >
          <MenuItem 
            onClick={() => handleSortChange('date')}
            selected={sortBy === 'date'}
            dense
          >
            <ListItemIcon>
              <CalendarToday fontSize="small" />
            </ListItemIcon>
            <ListItemText>
              Date {sortBy === 'date' && (
                sortOrder === 'desc' ? <ArrowDownward fontSize="small" /> : <ArrowUpward fontSize="small" />
              )}
            </ListItemText>
          </MenuItem>

          <MenuItem 
            onClick={() => handleSortChange('amount')}
            selected={sortBy === 'amount'}
            dense
          >
            <ListItemIcon>
              <AccountBalance fontSize="small" />
            </ListItemIcon>
            <ListItemText>
              Amount {sortBy === 'amount' && (
                sortOrder === 'desc' ? <ArrowDownward fontSize="small" /> : <ArrowUpward fontSize="small" />
              )}
            </ListItemText>
          </MenuItem>
        </Menu>
      </Box>
    );
  }

  /* -------------------- DESKTOP/TABLET UI -------------------- */
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fb', pb: 10 }}>
      {/* Header */}
      <Box
        sx={{
          bgcolor: PRIMARY_BLUE,
          px: isTablet ? 3 : 4,
          py: isTablet ? 3 : 4,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          position: 'relative'
        }}
      >
        <Typography
          fontSize={isTablet ? 24 : 28}
          fontWeight={700}
          color="white"
        >
          Purchase History
        </Typography>
        <Typography color="rgba(255,255,255,0.9)" fontSize={isTablet ? 14 : 16}>
          Track all vendor purchases and payments
        </Typography>
        
        {/* Refresh Button */}
        <IconButton
          onClick={handleRefresh}
          sx={{
            position: 'absolute',
            right: isTablet ? 20 : 24,
            top: isTablet ? 20 : 24,
            color: 'white',
            bgcolor: 'rgba(255,255,255,0.2)',
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.3)'
            }
          }}
        >
          <Refresh />
        </IconButton>
      </Box>

      {/* Error Alert */}
      {error && (
        <Container maxWidth={isTablet ? "md" : "lg"} sx={{ mt: 2 }}>
          <Alert 
            severity="error" 
            onClose={() => setError(null)}
            sx={{ borderRadius: 3 }}
          >
            {error}
          </Alert>
        </Container>
      )}

      {/* Data Quality Warning */}
      {purchases.some(p => typeof p.remainingAmount !== 'number') && (
        <Container maxWidth={isTablet ? "md" : "lg"} sx={{ mt: 2 }}>
          <Alert 
            severity="warning" 
            icon={<Warning />}
            sx={{ borderRadius: 3 }}
          >
            Some purchases don't have proper payment tracking. Showing calculated amounts.
          </Alert>
        </Container>
      )}

      <Container maxWidth={isTablet ? "md" : "lg"} sx={{ mt: 3 }}>
        {/* Stats Grid */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { 
              label: 'Total Purchases', 
              value: stats.totalPurchases,
              color: PRIMARY_BLUE
            },
            { 
              label: 'Total Amount', 
              value: `₹${stats.totalAmount.toLocaleString('en-IN')}`,
              color: '#4CAF50'
            },
            { 
              label: 'Pending Amount', 
              value: `₹${stats.pendingAmount.toLocaleString('en-IN')}`,
              color: '#FF9800'
            },
            { 
              label: 'Completed', 
              value: stats.completedPurchases,
              color: '#9C27B0'
            },
            { 
              label: 'Partially Paid', 
              value: stats.partiallyPaid,
              color: '#FF5722'
            },
            { 
              label: 'Pending %', 
              value: stats.totalPurchases > 0 
                ? `${Math.round((stats.completedPurchases / stats.totalPurchases) * 100)}%` 
                : '0%',
              color: '#607D8B'
            }
          ].map((s, i) => (
            <Grid item xs={6} sm={4} md={2} key={i}>
              <PremiumCard
                sx={{
                  textAlign: 'center',
                  borderRadius: 3,
                  p: 2,
                  border: `1px solid ${s.color}20`,
                  bgcolor: `${s.color}08`,
                  height: '100%',
                  transition: 'transform 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }
                }}
              >
                <Typography 
                  fontWeight={700} 
                  fontSize={isTablet ? 16 : 18}
                  color={s.color}
                >
                  {s.value}
                </Typography>
                <Typography 
                  fontSize={isTablet ? 10 : 11} 
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  {s.label}
                </Typography>
              </PremiumCard>
            </Grid>
          ))}
        </Grid>

        {/* Search & Filters */}
        <Card sx={{ mt: 2, p: isTablet ? 2 : 3, borderRadius: 3 }}>
          <SearchBar
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by product, customer, or description"
            fullWidth
            size={isTablet ? "small" : "medium"}
          />

          <Stack direction="row" spacing={2} mt={2} alignItems="center" flexWrap="wrap">
            <ToggleButtonGroup
              value={statusFilter}
              exclusive
              onChange={(e, v) => v && setStatusFilter(v)}
              size={isTablet ? "small" : "medium"}
              sx={{
                flexWrap: 'wrap',
                '& .MuiToggleButton-root': {
                  fontSize: isTablet ? 12 : 14,
                  px: isTablet ? 1.5 : 2,
                  py: isTablet ? 0.5 : 1,
                  borderRadius: 2,
                  borderColor: '#ddd',
                  '&.Mui-selected': {
                    bgcolor: `${PRIMARY_BLUE}15`,
                    color: PRIMARY_BLUE,
                    borderColor: `${PRIMARY_BLUE}40`,
                    fontWeight: 600
                  }
                }
              }}
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="pending">Pending</ToggleButton>
              <ToggleButton value="paid">Paid</ToggleButton>
              <ToggleButton value="partial">Partial</ToggleButton>
              <ToggleButton value="unpaid">Unpaid</ToggleButton>
            </ToggleButtonGroup>

            <Box flex={1} />

            <IconButton
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{ 
                border: '1px solid #ddd',
                borderRadius: 2,
                width: isTablet ? 36 : 40,
                height: isTablet ? 36 : 40
              }}
            >
              <Sort />
            </IconButton>
          </Stack>
          
          {/* Active Filters Info */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Showing {filteredPurchases.length} of {purchases.length} purchases
              {statusFilter !== 'all' && ` • Filter: ${statusFilter}`}
              {searchTerm && ` • Search: "${searchTerm}"`}
              {sortBy !== 'date' && ` • Sorted by: ${sortBy} (${sortOrder})`}
            </Typography>
          </Box>
        </Card>

        {/* No Results */}
        {filteredPurchases.length === 0 && !loading && (
          <PremiumCard sx={{ 
            mt: 3, 
            p: 4, 
            textAlign: 'center',
            borderRadius: 3
          }}>
            <Typography color="text.secondary">
              {searchTerm 
                ? `No purchases found for "${searchTerm}"`
                : statusFilter !== 'all'
                ? `No ${statusFilter} purchases found`
                : 'No purchases found'}
            </Typography>
            {(searchTerm || statusFilter !== 'all') && (
              <Typography 
                variant="caption" 
                color="text.secondary"
                sx={{ mt: 1, display: 'block' }}
              >
                Try changing your search or filter
              </Typography>
            )}
          </PremiumCard>
        )}

        {/* List */}
        <Fade in={!loading} timeout={500}>
          <Grid container spacing={2} mt={3}>
            {filteredPurchases.map(p => (
              <Grid item xs={12} key={p.id}>
                <PurchaseCard
                  purchase={p}
                  onClick={() => navigate(`/purchases/${p.id}`)}
                  isMobile={false}
                />
              </Grid>
            ))}
          </Grid>
        </Fade>
      </Container>

      {/* Floating Add Button */}
      <Fab
        onClick={() => navigate('/purchases/new')}
        sx={{
          position: 'fixed',
          bottom: isTablet ? 24 : 32,
          right: isTablet ? 24 : 32,
          bgcolor: PRIMARY_BLUE,
          color: 'white',
          width: isTablet ? 56 : 64,
          height: isTablet ? 56 : 64,
          '&:hover': {
            bgcolor: '#1565c0',
            transform: 'scale(1.05)'
          },
          transition: 'all 0.2s ease'
        }}
      >
        <Add fontSize={isTablet ? "medium" : "large"} />
      </Fab>

      {/* Sort Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{
          sx: {
            mt: 1,
            borderRadius: 2,
            minWidth: 200
          }
        }}
      >
        <MenuItem 
          onClick={() => handleSortChange('date')}
          selected={sortBy === 'date'}
        >
          <ListItemIcon>
            <CalendarToday fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            Date {sortBy === 'date' && (
              sortOrder === 'desc' ? <ArrowDownward fontSize="small" /> : <ArrowUpward fontSize="small" />
            )}
          </ListItemText>
        </MenuItem>

        <MenuItem 
          onClick={() => handleSortChange('amount')}
          selected={sortBy === 'amount'}
        >
          <ListItemIcon>
            <AccountBalance fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            Amount {sortBy === 'amount' && (
              sortOrder === 'desc' ? <ArrowDownward fontSize="small" /> : <ArrowUpward fontSize="small" />
            )}
          </ListItemText>
        </MenuItem>

        <MenuItem 
          onClick={() => handleSortChange('remaining')}
          selected={sortBy === 'remaining'}
        >
          <ListItemIcon>
            <AccountBalance fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            Remaining {sortBy === 'remaining' && (
              sortOrder === 'desc' ? <ArrowDownward fontSize="small" /> : <ArrowUpward fontSize="small" />
            )}
          </ListItemText>
        </MenuItem>

        <MenuItem 
          onClick={() => handleSortChange('customer')}
          selected={sortBy === 'customer'}
        >
          <ListItemIcon>
            <AccountBalance fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            Customer {sortBy === 'customer' && (
              sortOrder === 'desc' ? <ArrowDownward fontSize="small" /> : <ArrowUpward fontSize="small" />
            )}
          </ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default PurchasesPage;