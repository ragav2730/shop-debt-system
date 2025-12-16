import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  TextField,
  MenuItem,
  Box,
  IconButton,
  Button,
  Card,
  CardContent,
  Stack,
  useTheme,
  useMediaQuery,
  Grid,
  Avatar,
  Badge,
  Divider,
  InputAdornment,
  Tooltip,
  Fade,
  Link
} from '@mui/material';
import {
  Visibility,
  PersonAdd,
  Search,
  FilterList,
  Phone,
  Store,
  AccountBalance,
  Person,
  ArrowForward,
  MoreVert,
  CheckCircle,
  Pending,
  TrendingUp,
  Sort,
  PhoneForwarded
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';

const categories = ['All', 'Cement', 'Bricks', 'Steel', 'Sheat', 'Other'];

const CustomerList = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const customersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCustomers(customersData);
      setFilteredCustomers(customersData);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let filtered = customers;

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(customer => customer.category === selectedCategory);
    }

    if (searchTerm) {
      filtered = filtered.filter(customer =>
        customer.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone.includes(searchTerm) ||
        customer.productName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredCustomers(filtered);
  }, [selectedCategory, searchTerm, customers]);

  const getStatusColor = (balance) => {
    return balance > 0 ? 'error' : 'success';
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const getBalanceColor = (balance) => {
    if (balance === 0) return '#4caf50'; // Green
    if (balance <= 1000) return '#ff9800'; // Orange
    return '#f44336'; // Red
  };

  // Function to handle phone call - opens dial pad with number
  const handlePhoneCall = (phoneNumber) => {
    // Clean the phone number - remove any non-digit characters except +
    const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
    
    // For mobile devices, this will open the native dial pad
    // For web browsers, it will show a confirmation
    if (window.confirm(`Call ${cleanNumber}?`)) {
      window.location.href = `tel:${cleanNumber}`;
    }
  };

  // Mobile Card View Component with phone click functionality
  const CustomerCard = ({ customer }) => (
    <Card 
      elevation={2}
      sx={{ 
        mb: 2,
        borderRadius: 2,
        borderLeft: `4px solid ${getBalanceColor(customer.balance || 0)}`,
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 4,
          transition: 'all 0.2s ease'
        }
      }}
    >
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar 
              sx={{ 
                bgcolor: '#d32f2f',
                width: 48,
                height: 48,
                fontWeight: 'bold'
              }}
            >
              {getInitials(customer.customerName || 'CU')}
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                {customer.customerName}
              </Typography>
              {/* Clickable Phone Number */}
              <Button
                startIcon={<Phone fontSize="small" />}
                onClick={() => handlePhoneCall(customer.phone)}
                sx={{
                  textTransform: 'none',
                  color: 'primary.main',
                  p: 0,
                  minWidth: 'auto',
                  '&:hover': {
                    color: '#b71c1c',
                    bgcolor: 'transparent'
                  }
                }}
              >
                <Typography variant="body2" sx={{ textDecoration: 'underline' }}>
                  {customer.phone} (அலைபேசி)
                </Typography>
              </Button>
            </Box>
          </Stack>
          
          <IconButton
            component={RouterLink}
            to={`/list/${customer.id}`}
            color="primary"
            size="small"
          >
            <ArrowForward />
          </IconButton>
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">
              Product (பொருள்)
            </Typography>
            <Typography variant="body2" fontWeight="medium">
              {customer.productName || 'N/A'}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">
              Category (வகை)
            </Typography>
            <Typography variant="body2">
              <Chip 
                label={customer.category || 'Other'} 
                size="small" 
                sx={{ 
                  bgcolor: '#e3f2fd',
                  color: '#1565c0',
                  fontSize: '0.7rem'
                }}
              />
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">
              Total (மொத்தம்)
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              ₹{customer.amount?.toFixed(2) || '0.00'}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">
              Balance (மீதி)
            </Typography>
            <Typography 
              variant="body1" 
              fontWeight="bold"
              color={customer.balance > 0 ? 'error' : 'success.main'}
            >
              ₹{customer.balance?.toFixed(2) || '0.00'}
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Chip
                label={customer.balance > 0 ? 'Pending (நிலுவை)' : 'Paid (செலுத்தப்பட்டது)'}
                color={getStatusColor(customer.balance)}
                size="small"
                icon={customer.balance > 0 ? <Pending /> : <CheckCircle />}
              />
              <Typography variant="caption" color="text.secondary">
                {customer.createdAt?.toDate().toLocaleDateString('ta-IN')}
              </Typography>
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  return (
    <Container maxWidth="xl" sx={{ px: isMobile ? 1 : 3, py: isMobile ? 1 : 3 }}>
      <Paper 
        elevation={3} 
        sx={{ 
          p: isMobile ? 2 : 4, 
          mt: isMobile ? 1 : 4,
          borderRadius: 3,
          background: 'linear-gradient(to bottom right, #ffffff, #f8f9fa)'
        }}
      >
        {/* Header Section - No changes */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row', 
          justifyContent: 'space-between', 
          alignItems: isMobile ? 'flex-start' : 'center',
          mb: 4,
          gap: isMobile ? 2 : 0
        }}>
          <Box>
            <Typography variant={isMobile ? "h5" : "h4"} color="primary" fontWeight="bold" gutterBottom>
              Debt Customers List (கடன் வாடிக்கையாளர்கள்)
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Total: {filteredCustomers.length} customers | Pending: {filteredCustomers.filter(c => c.balance > 0).length}
            </Typography>
          </Box>
          
          <Button
            component={RouterLink}
            to="/entry"
            variant="contained"
            color="primary"
            size={isMobile ? "medium" : "large"}
            startIcon={<PersonAdd />}
            sx={{
              borderRadius: 2,
              px: 3,
              py: isMobile ? 1 : 1.5,
              background: 'linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #b71c1c 0%, #8b0000 100%)'
              }
            }}
          >
            Add New Customer (புதிய வாடிக்கையாளர்)
          </Button>
        </Box>

        {/* Stats Summary - No changes */}
        {!isMobile && (
          <Fade in timeout={500}>
            <Grid container spacing={2} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ bgcolor: '#e8f5e9', borderRadius: 2 }}>
                  <CardContent sx={{ p: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Total Customers (மொத்தம்)
                        </Typography>
                        <Typography variant="h5" fontWeight="bold">
                          {customers.length}
                        </Typography>
                      </Box>
                      <Avatar sx={{ bgcolor: '#4caf50' }}>
                        <Person />
                      </Avatar>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ bgcolor: '#fff3e0', borderRadius: 2 }}>
                  <CardContent sx={{ p: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Pending (நிலுவை)
                        </Typography>
                        <Typography variant="h5" fontWeight="bold" color="warning.main">
                          {customers.filter(c => c.balance > 0).length}
                        </Typography>
                      </Box>
                      <Avatar sx={{ bgcolor: '#ff9800' }}>
                        <Pending />
                      </Avatar>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ bgcolor: '#f3e5f5', borderRadius: 2 }}>
                  <CardContent sx={{ p: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Total Debt (மொத்த கடன்)
                        </Typography>
                        <Typography variant="h5" fontWeight="bold" color="error.main">
                          ₹{customers.reduce((sum, c) => sum + (c.balance || 0), 0).toFixed(2)}
                        </Typography>
                      </Box>
                      <Avatar sx={{ bgcolor: '#9c27b0' }}>
                        <AccountBalance />
                      </Avatar>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ bgcolor: '#e3f2fd', borderRadius: 2 }}>
                  <CardContent sx={{ p: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Today's Added (இன்று சேர்க்கப்பட்டது)
                        </Typography>
                        <Typography variant="h5" fontWeight="bold" color="primary.main">
                          {customers.filter(c => {
                            const today = new Date();
                            const custDate = c.createdAt?.toDate();
                            return custDate && custDate.toDateString() === today.toDateString();
                          }).length}
                        </Typography>
                      </Box>
                      <Avatar sx={{ bgcolor: '#2196f3' }}>
                        <TrendingUp />
                      </Avatar>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Fade>
        )}

        {/* Search and Filter Section - No changes */}
        <Paper 
          elevation={1} 
          sx={{ 
            p: 3, 
            mb: 4, 
            borderRadius: 2,
            bgcolor: '#f8f9fa'
          }}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Search by Name, Phone or Product (பெயர், தொலைபேசி அல்லது பொருள்)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size={isMobile ? "small" : "medium"}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search color="action" />
                    </InputAdornment>
                  ),
                  sx: { borderRadius: 2 }
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                select
                label="Filter by Category (வகையால் வடிகட்டு)"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                size={isMobile ? "small" : "medium"}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <FilterList color="action" />
                    </InputAdornment>
                  ),
                  sx: { borderRadius: 2 }
                }}
              >
                {categories.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat} {cat !== 'All' ? `(${cat})` : ''}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Sort />}
                onClick={() => {
                  const sorted = [...filteredCustomers].sort((a, b) => b.balance - a.balance);
                  setFilteredCustomers(sorted);
                }}
                sx={{ borderRadius: 2, height: '100%' }}
              >
                Sort (வரிசைப்படுத்து)
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Customer List - Mobile Cards or Desktop Table */}
        {isMobile ? (
          // Mobile Card View
          <Box>
            {filteredCustomers.map((customer) => (
              <CustomerCard key={customer.id} customer={customer} />
            ))}
          </Box>
        ) : (
          // Desktop Table View with clickable phone numbers
          <TableContainer sx={{ borderRadius: 2, border: '1px solid #e0e0e0' }}>
            <Table>
              <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                <TableRow>
                  <TableCell><strong>Customer Name (வாடிக்கையாளர் பெயர்)</strong></TableCell>
                  <TableCell><strong>Phone (அலைபேசி)</strong></TableCell>
                  <TableCell><strong>Product (பொருள்)</strong></TableCell>
                  <TableCell><strong>Category (வகை)</strong></TableCell>
                  <TableCell><strong>Total Amount (மொத்த தொகை)</strong></TableCell>
                  <TableCell><strong>Balance (மீதி)</strong></TableCell>
                  <TableCell><strong>Status (நிலை)</strong></TableCell>
                  <TableCell><strong>Actions (செயல்கள்)</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow 
                    key={customer.id} 
                    hover 
                    sx={{ 
                      '&:hover': { bgcolor: '#fff8e1' },
                      borderBottom: '1px solid #f0f0f0'
                    }}
                  >
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Avatar sx={{ bgcolor: '#d32f2f', width: 36, height: 36 }}>
                          {getInitials(customer.customerName)}
                        </Avatar>
                        <Typography fontWeight="medium">
                          {customer.customerName}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Click to call (அழைக்க கிளிக் செய்யவும்)" arrow>
                        <Button
                          startIcon={<Phone fontSize="small" />}
                          onClick={() => handlePhoneCall(customer.phone)}
                          sx={{
                            textTransform: 'none',
                            color: 'primary.main',
                            p: 0,
                            minWidth: 'auto',
                            '&:hover': {
                              color: '#b71c1c',
                              bgcolor: 'transparent'
                            }
                          }}
                        >
                          <Typography sx={{ 
                            textDecoration: 'underline',
                            fontWeight: 'medium'
                          }}>
                            {customer.phone}
                          </Typography>
                        </Button>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{customer.productName}</TableCell>
                    <TableCell>
                      <Chip 
                        label={customer.category} 
                        size="small" 
                        sx={{ 
                          bgcolor: '#e3f2fd',
                          color: '#1565c0',
                          fontWeight: 'medium'
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight="bold">
                        ₹{customer.amount?.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        fontWeight="bold"
                        sx={{ 
                          color: customer.balance > 0 ? '#d32f2f' : '#2e7d32',
                          bgcolor: customer.balance > 0 ? '#ffebee' : '#e8f5e9',
                          px: 2,
                          py: 0.5,
                          borderRadius: 1,
                          display: 'inline-block'
                        }}
                      >
                        ₹{customer.balance?.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={customer.balance > 0 ? 'Pending (நிலுவை)' : 'Paid (செலுத்தப்பட்டது)'}
                        color={getStatusColor(customer.balance)}
                        size="small"
                        icon={customer.balance > 0 ? <Pending /> : <CheckCircle />}
                      />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="View Details (விவரங்களைப் பார்க்க)" arrow>
                          <IconButton
                            component={RouterLink}
                            to={`/list/${customer.id}`}
                            color="primary"
                            size="small"
                            sx={{ 
                              bgcolor: '#e3f2fd',
                              '&:hover': { bgcolor: '#bbdefb' }
                            }}
                          >
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Call Customer (வாடிக்கையாளரை அழைக்க)" arrow>
                          <IconButton
                            color="success"
                            size="small"
                            onClick={() => handlePhoneCall(customer.phone)}
                            sx={{ 
                              bgcolor: '#e8f5e9',
                              '&:hover': { bgcolor: '#c8e6c9' }
                            }}
                          >
                            <PhoneForwarded />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* No Results Message - No changes */}
        {filteredCustomers.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Store sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No customers found (வாடிக்கையாளர்கள் எதுவும் கிடைக்கவில்லை)
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {searchTerm || selectedCategory !== 'All' 
                ? 'Try changing your search or filter criteria (உங்கள் தேடல் அல்லது வடிகட்டு அளவுகோல்களை மாற்றவும்)'
                : 'Click "Add New Customer" to get started (தொடங்க "புதிய வாடிக்கையாளர்" என்பதைக் கிளிக் செய்யவும்)'}
            </Typography>
            <Button
              component={RouterLink}
              to="/entry"
              variant="outlined"
              color="primary"
              startIcon={<PersonAdd />}
            >
              Add First Customer (முதல் வாடிக்கையாளரைச் சேர்க்கவும்)
            </Button>
          </Box>
        )}

        {/* Results Count - No changes */}
        {filteredCustomers.length > 0 && (
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Showing {filteredCustomers.length} of {customers.length} customers 
              (வாடிக்கையாளர்கள் {filteredCustomers.length} / {customers.length} காட்டப்படுகிறது)
            </Typography>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default CustomerList;