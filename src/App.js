import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Box, CircularProgress } from '@mui/material';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import { redTheme } from './styles/theme';

// Components - Make sure each file exists and exports default
import Login from './components/Auth/Login';
import Layout from './components/Layout/Layout';
import PrivateRoute from './components/Auth/PrivateRoute';
import OneTimeSetup from './components/Setup/OneTimeSetup';
import AddCustomer from './components/Entry/AddCustomer';
import CustomerList from './components/List/CustomerList';
import Payment from './components/Paid/Payment';
import ProductPrice from './components/Price/ProductPrice';
import AddUser from './components/Users/AddUser';
import CustomerDetail from './components/List/CustomerDetail';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(null); // Start as null

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      
      // Check setup completion AFTER auth state is known
      const isSetupComplete = localStorage.getItem('setupComplete');
      
      // If user exists OR setup was previously marked complete
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
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ThemeProvider theme={redTheme}>
      <CssBaseline />
      <Router>
        <Routes>
          {/* Only show setup if NOT complete AND no user */}
          {!setupComplete && !user ? (
            <Route path="/setup" element={<OneTimeSetup />} />
          ) : null}

          <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
          
          {/* Main app routes - accessible if user exists OR setup is complete */}
          <Route path="/" element={
            <PrivateRoute user={user}>
              <Layout />
            </PrivateRoute>
          }>
            <Route index element={<CustomerList />} />
            <Route path="entry" element={<AddCustomer />} />
            <Route path="list/:id" element={<CustomerDetail />} />
            <Route path="paid" element={<Payment />} />
            <Route path="price" element={<ProductPrice />} />
            <Route path="users" element={<AddUser />} />
          </Route>
          
          {/* Redirect logic */}
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