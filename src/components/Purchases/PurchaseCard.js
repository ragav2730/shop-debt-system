import React from 'react';
import {
  Card,
  CardContent,
  Stack,
  Typography,
  Avatar,
  Box,
  Chip,
  IconButton,
  alpha,
  useTheme,
  LinearProgress
} from '@mui/material';
import {
  ArrowForwardIos,
  ShoppingBag,
  Person,
  CalendarToday,
  AccountBalance,
  Payment
} from '@mui/icons-material';

const PurchaseCard = ({ purchase, onClick }) => {
  const theme = useTheme();
  const isPaid = (purchase.remainingAmount || 0) <= 0;
  const paidAmount = (purchase.amount || 0) - (purchase.remainingAmount || 0);
  const paymentPercentage = purchase.amount > 0 ? (paidAmount / purchase.amount) * 100 : 100;

  const formatDate = (dateInput) => {
    if (!dateInput) return 'N/A';
    try {
      if (dateInput.toDate && typeof dateInput.toDate === 'function') {
        return dateInput.toDate().toLocaleDateString('en-IN');
      }
      return new Date(dateInput).toLocaleDateString('en-IN');
    } catch {
      return 'Invalid Date';
    }
  };

  const getProductColor = (productName) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0', '#118AB2',
      '#EF476F', '#FFD166', '#06D6A0', '#073B4C', '#7209B7'
    ];
    const index = productName?.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  return (
    <Card
      onClick={onClick}
      sx={{
        borderRadius: 3,
        bgcolor: alpha(theme.palette.background.paper, 0.6),
        backdropFilter: 'blur(10px)',
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          transform: 'translateY(-2px)',
          borderColor: alpha(theme.palette.primary.main, 0.3),
          boxShadow: '0 12px 24px rgba(0,0,0,0.2)',
          bgcolor: alpha(theme.palette.background.paper, 0.8)
        },
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Status Indicator */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 4,
          height: '100%',
          bgcolor: isPaid ? '#4CAF50' : '#FFA726',
          borderTopLeftRadius: 12,
          borderBottomLeftRadius: 12
        }}
      />
      
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          {/* Product Avatar */}
          <Avatar
            sx={{
              width: 56,
              height: 56,
              bgcolor: getProductColor(purchase.productName),
              fontSize: 20,
              fontWeight: 700
            }}
          >
            <ShoppingBag />
          </Avatar>
          
          {/* Purchase Info */}
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  {purchase.productName || 'Unnamed Product'}
                </Typography>
                
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                  {purchase.customerName && (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Person sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {purchase.customerName}
                      </Typography>
                    </Stack>
                  )}
                  
                  {purchase.date && (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <CalendarToday sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(purchase.date)}
                      </Typography>
                    </Stack>
                  )}
                </Stack>
              </Box>
              
              {/* Amount */}
              <Stack alignItems="flex-end" spacing={0.5}>
                <Typography variant="h6" fontWeight={700} color="primary.main">
                  ₹{(purchase.amount || 0).toLocaleString('en-IN')}
                </Typography>
                
                {!isPaid && (
                  <Typography variant="caption" color="error.main" fontWeight={600}>
                    Pending: ₹{(purchase.remainingAmount || 0).toLocaleString('en-IN')}
                  </Typography>
                )}
                
                <Chip
                  label={isPaid ? 'PAID' : 'PENDING'}
                  size="small"
                  sx={{
                    bgcolor: isPaid ? 
                      alpha(theme.palette.success.main, 0.1) : 
                      alpha(theme.palette.warning.main, 0.1),
                    color: isPaid ? theme.palette.success.main : theme.palette.warning.main,
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    height: 20
                  }}
                />
              </Stack>
            </Stack>
            
            {/* Payment Progress */}
            {!isPaid && (
              <Box sx={{ mt: 2 }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Payment Progress
                  </Typography>
                  <Typography variant="caption" fontWeight={600} color="primary.main">
                    {paymentPercentage.toFixed(0)}%
                  </Typography>
                </Stack>
                
                <LinearProgress
                  variant="determinate"
                  value={paymentPercentage}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 3,
                      background: 'linear-gradient(90deg, #4CAF50 0%, #8BC34A 100%)'
                    }
                  }}
                />
                
                <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                  <Typography variant="caption" color="success.main">
                    Paid: ₹{paidAmount.toLocaleString('en-IN')}
                  </Typography>
                  <Typography variant="caption" color="warning.main">
                    Due: ₹{(purchase.remainingAmount || 0).toLocaleString('en-IN')}
                  </Typography>
                </Stack>
              </Box>
            )}
            
            {/* Description */}
            {purchase.description && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  mt: 1,
                  display: 'block',
                  fontStyle: 'italic'
                }}
              >
                {purchase.description}
              </Typography>
            )}
          </Box>
          
          {/* Arrow */}
          <IconButton
            size="small"
            sx={{
              color: 'text.secondary',
              '&:hover': { color: 'primary.main' }
            }}
          >
            <ArrowForwardIos sx={{ fontSize: 16 }} />
          </IconButton>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default PurchaseCard;