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
  Pending
} from '@mui/icons-material';

import { Link as RouterLink } from 'react-router-dom';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  where
} from 'firebase/firestore';
import { db } from '../../services/firebase';

const categories = ['All', 'Cement', 'Bricks', 'Steel', 'Sheet', 'Other'];

const CustomerList = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [vendors, setVendors] = useState([]); // Changed from customers to vendors
  const [transactions, setTransactions] = useState([]);
  const [filteredVendors, setFilteredVendors] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  /* ================= LOAD VENDORS (AS CUSTOMERS) ================= */
  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'vendors'), orderBy('vendorName')),
      snap => {
        const vendorsList = snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
          customerName: d.data().vendorName, // Map for compatibility
          balance: d.data().balance || 0
        }));
        setVendors(vendorsList);
      }
    );
  }, []);

  /* ================= LOAD TRANSACTIONS ================= */
  useEffect(() => {
    return onSnapshot(
      collection(db, 'transactions'),
      snap => {
        setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );
  }, []);

  /* ================= FILTER LOGIC ================= */
  useEffect(() => {
    // Only vendors with positive balance (they owe you money)
    let activeVendors = vendors.filter(v => (v.balance || 0) > 0);

    // Category filter
    if (selectedCategory !== 'All') {
      const vendorIdsWithCategory = new Set(
        transactions
          .filter(t =>
            t.category === selectedCategory &&
            (t.remainingAmount ?? t.amount) > 0
          )
          .map(t => t.vendorId || t.customerId) // Check both vendorId and customerId
      );

      activeVendors = activeVendors.filter(v =>
        vendorIdsWithCategory.has(v.id)
      );
    }

    // Search
    if (searchTerm) {
      activeVendors = activeVendors.filter(v =>
        v.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.phone?.includes(searchTerm)
      );
    }

    setFilteredVendors(activeVendors);
  }, [vendors, transactions, selectedCategory, searchTerm]);

  /* ================= HELPERS ================= */
  const getInitials = name =>
    name?.split(' ').map(n => n[0]).join('').slice(0, 2);

  const handlePhoneCall = phone => {
    window.location.href = `tel:${phone}`;
  };

  /* ================= VENDOR CARD ================= */
  const VendorCard = ({ vendor }) => (
    <Card sx={{ mb: 2, borderRadius: 4, bgcolor: '#FFF7F7', boxShadow: 'none' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between">
          <Stack direction="row" spacing={2}>
            <Avatar sx={{ bgcolor: '#C62828' }}>
              {getInitials(vendor.vendorName)}
            </Avatar>
            <Box>
              <Typography fontWeight={700}>
                {vendor.vendorName}
              </Typography>
              {vendor.phone && (
                <Button
                  onClick={() => handlePhoneCall(vendor.phone)}
                  startIcon={<Phone fontSize="small" />}
                  sx={{ p: 0, textTransform: 'none', color: '#B71C1C' }}
                >
                  {vendor.phone}
                </Button>
              )}
            </Box>
          </Stack>

          <IconButton
            component={RouterLink}
            to={`/vendors/${vendor.id}`} // Changed to vendor detail page
            sx={{ bgcolor: '#FFECEC' }}
          >
            <ArrowForward />
          </IconButton>
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        <Stack direction="row" justifyContent="space-between">
          <Typography color="error.main" fontWeight={700}>
            ₹{vendor.balance || 0}
          </Typography>
          <Chip
            size="small"
            label="Pending"
            icon={<Pending />}
            sx={{ bgcolor: '#FFD6D6', color: '#C62828' }}
          />
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Container maxWidth="lg">
      <Paper sx={{ p: 3, borderRadius: 4 }}>
        <Stack direction="row" justifyContent="space-between" mb={3}>
          <Typography variant="h5" fontWeight={800} color="#C62828">
            Pending Customers
          </Typography>

          <Button
            component={RouterLink}
            to="/vendors" // Changed to go to vendor list to add new customer
            startIcon={<PersonAdd />}
            variant="contained"
          >
            Add Customer
          </Button>
        </Stack>

        {/* SEARCH */}
        <TextField
          fullWidth
          size="small"
          label="Search"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            )
          }}
        />

        {/* CATEGORY */}
        <TextField
          fullWidth
          select
          size="small"
          label="Category"
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          sx={{ mb: 2 }}
        >
          {categories.map(c => (
            <MenuItem key={c} value={c}>{c}</MenuItem>
          ))}
        </TextField>

        {filteredVendors.map(v => (
          <VendorCard key={v.id} vendor={v} />
        ))}

        {filteredVendors.length === 0 && (
          <Typography align="center" color="text.secondary">
            No matching customers
          </Typography>
        )}
      </Paper>
    </Container>
  );
};

export default CustomerList;