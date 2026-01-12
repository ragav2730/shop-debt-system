// src/components/Setup/SettingsPage.js
import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Tabs,
  Tab,
  Stack,
  Alert,
  CircularProgress,
  Snackbar,
  Button,
  Divider,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Switch,
  FormControlLabel,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Save,
  Settings,
  Receipt,
  Notifications,
  Palette,
  Security,
  Business,
  Person,
  Email,
  Phone,
  LocationOn,
  CloudUpload,
  Delete,
  Restore
} from '@mui/icons-material';
import { auth, db, storage } from '../../services/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import BillSettingsSection from './BillSettingsSection';

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  
  // All settings state
  const [settings, setSettings] = useState({
    // Company/Bill Settings
    company: {
      name: 'My Shop',
      address: '123 Main Street, City',
      phone: '+91 9876543210',
      email: 'shop@example.com',
      gstin: 'GSTIN: 27ABCDE1234F1Z5',
      logoUrl: '',
      showLogo: false,
      footerText: 'Thank you for your business!'
    },
    // Theme Settings
    theme: {
      mode: 'light', // light | dark
      primaryColor: '#d32f2f',
      secondaryColor: '#1976d2',
      borderRadius: 8,
      denseMode: false
    },
    // Notification Settings
    notifications: {
      emailNotifications: true,
      whatsappNotifications: false,
      lowStockAlerts: true,
      paymentReminders: true,
      dailyReports: false,
      weeklySummary: true
    },
    // System Settings
    system: {
      autoBackup: true,
      backupFrequency: 'daily', // daily, weekly, monthly
      dataRetention: 365, // days
      currency: 'INR',
      dateFormat: 'DD/MM/YYYY',
      timezone: 'Asia/Kolkata',
      language: 'en'
    }
  });

  // User profile state
  const [userProfile, setUserProfile] = useState({
    displayName: '',
    phone: '',
    email: '',
    photoURL: ''
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    loadSettings();
    loadUserProfile();
  }, []);

  const loadSettings = async () => {
    try {
      const settingsRef = doc(db, 'settings', 'shop');
      const snapshot = await getDoc(settingsRef);
      
      if (snapshot.exists()) {
        setSettings(snapshot.data());
      } else {
        // Create default settings
        await setDoc(settingsRef, settings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async () => {
    try {
      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const snapshot = await getDoc(userRef);
        
        if (snapshot.exists()) {
          const userData = snapshot.data();
          setUserProfile({
            displayName: userData.name || auth.currentUser.displayName || '',
            phone: userData.phone || '',
            email: auth.currentUser.email || '',
            photoURL: userData.photoURL || ''
          });
        }
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleSettingChange = (category, field, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
  };

  const handleUserProfileChange = (field, value) => {
    setUserProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !auth.currentUser) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      showSnackbar('Please select an image file', 'error');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      showSnackbar('Image size should be less than 5MB', 'error');
      return;
    }

    setUploadingPhoto(true);
    try {
      const user = auth.currentUser;
      const storageRef = ref(storage, `profile-photos/${user.uid}/${Date.now()}_${file.name}`);
      
      // Upload file
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      // Update user profile in Firestore
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        photoURL: downloadURL,
        updatedAt: new Date()
      });
      
      // Update local state
      setUserProfile(prev => ({ ...prev, photoURL: downloadURL }));
      showSnackbar('Profile photo updated successfully', 'success');
      
    } catch (error) {
      console.error('Error uploading photo:', error);
      showSnackbar('Failed to upload photo', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const settingsRef = doc(db, 'settings', 'shop');
      await setDoc(settingsRef, settings, { merge: true });
      showSnackbar('Settings saved successfully', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      showSnackbar('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUserProfile = async () => {
    if (!auth.currentUser) return;
    
    setSaving(true);
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        name: userProfile.displayName,
        phone: userProfile.phone,
        updatedAt: new Date()
      });
      showSnackbar('Profile updated successfully', 'success');
    } catch (error) {
      console.error('Error saving profile:', error);
      showSnackbar('Failed to save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetSettings = () => {
    if (window.confirm('Reset all settings to default?')) {
      const defaultSettings = {
        company: {
          name: 'My Shop',
          address: '123 Main Street, City',
          phone: '+91 9876543210',
          email: 'shop@example.com',
          gstin: 'GSTIN: 27ABCDE1234F1Z5',
          logoUrl: '',
          showLogo: false,
          footerText: 'Thank you for your business!'
        },
        theme: {
          mode: 'light',
          primaryColor: '#d32f2f',
          secondaryColor: '#1976d2',
          borderRadius: 8,
          denseMode: false
        },
        notifications: {
          emailNotifications: true,
          whatsappNotifications: false,
          lowStockAlerts: true,
          paymentReminders: true,
          dailyReports: false,
          weeklySummary: true
        },
        system: {
          autoBackup: true,
          backupFrequency: 'daily',
          dataRetention: 365,
          currency: 'INR',
          dateFormat: 'DD/MM/YYYY',
          timezone: 'Asia/Kolkata',
          language: 'en'
        }
      };
      setSettings(defaultSettings);
      showSnackbar('Settings reset to default', 'info');
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {/* Header */}
        <Box sx={{ 
          p: 3, 
          bgcolor: 'primary.main', 
          color: 'white',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <Typography variant="h4" fontWeight={700}>
            <Settings sx={{ verticalAlign: 'middle', mr: 2 }} />
            Settings & Configuration
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
            Configure your shop, billing, notifications, and appearance
          </Typography>
        </Box>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ px: 2 }}
          >
            <Tab icon={<Business />} label="Company" />
            <Tab icon={<Receipt />} label="Billing" />
            <Tab icon={<Palette />} label="Appearance" />
            <Tab icon={<Notifications />} label="Notifications" />
            <Tab icon={<Person />} label="Profile" />
            <Tab icon={<Security />} label="System" />
          </Tabs>
        </Box>

        {/* Content */}
        <Box sx={{ p: 3 }}>
          {activeTab === 0 && (
            <Stack spacing={3}>
              <Typography variant="h6" gutterBottom>
                Company Information
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Company Name"
                    value={settings.company.name}
                    onChange={(e) => handleSettingChange('company', 'name', e.target.value)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="GSTIN Number"
                    value={settings.company.gstin}
                    onChange={(e) => handleSettingChange('company', 'gstin', e.target.value)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Address"
                    multiline
                    rows={2}
                    value={settings.company.address}
                    onChange={(e) => handleSettingChange('company', 'address', e.target.value)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Phone Number"
                    value={settings.company.phone}
                    onChange={(e) => handleSettingChange('company', 'phone', e.target.value)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={settings.company.email}
                    onChange={(e) => handleSettingChange('company', 'email', e.target.value)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Footer Text"
                    multiline
                    rows={2}
                    value={settings.company.footerText}
                    onChange={(e) => handleSettingChange('company', 'footerText', e.target.value)}
                    size="small"
                  />
                </Grid>
              </Grid>

              <Divider />
              
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Company Logo
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.company.showLogo}
                      onChange={(e) => handleSettingChange('company', 'showLogo', e.target.checked)}
                    />
                  }
                  label="Show logo on bills"
                />
                
                {settings.company.showLogo && (
                  <Box sx={{ mt: 2 }}>
                    <TextField
                      fullWidth
                      label="Logo URL"
                      value={settings.company.logoUrl}
                      onChange={(e) => handleSettingChange('company', 'logoUrl', e.target.value)}
                      size="small"
                      placeholder="https://example.com/logo.png"
                      helperText="Enter full URL of your company logo"
                    />
                    <Alert severity="info" sx={{ mt: 2 }}>
                      Recommended size: 200x100 pixels. For best results, use PNG with transparent background.
                    </Alert>
                  </Box>
                )}
              </Box>
            </Stack>
          )}

          {activeTab === 1 && (
            <BillSettingsSection
              settings={settings.company}
              onSettingsChange={(field, value) => handleSettingChange('company', field, value)}
            />
          )}

          {activeTab === 2 && (
            <Stack spacing={3}>
              <Typography variant="h6" gutterBottom>
                Theme & Appearance
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Theme Mode</InputLabel>
                    <Select
                      value={settings.theme.mode}
                      label="Theme Mode"
                      onChange={(e) => handleSettingChange('theme', 'mode', e.target.value)}
                    >
                      <MenuItem value="light">Light</MenuItem>
                      <MenuItem value="dark">Dark</MenuItem>
                      <MenuItem value="auto">Auto (System)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Primary Color</InputLabel>
                    <Select
                      value={settings.theme.primaryColor}
                      label="Primary Color"
                      onChange={(e) => handleSettingChange('theme', 'primaryColor', e.target.value)}
                    >
                      <MenuItem value="#d32f2f">Red (Default)</MenuItem>
                      <MenuItem value="#1976d2">Blue</MenuItem>
                      <MenuItem value="#388e3c">Green</MenuItem>
                      <MenuItem value="#f57c00">Orange</MenuItem>
                      <MenuItem value="#7b1fa2">Purple</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Border Radius"
                    value={settings.theme.borderRadius}
                    onChange={(e) => handleSettingChange('theme', 'borderRadius', parseInt(e.target.value) || 8)}
                    size="small"
                    inputProps={{ min: 0, max: 24 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.theme.denseMode}
                        onChange={(e) => handleSettingChange('theme', 'denseMode', e.target.checked)}
                      />
                    }
                    label="Dense Mode (Compact UI)"
                  />
                </Grid>
              </Grid>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    Preview
                  </Typography>
                  <Box sx={{ 
                    p: 3, 
                    borderRadius: settings.theme.borderRadius,
                    bgcolor: settings.theme.mode === 'dark' ? '#333' : '#f5f5f5',
                    color: settings.theme.mode === 'dark' ? 'white' : 'inherit',
                    border: `2px solid ${settings.theme.primaryColor}20`
                  }}>
                    <Typography sx={{ color: settings.theme.primaryColor, fontWeight: 'bold' }}>
                      Primary Color Sample
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      This is how your theme will look with the selected settings.
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Stack>
          )}

          {activeTab === 3 && (
            <Stack spacing={3}>
              <Typography variant="h6" gutterBottom>
                Notification Preferences
              </Typography>
              
              <List>
                <ListItem>
                  <ListItemIcon>
                    <Email />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Email Notifications"
                    secondary="Receive notifications via email"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      edge="end"
                      checked={settings.notifications.emailNotifications}
                      onChange={(e) => handleSettingChange('notifications', 'emailNotifications', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <Phone />
                  </ListItemIcon>
                  <ListItemText 
                    primary="WhatsApp Notifications"
                    secondary="Send payment reminders via WhatsApp"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      edge="end"
                      checked={settings.notifications.whatsappNotifications}
                      onChange={(e) => handleSettingChange('notifications', 'whatsappNotifications', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <Notifications />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Low Stock Alerts"
                    secondary="Get notified when stock is low"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      edge="end"
                      checked={settings.notifications.lowStockAlerts}
                      onChange={(e) => handleSettingChange('notifications', 'lowStockAlerts', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <Receipt />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Payment Reminders"
                    secondary="Remind customers about pending payments"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      edge="end"
                      checked={settings.notifications.paymentReminders}
                      onChange={(e) => handleSettingChange('notifications', 'paymentReminders', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
              
              <Divider />
              
              <Typography variant="subtitle1" gutterBottom>
                Report Frequency
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.notifications.dailyReports}
                        onChange={(e) => handleSettingChange('notifications', 'dailyReports', e.target.checked)}
                      />
                    }
                    label="Daily Sales Report"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.notifications.weeklySummary}
                        onChange={(e) => handleSettingChange('notifications', 'weeklySummary', e.target.checked)}
                      />
                    }
                    label="Weekly Summary"
                  />
                </Grid>
              </Grid>
            </Stack>
          )}

          {activeTab === 4 && (
            <Stack spacing={3}>
              <Typography variant="h6" gutterBottom>
                Personal Profile
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 3 }}>
                <Box>
                  <Avatar
                    src={userProfile.photoURL}
                    sx={{ 
                      width: 100, 
                      height: 100,
                      border: '3px solid',
                      borderColor: 'primary.main'
                    }}
                  >
                    {userProfile.displayName?.[0]?.toUpperCase() || 'U'}
                  </Avatar>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Profile Photo
                  </Typography>
                  <input
                    accept="image/*"
                    style={{ display: 'none' }}
                    id="profile-photo-upload"
                    type="file"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                  />
                  <label htmlFor="profile-photo-upload">
                    <Button
                      component="span"
                      variant="outlined"
                      startIcon={<CloudUpload />}
                      disabled={uploadingPhoto}
                      sx={{ mr: 1 }}
                    >
                      {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                    </Button>
                  </label>
                  <Button
                    variant="text"
                    color="error"
                    startIcon={<Delete />}
                    onClick={() => handleUserProfileChange('photoURL', '')}
                    disabled={!userProfile.photoURL || uploadingPhoto}
                  >
                    Remove
                  </Button>
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Recommended: Square image, max 5MB. JPG, PNG, or WebP.
                  </Typography>
                </Box>
              </Box>
              
              <Divider />
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Display Name"
                    value={userProfile.displayName}
                    onChange={(e) => handleUserProfileChange('displayName', e.target.value)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Phone Number"
                    value={userProfile.phone}
                    onChange={(e) => handleUserProfileChange('phone', e.target.value)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={userProfile.email}
                    disabled
                    size="small"
                    helperText="Email cannot be changed. Contact support for email changes."
                  />
                </Grid>
              </Grid>
              
              <Alert severity="info">
                Profile changes are saved automatically. Email changes require verification.
              </Alert>
            </Stack>
          )}

          {activeTab === 5 && (
            <Stack spacing={3}>
              <Typography variant="h6" gutterBottom>
                System Settings
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Currency</InputLabel>
                    <Select
                      value={settings.system.currency}
                      label="Currency"
                      onChange={(e) => handleSettingChange('system', 'currency', e.target.value)}
                    >
                      <MenuItem value="INR">Indian Rupee (₹)</MenuItem>
                      <MenuItem value="USD">US Dollar ($)</MenuItem>
                      <MenuItem value="EUR">Euro (€)</MenuItem>
                      <MenuItem value="GBP">British Pound (£)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Date Format</InputLabel>
                    <Select
                      value={settings.system.dateFormat}
                      label="Date Format"
                      onChange={(e) => handleSettingChange('system', 'dateFormat', e.target.value)}
                    >
                      <MenuItem value="DD/MM/YYYY">DD/MM/YYYY (Indian)</MenuItem>
                      <MenuItem value="MM/DD/YYYY">MM/DD/YYYY (US)</MenuItem>
                      <MenuItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Timezone</InputLabel>
                    <Select
                      value={settings.system.timezone}
                      label="Timezone"
                      onChange={(e) => handleSettingChange('system', 'timezone', e.target.value)}
                    >
                      <MenuItem value="Asia/Kolkata">India (IST)</MenuItem>
                      <MenuItem value="America/New_York">New York (EST)</MenuItem>
                      <MenuItem value="Europe/London">London (GMT)</MenuItem>
                      <MenuItem value="Asia/Tokyo">Tokyo (JST)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Language</InputLabel>
                    <Select
                      value={settings.system.language}
                      label="Language"
                      onChange={(e) => handleSettingChange('system', 'language', e.target.value)}
                    >
                      <MenuItem value="en">English</MenuItem>
                      <MenuItem value="ta">Tamil (தமிழ்)</MenuItem>
                      <MenuItem value="hi">Hindi (हिन्दी)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <Divider />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.system.autoBackup}
                        onChange={(e) => handleSettingChange('system', 'autoBackup', e.target.checked)}
                      />
                    }
                    label="Auto Backup"
                  />
                  {settings.system.autoBackup && (
                    <FormControl fullWidth size="small" sx={{ mt: 2 }}>
                      <InputLabel>Backup Frequency</InputLabel>
                      <Select
                        value={settings.system.backupFrequency}
                        label="Backup Frequency"
                        onChange={(e) => handleSettingChange('system', 'backupFrequency', e.target.value)}
                      >
                        <MenuItem value="daily">Daily</MenuItem>
                        <MenuItem value="weekly">Weekly</MenuItem>
                        <MenuItem value="monthly">Monthly</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Data Retention (Days)"
                    value={settings.system.dataRetention}
                    onChange={(e) => handleSettingChange('system', 'dataRetention', parseInt(e.target.value) || 365)}
                    size="small"
                    helperText="How long to keep old records"
                  />
                </Grid>
              </Grid>
              
              <Alert severity="warning">
                <Typography variant="subtitle2" gutterBottom>
                  ⚠️ Important System Settings
                </Typography>
                <Typography variant="body2">
                  Changes to system settings affect all users and data. Make sure you understand the implications before saving.
                </Typography>
              </Alert>
            </Stack>
          )}
        </Box>

        {/* Footer Actions */}
        <Box sx={{ 
          p: 2, 
          bgcolor: 'grey.50',
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Button
            startIcon={<Restore />}
            onClick={handleResetSettings}
            color="warning"
            disabled={saving}
          >
            Reset to Default
          </Button>
          
          <Stack direction="row" spacing={2}>
            {activeTab === 4 ? (
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={20} /> : <Save />}
                onClick={handleSaveUserProfile}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={20} /> : <Save />}
                onClick={handleSaveSettings}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            )}
          </Stack>
        </Box>
      </Paper>
    </Container>
  );
};

export default SettingsPage;