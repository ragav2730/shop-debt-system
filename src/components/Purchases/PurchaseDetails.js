import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Stack,
  Card,
  CardContent,
  Avatar,
  Chip,
  Button,
  IconButton,
  Divider,
  LinearProgress,
  Grid,
  Paper,
  useTheme,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Delete,
  Share,
  WhatsApp,
  Phone,
  Person,
  ShoppingBag,
  AccountBalanceWallet,
  Payment,
  Receipt,
  TrendingUp,
  AttachMoney
} from '@mui/icons-material';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

const PRIMARY_BLUE = '#1976d2';

const PurchaseDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();

  const [purchase, setPurchase] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchPurchase = async () => {
      const purchaseDoc = await getDoc(doc(db, 'transactions', id));
      if (purchaseDoc.exists()) {
        const purchaseData = { id: purchaseDoc.id, ...purchaseDoc.data() };
        setPurchase(purchaseData);

        if (purchaseData.customerId) {
          const customerDoc = await getDoc(doc(db, 'customers', purchaseData.customerId));
          if (customerDoc.exists()) {
            setCustomer({ id: customerDoc.id, ...customerDoc.data() });
          }
        }
      }
      setLoading(false);
    };

    fetchPurchase();
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm('Delete this purchase?')) return;
    setDeleting(true);
    await deleteDoc(doc(db, 'transactions', id));
    navigate('/purchases');
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={6}>
        <CircularProgress />
      </Box>
    );
  }

  if (!purchase) {
    return <Alert severity="error">Purchase not found</Alert>;
  }

  const remaining =
    typeof purchase.remainingAmount === 'number'
      ? purchase.remainingAmount
      : purchase.amount || 0;

  const isPaid = remaining === 0;
  const paidAmount = (purchase.amount || 0) - remaining;
  const progress = purchase.amount > 0 ? (paidAmount / purchase.amount) * 100 : 100;

  return (
    <Box sx={{ bgcolor: '#f5f7fb', minHeight: '100vh', pb: 4 }}>
      {/* Header */}
      <Box sx={{
        bgcolor: PRIMARY_BLUE,
        color: 'white',
        px: 2,
        py: 2,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24
      }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton onClick={() => navigate('/purchases')} sx={{ color: 'white' }}>
            <ArrowBack />
          </IconButton>
          <Typography fontSize={20} fontWeight={700}>
            Purchase Details
          </Typography>
        </Stack>
      </Box>

      <Container maxWidth="md" sx={{ mt: 3 }}>
        <Grid container spacing={3}>
          {/* LEFT */}
          <Grid item xs={12} md={8}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ bgcolor: PRIMARY_BLUE }}>
                    <ShoppingBag />
                  </Avatar>
                  <Box flex={1}>
                    <Typography fontWeight={700}>
                      {purchase.productName}
                    </Typography>
                    <Chip
                      size="small"
                      label={isPaid ? 'PAID' : 'PENDING'}
                      color={isPaid ? 'success' : 'warning'}
                      sx={{ mt: 0.5 }}
                    />
                  </Box>
                </Stack>

                <Divider sx={{ my: 2 }} />

                <Typography fontSize={13} color="text.secondary">
                  Payment Progress
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{ height: 8, borderRadius: 5, mt: 1 }}
                />

                <Grid container spacing={2} mt={2}>
                  <Grid item xs={6}>
                    <Typography fontSize={12}>Paid</Typography>
                    <Typography fontWeight={700} color="success.main">
                      ₹{paidAmount}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography fontSize={12}>Balance</Typography>
                    <Typography fontWeight={700} color="error.main">
                      ₹{remaining}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {customer && (
              <Card sx={{ mt: 3, borderRadius: 3 }}>
                <CardContent>
                  <Typography fontWeight={600} mb={1}>
                    Customer
                  </Typography>

                  <List dense>
                    <ListItem>
                      <ListItemIcon><Person /></ListItemIcon>
                      <ListItemText primary={customer.customerName} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><Phone /></ListItemIcon>
                      <ListItemText primary={customer.phone} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><AccountBalanceWallet /></ListItemIcon>
                      <ListItemText
                        primary={`₹${customer.balance}`}
                        primaryTypographyProps={{
                          color: customer.balance > 0 ? 'error.main' : 'success.main'
                        }}
                      />
                    </ListItem>
                  </List>

                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => navigate(`/customers/${customer.id}`)}
                  >
                    View Customer
                  </Button>
                </CardContent>
              </Card>
            )}
          </Grid>

          {/* RIGHT */}
          <Grid item xs={12} md={4}>
            <Card sx={{ borderRadius: 3, mb: 2, textAlign: 'center' }}>
              <CardContent>
                <AttachMoney sx={{ fontSize: 42, color: PRIMARY_BLUE }} />
                <Typography fontWeight={800} color={PRIMARY_BLUE}>
                  ₹{purchase.amount}
                </Typography>
                <Typography fontSize={12} color="text.secondary">
                  Total Purchase
                </Typography>
              </CardContent>
            </Card>

            <Stack spacing={1}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<Payment />}
                disabled={isPaid}
              >
                Make Payment
              </Button>

              <Button fullWidth variant="outlined" startIcon={<Receipt />}>
                Download Bill
              </Button>

              <Button fullWidth variant="outlined" startIcon={<WhatsApp />}>
                Share WhatsApp
              </Button>

              <Button
                fullWidth
                color="error"
                startIcon={deleting ? <CircularProgress size={18} /> : <Delete />}
                onClick={handleDelete}
              >
                Delete
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default PurchaseDetails;
