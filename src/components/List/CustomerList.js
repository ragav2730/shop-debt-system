import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Chip,
  TextField,
  MenuItem,
  Menu,
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
  Pending,
  Download,
  PictureAsPdf,
  TableChart
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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const categories = ['All', 'Cement', 'Bricks', 'Steel', 'Sheet', 'Other'];

const CustomerList = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [vendors, setVendors] = useState([]); // Changed from customers to vendors
  const [transactions, setTransactions] = useState([]);
  const [filteredVendors, setFilteredVendors] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [downloadAnchorEl, setDownloadAnchorEl] = useState(null);

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

  // Total of all purchases linked to this vendor (matches "Total Sales" on Vendor Detail page)
  const getVendorTotalAmount = vendorId =>
    transactions
      .filter(t => (t.vendorId || t.customerId) === vendorId)
      .reduce((sum, t) => sum + (t.amount || 0), 0);

  /* ================= DOWNLOAD: CSV ================= */
  const handleDownloadCSV = () => {
    const escapeCSV = value => {
      const str = String(value ?? '');
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const headers = ['Name', 'Phone No', 'Total Amount', 'Balance'];
    const rows = filteredVendors.map(v => [
      v.vendorName || '',
      v.phone || '',
      getVendorTotalAmount(v.id),
      v.balance || 0
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(escapeCSV).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Customers_List_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /* ================= DOWNLOAD: PDF ================= */
  const handleDownloadPDF = () => {
    const docPdf = new jsPDF();

    // Header
    docPdf.setFontSize(16);
    docPdf.setTextColor(198, 40, 40); // #C62828
    docPdf.text('Pending Customers Report', 14, 16);

    docPdf.setFontSize(10);
    docPdf.setTextColor(100, 100, 100);
    docPdf.text(
      `Generated on ${new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })}`,
      14,
      22
    );

    // Table rows — using "Rs." instead of the rupee symbol (jsPDF's default font
    // doesn't include the ₹ glyph and renders it as a broken/garbled character)
    const tableRows = filteredVendors.map(v => [
      v.vendorName || '',
      v.phone || '-',
      `Rs. ${getVendorTotalAmount(v.id).toLocaleString('en-IN')}`,
      `Rs. ${(v.balance || 0).toLocaleString('en-IN')}`
    ]);

    autoTable(docPdf, {
      startY: 28,
      head: [['Name', 'Phone No', 'Total Amount', 'Balance']],
      body: tableRows,
      headStyles: {
        fillColor: [198, 40, 40],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: { fillColor: [255, 247, 247] },
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' }
      }
    });

    const totalBalance = filteredVendors.reduce((sum, v) => sum + (v.balance || 0), 0);
    const finalY = docPdf.lastAutoTable ? docPdf.lastAutoTable.finalY : 28;

    docPdf.setFontSize(11);
    docPdf.setTextColor(198, 40, 40);
    docPdf.text(
      `Total Outstanding Balance: Rs. ${totalBalance.toLocaleString('en-IN')}`,
      14,
      finalY + 10
    );

    docPdf.save(`Customers_List_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  /* ================= DOWNLOAD MENU ================= */
  const handleDownloadClick = event => {
    setDownloadAnchorEl(event.currentTarget);
  };

  const handleDownloadClose = () => {
    setDownloadAnchorEl(null);
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
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} spacing={2}>
          <Typography variant="h5" fontWeight={800} color="#C62828">
            Pending Customers
          </Typography>

          <Stack direction="row" spacing={1}>
            <Button
              onClick={handleDownloadClick}
              startIcon={<Download />}
              variant="outlined"
              disabled={filteredVendors.length === 0}
              sx={{ color: '#C62828', borderColor: '#C62828' }}
            >
              {!isMobile && 'Download'}
            </Button>
            <Menu
              anchorEl={downloadAnchorEl}
              open={Boolean(downloadAnchorEl)}
              onClose={handleDownloadClose}
            >
              <MenuItem
                onClick={() => {
                  handleDownloadCSV();
                  handleDownloadClose();
                }}
              >
                <TableChart fontSize="small" sx={{ mr: 1 }} />
                Download CSV
              </MenuItem>
              <MenuItem
                onClick={() => {
                  handleDownloadPDF();
                  handleDownloadClose();
                }}
              >
                <PictureAsPdf fontSize="small" sx={{ mr: 1 }} />
                Download PDF
              </MenuItem>
            </Menu>

            <Button
              component={RouterLink}
              to="/vendors" // Changed to go to vendor list to add new customer
              startIcon={<PersonAdd />}
              variant="contained"
            >
              {isMobile ? 'Add' : 'Add Customer'}
            </Button>
          </Stack>
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