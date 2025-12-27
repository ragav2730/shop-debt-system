import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
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
  Divider,
  InputAdornment
} from '@mui/material';

import {
  PersonAdd,
  Search,
  FilterList,
  Phone,
  ArrowForward,
  CheckCircle,
  Pending
} from '@mui/icons-material';

import { Link as RouterLink } from 'react-router-dom';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';

const categories = ['All', 'Cement', 'Bricks', 'Steel', 'Sheet', 'Other'];

const CustomerList = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCustomers(data);
      setFilteredCustomers(data);
    });
  }, []);

  useEffect(() => {
    let filtered = customers;

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(c => c.category === selectedCategory);
    }

    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm)
      );
    }

    setFilteredCustomers(filtered);
  }, [selectedCategory, searchTerm, customers]);

  /* ---------- STATS ---------- */
  const totalCustomers = customers.length;
  const pendingCount = customers.filter(c => c.balance > 0).length;
  const totalBalance = customers.reduce((s, c) => s + (c.balance || 0), 0);
  const todayAdded = customers.filter(c => {
    const d = c.createdAt?.toDate();
    return d && d.toDateString() === new Date().toDateString();
  }).length;

  const getInitials = name =>
    name?.split(' ').map(n => n[0]).join('').slice(0, 2);

  const handlePhoneCall = phone => {
    window.location.href = `tel:${phone.replace(/[^\d+]/g, '')}`;
  };

  /* ---------- CUSTOMER CARD (MOBILE-FIRST) ---------- */
  const CustomerCard = ({ customer }) => (
    <Card
      sx={{
        mb: 2,
        borderRadius: 4,
        bgcolor: '#FFF7F7',
        border: '1px solid #F1DCDC',
        boxShadow: 'none'
      }}
    >
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between">
          <Stack direction="row" spacing={2}>
            <Avatar sx={{ bgcolor: '#C62828', fontWeight: 700 }}>
              {getInitials(customer.customerName)}
            </Avatar>
            <Box>
              <Typography fontWeight={700}>
                {customer.customerName}
              </Typography>
              <Button
                onClick={() => handlePhoneCall(customer.phone)}
                startIcon={<Phone fontSize="small" />}
                sx={{
                  p: 0,
                  minWidth: 'auto',
                  textTransform: 'none',
                  color: '#B71C1C'
                }}
              >
                {customer.phone} (அலைபேசி)
              </Button>
            </Box>
          </Stack>

          <IconButton
            component={RouterLink}
            to={`/list/${customer.id}`}
            sx={{ bgcolor: '#FFECEC' }}
          >
            <ArrowForward />
          </IconButton>
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        <Grid container spacing={1.5}>
          <Grid item xs={6}>
            <Typography variant="caption">Total</Typography>
            <Typography fontWeight={700}>
              ₹{customer.amount?.toFixed(2)}
            </Typography>
          </Grid>

          <Grid item xs={6}>
            <Typography variant="caption">Balance</Typography>
            <Typography
              fontWeight={700}
              color={customer.balance > 0 ? 'error.main' : 'success.main'}
            >
              ₹{customer.balance?.toFixed(2)}
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <Stack direction="row" justifyContent="space-between">
              <Chip
                size="small"
                label={
                  customer.balance > 0
                    ? 'Pending (நிலுவை)'
                    : 'Paid (செலுத்தப்பட்டது)'
                }
                icon={customer.balance > 0 ? <Pending /> : <CheckCircle />}
                sx={{
                  bgcolor: customer.balance > 0 ? '#FFD6D6' : '#E6F7EC',
                  color: customer.balance > 0 ? '#C62828' : '#2E7D32',
                  fontWeight: 600
                }}
              />
              <Typography variant="caption">
                {customer.createdAt?.toDate().toLocaleDateString('ta-IN')}
              </Typography>
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  return (
    <Container maxWidth="lg" sx={{ py: isMobile ? 1 : 3 }}>
      <Paper
        sx={{
          p: isMobile ? 2 : 3,
          borderRadius: 4,
          bgcolor: '#FFFFFF'
        }}
      >
        {/* ---------- HEADER ---------- */}
        <Stack
          direction={isMobile ? 'column' : 'row'}
          justifyContent="space-between"
          alignItems={isMobile ? 'stretch' : 'center'}
          spacing={2}
          mb={3}
        >
          <Typography variant="h5" fontWeight={800} color="#C62828">
            கடன் வாடிக்கையாளர்கள்
          </Typography>

          {/* Desktop compact button | Mobile full */}
          <Button
            component={RouterLink}
            to="/entry"
            startIcon={<PersonAdd />}
            fullWidth={isMobile}
            sx={{
              px: isMobile ? 2 : 2.5,
              py: isMobile ? 1.4 : 1,
              borderRadius: 3,
              fontWeight: 700,
              fontSize: isMobile ? '1rem' : '0.85rem',
              maxWidth: isMobile ? '100%' : 220,
              background: 'linear-gradient(135deg,#E53935,#B71C1C)',
              boxShadow: 'none'
            }}
            variant="contained"
          >
            Add Customer
          </Button>
        </Stack>

        {/* ---------- STATS (MOBILE SAFE) ---------- */}
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          {[
            { label: 'Total', value: totalCustomers },
            { label: 'Pending', value: pendingCount },
            { label: 'Total Balance', value: `₹${totalBalance.toFixed(0)}` },
            { label: 'Today Added', value: todayAdded }
          ].map((s, i) => (
            <Grid item xs={6} key={i}>
              <Card
                sx={{
                  p: 1.5,
                  borderRadius: 3,
                  bgcolor: '#FFF5F5',
                  border: '1px solid #F3DADA',
                  boxShadow: 'none',
                  minHeight: 72
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {s.label}
                </Typography>
                <Typography fontWeight={800} color="#B71C1C">
                  {s.value}
                </Typography>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* ---------- SEARCH ---------- */}
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            label="Search (தேடல்)"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            sx={{ mb: 1.5 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              )
            }}
          />

          <TextField
            fullWidth
            select
            size="small"
            label="Category (வகை)"
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <FilterList />
                </InputAdornment>
              )
            }}
          >
            {categories.map(c => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </TextField>
        </Box>

        {/* ---------- LIST ---------- */}
        {filteredCustomers.map(c => (
          <CustomerCard key={c.id} customer={c} />
        ))}

        {filteredCustomers.length === 0 && (
          <Box textAlign="center" py={5}>
            <Typography color="text.secondary">
              No customers found
            </Typography>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default CustomerList;
