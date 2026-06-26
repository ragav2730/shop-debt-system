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
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip
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
  MonetizationOn,
  Download,
  PictureAsPdf,
  TableChart,
  TextFields
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import CustomerCard from './CustomerCard';
import SearchBar from '../Shared/SearchBar';
import PremiumCard from '../Shared/PremiumCard';

// ─── Export helpers ───────────────────────────────────────────────────────────

const buildRows = (customers) =>
  customers.map((c) => ({
    name: c.customerName || '',
    phone: c.phone || '',
    totalAmount: c.totalPurchases || 0,
    balance: c.balance || 0,
  }));

const exportToCSV = (customers) => {
  const rows = buildRows(customers);
  const header = ['Name', 'Phone No', 'Total Amount', 'Balance'];
  const lines = [
    header.join(','),
    ...rows.map((r) =>
      [`"${r.name}"`, `"${r.phone}"`, r.totalAmount, r.balance].join(',')
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Customers_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const exportToExcel = async (customers) => {
  const { utils, writeFile } = await import('xlsx');
  const rows = buildRows(customers).map((r) => ({
    Name: r.name,
    'Phone No': r.phone,
    'Total Amount': r.totalAmount,
    Balance: r.balance,
  }));
  const ws = utils.json_to_sheet(rows);
  // Column widths
  ws['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Customers');
  writeFile(wb, `Customers_${new Date().toISOString().split('T')[0]}.xlsx`);
};

const exportToPDF = async (customers) => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Header bar
  doc.setFillColor(102, 126, 234);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.text('Customer List', 14, 12);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 21);
  doc.text(`Total: ${customers.length} customers`, 150, 21);

  const rows = buildRows(customers);
  const totalBalance = rows.reduce((s, r) => s + r.balance, 0);
  const totalAmount = rows.reduce((s, r) => s + r.totalAmount, 0);

  autoTable(doc, {
    startY: 34,
    head: [['Name', 'Phone No', 'Total Amount (₹)', 'Balance (₹)']],
    body: rows.map((r) => [
      r.name,
      r.phone || '—',
      r.totalAmount.toLocaleString('en-IN'),
      r.balance.toLocaleString('en-IN'),
    ]),
    foot: [['', 'TOTAL', totalAmount.toLocaleString('en-IN'), totalBalance.toLocaleString('en-IN')]],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [102, 126, 234], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [240, 240, 255], textColor: [33, 33, 33], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 255] },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 40 },
      2: { cellWidth: 40, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
    },
    didParseCell: (data) => {
      // Colour balance column: red if >0, green if 0
      if (data.section === 'body' && data.column.index === 3) {
        const val = rows[data.row.index]?.balance;
        if (val > 0) data.cell.styles.textColor = [198, 40, 40];
        else if (val === 0) data.cell.styles.textColor = [46, 125, 50];
      }
    },
  });

  // Page numbers
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${pages}`,
      doc.internal.pageSize.getWidth() - 28,
      doc.internal.pageSize.getHeight() - 8
    );
  }

  doc.save(`Customers_${new Date().toISOString().split('T')[0]}.pdf`);
};

// ─────────────────────────────────────────────────────────────────────────────

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

  // Download menu state
  const [downloadAnchor, setDownloadAnchor] = useState(null);
  const [downloading, setDownloading] = useState(false);

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

          const totalDebt = customersData.reduce((sum, c) =>
            sum + (c.balance > 0 ? c.balance : 0), 0
          );
          const activeCustomers = customersData.filter(c => c.balance > 0).length;
          const totalPaid = customersData.reduce((sum, c) =>
            sum + (c.totalPurchases || 0) - (c.balance || 0), 0
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

  const handleCustomerClick = (customerId) => navigate(`/customers/${customerId}`);
  const handleAddCustomer = () => navigate('/customers/new');

  const handleDownload = async (format) => {
    setDownloadAnchor(null);
    setDownloading(true);
    try {
      // Download uses the currently filtered list so search results can be exported too
      const list = filteredCustomers;
      if (format === 'pdf') await exportToPDF(list);
      else if (format === 'excel') await exportToExcel(list);
      else exportToCSV(list);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ bgcolor: '#000', minHeight: '100vh', pt: { xs: '88px', md: '108px' } }}>
        <Container maxWidth="lg">
          <Box sx={{ p: 2 }}>
            <Skeleton variant="rectangular" height={150} sx={{ borderRadius: 4, mb: 3 }} />
            <Skeleton variant="text" height={40} sx={{ mb: 2 }} />
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} variant="rectangular" height={80} sx={{ borderRadius: 2, mb: 2 }} />
            ))}
          </Box>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: '#000', minHeight: '100vh', pb: 8, pt: { xs: '88px', md: '108px' } }}>

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
              {[
                { icon: <Group sx={{ color: 'white', fontSize: 28 }} />, value: stats.totalCustomers, label: 'Total' },
                { icon: <TrendingDown sx={{ color: '#FF6B6B', fontSize: 28 }} />, value: `₹${stats.totalDebt.toLocaleString('en-IN')}`, label: 'Total Debt' },
                { icon: <TrendingUp sx={{ color: '#4CAF50', fontSize: 28 }} />, value: `₹${stats.totalPaid.toLocaleString('en-IN')}`, label: 'Total Paid' },
                { icon: <AccountBalance sx={{ color: '#FFA726', fontSize: 28 }} />, value: stats.activeCustomers, label: 'Pending' },
              ].map(({ icon, value, label }) => (
                <Grid item xs={6} sm={3} key={label}>
                  <PremiumCard sx={{ bgcolor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}>
                    <Stack alignItems="center" spacing={1}>
                      {icon}
                      <Typography variant="h5" fontWeight={700} color="white">{value}</Typography>
                      <Typography variant="caption" color="rgba(255,255,255,0.8)">{label}</Typography>
                    </Stack>
                  </PremiumCard>
                </Grid>
              ))}
            </Grid>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg">
        {/* Search + Add + Download */}
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

            {/* Download button */}
            <Tooltip title="Download customer list">
              <IconButton
                onClick={(e) => setDownloadAnchor(e.currentTarget)}
                disabled={downloading || filteredCustomers.length === 0}
                sx={{
                  bgcolor: downloading ? alpha('#4CAF50', 0.3) : alpha('#4CAF50', 0.15),
                  color: '#4CAF50',
                  width: 56,
                  height: 56,
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: alpha('#4CAF50', 0.4),
                  '&:hover': {
                    bgcolor: alpha('#4CAF50', 0.25),
                    transform: 'scale(1.05)'
                  },
                  transition: 'all 0.2s'
                }}
              >
                {downloading
                  ? <CircularProgress size={22} sx={{ color: '#4CAF50' }} />
                  : <Download />
                }
              </IconButton>
            </Tooltip>

            {/* Add button */}
            <IconButton
              onClick={handleAddCustomer}
              sx={{
                bgcolor: 'primary.main',
                color: 'white',
                width: 56,
                height: 56,
                borderRadius: 3,
                '&:hover': { bgcolor: 'primary.dark', transform: 'scale(1.05)' }
              }}
            >
              <Add />
            </IconButton>
          </Stack>
        </Box>

        {/* Format picker menu */}
        <Menu
          anchorEl={downloadAnchor}
          open={Boolean(downloadAnchor)}
          onClose={() => setDownloadAnchor(null)}
          PaperProps={{
            sx: {
              bgcolor: '#1a1a2e',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 2,
              minWidth: 180,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }
          }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
            <Typography variant="caption" color="rgba(255,255,255,0.5)" fontWeight={600} letterSpacing={0.8}>
              DOWNLOAD AS
            </Typography>
          </Box>

          <MenuItem onClick={() => handleDownload('pdf')} sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(102,126,234,0.2)' } }}>
            <ListItemIcon><PictureAsPdf sx={{ color: '#ef5350' }} /></ListItemIcon>
            <ListItemText primary="PDF" secondary="Best for printing" secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.4)', fontSize: 11 } }} />
          </MenuItem>

          <MenuItem onClick={() => handleDownload('excel')} sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(76,175,80,0.2)' } }}>
            <ListItemIcon><TableChart sx={{ color: '#66bb6a' }} /></ListItemIcon>
            <ListItemText primary="Excel (.xlsx)" secondary="Best for analysis" secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.4)', fontSize: 11 } }} />
          </MenuItem>

          <MenuItem onClick={() => handleDownload('csv')} sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,167,38,0.2)' } }}>
            <ListItemIcon><TextFields sx={{ color: '#ffa726' }} /></ListItemIcon>
            <ListItemText primary="CSV" secondary="Simple format" secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.4)', fontSize: 11 } }} />
          </MenuItem>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mx: 1 }} />
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="caption" color="rgba(255,255,255,0.35)">
              {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''} will be exported
            </Typography>
          </Box>
        </Menu>

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