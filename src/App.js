import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Box, CircularProgress } from '@mui/material';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import { redTheme } from './styles/theme';

// Components
import Login from './components/Auth/Login';
import Layout from './components/Layout/Layout';
import PrivateRoute from './components/Auth/PrivateRoute';
import OneTimeSetup from './components/Setup/OneTimeSetup';

// Main Components
import Dashboard from './components/Dashboard/Dashboard';
import AddCustomer from './components/Entry/AddCustomer';
import CustomerList from './components/List/CustomerList';
import CustomerDetail from './components/List/CustomerDetail';
import Payment from './components/Paid/Payment';
import ProductPrice from './components/Price/ProductPrice';
import AddUser from './components/Users/AddUser';

// Customer Management Components
import CustomerDetailsPage from './components/Customers/CustomerDetailsPage';
import PDFGenerator from './components/Customers/PDFGenerator';
import BillCustomizer from './components/Customers/BillCustomizer';

// Purchase Management (Keep this if you want it)
import PurchasesPage from './components/Purchases/PurchasesPage';
import PurchaseDetails from './components/Purchases/PurchaseDetails';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      
      // Check setup completion
      const isSetupComplete = localStorage.getItem('setupComplete');
      
      if (user || isSetupComplete === 'true') {
        setSetupComplete(true);
      } else {
        setSetupComplete(false);
      }
    });

    return unsubscribe;
  }, []);

  if (loading || setupComplete === null) {
    return (
      <ThemeProvider theme={redTheme}>
        <CssBaseline />
        <Box 
          display="flex" 
          justifyContent="center" 
          alignItems="center" 
          minHeight="100vh"
          sx={{ bgcolor: '#fafafa' }}
        >
          <CircularProgress color="primary" />
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={redTheme}>
      <CssBaseline />
      <Router>
        <Routes>
          {/* Setup route - only accessible when setup is not complete and no user */}
          {!setupComplete && !user && (
            <Route path="/setup" element={<OneTimeSetup />} />
          )}

          {/* Login route */}
          <Route path="/login" element={
            user ? <Navigate to="/" /> : <Login />
          } />

          {/* Protected routes */}
          <Route path="/" element={
            <PrivateRoute user={user}>
              <Layout />
            </PrivateRoute>
          }>
            {/* Dashboard as default route */}
            <Route index element={<Dashboard />} />
            
            {/* Customer Management Routes */}
            <Route path="customers" element={<CustomerList />} />
            <Route path="customers/:id" element={<CustomerDetailsPage />} />
            
            {/* Purchase Management Routes (Optional - keep if you want) */}
            <Route path="purchases" element={<PurchasesPage />} />
            <Route path="purchases/:id" element={<PurchaseDetails />} />
            
            {/* Legacy routes for backward compatibility */}
            <Route path="entry" element={<AddCustomer />} />
            <Route path="list" element={<CustomerList />} />
            <Route path="list/:id" element={<CustomerDetail />} />
            
            {/* Payment & Transactions */}
            <Route path="paid" element={<Payment />} />
            
            {/* Product Management */}
            <Route path="price" element={<ProductPrice />} />
            
            {/* User Management */}
            <Route path="users" element={<AddUser />} />
            
            {/* PDF Generation & Customization */}
            <Route path="generate-pdf" element={<PDFGenerator />} />
            <Route path="customize-bill" element={<BillCustomizer />} />
            
            {/* Settings */}
            <Route path="settings" element={
              <Box sx={{ p: 3 }}>
                <h2>Settings</h2>
                <p>Settings page coming soon...</p>
              </Box>
            } />
            
            {/* About */}
            <Route path="about" element={
              <Box sx={{ p: 3 }}>
                <h2>About Shop Debt System</h2>
                <p>Version 2.0.0</p>
                <p>Professional debt management system for small businesses.</p>
              </Box>
            } />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={
            !setupComplete && !user ? 
              <Navigate to="/setup" /> : 
              user ? <Navigate to="/" /> : <Navigate to="/login" />
          } />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;