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
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Tooltip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Search,
  FilterList,
  Add,
  Phone,
  ArrowForward,
  Business,
  Payment,
  WarningAmber
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

  // ── Duplicate-name tracking ──────────────────────────────────────────────
  // Stores the error string when the typed name already exists, empty otherwise
  const [nameError, setNameError] = useState('');

  /* =========== FETCH VENDORS =========== */
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'vendors'), orderBy('vendorName')),
      async snap => {
        const vendorList = snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
          balance: d.data().balance || 0,
          initialBalance: d.data().initialBalance || 0
        }));

        const vendorsWithStats = await Promise.all(
          vendorList.map(async vendor => {
            try {
              const purchasesQuery = query(
                collection(db, 'transactions'),
                where('vendorName', '==', vendor.vendorName)
              );
              const purchasesSnap = await getDocs(purchasesQuery);
              const customerPurchases = purchasesSnap.docs.map(d => d.data());

              const totalSales = customerPurchases.reduce(
                (sum, p) => sum + (p.amount || 0),
                0
              );
              const pendingSales = customerPurchases.reduce(
                (sum, p) => sum + (p.remainingAmount || p.amount || 0),
                0
              );

              return {
                ...vendor,
                totalSales,
                pendingSales,
                paidSales: totalSales - pendingSales,
                customerCount: purchasesSnap.size,
                status:
                  vendor.balance < 0
                    ? 'owe'
                    : vendor.balance > 0
                    ? 'owed'
                    : 'zero'
              };
            } catch {
              return {
                ...vendor,
                totalSales: 0,
                pendingSales: 0,
                paidSales: 0,
                customerCount: 0,
                status:
                  vendor.balance < 0
                    ? 'owe'
                    : vendor.balance > 0
                    ? 'owed'
                    : 'zero'
              };
            }
          })
        );

        setVendors(vendorsWithStats);
        setLoading(false);

        const totalBalance = vendorsWithStats.reduce(
          (sum, v) => sum + (v.balance || 0),
          0
        );
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
      error => {
        console.error('Error fetching vendors:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /* =========== APPLY FILTERS =========== */
  useEffect(() => {
    let result = vendors;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        v =>
          v.vendorName?.toLowerCase().includes(term) ||
          v.phone?.includes(term) ||
          v.email?.toLowerCase().includes(term) ||
          v.address?.toLowerCase().includes(term)
      );
    }

    if (filter === 'owe') result = result.filter(v => v.balance < 0);
    else if (filter === 'owed') result = result.filter(v => v.balance > 0);
    else if (filter === 'zero') result = result.filter(v => v.balance === 0);

    setFilteredVendors(result);
  }, [vendors, searchTerm, filter]);

  /* =========== DUPLICATE NAME CHECK =========== */
  /**
   * Returns true if `name` already exists in the vendors list.
   * Comparison is case-insensitive and trims whitespace.
   */
  const isDuplicateName = (name) => {
    if (!name.trim()) return false;
    return vendors.some(
      v => v.vendorName?.trim().toLowerCase() === name.trim().toLowerCase()
    );
  };

  /**
   * Handles name field changes: updates state and validates for duplicates
   * in real-time so the user gets instant feedback.
   */
  const handleNameChange = (e) => {
    const value = e.target.value;
    setNewVendor(prev => ({ ...prev, name: value }));

    if (value.trim() === '') {
      setNameError('');
    } else if (isDuplicateName(value)) {
      setNameError(
        `"${value.trim()}" already exists. Please use a different name.`
      );
    } else {
      setNameError('');
    }
  };

  /* =========== DIALOG OPEN / CLOSE =========== */
  const handleOpenDialog = () => {
    setNewVendor({ name: '', phone: '', email: '', address: '', initialBalance: '0' });
    setNameError('');
    setOpenAddDialog(true);
  };

  const handleCloseDialog = () => {
    if (processing) return;
    setNewVendor({ name: '', phone: '', email: '', address: '', initialBalance: '0' });
    setNameError('');
    setOpenAddDialog(false);
  };

  /* =========== ADD VENDOR =========== */
  const handleAddVendor = async () => {
    if (!newVendor.name.trim()) {
      setNameError('Vendor name is required.');
      return;
    }

    // Hard guard — catches any race between typing and submit
    if (isDuplicateName(newVendor.name)) {
      setNameError(
        `"${newVendor.name.trim()}" already exists. Please use a different name.`
      );
      return;
    }

    setProcessing(true);
    try {
      const initialBalance = parseFloat(newVendor.initialBalance) || 0;

      await addDoc(collection(db, 'vendors'), {
        vendorName: newVendor.name.trim(),
        phone: newVendor.phone,
        email: newVendor.email,
        address: newVendor.address,
        balance: initialBalance,
        initialBalance,
        status:
          initialBalance === 0
            ? 'paid'
            : initialBalance > 0
            ? 'owed'
            : 'owe',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      handleCloseDialog();
      alert('Vendor added successfully!');
    } catch (error) {
      console.error('Error adding vendor:', error);
      alert('Failed to add vendor. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  /* =========== HELPERS =========== */
  const getInitials = name => {
    if (!name) return 'V';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const formatCurrency = amount =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);

  // Whether the submit button should be disabled
  const isSubmitDisabled =
    processing || !newVendor.name.trim() || !!nameError;

  if (loading) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}
      >
        <CircularProgress />
      </Box>
    );
  }

  /* =========== RENDER =========== */
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
          onClick={handleOpenDialog}
          sx={{ borderRadius: 2, px: 3, py: 1 }}
        >
          Add Vendor
        </Button>
      </Stack>

      {/* Stats Summary */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Vendors', value: stats.totalVendors, color: 'inherit' },
          { label: 'You Owe', value: formatCurrency(stats.totalOwedToVendors), color: 'error.main' },
          { label: 'Owed to You', value: formatCurrency(stats.totalOwedByVendors), color: 'success.main' },
          {
            label: 'Net Balance',
            value: formatCurrency(stats.totalBalance),
            color: stats.totalBalance < 0 ? 'error.main' : 'success.main'
          },
          { label: 'Active Vendors', value: stats.pendingVendors, color: 'inherit' }
        ].map(stat => (
          <Grid item xs={12} sm={6} md={2.4} key={stat.label}>
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {stat.label}
              </Typography>
              <Typography variant="h5" fontWeight={700} color={stat.color}>
                {stat.value}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Search and Filter Bar */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              placeholder="Search vendors by name, phone, email, or address"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
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
                onChange={e => setFilter(e.target.value)}
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

      {/* Vendor Table / List */}
      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {isMobile ? (
          /* ── Mobile: card list ── */
          <Box>
            {filteredVendors.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Business sx={{ fontSize: 60, color: '#e0e0e0', mb: 2 }} />
                <Typography color="text.secondary">No vendors found</Typography>
              </Box>
            ) : (
              filteredVendors
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map(vendor => (
                  <Box
                    key={vendor.id}
                    sx={{ borderBottom: '1px solid #f0f0f0', '&:last-child': { borderBottom: 'none' } }}
                  >
                    <Box
                      sx={{ p: 2, cursor: 'pointer', '&:hover': { bgcolor: '#fafafa' } }}
                      onClick={() => navigate(`/vendors/${vendor.id}`)}
                    >
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Avatar
                          sx={{
                            bgcolor:
                              vendor.balance < 0
                                ? '#ff9800'
                                : vendor.balance > 0
                                ? '#4caf50'
                                : '#9e9e9e',
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
                          {vendor.phone && (
                            <Typography variant="caption" color="text.secondary">
                              <Phone sx={{ fontSize: 12, mr: 0.5 }} />
                              {vendor.phone}
                            </Typography>
                          )}
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography
                            variant="h6"
                            fontWeight={700}
                            color={
                              vendor.balance < 0
                                ? 'error.main'
                                : vendor.balance > 0
                                ? 'success.main'
                                : 'text.secondary'
                            }
                          >
                            ₹{Math.abs(vendor.balance)}
                          </Typography>
                          <Chip
                            label={
                              vendor.balance < 0
                                ? 'You Owe'
                                : vendor.balance > 0
                                ? 'Owes You'
                                : 'Settled'
                            }
                            size="small"
                            color={
                              vendor.balance < 0
                                ? 'error'
                                : vendor.balance > 0
                                ? 'success'
                                : 'default'
                            }
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
                ))
            )}
          </Box>
        ) : (
          /* ── Desktop: table ── */
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
                      <Typography color="text.secondary">No vendors found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVendors
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map(vendor => (
                      <TableRow
                        key={vendor.id}
                        hover
                        sx={{ cursor: 'pointer', '&:last-child td': { border: 0 } }}
                        onClick={() => navigate(`/vendors/${vendor.id}`)}
                      >
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={2}>
                            <Avatar
                              sx={{
                                bgcolor:
                                  vendor.balance < 0
                                    ? '#ff9800'
                                    : vendor.balance > 0
                                    ? '#4caf50'
                                    : '#9e9e9e'
                              }}
                            >
                              {getInitials(vendor.vendorName)}
                            </Avatar>
                            <Box>
                              <Typography fontWeight={600}>{vendor.vendorName}</Typography>
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
                            color={
                              vendor.balance < 0
                                ? 'error.main'
                                : vendor.balance > 0
                                ? 'success.main'
                                : 'text.secondary'
                            }
                          >
                            ₹{Math.abs(vendor.balance)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={
                              vendor.balance < 0
                                ? 'You Owe'
                                : vendor.balance > 0
                                ? 'Owes You'
                                : 'Settled'
                            }
                            color={
                              vendor.balance < 0
                                ? 'error'
                                : vendor.balance > 0
                                ? 'success'
                                : 'default'
                            }
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight={600}>{vendor.customerCount || 0}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight={600}>₹{vendor.totalSales || 0}</Typography>
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
                                onClick={e => {
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
                                  onClick={e => {
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

        {filteredVendors.length > 0 && (
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={filteredVendors.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={e => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        )}
      </Paper>

      {/* =========== ADD VENDOR DIALOG =========== */}
      <Dialog
        open={openAddDialog}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" fontWeight={600}>
            Add New Vendor
          </Typography>
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>

            {/* Duplicate-name inline warning banner */}
            {nameError && (
              <Alert
                severity="warning"
                icon={<WarningAmber />}
                sx={{ borderRadius: 2 }}
              >
                <Typography variant="body2" fontWeight={600}>
                  Duplicate vendor name
                </Typography>
                <Typography variant="caption">
                  {nameError}
                </Typography>
              </Alert>
            )}

            {/* Vendor Name — shows red border + helper text on duplicate */}
            <TextField
              fullWidth
              label="Vendor Name *"
              value={newVendor.name}
              onChange={handleNameChange}
              required
              disabled={processing}
              error={!!nameError}
              helperText={
                nameError
                  ? 'A vendor with this name already exists. Please choose a different name.'
                  : ''
              }
              InputProps={{
                endAdornment: nameError ? (
                  <InputAdornment position="end">
                    <WarningAmber color="warning" fontSize="small" />
                  </InputAdornment>
                ) : null
              }}
              autoFocus
            />

            <TextField
              fullWidth
              label="Phone Number"
              value={newVendor.phone}
              onChange={e => setNewVendor(prev => ({ ...prev, phone: e.target.value }))}
              type="tel"
              disabled={processing}
            />
            <TextField
              fullWidth
              label="Email"
              value={newVendor.email}
              onChange={e => setNewVendor(prev => ({ ...prev, email: e.target.value }))}
              type="email"
              disabled={processing}
            />
            <TextField
              fullWidth
              label="Address"
              value={newVendor.address}
              onChange={e => setNewVendor(prev => ({ ...prev, address: e.target.value }))}
              multiline
              rows={2}
              disabled={processing}
            />
            <TextField
              fullWidth
              label="Initial Balance"
              value={newVendor.initialBalance}
              onChange={e =>
                setNewVendor(prev => ({ ...prev, initialBalance: e.target.value }))
              }
              type="number"
              disabled={processing}
              InputProps={{
                startAdornment: <InputAdornment position="start">₹</InputAdornment>
              }}
              helperText="Positive = vendor owes you · Negative = you owe vendor · Zero = settled"
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleCloseDialog} disabled={processing}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddVendor}
            // Disabled when: still processing, no name typed, OR name is a duplicate
            disabled={isSubmitDisabled}
            startIcon={processing ? <CircularProgress size={20} /> : null}
          >
            {processing ? 'Adding...' : 'Add Vendor'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default VendorList;