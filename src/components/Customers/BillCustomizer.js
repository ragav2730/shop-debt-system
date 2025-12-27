import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Stack,
  Switch,
  FormControlLabel,
  Divider,
  IconButton,
  Alert,
  Grid,
  Card,
  CardContent,
  InputAdornment,
  Tabs,
  Tab
} from '@mui/material';
import { Close, Save, Restore, Preview, ColorLens, TextFields, Image } from '@mui/icons-material';

const BillCustomizer = ({ open, onClose, onSave, currentSettings }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [settings, setSettings] = useState({
    companyName: 'My Shop',
    companyAddress: '123 Main Street, City, State',
    companyPhone: '+91 9876543210',
    companyEmail: 'shop@example.com',
    gstNumber: 'GSTIN: 27XXXXX1234X1Z5',
    footerText: 'Thank you for your business!',
    showLogo: false,
    logoUrl: '',
    showTerms: true,
    termsText: '• Goods once sold will not be taken back\n• Payment within 15 days\n• Subject to jurisdiction',
    headerColor: '#d32f2f',
    textColor: '#000000',
    primaryColor: '#d32f2f',
    secondaryColor: '#ff9800',
    fontFamily: 'Arial',
    fontSize: '12'
  });

  useEffect(() => {
    if (currentSettings) {
      setSettings(currentSettings);
    } else {
      // Load from localStorage
      const saved = localStorage.getItem('billSettings');
      if (saved) {
        setSettings(JSON.parse(saved));
      }
    }
  }, [currentSettings]);

  const handleChange = (field) => (e) => {
    setSettings(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };

  const handleSwitchChange = (field) => (e) => {
    setSettings(prev => ({
      ...prev,
      [field]: e.target.checked
    }));
  };

  const handleSave = () => {
    localStorage.setItem('billSettings', JSON.stringify(settings));
    if (onSave) onSave(settings);
    onClose();
  };

  const handleReset = () => {
    const defaultSettings = {
      companyName: 'My Shop',
      companyAddress: '123 Main Street, City, State',
      companyPhone: '+91 9876543210',
      companyEmail: 'shop@example.com',
      gstNumber: 'GSTIN: 27XXXXX1234X1Z5',
      footerText: 'Thank you for your business!',
      showLogo: false,
      logoUrl: '',
      showTerms: true,
      termsText: '• Goods once sold will not be taken back\n• Payment within 15 days\n• Subject to jurisdiction',
      headerColor: '#d32f2f',
      textColor: '#000000',
      primaryColor: '#d32f2f',
      secondaryColor: '#ff9800',
      fontFamily: 'Arial',
      fontSize: '12'
    };
    setSettings(defaultSettings);
  };

  const handlePreview = () => {
    alert('Preview feature coming soon!');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Customize Bill Template</Typography>
          <Stack direction="row" spacing={1}>
            <IconButton size="small" onClick={handlePreview}>
              <Preview />
            </IconButton>
            <IconButton size="small" onClick={onClose}>
              <Close />
            </IconButton>
          </Stack>
        </Stack>
      </DialogTitle>
      
      <DialogContent dividers>
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{ mb: 3 }}
        >
          <Tab label="Company Details" />
          <Tab label="Design" />
          <Tab label="Content" />
        </Tabs>

        {activeTab === 0 && (
          <Stack spacing={3}>
            <Alert severity="info">
              Customize your company details for the bill header
            </Alert>

            <TextField
              fullWidth
              label="Company Name"
              value={settings.companyName}
              onChange={handleChange('companyName')}
              size="small"
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth
              label="Company Address"
              value={settings.companyAddress}
              onChange={handleChange('companyAddress')}
              size="small"
              multiline
              rows={2}
              sx={{ mb: 2 }}
            />
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  value={settings.companyPhone}
                  onChange={handleChange('companyPhone')}
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Email"
                  value={settings.companyEmail}
                  onChange={handleChange('companyEmail')}
                  size="small"
                />
              </Grid>
            </Grid>
            
            <TextField
              fullWidth
              label="GST Number"
              value={settings.gstNumber}
              onChange={handleChange('gstNumber')}
              size="small"
              sx={{ mt: 2 }}
            />
          </Stack>
        )}

        {activeTab === 1 && (
          <Stack spacing={3}>
            <Alert severity="info">
              Customize the visual appearance of your bills
            </Alert>

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Header Color"
                  type="color"
                  value={settings.headerColor}
                  onChange={handleChange('headerColor')}
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <ColorLens />
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Text Color"
                  type="color"
                  value={settings.textColor}
                  onChange={handleChange('textColor')}
                  size="small"
                />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Primary Color"
                  type="color"
                  value={settings.primaryColor}
                  onChange={handleChange('primaryColor')}
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Secondary Color"
                  type="color"
                  value={settings.secondaryColor}
                  onChange={handleChange('secondaryColor')}
                  size="small"
                />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  select
                  fullWidth
                  label="Font Family"
                  value={settings.fontFamily}
                  onChange={handleChange('fontFamily')}
                  size="small"
                  SelectProps={{
                    native: true
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <TextFields />
                      </InputAdornment>
                    )
                  }}
                >
                  <option value="Arial">Arial</option>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Verdana">Verdana</option>
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  select
                  fullWidth
                  label="Font Size"
                  value={settings.fontSize}
                  onChange={handleChange('fontSize')}
                  size="small"
                  SelectProps={{
                    native: true
                  }}
                >
                  <option value="10">Small (10)</option>
                  <option value="12">Medium (12)</option>
                  <option value="14">Large (14)</option>
                  <option value="16">Extra Large (16)</option>
                </TextField>
              </Grid>
            </Grid>

            <FormControlLabel
              control={
                <Switch
                  checked={settings.showLogo}
                  onChange={handleSwitchChange('showLogo')}
                  size="small"
                />
              }
              label="Show Company Logo"
            />
            
            {settings.showLogo && (
              <TextField
                fullWidth
                label="Logo URL"
                value={settings.logoUrl}
                onChange={handleChange('logoUrl')}
                size="small"
                placeholder="https://example.com/logo.png"
                helperText="Enter URL of your company logo"
                sx={{ mt: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Image />
                    </InputAdornment>
                  )
                }}
              />
            )}
          </Stack>
        )}

        {activeTab === 2 && (
          <Stack spacing={3}>
            <Alert severity="info">
              Customize the content and terms of your bills
            </Alert>

            <TextField
              fullWidth
              label="Footer Text"
              value={settings.footerText}
              onChange={handleChange('footerText')}
              size="small"
              multiline
              rows={2}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={settings.showTerms}
                  onChange={handleSwitchChange('showTerms')}
                  size="small"
                />
              }
              label="Show Terms & Conditions"
            />
            
            {settings.showTerms && (
              <TextField
                fullWidth
                label="Terms & Conditions"
                value={settings.termsText}
                onChange={handleChange('termsText')}
                size="small"
                multiline
                rows={4}
                sx={{ mt: 2 }}
                helperText="Enter each term on a new line starting with •"
              />
            )}

            {/* Preview Card */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  Preview
                </Typography>
                <Box sx={{ 
                  p: 2, 
                  bgcolor: settings.headerColor + '10',
                  borderLeft: `4px solid ${settings.headerColor}`,
                  borderRadius: 1
                }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: settings.textColor,
                      fontFamily: settings.fontFamily,
                      fontSize: `${settings.fontSize}px`
                    }}
                  >
                    This is how your bill text will appear
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Stack>
        )}
      </DialogContent>
      
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button
          startIcon={<Restore />}
          onClick={handleReset}
          color="warning"
          variant="outlined"
        >
          Reset to Default
        </Button>
        <Button
          startIcon={<Save />}
          onClick={handleSave}
          variant="contained"
          color="primary"
        >
          Save Settings
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BillCustomizer;