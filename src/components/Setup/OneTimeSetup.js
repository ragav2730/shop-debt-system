import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  DataArray,
  People,
  ShoppingCart,
  Payment,
  Store
} from '@mui/icons-material';
// Remove CheckCircle and Error if not used
import { initializeCompleteDatabase, checkDatabaseStatus } from '../../services/setupDatabase';

const OneTimeSetup = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    'Check Database Status',
    'Initialize Collections',
    'Create Owner Account',
    'Add Sample Data',
    'Complete Setup'
  ];

  useEffect(() => {
    checkCurrentStatus();
  }, []);

  const checkCurrentStatus = async () => {
    const status = await checkDatabaseStatus();
    setDbStatus(status);
    
    if (status.usersExist && status.productsExist) {
      setActiveStep(4); // Already initialized
    }
  };

  const handleInitialize = async () => {
    setLoading(true);
    setError(null);
    setActiveStep(1);

    try {
      const result = await initializeCompleteDatabase();
      
      if (result.success) {
        setResult(result);
        setActiveStep(4);
        
        // Store credentials in localStorage (for demo only)
        localStorage.setItem('setupComplete', 'true');
        localStorage.setItem('ownerEmail', result.ownerEmail);
        
        // Refresh status
        setTimeout(() => checkCurrentStatus(), 2000);
      } else {
        setError(result.error);
        setActiveStep(0);
      }
    } catch (err) {
      setError(err.message);
      setActiveStep(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
        <Typography variant="h4" align="center" gutterBottom color="primary">
          🚀 One-Time Database Setup
        </Typography>
        
        <Typography variant="body1" align="center" paragraph color="text.secondary">
          Run this once to set up your complete Firestore database with sample data
        </Typography>

        <Stepper activeStep={activeStep} sx={{ my: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {dbStatus && (
          <Card sx={{ mb: 3, bgcolor: 'grey.50' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Current Database Status
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <People color={dbStatus.usersExist ? "success" : "disabled"} />
                    <Typography>
                      Users: {dbStatus.usersExist ? `${dbStatus.totalUsers} found` : 'Not found'}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Store color={dbStatus.productsExist ? "success" : "disabled"} />
                    <Typography>
                      Products: {dbStatus.productsExist ? `${dbStatus.totalProducts} found` : 'Not found'}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography variant="subtitle2">Error: {error}</Typography>
          </Alert>
        )}

        {result?.success ? (
          <Alert severity="success" sx={{ mb: 3 }}>
            <Typography variant="subtitle2">✅ Setup Completed Successfully!</Typography>
            <Typography variant="body2">
              Database is ready with all collections and sample data.
            </Typography>
          </Alert>
        ) : null}

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            What will be created:
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <People color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Users Collection" 
                secondary="Owner account with full permissions"
              />
            </ListItem>
            <Divider />
            <ListItem>
              <ListItemIcon>
                <Store color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Products Collection" 
                secondary="8 sample products with prices and categories"
              />
            </ListItem>
            <Divider />
            <ListItem>
              <ListItemIcon>
                <ShoppingCart color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Customers & Transactions" 
                secondary="3 sample customers with their purchase history"
              />
            </ListItem>
            <Divider />
            <ListItem>
              <ListItemIcon>
                <Payment color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Payments Collection" 
                secondary="Sample payment records"
              />
            </ListItem>
          </List>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
          {!dbStatus?.usersExist ? (
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={handleInitialize}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <DataArray />}
            >
              {loading ? 'Setting up Database...' : 'Initialize Complete Database'}
            </Button>
          ) : (
            <Alert severity="success" sx={{ width: '100%' }}>
              <Typography variant="subtitle1">
                ✅ Database is already initialized!
              </Typography>
              <Typography variant="body2">
                You can start using the application.
              </Typography>
            </Alert>
          )}
        </Box>

        {result?.success && (
          <Card sx={{ mt: 4, bgcolor: 'primary.light', color: 'white' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🔐 Login Credentials (Save these!)
              </Typography>
              <Typography variant="body2">
                <strong>Email:</strong> {result.ownerEmail}
              </Typography>
              <Typography variant="body2">
                <strong>Password:</strong> Owner@123
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.9 }}>
                Change the password immediately after first login!
              </Typography>
            </CardContent>
          </Card>
        )}

        <Alert severity="info" sx={{ mt: 4 }}>
          <Typography variant="caption">
            <strong>Note:</strong> This is a one-time setup. After running this, your database will be ready with all collections. 
            You can add/remove sample data later through the application.
          </Typography>
        </Alert>
      </Paper>
    </Container>
  );
};

export default OneTimeSetup;