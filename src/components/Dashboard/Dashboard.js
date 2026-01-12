import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Stack,
  Avatar,
  Chip,
  LinearProgress,
  useTheme,
  useMediaQuery,
  Skeleton,
  Divider,
  Container
} from '@mui/material';

import {
  People,
  Pending,
  AccountBalanceWallet,
  TrendingUp
} from '@mui/icons-material';

import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalCustomers: 0,
    pendingCustomers: 0,
    totalDebt: 0,
    todayCollection: 0,
    monthlyCollection: 0,
    loading: true
  });

  const [recentCustomers, setRecentCustomers] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);

  /* ================= UTIL ================= */
  const formatCurrency = amt => {
    if (!amt) return '₹0';
    if (amt >= 100000) return `₹${(amt / 100000).toFixed(1)}L`;
    if (amt >= 1000) return `₹${(amt / 1000).toFixed(1)}K`;
    return `₹${amt}`;
  };

  /* ================= DATA FETCH ================= */
  useEffect(() => {
    const unsubCustomers = onSnapshot(
      collection(db, 'customers'),
      snap => {
        let total = 0;
        let pending = 0;
        let debt = 0;
        const list = [];

        snap.forEach(doc => {
          const c = { id: doc.id, ...doc.data() };
          total++;
          if ((c.balance || 0) > 0) {
            pending++;
            debt += c.balance;
          }
          list.push(c);
        });

        list.sort((a, b) => b.createdAt?.toDate() - a.createdAt?.toDate());

        setRecentCustomers(list.slice(0, 5));
        setStats(s => ({
          ...s,
          totalCustomers: total,
          pendingCustomers: pending,
          totalDebt: debt
        }));
      }
    );

    const unsubPayments = onSnapshot(
      query(collection(db, 'payments'), orderBy('createdAt', 'desc')),
      snap => {
        let today = 0;
        let month = 0;
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const firstOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);

        const payments = [];

        snap.forEach(doc => {
          const p = { id: doc.id, ...doc.data() };
          const d = p.createdAt?.toDate();
          if (!d) return;

          if (d >= todayDate) today += p.amount || 0;
          if (d >= firstOfMonth) month += p.amount || 0;

          payments.push(p);
        });

        setRecentPayments(payments.slice(0, 5));
        setStats(s => ({
          ...s,
          todayCollection: today,
          monthlyCollection: month,
          loading: false
        }));

        generateWeeklyChart(payments);
      }
    );

    return () => {
      unsubCustomers();
      unsubPayments();
    };
  }, []);

  /* ================= WEEKLY CHART ================= */
  const generateWeeklyChart = payments => {
    const days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { label: d.toLocaleDateString('en-IN', { weekday: 'short' }), amount: 0 };
    });

    payments.forEach(p => {
      const d = p.createdAt?.toDate();
      if (!d) return;
      const diff = Math.floor((new Date() - d) / 86400000);
      if (diff >= 0 && diff < 7) {
        days[6 - diff].amount += p.amount || 0;
      }
    });

    setWeeklyData(days);
  };

  /* ================= PREMIUM CARD ================= */
  const PremiumStat = ({ title, value, icon, color }) => (
    <Card
      sx={{
        borderRadius: 4,
        background: `linear-gradient(135deg, ${color}15, ${color}05)`,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 12px 30px rgba(0,0,0,0.08)'
      }}
    >
      <CardContent>
        <Stack direction="row" justifyContent="space-between">
          <Box>
            <Typography variant="caption" color="text.secondary">
              {title}
            </Typography>
            <Typography variant="h5" fontWeight={700} color={color}>
              {stats.loading ? <Skeleton width={80} /> : value}
            </Typography>
          </Box>
          <Avatar sx={{ bgcolor: `${color}20`, color }}>
            {icon}
          </Avatar>
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ bgcolor: '#f4f6f8', minHeight: '100vh' }}>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {/* HEADER */}
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Live business overview
        </Typography>

        {/* STATS */}
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={6} md={3}>
            <PremiumStat
              title="Total Customers"
              value={stats.totalCustomers}
              icon={<People />}
              color="#1976d2"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <PremiumStat
              title="Pending Customers"
              value={stats.pendingCustomers}
              icon={<Pending />}
              color="#d32f2f"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <PremiumStat
              title="Total Debt"
              value={formatCurrency(stats.totalDebt)}
              icon={<AccountBalanceWallet />}
              color="#c62828"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <PremiumStat
              title="This Month Collection"
              value={formatCurrency(stats.monthlyCollection)}
              icon={<TrendingUp />}
              color="#2e7d32"
            />
          </Grid>
        </Grid>

        {/* WEEKLY COLLECTION */}
        <Card sx={{ mt: 3, borderRadius: 4 }}>
          <CardContent>
            <Typography fontWeight={600} gutterBottom>
              Weekly Collection
            </Typography>

            <Stack direction="row" alignItems="flex-end" spacing={1} sx={{ height: 180 }}>
              {weeklyData.map((d, i) => {
                const max = Math.max(...weeklyData.map(x => x.amount));
                const h = max ? (d.amount / max) * 140 : 0;

                return (
                  <Box key={i} sx={{ flex: 1, textAlign: 'center' }}>
                    <Box
                      sx={{
                        height: h,
                        bgcolor: theme.palette.primary.main,
                        borderRadius: 2,
                        transition: '0.3s'
                      }}
                    />
                    <Typography variant="caption">{d.label}</Typography>
                  </Box>
                );
              })}
            </Stack>
          </CardContent>
        </Card>

        {/* RECENT */}
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={12} md={6}>
            <Card sx={{ borderRadius: 4 }}>
              <CardContent>
                <Typography fontWeight={600}>Recent Customers</Typography>
                <Divider sx={{ my: 1 }} />
                {recentCustomers.map(c => (
                  <Box
                    key={c.id}
                    sx={{ py: 1, cursor: 'pointer' }}
                    onClick={() => navigate(`/list/${c.id}`)}
                  >
                    <Stack direction="row" justifyContent="space-between">
                      <Typography>{c.customerName}</Typography>
                      <Chip
                        size="small"
                        label={`₹${c.balance || 0}`}
                        color={c.balance > 0 ? 'error' : 'success'}
                      />
                    </Stack>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ borderRadius: 4 }}>
              <CardContent>
                <Typography fontWeight={600}>Recent Payments</Typography>
                <Divider sx={{ my: 1 }} />
                {recentPayments.map(p => (
                  <Box key={p.id} sx={{ py: 1 }}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography>{p.customerName}</Typography>
                      <Typography color="success.main">
                        ₹{p.amount}
                      </Typography>
                    </Stack>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Dashboard;
