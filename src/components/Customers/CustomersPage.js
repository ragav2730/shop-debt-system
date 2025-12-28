import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Stack,
  Chip,
  Avatar,
  Skeleton,
  InputAdornment,
  TextField,
  IconButton,
  Fade,
  Divider,
  Paper,
  alpha,
  useTheme,
  CircularProgress
} from '@mui/material';
import {
  Search,
  FilterList,
  Add,
  ArrowForwardIos,
  Person,
  TrendingUp,
  TrendingDown,
  Group,
  AccountBalance,
  MonetizationOn
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import CustomerCard from './CustomerCard';
import SearchBar from '../Shared/SearchBar';
import PremiumCard from '../Shared/PremiumCard';

const CustomersPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalDebt: 0,
    activeCustomers: 0,
    totalPaid: 0
  });

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const q = query(collection(db, 'customers'), orderBy('customerName'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const customersData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          setCustomers(customersData);
          setFilteredCustomers(customersData);
          
          // Calculate stats
          const totalDebt = customersData.reduce((sum, customer) => 
            sum + (customer.balance > 0 ? customer.balance : 0), 0
          );
          const activeCustomers = customersData.filter(c => c.balance > 0).length;
          const totalPaid = customersData.reduce((sum, customer) => 
            sum + (customer.totalPurchases || 0) - (customer.balance || 0), 0
          );
          
          setStats({
            totalCustomers: customersData.length,
            totalDebt,
            activeCustomers,
            totalPaid
          });
          
          setLoading(false);
        });
        
        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching customers:', error);
        setLoading(false);
      }
    };
    
    fetchCustomers();
  }, []);

  useEffect(() => {
    const filtered = customers.filter(customer =>
      customer.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.includes(searchTerm) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredCustomers(filtered);
  }, [searchTerm, customers]);

  const handleCustomerClick = (customerId) => {
    navigate(`/customers/${customerId}`);
  };

  const handleAddCustomer = () => {
    navigate('/customers/new');
  };

  if (loading) {
    return (
      <Box sx={{ 
        bgcolor: '#000', 
        minHeight: '100vh',
        pt: { xs: '88px', md: '108px' }
      }}>
        <Container maxWidth="lg">
          <Box sx={{ p: 2 }}>
            <Skeleton variant="rectangular" height={150} sx={{ borderRadius: 4, mb: 3 }} />
            <Skeleton variant="text" height={40} sx={{ mb: 2 }} />
            {[1, 2, 3, 4].map((i) => (
              <Skeleton 
                key={i} 
                variant="rectangular" 
                height={80} 
                sx={{ borderRadius: 2, mb: 2 }} 
              />
            ))}
          </Box>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      bgcolor: '#000', 
      minHeight: '100vh',
      pb: 8,
      pt: { xs: '88px', md: '108px' }
    }}>
      {/* Premium Header */}
      <Box sx={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        py: 4,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        position: 'relative',
        overflow: 'hidden',
        mb: 3
      }}>
        <Box sx={{
          position: 'absolute',
          top: -50,
          right: -50,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)'
        }} />
        
        <Container maxWidth="lg">
          <Stack spacing={3}>
            <Box>
              <Typography variant="h3" fontWeight={800} color="white" sx={{ mb: 0.5 }}>
                Customers
              </Typography>
              <Typography variant="subtitle1" color="rgba(255,255,255,0.8)">
                Manage your vendors and track balances
              </Typography>
            </Box>
            
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <PremiumCard sx={{ bgcolor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}>
                  <Stack alignItems="center" spacing={1}>
                    <Group sx={{ color: 'white', fontSize: 28 }} />
                    <Typography variant="h5" fontWeight={700} color="white">
                      {stats.totalCustomers}
                    </Typography>
                    <Typography variant="caption" color="rgba(255,255,255,0.8)">
                      Total
                    </Typography>
                  </Stack>
                </PremiumCard>
              </Grid>
              
              <Grid item xs={6} sm={3}>
                <PremiumCard sx={{ bgcolor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}>
                  <Stack alignItems="center" spacing={1}>
                    <TrendingDown sx={{ color: '#FF6B6B', fontSize: 28 }} />
                    <Typography variant="h5" fontWeight={700} color="white">
                      ₹{stats.totalDebt.toLocaleString('en-IN')}
                    </Typography>
                    <Typography variant="caption" color="rgba(255,255,255,0.8)">
                      Total Debt
                    </Typography>
                  </Stack>
                </PremiumCard>
              </Grid>
              
              <Grid item xs={6} sm={3}>
                <PremiumCard sx={{ bgcolor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}>
                  <Stack alignItems="center" spacing={1}>
                    <TrendingUp sx={{ color: '#4CAF50', fontSize: 28 }} />
                    <Typography variant="h5" fontWeight={700} color="white">
                      ₹{stats.totalPaid.toLocaleString('en-IN')}
                    </Typography>
                    <Typography variant="caption" color="rgba(255,255,255,0.8)">
                      Total Paid
                    </Typography>
                  </Stack>
                </PremiumCard>
              </Grid>
              
              <Grid item xs={6} sm={3}>
                <PremiumCard sx={{ bgcolor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}>
                  <Stack alignItems="center" spacing={1}>
                    <AccountBalance sx={{ color: '#FFA726', fontSize: 28 }} />
                    <Typography variant="h5" fontWeight={700} color="white">
                      {stats.activeCustomers}
                    </Typography>
                    <Typography variant="caption" color="rgba(255,255,255,0.8)">
                      Pending
                    </Typography>
                  </Stack>
                </PremiumCard>
              </Grid>
            </Grid>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg">
        {/* Search and Add Section */}
        <Box sx={{ 
          mb: 3, 
          position: 'sticky', 
          top: { xs: 80, md: 100 }, 
          zIndex: 10,
          backdropFilter: 'blur(20px)',
          backgroundColor: alpha('#000', 0.8),
          borderRadius: 3,
          p: 2
        }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ flex: 1 }}>
              <SearchBar
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search customers..."
                fullWidth
              />
            </Box>
            
            <IconButton
              onClick={handleAddCustomer}
              sx={{
                bgcolor: 'primary.main',
                color: 'white',
                width: 56,
                height: 56,
                borderRadius: 3,
                '&:hover': {
                  bgcolor: 'primary.dark',
                  transform: 'scale(1.05)'
                }
              }}
            >
              <Add />
            </IconButton>
          </Stack>
        </Box>

        {/* Customer List */}
        {filteredCustomers.length === 0 ? (
          <PremiumCard sx={{ textAlign: 'center', py: 8 }}>
            <Person sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No customers found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {searchTerm ? 'Try a different search term' : 'Add your first customer'}
            </Typography>
          </PremiumCard>
        ) : (
          <Fade in={true}>
            <Stack spacing={2}>
              <Typography variant="subtitle1" color="text.secondary" sx={{ px: 2 }}>
                {filteredCustomers.length} customers
              </Typography>
              
              {filteredCustomers.map((customer) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  onClick={() => handleCustomerClick(customer.id)}
                />
              ))}
            </Stack>
          </Fade>
        )}
      </Container>
    </Box>
  );
};

export default CustomersPage;