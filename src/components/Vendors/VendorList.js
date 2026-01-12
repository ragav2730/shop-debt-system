import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  TextField,
  InputAdornment,
  Button,
  Stack,
  IconButton,
  Avatar,
  Divider,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  LinearProgress,
  Alert,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Search,
  FilterList,
  Add,
  Phone,
  Email,
  LocationOn,
  ArrowForward,
  AttachMoney,
  Receipt,
  CalendarToday,
  Business,
  TrendingUp,
  People,
  Store,
  AccountBalance,
  Inventory,
  MoreVert,
  Payment
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  addDoc,
  getDocs,
  where
} from 'firebase/firestore';
import { db } from '../../services/firebase';

const VendorList = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [vendors, setVendors] = useState([]);
  const [filteredVendors, setFilteredVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  const [stats, setStats] = useState({
    totalVendors: 0,
    totalOwedToVendors: 0,
    totalOwedByVendors: 0,
    totalBalance: 0,
    pendingVendors: 0
  });
  
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [newVendor, setNewVendor] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    initialBalance: '0'
  });
  const [processing, setProcessing] = useState(false);

  // Fetch vendors with customer purchase stats
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'vendors'), orderBy('vendorName')),
      async (snap) => {
        const vendorList = snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
          balance: d.data().balance || 0
        }));
        
        // Get customer purchase statistics for each vendor
        const vendorsWithStats = await Promise.all(vendorList.map(async (vendor) => {
          try {
            // Get customer purchases from this vendor
            const purchasesQuery = query(
              collection(db, 'transactions'),
              where('vendorName', '==', vendor.vendorName)
            );
            
            const purchasesSnap = await getDocs(purchasesQuery);
            const customerPurchases = purchasesSnap.docs.map(doc => doc.data());
            
            const totalSales = customerPurchases.reduce((sum, p) => sum + (p.amount || 0), 0);
            const pendingSales = customerPurchases.reduce((sum, p) => sum + (p.remainingAmount || p.amount || 0), 0);
            const paidSales = totalSales - pendingSales;
            
            return {
              ...vendor,
              totalSales,
              pendingSales,
              paidSales,
              customerCount: purchasesSnap.size,
              status: vendor.balance < 0 ? 'owe' : vendor.balance > 0 ? 'owed' : 'zero'
            };
          } catch (error) {
            console.error('Error fetching vendor stats:', error);
            return {
              ...vendor,
              totalSales: 0,
              pendingSales: 0,
              paidSales: 0,
              customerCount: 0,
              status: vendor.balance < 0 ? 'owe' : vendor.balance > 0 ? 'owed' : 'zero'
            };
          }
        }));
        
        setVendors(vendorsWithStats);
        setLoading(false);
        
        // Calculate overall stats
        const totalBalance = vendorsWithStats.reduce((sum, v) => sum + (v.balance || 0), 0);
        const totalOwedToVendors = vendorsWithStats
          .filter(v => v.balance < 0)
          .reduce((sum, v) => sum + Math.abs(v.balance || 0), 0);
        const totalOwedByVendors = vendorsWithStats
          .filter(v => v.balance > 0)
          .reduce((sum, v) => sum + (v.balance || 0), 0);
        const pendingVendors = vendorsWithStats.filter(v => v.balance !== 0).length;
        
        setStats({
          totalVendors: vendorsWithStats.length,
          totalBalance,
          totalOwedToVendors,
          totalOwedByVendors,
          pendingVendors
        });
      },
      (error) => {
        console.error('Error fetching vendors:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Apply filters
  useEffect(() => {
    let result = vendors;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(v =>
        v.vendorName?.toLowerCase().includes(term) ||
        v.phone?.includes(term) ||
        v.email?.toLowerCase().includes(term) ||
        v.address?.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (filter === 'owe') {
      result = result.filter(v => v.balance < 0);
    } else if (filter === 'owed') {
      result = result.filter(v => v.balance > 0);
    } else if (filter === 'zero') {
      result = result.filter(v => v.balance === 0);
    }

    setFilteredVendors(result);
  }, [vendors, searchTerm, filter]);

  const getInitials = (name) => {
    if (!name) return 'V';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const handleAddVendor = async () => {
    if (!newVendor.name.trim()) {
      alert('Vendor name is required');
      return;
    }

    setProcessing(true);
    try {
      const initialBalance = parseFloat(newVendor.initialBalance) || 0;
      
      await addDoc(collection(db, 'vendors'), {
        vendorName: newVendor.name,
        phone: newVendor.phone,
        email: newVendor.email,
        address: newVendor.address,
        balance: initialBalance,
        status: initialBalance === 0 ? 'paid' : initialBalance > 0 ? 'owed' : 'owe',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      setNewVendor({ name: '', phone: '', email: '', address: '', initialBalance: '0' });
      setOpenAddDialog(false);
      
      alert('Vendor added successfully!');
    } catch (error) {
      console.error('Error adding vendor:', error);
      alert('Failed to add vendor');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getBalanceColor = (balance) => {
    if (balance < 0) return 'error.main';
    if (balance > 0) return 'success.main';
    return 'text.secondary';
  };

  const getBalanceText = (balance) => {
    if (balance < 0) return `You owe: ${formatCurrency(Math.abs(balance))}`;
    if (balance > 0) return `You are owed: ${formatCurrency(balance)}`;
    return 'Settled';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Vendor Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track all vendor purchases, sales, and payments
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setOpenAddDialog(true)}
          sx={{
            borderRadius: 2,
            px: 3,
            py: 1
          }}
        >
          Add Vendor
        </Button>
      </Stack>

      {/* Stats Summary */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Paper sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Total Vendors
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {stats.totalVendors}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Paper sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="body2" color="text.secondary">
              You Owe
            </Typography>
            <Typography variant="h5" fontWeight={700} color="error.main">
              {formatCurrency(stats.totalOwedToVendors)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Paper sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Owed to You
            </Typography>
            <Typography variant="h5" fontWeight={700} color="success.main">
              {formatCurrency(stats.totalOwedByVendors)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Paper sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Net Balance
            </Typography>
            <Typography variant="h5" fontWeight={700} color={stats.totalBalance < 0 ? 'error.main' : 'success.main'}>
              {formatCurrency(stats.totalBalance)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Paper sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Active Vendors
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {stats.pendingVendors}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Search and Filter Bar */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              placeholder="Search vendors by name, phone, email, or address"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Stack direction="row" spacing={2}>
              <TextField
                select
                fullWidth
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                size="small"
              >
                <MenuItem value="all">All Vendors</MenuItem>
                <MenuItem value="owe">You Owe Money</MenuItem>
                <MenuItem value="owed">You Are Owed Money</MenuItem>
                <MenuItem value="zero">Settled</MenuItem>
              </TextField>
              <Button
                variant="outlined"
                startIcon={<FilterList />}
                size="small"
                sx={{ whiteSpace: 'nowrap' }}
              >
                Filter
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Vendors Table - Row by Row */}
      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {isMobile ? (
          // Mobile View - List
          <Box>
            {filteredVendors.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Business sx={{ fontSize: 60, color: '#e0e0e0', mb: 2 }} />
                <Typography color="text.secondary">
                  No vendors found
                </Typography>
              </Box>
            ) : (
              <>
                {filteredVendors
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((vendor) => (
                    <Box 
                      key={vendor.id}
                      sx={{ 
                        borderBottom: '1px solid #f0f0f0',
                        '&:last-child': { borderBottom: 'none' }
                      }}
                    >
                      <Box 
                        sx={{ 
                          p: 2,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: '#fafafa' }
                        }}
                        onClick={() => navigate(`/vendors/${vendor.id}`)}
                      >
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <Avatar
                            sx={{
                              bgcolor: vendor.balance < 0 ? '#ff9800' : vendor.balance > 0 ? '#4caf50' : '#9e9e9e',
                              width: 48,
                              height: 48
                            }}
                          >
                            {getInitials(vendor.vendorName)}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="subtitle1" fontWeight={600} noWrap>
                              {vendor.vendorName}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                              {vendor.phone && (
                                <Typography variant="caption" color="text.secondary">
                                  <Phone sx={{ fontSize: 12, mr: 0.5 }} />
                                  {vendor.phone}
                                </Typography>
                              )}
                            </Stack>
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography 
                              variant="h6" 
                              fontWeight={700}
                              color={vendor.balance < 0 ? 'error.main' : vendor.balance > 0 ? 'success.main' : 'text.secondary'}
                            >
                              ₹{Math.abs(vendor.balance)}
                            </Typography>
                            <Chip
                              label={vendor.balance < 0 ? 'You Owe' : vendor.balance > 0 ? 'Owes You' : 'Settled'}
                              size="small"
                              color={vendor.balance < 0 ? 'error' : vendor.balance > 0 ? 'success' : 'default'}
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                          </Box>
                        </Stack>
                        
                        <Divider sx={{ my: 1.5 }} />
                        
                        <Grid container spacing={1}>
                          <Grid item xs={4}>
                            <Typography variant="caption" color="text.secondary">
                              Customers
                            </Typography>
                            <Typography variant="body2" fontWeight={600}>
                              {vendor.customerCount || 0}
                            </Typography>
                          </Grid>
                          <Grid item xs={4}>
                            <Typography variant="caption" color="text.secondary">
                              Sales
                            </Typography>
                            <Typography variant="body2" fontWeight={600}>
                              ₹{vendor.totalSales || 0}
                            </Typography>
                          </Grid>
                          <Grid item xs={4}>
                            <Typography variant="caption" color="text.secondary">
                              Pending
                            </Typography>
                            <Typography variant="body2" fontWeight={600} color="error.main">
                              ₹{vendor.pendingSales || 0}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Box>
                    </Box>
                  ))}
              </>
            )}
          </Box>
        ) : (
          // Desktop View - Table
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#fafafa' }}>
                  <TableCell width="30%">Vendor</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell align="right">Balance</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="right">Customers</TableCell>
                  <TableCell align="right">Total Sales</TableCell>
                  <TableCell align="right">Pending</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredVendors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <Business sx={{ fontSize: 60, color: '#e0e0e0', mb: 2 }} />
                      <Typography color="text.secondary">
                        No vendors found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVendors
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((vendor) => (
                      <TableRow 
                        key={vendor.id}
                        hover
                        sx={{ 
                          cursor: 'pointer',
                          '&:last-child td, &:last-child th': { border: 0 }
                        }}
                        onClick={() => navigate(`/vendors/${vendor.id}`)}
                      >
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={2}>
                            <Avatar
                              sx={{
                                bgcolor: vendor.balance < 0 ? '#ff9800' : vendor.balance > 0 ? '#4caf50' : '#9e9e9e',
                              }}
                            >
                              {getInitials(vendor.vendorName)}
                            </Avatar>
                            <Box>
                              <Typography fontWeight={600}>
                                {vendor.vendorName}
                              </Typography>
                              {vendor.email && (
                                <Typography variant="caption" color="text.secondary">
                                  {vendor.email}
                                </Typography>
                              )}
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          {vendor.phone ? (
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <Phone fontSize="small" />
                              <Typography>{vendor.phone}</Typography>
                            </Stack>
                          ) : (
                            <Typography color="text.secondary">No phone</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Typography 
                            variant="h6" 
                            fontWeight={700}
                            color={vendor.balance < 0 ? 'error.main' : vendor.balance > 0 ? 'success.main' : 'text.secondary'}
                          >
                            ₹{Math.abs(vendor.balance)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={vendor.balance < 0 ? 'You Owe' : vendor.balance > 0 ? 'Owes You' : 'Settled'}
                            color={vendor.balance < 0 ? 'error' : vendor.balance > 0 ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight={600}>
                            {vendor.customerCount || 0}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight={600}>
                            ₹{vendor.totalSales || 0}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight={600} color="error.main">
                            ₹{vendor.pendingSales || 0}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Tooltip title="View Details">
                              <IconButton 
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/vendors/${vendor.id}`);
                                }}
                              >
                                <ArrowForward fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {vendor.balance > 0 && (
                              <Tooltip title="Collect Payment">
                                <IconButton 
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/payment?vendorId=${vendor.id}`);
                                  }}
                                >
                                  <Payment fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Pagination */}
        {filteredVendors.length > 0 && (
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={filteredVendors.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        )}
      </Paper>

      {/* Add Vendor Dialog */}
      <Dialog open={openAddDialog} onClose={() => !processing && setOpenAddDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h6" fontWeight={600}>
            Add New Vendor
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Vendor Name *"
              value={newVendor.name}
              onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
              required
              disabled={processing}
            />
            <TextField
              fullWidth
              label="Phone Number"
              value={newVendor.phone}
              onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
              type="tel"
              disabled={processing}
            />
            <TextField
              fullWidth
              label="Email"
              value={newVendor.email}
              onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
              type="email"
              disabled={processing}
            />
            <TextField
              fullWidth
              label="Address"
              value={newVendor.address}
              onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })}
              multiline
              rows={2}
              disabled={processing}
            />
            <TextField
              fullWidth
              label="Initial Balance"
              value={newVendor.initialBalance}
              onChange={(e) => setNewVendor({ ...newVendor, initialBalance: e.target.value })}
              type="number"
              disabled={processing}
              InputProps={{
                startAdornment: <InputAdornment position="start">₹</InputAdornment>,
              }}
              helperText="Positive = vendor owes you, Negative = you owe vendor, Zero = settled"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenAddDialog(false)} disabled={processing}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleAddVendor}
            disabled={processing || !newVendor.name.trim()}
            startIcon={processing && <CircularProgress size={20} />}
          >
            {processing ? 'Adding...' : 'Add Vendor'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default VendorList;