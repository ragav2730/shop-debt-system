import React from 'react';
import { TextField, InputAdornment, alpha } from '@mui/material';
import { Search } from '@mui/icons-material';

const SearchBar = ({ value, onChange, placeholder = "Search...", ...props }) => {
  return (
    <TextField
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      variant="outlined"
      size="small"
      fullWidth
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Search sx={{ color: 'text.secondary' }} />
          </InputAdornment>
        ),
        sx: {
          borderRadius: 3,
          bgcolor: alpha('#fff', 0.05),
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'text.primary',
          '&:hover': {
            borderColor: 'rgba(255,255,255,0.2)'
          },
          '&.Mui-focused': {
            borderColor: 'primary.main',
            boxShadow: '0 0 0 2px rgba(100, 100, 255, 0.25)'
          }
        }
      }}
      {...props}
    />
  );
};

export default SearchBar;