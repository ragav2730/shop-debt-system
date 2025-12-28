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
  Alert
} from '@mui/material';
import {
  Add,
  Sort,
  CalendarToday,
  AccountBalance,
  ArrowDownward,
  ArrowUpward,
  Refresh,
  Warning
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
        const enrichedPurchases = purchasesData.map(purchase => {
          // Find payments for this purchase
          const purchasePayments = paymentsData.filter(
            payment => payment.transactionId === purchase.id
          );
          
          // Calculate total paid for this purchase
          const totalPaidForPurchase = purchasePayments.reduce(
            (sum, payment) => sum + (payment.amount || 0),
            0
          );
          
          // Calculate remaining amount
          const purchaseAmount = purchase.amount || 0;
          let remainingAmount = purchaseAmount - totalPaidForPurchase;
          
          // If purchase has remainingAmount field, use it, but validate with payments
          if (typeof purchase.remainingAmount === 'number') {
            // Use the lower of calculated remaining or stored remaining
            remainingAmount = Math.min(remainingAmount, purchase.remainingAmount);
          }
          
          // Ensure remaining amount is not negative
          remainingAmount = Math.max(0, remainingAmount);
          
          // Determine status
          let status = 'pending';
          if (remainingAmount === 0 && purchaseAmount > 0) {
            status = 'paid';
          } else if (totalPaidForPurchase > 0 && remainingAmount > 0) {
            status = 'partial';
          }
          
          return {
            ...purchase,
            totalPaid: totalPaidForPurchase,
            remainingAmount: remainingAmount,
            calculatedRemaining: remainingAmount,
            status: status,
            paymentCount: purchasePayments.length
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
            // Pending: Has remaining amount, no payments or partial payments
            return remaining > 0;
          
          case 'paid':
            // Paid: No remaining amount AND has some amount
            return remaining === 0 && amount > 0;
          
          case 'partial':
            // Partially paid: Has payments but still has remaining amount
            return p.status === 'partial';
          
          case 'unpaid':
            // Unpaid: No payments made at all
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
      
      // If equal, sort by date
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

  /* -------------------- LOADING -------------------- */
  if (loading) {
    return (
      <Box sx={{ p: 2, minHeight: '100vh', bgcolor: '#f5f7fb' }}>
        <Box
          sx={{
            bgcolor: PRIMARY_BLUE,
            px: 2,
            py: 3,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24
          }}
        >
          <Typography
            fontSize={isMobile ? 22 : 26}
            fontWeight={700}
            color="white"
          >
            Purchase History
          </Typography>
          <Typography color="rgba(255,255,255,0.9)" fontSize={14}>
            Loading...
          </Typography>
        </Box>
        
        <Container maxWidth="sm" sx={{ mt: 3 }}>
          {[1, 2, 3, 4].map(i => (
            <Skeleton 
              key={i} 
              variant="rectangular" 
              height={110} 
              sx={{ 
                borderRadius: 3, 
                mb: 2,
                bgcolor: 'rgba(0,0,0,0.08)'
              }} 
            />
          ))}
        </Container>
      </Box>
    );
  }

  /* -------------------- UI -------------------- */
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fb', pb: 10 }}>
      {/* Header */}
      <Box
        sx={{
          bgcolor: PRIMARY_BLUE,
          px: 2,
          py: 3,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          position: 'relative'
        }}
      >
        <Typography
          fontSize={isMobile ? 22 : 26}
          fontWeight={700}
          color="white"
        >
          Purchase History
        </Typography>
        <Typography color="rgba(255,255,255,0.9)" fontSize={14}>
          Track all vendor purchases and payments
        </Typography>
        
        {/* Refresh Button */}
        <IconButton
          onClick={handleRefresh}
          sx={{
            position: 'absolute',
            right: 16,
            top: 16,
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
        <Container maxWidth="sm" sx={{ mt: 2 }}>
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
        <Container maxWidth="sm" sx={{ mt: 2 }}>
          <Alert 
            severity="warning" 
            icon={<Warning />}
            sx={{ borderRadius: 3 }}
          >
            Some purchases don't have proper payment tracking. Showing calculated amounts.
          </Alert>
        </Container>
      )}

      <Container maxWidth="sm" sx={{ mt: 3 }}>
        {/* Stats */}
        <Stack
          direction="row"
          spacing={2}
          sx={{
            overflowX: 'auto',
            pb: 1,
            '&::-webkit-scrollbar': { display: 'none' }
          }}
        >
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
            }
          ].map((s, i) => (
            <PremiumCard
              key={i}
              sx={{
                minWidth: 140,
                textAlign: 'center',
                borderRadius: 3,
                border: `1px solid ${s.color}20`,
                bgcolor: `${s.color}08`
              }}
            >
              <Typography 
                fontWeight={700} 
                fontSize={18}
                color={s.color}
              >
                {s.value}
              </Typography>
              <Typography 
                fontSize={11} 
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                {s.label}
              </Typography>
            </PremiumCard>
          ))}
        </Stack>

        {/* Search & Filters */}
        <Card sx={{ mt: 2, p: 2, borderRadius: 3 }}>
          <SearchBar
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by product, customer, or description"
            fullWidth
          />

          <Stack direction="row" spacing={1} mt={2} alignItems="center">
            <ToggleButtonGroup
              value={statusFilter}
              exclusive
              onChange={(e, v) => v && setStatusFilter(v)}
              size="small"
              sx={{
                flexWrap: 'wrap',
                '& .MuiToggleButton-root': {
                  fontSize: 12,
                  px: 1.5,
                  py: 0.5,
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
                width: 36,
                height: 36
              }}
            >
              <Sort />
            </IconButton>
          </Stack>
          
          {/* Active Filters Info */}
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Showing {filteredPurchases.length} of {purchases.length} purchases
              {statusFilter !== 'all' && ` • Filter: ${statusFilter}`}
              {searchTerm && ` • Search: "${searchTerm}"`}
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
          <Stack spacing={2} mt={3}>
            {filteredPurchases.map(p => (
              <PurchaseCard
                key={p.id}
                purchase={p}
                onClick={() => navigate(`/purchases/${p.id}`)}
              />
            ))}
          </Stack>
        </Fade>
      </Container>

      {/* Floating Add Button */}
      <IconButton
        onClick={() => navigate('/purchases/new')}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          bgcolor: PRIMARY_BLUE,
          color: 'white',
          width: 56,
          height: 56,
          borderRadius: '50%',
          boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
          '&:hover': {
            bgcolor: '#1565c0',
            transform: 'scale(1.05)'
          },
          transition: 'all 0.2s ease'
        }}
      >
        <Add fontSize="large" />
      </IconButton>

      {/* Sort Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{
          sx: {
            mt: 1,
            borderRadius: 2,
            minWidth: 180
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