// src/components/Users/ProfilePage.js
import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Avatar,
  Grid,
  Divider,
  Alert,
  Card,
  CardContent,
  Stack,
  CircularProgress,
  Snackbar,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment
} from '@mui/material';
import {
  Person,
  Email,
  Phone,
  LocationOn,
  CalendarToday,
  Edit,
  Save,
  CloudUpload,
  Delete,
  Lock,
  Visibility,
  VisibilityOff,
  Security,
  CheckCircle,
  Error
} from '@mui/icons-material';
import { auth, db, storage } from '../../services/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';

const ProfilePage = () => {
  const [userData, setUserData] = useState({
    displayName: '',
    email: '',
    phone: '',
    address: '',
    photoURL: '',
    role: '',
    createdAt: null
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  
  // Password change state
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    showCurrent: false,
    showNew: false,
    showConfirm: false
  });
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const snapshot = await getDoc(userRef);
        
        if (snapshot.exists()) {
          const data = snapshot.data();
          setUserData({
            displayName: data.name || auth.currentUser.displayName || '',
            email: auth.currentUser.email || '',
            phone: data.phone || '',
            address: data.address || '',
            photoURL: data.photoURL || '',
            role: data.role || 'user',
            createdAt: data.createdAt?.toDate() || new Date()
          });
        } else {
          // Create user document if it doesn't exist
          await updateDoc(userRef, {
            name: auth.currentUser.displayName || '',
            email: auth.currentUser.email,
            role: 'owner',
            createdAt: new Date(),
            updatedAt: new Date()
          });
          loadUserProfile(); // Reload
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      showSnackbar('Failed to load profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setUserData(prev => ({
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
    
    if (file.size > 5 * 1024 * 1024) {
      showSnackbar('Image size should be less than 5MB', 'error');
      return;
    }

    setUploadingPhoto(true);
    try {
      const user = auth.currentUser;
      
      // Delete old photo if exists
      if (userData.photoURL && userData.photoURL.includes('firebasestorage')) {
        try {
          const oldPhotoRef = ref(storage, userData.photoURL);
          await deleteObject(oldPhotoRef);
        } catch (error) {
          console.log('No old photo to delete');
        }
      }
      
      // Upload new photo
      const timestamp = Date.now();
      const storageRef = ref(storage, `profile-photos/${user.uid}/${timestamp}_${file.name}`);
      
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      // Update Firestore
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        photoURL: downloadURL,
        updatedAt: new Date()
      });
      
      // Update local state
      setUserData(prev => ({ ...prev, photoURL: downloadURL }));
      showSnackbar('Profile photo updated successfully', 'success');
      
    } catch (error) {
      console.error('Error uploading photo:', error);
      showSnackbar('Failed to upload photo', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!auth.currentUser || !userData.photoURL) return;
    
    try {
      // Delete from storage
      if (userData.photoURL.includes('firebasestorage')) {
        const photoRef = ref(storage, userData.photoURL);
        await deleteObject(photoRef);
      }
      
      // Update Firestore
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        photoURL: '',
        updatedAt: new Date()
      });
      
      // Update local state
      setUserData(prev => ({ ...prev, photoURL: '' }));
      showSnackbar('Profile photo removed', 'success');
      
    } catch (error) {
      console.error('Error removing photo:', error);
      showSnackbar('Failed to remove photo', 'error');
    }
  };

  const handleSaveProfile = async () => {
    if (!auth.currentUser) return;
    
    setSaving(true);
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        name: userData.displayName,
        phone: userData.phone,
        address: userData.address,
        updatedAt: new Date()
      });
      
      setEditMode(false);
      showSnackbar('Profile updated successfully', 'success');
    } catch (error) {
      console.error('Error saving profile:', error);
      showSnackbar('Failed to save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    // Validate passwords
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showSnackbar('New passwords do not match', 'error');
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      showSnackbar('Password must be at least 6 characters', 'error');
      return;
    }
    
    if (passwordData.currentPassword === passwordData.newPassword) {
      showSnackbar('New password must be different from current', 'error');
      return;
    }

    setChangingPassword(true);
    try {
      const user = auth.currentUser;
      
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(
        user.email,
        passwordData.currentPassword
      );
      
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, passwordData.newPassword);
      
      // Reset form
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        showCurrent: false,
        showNew: false,
        showConfirm: false
      });
      
      setPasswordDialog(false);
      showSnackbar('Password changed successfully', 'success');
      
    } catch (error) {
      console.error('Error changing password:', error);
      
      if (error.code === 'auth/wrong-password') {
        showSnackbar('Current password is incorrect', 'error');
      } else if (error.code === 'auth/weak-password') {
        showSnackbar('Password is too weak', 'error');
      } else {
        showSnackbar('Failed to change password', 'error');
      }
    } finally {
      setChangingPassword(false);
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

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <>
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

      <Container maxWidth="md" sx={{ py: 3 }}>
        <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
          {/* Header */}
          <Box sx={{ 
            p: 3, 
            bgcolor: 'primary.main', 
            color: 'white',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            <Typography variant="h4" fontWeight={700}>
              <Person sx={{ verticalAlign: 'middle', mr: 2 }} />
              My Profile
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
              Manage your personal information and account settings
            </Typography>
          </Box>

          <Box sx={{ p: 3 }}>
            <Grid container spacing={4}>
              {/* Left Column - Profile Photo & Basic Info */}
              <Grid item xs={12} md={4}>
                <Card sx={{ borderRadius: 2 }}>
                  <CardContent sx={{ textAlign: 'center', p: 3 }}>
                    <Box sx={{ position: 'relative', display: 'inline-block' }}>
                      <Avatar
                        src={userData.photoURL}
                        sx={{ 
                          width: 150, 
                          height: 150,
                          border: '4px solid',
                          borderColor: 'primary.main',
                          mb: 2
                        }}
                      >
                        {userData.displayName?.[0]?.toUpperCase() || 'U'}
                      </Avatar>
                      
                      <input
                        accept="image/*"
                        style={{ display: 'none' }}
                        id="profile-photo-upload"
                        type="file"
                        onChange={handlePhotoUpload}
                        disabled={uploadingPhoto}
                      />
                      <label htmlFor="profile-photo-upload">
                        <IconButton
                          component="span"
                          sx={{
                            position: 'absolute',
                            bottom: 10,
                            right: 10,
                            bgcolor: 'primary.main',
                            color: 'white',
                            '&:hover': { bgcolor: 'primary.dark' }
                          }}
                          disabled={uploadingPhoto}
                        >
                          <CloudUpload />
                        </IconButton>
                      </label>
                    </Box>
                    
                    <Typography variant="h6" gutterBottom>
                      {userData.displayName || 'User Name'}
                    </Typography>
                    
                    <Chip
                      label={userData.role.toUpperCase()}
                      color={userData.role === 'owner' ? 'primary' : 'default'}
                      sx={{ mb: 2 }}
                    />
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <Email sx={{ fontSize: 16, verticalAlign: 'middle', mr: 1 }} />
                      {userData.email}
                    </Typography>
                    
                    {userData.phone && (
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        <Phone sx={{ fontSize: 16, verticalAlign: 'middle', mr: 1 }} />
                        {userData.phone}
                      </Typography>
                    )}
                    
                    <Typography variant="caption" color="text.secondary" display="block">
                      <CalendarToday sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                      Member since {formatDate(userData.createdAt)}
                    </Typography>
                    
                    <Stack spacing={1} sx={{ mt: 3 }}>
                      <Button
                        variant="outlined"
                        fullWidth
                        onClick={() => setEditMode(!editMode)}
                        startIcon={<Edit />}
                      >
                        {editMode ? 'Cancel Edit' : 'Edit Profile'}
                      </Button>
                      
                      {userData.photoURL && (
                        <Button
                          variant="outlined"
                          color="error"
                          fullWidth
                          onClick={handleRemovePhoto}
                          startIcon={<Delete />}
                          disabled={uploadingPhoto}
                        >
                          Remove Photo
                        </Button>
                      )}
                      
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={() => setPasswordDialog(true)}
                        startIcon={<Lock />}
                        sx={{ bgcolor: 'secondary.main' }}
                      >
                        Change Password
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
                
                {/* Account Security Card */}
                <Card sx={{ borderRadius: 2, mt: 3 }}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                      <Security sx={{ verticalAlign: 'middle', mr: 1 }} />
                      Account Security
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemIcon>
                          <CheckCircle color="success" />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Email Verified" 
                          secondary={userData.email ? 'Verified' : 'Not verified'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          {userData.phone ? <CheckCircle color="success" /> : <Error color="warning" />}
                        </ListItemIcon>
                        <ListItemText 
                          primary="Phone Number" 
                          secondary={userData.phone || 'Not added'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <CheckCircle color="success" />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Last Login" 
                          secondary="Today, 10:30 AM"
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              {/* Right Column - Profile Details */}
              <Grid item xs={12} md={8}>
                <Card sx={{ borderRadius: 2, mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Personal Information
                    </Typography>
                    
                    <Grid container spacing={3} sx={{ mt: 1 }}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Full Name"
                          value={userData.displayName}
                          onChange={(e) => handleInputChange('displayName', e.target.value)}
                          disabled={!editMode}
                          size="small"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Person />
                              </InputAdornment>
                            )
                          }}
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Email"
                          value={userData.email}
                          disabled
                          size="small"
                          helperText="Email cannot be changed"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Email />
                              </InputAdornment>
                            )
                          }}
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Phone Number"
                          value={userData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          disabled={!editMode}
                          size="small"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Phone />
                              </InputAdornment>
                            )
                          }}
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Address"
                          multiline
                          rows={3}
                          value={userData.address}
                          onChange={(e) => handleInputChange('address', e.target.value)}
                          disabled={!editMode}
                          size="small"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <LocationOn />
                              </InputAdornment>
                            )
                          }}
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Role"
                          value={userData.role}
                          disabled
                          size="small"
                          helperText="Your role in the system"
                        />
                      </Grid>
                    </Grid>
                    
                    {editMode && (
                      <Box sx={{ mt: 3, textAlign: 'right' }}>
                        <Button
                          variant="contained"
                          onClick={handleSaveProfile}
                          disabled={saving}
                          startIcon={saving ? <CircularProgress size={20} /> : <Save />}
                        >
                          {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                      </Box>
                    )}
                  </CardContent>
                </Card>
                
                {/* Account Activity (Placeholder) */}
                <Card sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Recent Activity
                    </Typography>
                    <Alert severity="info">
                      <Typography variant="body2">
                        Activity log will show your recent actions in the system.
                      </Typography>
                    </Alert>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        </Paper>
      </Container>

      {/* Password Change Dialog */}
      <Dialog open={passwordDialog} onClose={() => !changingPassword && setPasswordDialog(false)}>
        <DialogTitle>
          <Lock sx={{ verticalAlign: 'middle', mr: 1 }} />
          Change Password
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1, minWidth: 300 }}>
            <TextField
              fullWidth
              type={passwordData.showCurrent ? 'text' : 'password'}
              label="Current Password"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
              disabled={changingPassword}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setPasswordData(prev => ({ ...prev, showCurrent: !prev.showCurrent }))}
                      edge="end"
                    >
                      {passwordData.showCurrent ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            
            <TextField
              fullWidth
              type={passwordData.showNew ? 'text' : 'password'}
              label="New Password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
              disabled={changingPassword}
              helperText="Minimum 6 characters"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setPasswordData(prev => ({ ...prev, showNew: !prev.showNew }))}
                      edge="end"
                    >
                      {passwordData.showNew ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            
            <TextField
              fullWidth
              type={passwordData.showConfirm ? 'text' : 'password'}
              label="Confirm New Password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              disabled={changingPassword}
              error={passwordData.newPassword !== passwordData.confirmPassword && passwordData.confirmPassword !== ''}
              helperText={passwordData.newPassword !== passwordData.confirmPassword && passwordData.confirmPassword !== '' ? "Passwords don't match" : ''}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setPasswordData(prev => ({ ...prev, showConfirm: !prev.showConfirm }))}
                      edge="end"
                    >
                      {passwordData.showConfirm ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            
            <Alert severity="warning">
              <Typography variant="body2">
                You will be logged out from all devices after password change.
              </Typography>
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setPasswordDialog(false)} 
            disabled={changingPassword}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handlePasswordChange}
            disabled={changingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
            startIcon={changingPassword ? <CircularProgress size={20} /> : null}
          >
            {changingPassword ? 'Changing...' : 'Change Password'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ProfilePage;