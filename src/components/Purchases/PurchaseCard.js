import React, { memo } from 'react';
import {
  Card,
  CardContent,
  Stack,
  Typography,
  Avatar,
  Box,
  Chip,
  IconButton,
  LinearProgress,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  ArrowForwardIos,
  ShoppingBag,
  Person,
  CalendarToday,
  CheckCircle,
  PendingActions,
  TrendingUp
} from '@mui/icons-material';

const PurchaseCard = memo(({ purchase, onClick, isMobile = false }) => {
  const theme = useTheme();
  const isSmallMobile = useMediaQuery(theme.breakpoints.down('sm'));

  /* -------------------- PROPER PAYMENT CALCULATIONS WITH REAL-TIME UPDATES -------------------- */
  // IMPORTANT: This should receive updated purchase data from parent component
  // The parent (PurchasesPage) should update purchase data when payments change
  
  // Calculate remaining amount - prioritize real-time calculated values
  const remaining = purchase.calculatedRemaining !== undefined 
    ? purchase.calculatedRemaining 
    : typeof purchase.remainingAmount === 'number'
      ? purchase.remainingAmount
      : purchase.amount || 0;

  // Calculate total paid - use updated value from parent
  const totalPaid = purchase.totalPaid !== undefined 
    ? purchase.totalPaid 
    : (purchase.amount || 0) - remaining;

  const isPaid = remaining === 0 && (purchase.amount || 0) > 0;
  const isPartial = totalPaid > 0 && remaining > 0;
  const isUnpaid = totalPaid === 0 && (purchase.amount || 0) > 0;
  
  const paymentPercentage = (purchase.amount || 0) > 0 
    ? Math.min(100, (totalPaid / (purchase.amount || 1)) * 100)
    : 100;

  /* -------------------- FORMATTERS -------------------- */
  const formatDate = (dateInput) => {
    if (!dateInput) return 'N/A';
    try {
      if (dateInput.toDate && typeof dateInput.toDate === 'function') {
        return dateInput.toDate().toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short'
        });
      }
      const date = new Date(dateInput);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short'
      });
    } catch {
      return 'N/A';
    }
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₹0';
    return `₹${Math.round(amount).toLocaleString('en-IN')}`;
  };

  const getStatusColor = () => {
    if (isPaid) return '#34C759'; // iOS Green
    if (isPartial) return '#FF9500'; // iOS Orange
    return '#FF3B30'; // iOS Red
  };

  const getStatusText = () => {
    if (isPaid) return 'PAID';
    if (isPartial) return 'PARTIAL';
    return 'PENDING';
  };

  const getStatusIcon = () => {
    if (isPaid) return <CheckCircle sx={{ fontSize: 14 }} />;
    if (isPartial) return <TrendingUp sx={{ fontSize: 14 }} />;
    return <PendingActions sx={{ fontSize: 14 }} />;
  };

  /* -------------------- CARD STYLE -------------------- */
  const getCardStyle = () => {
    const baseStyle = {
      borderRadius: 12,
      border: '1px solid rgba(0,0,0,0.08)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      backgroundColor: '#FFFFFF',
      overflow: 'hidden',
      marginBottom: 8,
      transition: 'all 0.2s ease',
      cursor: 'pointer',
      '&:hover': {
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        borderColor: 'rgba(0,0,0,0.12)',
        transform: 'translateY(-1px)'
      }
    };

    if (isMobile) {
      return {
        ...baseStyle,
        '&:active': {
          transform: 'scale(0.995)',
          backgroundColor: 'rgba(0,0,0,0.01)'
        }
      };
    }
    
    return baseStyle;
  };

  /* -------------------- REGULAR CARD SIZE (DEFAULT) -------------------- */
  return (
    <Card 
      onClick={onClick}
      sx={getCardStyle()}
      elevation={0}
    >
      <CardContent sx={{ p: 2.5, pb: '20px !important' }}>
        <Stack spacing={1.5}>
          {/* Header Row - Product & Amount */}
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
              <Avatar
                sx={{
                  width: 44,
                  height: 44,
                  backgroundColor: isPaid ? '#34C759' : isPartial ? '#FF9500' : '#FF3B30',
                  color: 'white',
                  fontSize: 18,
                  fontWeight: 600
                }}
              >
                <ShoppingBag />
              </Avatar>
              
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: '#1D1D1F',
                    mb: 0.5,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {purchase.productName || 'Unnamed Product'}
                </Typography>
                
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography
                    sx={{
                      fontSize: 12,
                      color: '#8E8E93',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5
                    }}
                  >
                    <CalendarToday sx={{ fontSize: 11 }} />
                    {formatDate(purchase.date)}
                  </Typography>
                  
                  {purchase.customerName && (
                    <Typography
                      sx={{
                        fontSize: 12,
                        color: '#8E8E93',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '120px'
                      }}
                    >
                      <Person sx={{ fontSize: 11 }} />
                      {purchase.customerName}
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Stack>

            {/* Status & Amount */}
            <Stack alignItems="flex-end" spacing={0.5} sx={{ ml: 1 }}>
              <Typography
                sx={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#1D1D1F'
                }}
              >
                {formatCurrency(purchase.amount || 0)}
              </Typography>
              
              <Chip
                icon={getStatusIcon()}
                label={getStatusText()}
                size="small"
                sx={{
                  height: 22,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  backgroundColor: `${getStatusColor()}15`,
                  color: getStatusColor(),
                  border: `1px solid ${getStatusColor()}30`,
                  '& .MuiChip-icon': {
                    marginLeft: 0.5,
                    color: getStatusColor()
                  }
                }}
              />
            </Stack>
          </Stack>

          {/* Payment Progress Bar */}
          <Box sx={{ mt: 0.5 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography sx={{ fontSize: 11, color: '#8E8E93', fontWeight: 500 }}>
                Payment Progress
              </Typography>
              <Typography sx={{ fontSize: 11, color: '#007AFF', fontWeight: 600 }}>
                {paymentPercentage.toFixed(0)}%
              </Typography>
            </Stack>
            
            <LinearProgress
              variant="determinate"
              value={paymentPercentage}
              sx={{
                height: 4,
                borderRadius: 2,
                backgroundColor: 'rgba(0,0,0,0.08)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 2,
                  backgroundColor: isPaid ? '#34C759' : '#007AFF',
                  transition: 'width 0.3s ease'
                }
              }}
            />
          </Box>

          {/* Amount Details */}
          <Stack direction="row" spacing={1.5}>
            <Box sx={{ 
              flex: 1, 
              p: 1.5, 
              backgroundColor: '#F8F8FA',
              borderRadius: 8,
              textAlign: 'center'
            }}>
              <Typography sx={{ fontSize: 10, color: '#8E8E93', mb: 0.5, fontWeight: 500 }}>
                Paid
              </Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#34C759' }}>
                {formatCurrency(totalPaid)}
              </Typography>
            </Box>
            
            <Box sx={{ 
              flex: 1, 
              p: 1.5, 
              backgroundColor: '#F8F8FA',
              borderRadius: 8,
              textAlign: 'center'
            }}>
              <Typography sx={{ fontSize: 10, color: '#8E8E93', mb: 0.5, fontWeight: 500 }}>
                Balance
              </Typography>
              <Typography sx={{ 
                fontSize: 14, 
                fontWeight: 700, 
                color: remaining > 0 ? '#FF3B30' : '#34C759'
              }}>
                {formatCurrency(remaining)}
              </Typography>
            </Box>
            
            <Box sx={{ 
              flex: 1, 
              p: 1.5, 
              backgroundColor: '#F8F8FA',
              borderRadius: 8,
              textAlign: 'center'
            }}>
              <Typography sx={{ fontSize: 10, color: '#8E8E93', mb: 0.5, fontWeight: 500 }}>
                Status
              </Typography>
              <Typography sx={{ 
                fontSize: 11, 
                fontWeight: 700, 
                color: getStatusColor(),
                textTransform: 'uppercase'
              }}>
                {getStatusText()}
              </Typography>
            </Box>
          </Stack>

          {/* Description */}
          {purchase.description && (
            <Typography
              sx={{
                fontSize: 12,
                color: '#8E8E93',
                lineHeight: 1.4,
                mt: 0.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}
            >
              {purchase.description}
            </Typography>
          )}

          {/* Footer with Payment Count */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
            <Typography sx={{ fontSize: 11, color: '#8E8E93' }}>
              {purchase.paymentCount || 0} payment{purchase.paymentCount !== 1 ? 's' : ''}
            </Typography>
            
            <IconButton
              size="small"
              sx={{
                color: '#C7C7CC',
                p: 0.5,
                '&:hover': { 
                  color: '#007AFF',
                  backgroundColor: 'rgba(0,122,255,0.1)'
                }
              }}
            >
              <ArrowForwardIos sx={{ fontSize: 14 }} />
            </IconButton>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
});

// Add display name for debugging
PurchaseCard.displayName = 'PurchaseCard';

export default PurchaseCard;