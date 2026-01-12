import React, { useEffect, useState } from 'react';
import { deleteAllCustomersData } from './utils/deleteAllCustomers';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Box, CircularProgress } from '@mui/material';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import { redTheme } from './styles/theme';

/* ---------------- AUTH & LAYOUT ---------------- */
import Login from './components/Auth/Login';
import PrivateRoute from './components/Auth/PrivateRoute';
import Layout from './components/Layout/Layout';
import OneTimeSetup from './components/Setup/OneTimeSetup';

/* ---------------- DASHBOARD ---------------- */
import Dashboard from './components/Dashboard/Dashboard';

/* ---------------- CUSTOMER ---------------- */
import AddCustomer from './components/Entry/AddCustomer';
import CustomerList from './components/List/CustomerList';
import CustomerDetail from './components/List/CustomerDetail';
import CustomerDetailsPage from './components/Customers/CustomerDetailsPage';

/* ---------------- VENDORS ---------------- */
import VendorList from './components/Vendors/VendorList';  // NEW
import VendorDetail from './components/Vendors/VendorDetail';  // NEW

/* ---------------- PAYMENTS ---------------- */
import Payment from './components/Paid/Payment';

/* ---------------- PRODUCTS ---------------- */
import ProductPrice from './components/Price/ProductPrice';
import ProductManager from './components/Products/ProductManager';

/* ---------------- PURCHASES ---------------- */
import PurchasesPage from './components/Purchases/PurchasesPage';
import PurchaseDetails from './components/Purchases/PurchaseDetails';

/* ---------------- USERS ---------------- */
import AddUser from './components/Users/AddUser';
import ProfilePage from './components/Users/ProfilePage';

/* ---------------- SETTINGS & PDF ---------------- */
import SettingsPage from './components/Setup/SettingsPage';
import PDFGenerator from './components/Customers/PDFGenerator';
import BillCustomizer from './components/Customers/BillCustomizer';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(null);

  /* ---------------- AUTH STATE ---------------- */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      const isSetupDone = localStorage.getItem('setupComplete') === 'true';
      setSetupComplete(isSetupDone || !!currentUser);
    });

    return unsubscribe;
  }, []);

  /* ---------------- LOADING SCREEN ---------------- */
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
          <CircularProgress />
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={redTheme}>
      <CssBaseline />
      <Router>
        <Routes>

          {/* ---------------- SETUP ---------------- */}
          {!setupComplete && !user && (
            <Route path="/setup" element={<OneTimeSetup />} />
          )}

          {/* ---------------- LOGIN ---------------- */}
          <Route
            path="/login"
            element={user ? <Navigate to="/" /> : <Login />}
          />

          {/* ---------------- PROTECTED APP ---------------- */}
          <Route
            path="/"
            element={
              <PrivateRoute user={user}>
                <Layout />
              </PrivateRoute>
            }
          >
            {/* Dashboard */}
            <Route index element={<Dashboard />} />

            {/* Customers */}
            <Route path="customers" element={<CustomerList />} />
            <Route path="customers/:id" element={<CustomerDetailsPage />} />

            {/* VENDORS - NEW */}
            <Route path="vendors" element={<VendorList />} />
            <Route path="vendors/:id" element={<VendorDetail />} />

            {/* Legacy customer routes (kept for safety) */}
            <Route path="entry" element={<AddCustomer />} />
            <Route path="list" element={<CustomerList />} />
            <Route path="list/:id" element={<CustomerDetail />} />

            {/* Payments */}
            <Route path="paid" element={<Payment />} />

            {/* Purchases */}
            <Route path="purchases" element={<PurchasesPage />} />
            <Route path="purchases/:id" element={<PurchaseDetails />} />

            {/* 🔥 PRODUCT MANAGEMENT (IMPORTANT) */}
            <Route path="products" element={<ProductManager />} />
            <Route path="price" element={<ProductPrice />} />

            {/* Users */}
            <Route path="users" element={<AddUser />} />
            <Route path="profile" element={<ProfilePage />} />

            {/* PDF */}
            <Route path="generate-pdf" element={<PDFGenerator />} />
            <Route path="customize-bill" element={<BillCustomizer />} />

            {/* Settings */}
            <Route path="settings" element={<SettingsPage />} />

            {/* About */}
            <Route
              path="about"
              element={
                <Box sx={{ p: 3 }}>
                  <h2>Shop Debt System</h2>
                  <p>Version 2.0.0</p>
                  <p>Professional debt management platform.</p>
                </Box>
              }
            />
          </Route>

          {/* ---------------- FALLBACK ---------------- */}
          <Route
            path="*"
            element={
              !setupComplete && !user
                ? <Navigate to="/setup" />
                : user
                ? <Navigate to="/" />
                : <Navigate to="/login" />
            }
          />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;