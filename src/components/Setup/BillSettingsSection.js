// src/components/Setup/BillSettingsSection.js
import React, { useState } from 'react';

import {
  Box,
  Typography,
  TextField,
  Grid,
  Switch,
  FormControlLabel,
  Alert,
  Card,
  CardContent,
  Divider,
  Stack,
  Button
} from '@mui/material';
import {
  PictureAsPdf,
  Receipt,
  Image
} from '@mui/icons-material';

const BillSettingsSection = ({ settings, onSettingsChange }) => {
  const [logoPreview, setLogoPreview] = useState(settings.logoUrl || '');

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    onSettingsChange(field, value);
    
    // Update preview for logo URL
    if (field === 'logoUrl') {
      setLogoPreview(value);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // For demo: Create object URL for preview
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
    
    // In real app, you would upload to Firebase Storage here
    // and then update the logoUrl with the download URL
    Alert.info('Logo upload would save to Firebase Storage in production');
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h6" gutterBottom>
        <Receipt sx={{ verticalAlign: 'middle', mr: 1 }} />
        Bill & Invoice Settings
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Company Name (on Bill)"
            value={settings.name}
            onChange={handleChange('name')}
            size="small"
            helperText="Will appear as header on all bills"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="GSTIN/Tax Number"
            value={settings.gstin}
            onChange={handleChange('gstin')}
            size="small"
            helperText="Required for tax invoices"
          />
        </Grid>
      </Grid>

      <TextField
        fullWidth
        label="Company Address"
        multiline
        rows={2}
        value={settings.address}
        onChange={handleChange('address')}
        size="small"
        helperText="Full address for billing purposes"
      />

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Phone Number"
            value={settings.phone}
            onChange={handleChange('phone')}
            size="small"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={settings.email}
            onChange={handleChange('email')}
            size="small"
          />
        </Grid>
      </Grid>

      <Divider />

      <Box>
        <Typography variant="subtitle1" gutterBottom>
          Bill Logo & Appearance
        </Typography>
        
        <FormControlLabel
          control={
            <Switch
              checked={settings.showLogo}
              onChange={handleChange('showLogo')}
            />
          }
          label="Show company logo on bills"
        />
        
        {settings.showLogo && (
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={6}>
                <input
                  accept="image/*"
                  style={{ display: 'none' }}
                  id="bill-logo-upload"
                  type="file"
                  onChange={handleLogoUpload}
                />
                <label htmlFor="bill-logo-upload">
                  <Button
                    component="span"
                    variant="outlined"
                    startIcon={<Image />}
                    fullWidth
                  >
                    Upload Logo Image
                  </Button>
                </label>
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  Or enter URL below
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={6}>
                {logoPreview && (
                  <Card variant="outlined" sx={{ p: 1 }}>
                    <CardContent sx={{ p: 1, textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary" gutterBottom>
                        Logo Preview
                      </Typography>
                      <Box
                        component="img"
                        src={logoPreview}
                        alt="Logo preview"
                        sx={{
                          maxWidth: '100%',
                          maxHeight: 80,
                          objectFit: 'contain'
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </CardContent>
                  </Card>
                )}
              </Grid>
            </Grid>
            
            <TextField
              fullWidth
              label="Logo URL"
              value={settings.logoUrl}
              onChange={handleChange('logoUrl')}
              size="small"
              sx={{ mt: 2 }}
              placeholder="https://example.com/logo.png"
              helperText="Enter URL of your company logo or upload image"
            />
          </Box>
        )}
      </Box>

      <Divider />

      <TextField
        fullWidth
        label="Bill Footer Text"
        multiline
        rows={2}
        value={settings.footerText}
        onChange={handleChange('footerText')}
        size="small"
        helperText="Appears at the bottom of every bill"
      />

      <Alert severity="info">
        <Typography variant="subtitle2" gutterBottom>
          💡 Bill Formatting Tips
        </Typography>
        <Typography variant="body2">
          • Use PNG logo with transparent background for best results<br />
          • Keep address concise but complete<br />
          • Include GSTIN for tax compliance<br />
          • Footer text should include thank you note and terms
        </Typography>
      </Alert>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" gutterBottom color="primary">
            <PictureAsPdf sx={{ verticalAlign: 'middle', mr: 1 }} />
            Bill Preview
          </Typography>
          <Box sx={{ 
            p: 3, 
            bgcolor: 'grey.50',
            borderRadius: 1,
            border: '1px dashed',
            borderColor: 'divider'
          }}>
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              {settings.showLogo && logoPreview ? (
                <Box
                  component="img"
                  src={logoPreview}
                  alt="Logo"
                  sx={{ height: 40, mb: 1 }}
                />
              ) : (
                <Typography variant="h6" fontWeight="bold">
                  {settings.name || 'COMPANY NAME'}
                </Typography>
              )}
              <Typography variant="caption" display="block">
                {settings.address || 'Company Address'}
              </Typography>
              <Typography variant="caption" display="block">
                {settings.phone ? `Phone: ${settings.phone}` : ''}
                {settings.email ? ` | Email: ${settings.email}` : ''}
              </Typography>
              <Typography variant="caption" display="block">
                {settings.gstin || 'GSTIN: XXXXXX'}
              </Typography>
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="body2" align="center">
              Sample Bill Content Here...
            </Typography>
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="caption" align="center" display="block">
              {settings.footerText || 'Thank you for your business!'}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
};

export default BillSettingsSection;