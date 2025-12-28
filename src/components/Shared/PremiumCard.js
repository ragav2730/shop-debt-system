import React from 'react';
import { Card, alpha } from '@mui/material';

const PremiumCard = ({ children, sx, ...props }) => {
  return (
    <Card
      sx={{
        borderRadius: 3,
        bgcolor: alpha('#fff', 0.05),
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)',
        overflow: 'hidden',
        position: 'relative',
        ...sx
      }}
      {...props}
    >
      {children}
    </Card>
  );
};

export default PremiumCard;