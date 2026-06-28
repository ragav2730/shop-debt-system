import React, { useState, useEffect, useMemo } from 'react';
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
  Grid,
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
  TableChart,
  ReceiptLong,
  PeopleAlt,
  AccountBalanceWallet
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
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

  const [vendors, setVendors] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [payments, setPayments] = useState([]);
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
          initialBalance: d.data().initialBalance || 0
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

  /* ================= LOAD PAYMENTS =================
     FIX: this page previously never loaded payments at all, so there was
     no way to show "amount received" and the Balance shown was whatever
     the vendor doc's `balance` field happened to say — with no way to
     verify it. We now pull payments and derive the balance ourselves:
        Total Balance = Initial Balance + Total Purchases − Total Paid
     which is self-consistent and doesn't depend on the stored field
     having stayed correctly in sync.
  */
  useEffect(() => {
    return onSnapshot(
      collection(db, 'payments'),
      snap => {
        setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );
  }, []);

  /* ================= PER-VENDOR STATS ================= */
  const vendorsWithStats = useMemo(() => {
    return vendors.map(v => {
      const vendorTransactions = transactions.filter(
        t => (t.vendorId || t.customerId) === v.id
      );
      const totalSales = vendorTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

      const vendorPayments = payments.filter(p => p.vendorId === v.id);
      const totalPaid = vendorPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      const initialBalance = v.initialBalance || 0;
      const computedBalance = Math.max(0, initialBalance + totalSales - totalPaid);

      const lastTransaction = vendorTransactions
        .slice()
        .sort((a, b) => {
          const da = a.date?.toDate?.() || new Date(a.date || 0);
          const db_ = b.date?.toDate?.() || new Date(b.date || 0);
          return db_ - da;
        })[0];

      return {
        ...v,
        totalSales,
        totalPaid,
        computedBalance,
        transactionCount: vendorTransactions.length,
        lastTransaction
      };
    });
  }, [vendors, transactions, payments]);

  // Vendors who currently owe money — the universe this whole page is about.
  const pendingVendors = useMemo(
    () => vendorsWithStats.filter(v => v.computedBalance > 0),
    [vendorsWithStats]
  );

  /* ================= TOP SUMMARY STATS =================
     Always reflects ALL pending vendors, independent of the search box /
     category filter below, so it reads as a stable dashboard total.
  */
  const summary = useMemo(() => {
    const totalDebt = pendingVendors.reduce((sum, v) => sum + v.computedBalance, 0);
    const totalReceived = pendingVendors.reduce((sum, v) => sum + v.totalPaid, 0);
    return {
      totalDebt,
      totalReceived,
      customerCount: pendingVendors.length
    };
  }, [pendingVendors]);

  /* ================= FILTER LOGIC ================= */
  const filteredVendors = useMemo(() => {
    let result = pendingVendors;

    // Category filter
    if (selectedCategory !== 'All') {
      const vendorIdsWithCategory = new Set(
        transactions
          .filter(t =>
            t.category === selectedCategory &&
            (t.remainingAmount ?? t.amount) > 0
          )
          .map(t => t.vendorId || t.customerId)
      );

      result = result.filter(v => vendorIdsWithCategory.has(v.id));
    }

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        v =>
          v.vendorName?.toLowerCase().includes(term) ||
          v.phone?.includes(searchTerm)
      );
    }

    // Highest debt first — helps prioritize who to follow up with.
    return [...result].sort((a, b) => b.computedBalance - a.computedBalance);
  }, [pendingVendors, transactions, selectedCategory, searchTerm]);

  /* ================= HELPERS ================= */
  const getInitials = name =>
    name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const handlePhoneCall = phone => {
    window.location.href = `tel:${phone}`;
  };

  const formatDate = dateInput => {
    if (!dateInput) return null;
    try {
      const d = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch {
      return null;
    }
  };

  const formatINR = amount =>
    `₹${Math.round(amount || 0).toLocaleString('en-IN')}`;

  /* ================= DOWNLOAD: CSV ================= */
  const handleDownloadCSV = () => {
    const escapeCSV = value => {
      const str = String(value ?? '');
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

    // FIX: now includes Amount Paid (Received), and Total Balance is the
    // self-computed (initialBalance + sales - paid) figure, not the raw
    // stored field.
    const headers = ['Name', 'Phone No', 'Total Amount', 'Amount Paid (Received)', 'Total Balance'];
    const rows = filteredVendors.map(v => [
      v.vendorName || '',
      v.phone || '',
      v.totalSales,
      v.totalPaid,
      v.computedBalance
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

    // FIX: added "Amount Paid (Received)" column, and Total Balance now
    // uses the self-computed figure (initialBalance + sales - paid),
    // guaranteeing it reflects payments rather than trusting a stored
    // field that other parts of the app could in theory leave stale.
    const tableRows = filteredVendors.map(v => [
      v.vendorName || '',
      v.phone || '-',
      `Rs. ${v.totalSales.toLocaleString('en-IN')}`,
      `Rs. ${v.totalPaid.toLocaleString('en-IN')}`,
      `Rs. ${v.computedBalance.toLocaleString('en-IN')}`
    ]);

    autoTable(docPdf, {
      startY: 28,
      head: [['Name', 'Phone No', 'Total Amount', 'Amount Paid (Received)', 'Total Balance']],
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
        3: { halign: 'right' },
        4: { halign: 'right' }
      }
    });

    const totalBalance = filteredVendors.reduce((sum, v) => sum + v.computedBalance, 0);
    const totalReceived = filteredVendors.reduce((sum, v) => sum + v.totalPaid, 0);
    const finalY = docPdf.lastAutoTable ? docPdf.lastAutoTable.finalY : 28;

    docPdf.setFontSize(11);
    docPdf.setTextColor(46, 125, 50); // green
    docPdf.text(
      `Total Received: Rs. ${totalReceived.toLocaleString('en-IN')}`,
      14,
      finalY + 10
    );

    docPdf.setTextColor(198, 40, 40);
    docPdf.text(
      `Total Outstanding Balance: Rs. ${totalBalance.toLocaleString('en-IN')}`,
      14,
      finalY + 17
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

  /* ================= VENDOR CARD =================
     FIX: significantly more compact (smaller avatar, tighter padding,
     smaller type) and now surfaces more at-a-glance detail — purchase
     count, amount already paid, and the date of their last purchase —
     instead of just name / phone / balance.
  */
  const VendorCard = ({ vendor }) => {
    const lastDate = formatDate(vendor.lastTransaction?.date);

    return (
      <Card
        sx={{
          mb: 1.25,
          borderRadius: 3,
          bgcolor: '#FFF7F7',
          border: '1px solid #FFE0E0',
          boxShadow: 'none'
        }}
      >
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
              <Avatar sx={{ bgcolor: '#C62828', width: 38, height: 38, fontSize: 14 }}>
                {getInitials(vendor.vendorName)}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={700} variant="body2" noWrap>
                  {vendor.vendorName}
                </Typography>
                {vendor.phone ? (
                  <Button
                    onClick={() => handlePhoneCall(vendor.phone)}
                    startIcon={<Phone sx={{ fontSize: 13 }} />}
                    size="small"
                    sx={{
                      p: 0,
                      minWidth: 0,
                      textTransform: 'none',
                      color: '#B71C1C',
                      fontSize: '0.75rem',
                      '& .MuiButton-startIcon': { mr: 0.5 }
                    }}
                  >
                    {vendor.phone}
                  </Button>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    No phone
                  </Typography>
                )}
              </Box>
            </Stack>

            <Stack alignItems="flex-end" spacing={0.4}>
              <Typography color="error.main" fontWeight={700} variant="subtitle1" noWrap>
                {formatINR(vendor.computedBalance)}
              </Typography>
              <Chip
                size="small"
                label="Pending"
                icon={<Pending sx={{ fontSize: 13 }} />}
                sx={{
                  height: 20,
                  bgcolor: '#FFD6D6',
                  color: '#C62828',
                  '& .MuiChip-label': { px: 0.75, fontSize: '0.65rem' },
                  '& .MuiChip-icon': { ml: 0.5 }
                }}
              />
            </Stack>

            <IconButton
              component={RouterLink}
              to={`/vendors/${vendor.id}`}
              size="small"
              sx={{ bgcolor: '#FFECEC', ml: 0.5 }}
            >
              <ArrowForward fontSize="small" />
            </IconButton>
          </Stack>

          <Divider sx={{ my: 1 }} />

          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <ReceiptLong sx={{ fontSize: 13, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                {vendor.transactionCount} purchase{vendor.transactionCount !== 1 ? 's' : ''}
              </Typography>
            </Stack>
            <Typography variant="caption" color="success.main" fontWeight={600}>
              Paid: {formatINR(vendor.totalPaid)}
            </Typography>
            {lastDate && (
              <Typography variant="caption" color="text.secondary">
                Last: {lastDate}
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>
    );
  };

  return (
    <Container maxWidth="lg">
      <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 4 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
          spacing={2}
          flexWrap="wrap"
        >
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
              {!isSmall && 'Download'}
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
              to="/vendors"
              startIcon={<PersonAdd />}
              variant="contained"
            >
              {isSmall ? 'Add' : 'Add Customer'}
            </Button>
          </Stack>
        </Stack>

        {/* TOP SUMMARY — always reflects ALL pending customers, regardless
            of the search/category filter below. */}
        <Grid container spacing={1.5} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={4}>
            <Paper
              sx={{
                p: 1.75,
                borderRadius: 3,
                bgcolor: '#FFF7F7',
                border: '1px solid #FFE0E0'
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <AccountBalanceWallet sx={{ color: '#C62828', fontSize: 20 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Total Outstanding
                  </Typography>
                  <Typography variant="h6" fontWeight={800} color="#C62828">
                    {formatINR(summary.totalDebt)}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={4}>
            <Paper
              sx={{
                p: 1.75,
                borderRadius: 3,
                bgcolor: '#FFF7F7',
                border: '1px solid #FFE0E0'
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <PeopleAlt sx={{ color: '#C62828', fontSize: 20 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Customers with Dues
                  </Typography>
                  <Typography variant="h6" fontWeight={800} color="#C62828">
                    {summary.customerCount}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Paper
              sx={{
                p: 1.75,
                borderRadius: 3,
                bgcolor: '#F4FBF4',
                border: '1px solid #DCF0DC'
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <ReceiptLong sx={{ color: '#2E7D32', fontSize: 20 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Total Received
                  </Typography>
                  <Typography variant="h6" fontWeight={800} color="success.main">
                    {formatINR(summary.totalReceived)}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>

        {/* SEARCH + CATEGORY */}
        <Stack direction={isSmall ? 'column' : 'row'} spacing={1.5} sx={{ mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            label="Search"
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
          <TextField
            fullWidth
            select
            size="small"
            label="Category"
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            sx={{ minWidth: isSmall ? '100%' : 180 }}
          >
            {categories.map(c => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </TextField>
        </Stack>

        {filteredVendors.map(v => (
          <VendorCard key={v.id} vendor={v} />
        ))}

        {filteredVendors.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              No matching customers
            </Typography>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default CustomerList;