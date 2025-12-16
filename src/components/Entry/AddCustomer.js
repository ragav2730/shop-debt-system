import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Grid,
  Box,
  MenuItem,
  IconButton,
  Alert,
  Chip,
  Card,
  CardContent,
  Stack,
  Autocomplete,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Divider,
  InputAdornment,
  useTheme,
  useMediaQuery,
  Slide,
  Fade
} from '@mui/material';
import {
  Add,
  Delete,
  PhotoCamera,
  Person,
  Phone,
  Store,
  AttachMoney,
  Description,
  Category,
  Receipt,
  Search,
  ArrowForward,
  CheckCircle,
  Image,
  Upload,
  PersonAdd
} from '@mui/icons-material';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  getDocs, 
  query, 
  where,
  increment 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../services/firebase';

const categories = ['Cement', 'Bricks', 'Steel', 'Sheat', 'Pipes', 'Other'];

const AddCustomer = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    productName: '',
    category: '',
    amount: '',
    billNumber: '',
    description: '',
  });
  const [billPhotos, setBillPhotos] = useState([]);
  const [success, setSuccess] = useState(false);
  const [existingCustomers, setExistingCustomers] = useState([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [transactionAdded, setTransactionAdded] = useState(false);

  // Fetch existing customers
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const customersQuery = query(collection(db, 'customers'));
        const querySnapshot = await getDocs(customersQuery);
        const customersData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setExistingCustomers(customersData);
      } catch (error) {
        console.error('Error fetching customers:', error);
      }
    };

    fetchCustomers();
  }, [transactionAdded]); // Re-fetch when transaction is added

  // Filter suggestions based on input
  useEffect(() => {
    if (formData.phone.length >= 3 || formData.customerName.length >= 2) {
      const filtered = existingCustomers.filter(customer => {
        const phoneMatch = customer.phone.includes(formData.phone);
        const nameMatch = customer.customerName.toLowerCase().includes(formData.customerName.toLowerCase());
        return phoneMatch || nameMatch;
      });
      setFilteredSuggestions(filtered.slice(0, 5)); // Show top 5 suggestions
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [formData.phone, formData.customerName, existingCustomers]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleCustomerSelect = (customer) => {
    setFormData({
      ...formData,
      customerName: customer.customerName,
      phone: customer.phone,
      productName: customer.productName || '',
      category: customer.category || '',
      amount: '',
      billNumber: '',
      description: customer.description || '',
    });
    setSelectedCustomer(customer);
    setShowSuggestions(false);
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const newPhotos = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name
    }));
    setBillPhotos([...billPhotos, ...newPhotos]);
  };

  const removeFile = (index) => {
    setBillPhotos(billPhotos.filter((_, i) => i !== index));
  };

  const uploadPhotos = async (customerId) => {
    const urls = [];
    for (const photo of billPhotos) {
      const storageRef = ref(storage, `bills/${customerId}/${Date.now()}_${photo.file.name}`);
      await uploadBytes(storageRef, photo.file);
      const url = await getDownloadURL(storageRef);
      urls.push(url);
    }
    return urls;
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    const amount = parseFloat(formData.amount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    let customerRef;
    let previousBalance = 0;
    let newBalance = 0;
    let totalAmount = 0;

    if (selectedCustomer) {
      // FOR EXISTING CUSTOMER: Add to existing balance and total amount
      customerRef = doc(db, 'customers', selectedCustomer.id);
      previousBalance = selectedCustomer.balance || 0;
      totalAmount = (selectedCustomer.totalAmount || 0) + amount;  // Update total amount
      newBalance = previousBalance + amount;
      
      // Update customer's balance AND totalAmount
      await updateDoc(customerRef, {
        balance: newBalance,
        totalAmount: totalAmount,  // ADD THIS LINE
        updatedAt: serverTimestamp(),
        status: newBalance > 0 ? 'pending' : 'paid'
      });

      console.log(`Updated customer ${selectedCustomer.id}: 
        Previous Balance: ₹${previousBalance}, 
        Total Amount: ₹${totalAmount},
        New Purchase: ₹${amount}, 
        New Balance: ₹${newBalance}`);
    } else {
      // FOR NEW CUSTOMER: Create new with initial balance and total amount
      totalAmount = amount;  // For new customer, total amount = first purchase
      customerRef = await addDoc(collection(db, 'customers'), {
        ...formData,
        amount: amount,
        totalAmount: amount,  // ADD THIS FIELD
        balance: amount,
        createdAt: serverTimestamp(),
        status: 'pending',
      });
      previousBalance = 0;
      newBalance = amount;
    }

    // Upload photos
    const photoUrls = await uploadPhotos(customerRef.id);

    // Add transaction record
    await addDoc(collection(db, 'transactions'), {
      customerId: selectedCustomer ? selectedCustomer.id : customerRef.id,
      customerName: formData.customerName,
      phone: formData.phone,
      productName: formData.productName,
      category: formData.category,
      amount: amount,
      billNumber: formData.billNumber,
      description: formData.description,
      photoUrls,
      date: serverTimestamp(),
      type: 'purchase',
      previousBalance: previousBalance,
      newBalance: newBalance,
      totalAmount: totalAmount,  // Add to transaction too
      isExistingCustomer: !!selectedCustomer
    });

    setSuccess(true);
    setTransactionAdded(!transactionAdded);
    
    // Reset form but keep selected customer if they want to add another transaction
    setFormData({
      ...formData,
      productName: '',
      category: '',
      amount: '',
      billNumber: '',
      description: '',
    });
    setBillPhotos([]);
    
    // Keep selected customer for adding another transaction
    if (selectedCustomer) {
      // Update the selected customer's balance AND totalAmount in state
      setSelectedCustomer({
        ...selectedCustomer,
        balance: newBalance,
        totalAmount: totalAmount  // Update this too
      });
    }

    setTimeout(() => setSuccess(false), 3000);
  } catch (error) {
    console.error('Error adding customer/transaction:', error);
    alert('Error: ' + error.message);
  }
};

  // Calculate new balance for preview
  const calculateNewBalance = () => {
    if (!formData.amount || parseFloat(formData.amount) <= 0) return null;
    
    const newAmount = parseFloat(formData.amount);
    if (selectedCustomer) {
      const currentBalance = selectedCustomer.balance || 0;
      return currentBalance + newAmount;
    }
    return newAmount;
  };

  const newBalance = calculateNewBalance();

  // Customer Suggestion Card
  const CustomerSuggestionCard = ({ customer }) => (
    <Card 
      elevation={0}
      sx={{ 
        mb: 1,
        border: '1px solid',
        borderColor: 'grey.200',
        borderRadius: 2,
        cursor: 'pointer',
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: 'rgba(211, 47, 47, 0.04)'
        },
        transition: 'all 0.2s ease'
      }}
      onClick={() => handleCustomerSelect(customer)}
    >
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar sx={{ 
              width: 40, 
              height: 40, 
              bgcolor: customer.balance > 0 ? '#ffebee' : '#e8f5e9',
              color: customer.balance > 0 ? '#d32f2f' : '#2e7d32'
            }}>
              <Person />
            </Avatar>
            <Box>
              <Typography variant="subtitle2" fontWeight="bold">
                {customer.customerName}
              </Typography>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Phone fontSize="small" sx={{ fontSize: 14 }} />
                <Typography variant="caption" color="text.secondary">
                  {customer.phone}
                </Typography>
              </Stack>
            </Box>
          </Stack>
          <Stack alignItems="flex-end">
            <Chip
              label={`₹${customer.balance?.toFixed(2) || '0.00'}`}
              size="small"
              color={customer.balance > 0 ? 'error' : 'success'}
              sx={{ height: 22, fontSize: '0.7rem' }}
            />
            <Typography variant="caption" color="text.secondary">
              {customer.category || 'No category'}
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Container maxWidth="lg" sx={{ px: isMobile ? 1 : 3, py: isMobile ? 1 : 3 }}>
      {/* Success Animation */}
      <Fade in={success}>
        <Box sx={{ position: 'fixed', top: 20, right: 20, zIndex: 9999 }}>
          <Alert 
            severity="success" 
            icon={<CheckCircle fontSize="large" />}
            sx={{ 
              boxShadow: 6,
              borderRadius: 2,
              animation: 'slideIn 0.3s ease'
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography fontWeight="bold">
                {selectedCustomer ? 'Transaction Added!' : 'Customer Created!'}
              </Typography>
              <Typography variant="caption">
                {selectedCustomer 
                  ? `₹${formData.amount} added to ${selectedCustomer.customerName}'s account` 
                  : 'New customer created successfully'}
              </Typography>
            </Stack>
          </Alert>
        </Box>
      </Fade>

      <Paper 
        elevation={3} 
        sx={{ 
          p: isMobile ? 2 : 4, 
          mt: isMobile ? 1 : 4,
          borderRadius: 3,
          background: 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)',
          border: '1px solid rgba(211, 47, 47, 0.1)'
        }}
      >
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
            <Avatar sx={{ bgcolor: '#d32f2f', width: 48, height: 48 }}>
              <PersonAdd />
            </Avatar>
            <Box>
              <Typography variant={isMobile ? "h5" : "h4"} color="primary" fontWeight="bold">
                {selectedCustomer ? 'Add Transaction' : 'Add Customer Entry'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedCustomer 
                  ? `Adding purchase to ${selectedCustomer.customerName}'s account`
                  : 'Create new customer or select existing customer'}
              </Typography>
            </Box>
          </Stack>
          <Divider sx={{ mt: 2 }} />
        </Box>

        {/* Balance Preview Card (if customer selected) */}
        {selectedCustomer && formData.amount && (
          <Fade in timeout={300}>
            <Card 
              elevation={1} 
              sx={{ 
                mb: 3, 
                p: 2, 
                borderRadius: 2,
                bgcolor: 'rgba(33, 150, 243, 0.08)',
                border: '1px solid rgba(33, 150, 243, 0.2)'
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Balance Update Preview
                  </Typography>
                  <Stack direction="row" spacing={3} alignItems="center">
                    <Box>
                      <Typography variant="caption" color="text.secondary">Current</Typography>
                      <Typography variant="h6" color="error.main">
                        ₹{selectedCustomer.balance?.toFixed(2)}
                      </Typography>
                    </Box>
                    <Add sx={{ color: 'primary.main' }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary">New Purchase</Typography>
                      <Typography variant="h6" color="primary.main">
                        ₹{parseFloat(formData.amount).toFixed(2)}
                      </Typography>
                    </Box>
                    <ArrowForward sx={{ color: 'primary.main' }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary">New Balance</Typography>
                      <Typography variant="h5" fontWeight="bold" color={newBalance > 0 ? 'error' : 'success.main'}>
                        ₹{newBalance.toFixed(2)}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
                <Chip 
                  label="Balance will be updated"
                  color="info"
                  size="small"
                  icon={<CheckCircle />}
                />
              </Stack>
            </Card>
          </Fade>
        )}

        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Customer Details Section */}
            <Grid item xs={12} lg={6}>
              <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
                    <Person color="primary" />
                    <Typography variant="h6" fontWeight="bold" color="primary">
                      Customer Details
                    </Typography>
                  </Stack>

                  {/* Customer Search/Add Section */}
                  {selectedCustomer ? (
                    // Show selected customer info
                    <Box sx={{ mb: 3, p: 2, borderRadius: 2, bgcolor: 'rgba(211, 47, 47, 0.04)', border: '1px solid rgba(211, 47, 47, 0.1)' }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <Avatar sx={{ bgcolor: '#d32f2f' }}>
                            <Person />
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle1" fontWeight="bold">
                              {selectedCustomer.customerName}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {selectedCustomer.phone} • Current Balance: ₹{selectedCustomer.balance?.toFixed(2)}
                            </Typography>
                          </Box>
                        </Stack>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setSelectedCustomer(null);
                            setFormData({
                              customerName: '',
                              phone: '',
                              productName: '',
                              category: '',
                              amount: '',
                              billNumber: '',
                              description: '',
                            });
                          }}
                        >
                          Change Customer
                        </Button>
                      </Stack>
                    </Box>
                  ) : (
                    // Show customer search/input
                    <>
                      <Box sx={{ position: 'relative', mb: 3 }}>
                        <TextField
                          fullWidth
                          label="Customer Name *"
                          name="customerName"
                          value={formData.customerName}
                          onChange={handleChange}
                          required
                          size={isMobile ? "small" : "medium"}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Person color="action" />
                              </InputAdornment>
                            ),
                            sx: { borderRadius: 2 }
                          }}
                        />
                        
                        {/* Customer Suggestions */}
                        {showSuggestions && (
                          <Slide in direction="down" timeout={300}>
                            <Paper 
                              elevation={3}
                              sx={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                zIndex: 1000,
                                mt: 1,
                                p: 2,
                                borderRadius: 2,
                                maxHeight: 200,
                                overflow: 'auto',
                                border: '1px solid',
                                borderColor: 'primary.light'
                              }}
                            >
                              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                                Select existing customer or continue typing for new customer:
                              </Typography>
                              {filteredSuggestions.map((customer) => (
                                <CustomerSuggestionCard key={customer.id} customer={customer} />
                              ))}
                            </Paper>
                          </Slide>
                        )}
                      </Box>

                      {/* Phone Number */}
                      <TextField
                        fullWidth
                        label="Phone Number *"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                        size={isMobile ? "small" : "medium"}
                        sx={{ mb: 3 }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Phone color="action" />
                            </InputAdornment>
                          ),
                          sx: { borderRadius: 2 }
                        }}
                      />
                    </>
                  )}

                  {/* Product Details */}
                  <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                    <TextField
                      fullWidth
                      label="Product Name *"
                      name="productName"
                      value={formData.productName}
                      onChange={handleChange}
                      required
                      size={isMobile ? "small" : "medium"}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Store color="action" />
                          </InputAdornment>
                        ),
                        sx: { borderRadius: 2 }
                      }}
                    />
                  </Stack>

                  {/* Category Selection */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, ml: 1 }}>
                      Category (வகை) *
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {categories.map((cat) => (
                        <Chip
                          key={cat}
                          label={cat}
                          onClick={() => setFormData({...formData, category: cat})}
                          color={formData.category === cat ? 'primary' : 'default'}
                          variant={formData.category === cat ? 'filled' : 'outlined'}
                          icon={<Category fontSize="small" />}
                          sx={{ 
                            mb: 1,
                            '& .MuiChip-label': { fontSize: isMobile ? '0.8rem' : '0.9rem' }
                          }}
                        />
                      ))}
                    </Stack>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Transaction Details Section */}
            <Grid item xs={12} lg={6}>
              <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
                    <Receipt color="primary" />
                    <Typography variant="h6" fontWeight="bold" color="primary">
                      Transaction Details
                    </Typography>
                  </Stack>

                  {/* Amount - Most Important Field */}
                  <TextField
                    fullWidth
                    label="Amount (₹) *"
                    name="amount"
                    type="number"
                    value={formData.amount}
                    onChange={handleChange}
                    required
                    size={isMobile ? "small" : "medium"}
                    sx={{ mb: 3 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <AttachMoney color="action" />
                        </InputAdornment>
                      ),
                      sx: { 
                        borderRadius: 2,
                        '& input': { fontSize: isMobile ? '1.1rem' : '1.2rem', fontWeight: 'bold' }
                      }
                    }}
                    helperText={selectedCustomer ? `Will be added to existing balance of ₹${selectedCustomer.balance?.toFixed(2)}` : 'Initial purchase amount'}
                  />

                  {/* Bill Number */}
                  <TextField
                    fullWidth
                    label="Bill Number (Optional)"
                    name="billNumber"
                    value={formData.billNumber}
                    onChange={handleChange}
                    size={isMobile ? "small" : "medium"}
                    sx={{ mb: 3 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Receipt color="action" />
                        </InputAdornment>
                      ),
                      sx: { borderRadius: 2 }
                    }}
                  />

                  {/* Description */}
                  <TextField
                    fullWidth
                    label="Description (Notes)"
                    name="description"
                    multiline
                    rows={3}
                    value={formData.description}
                    onChange={handleChange}
                    size={isMobile ? "small" : "medium"}
                    sx={{ mb: 3 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Description color="action" />
                        </InputAdornment>
                      ),
                      sx: { borderRadius: 2 }
                    }}
                  />

                  {/* Bill Photos */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, ml: 1 }}>
                      Bill Photos (Optional)
                    </Typography>
                    
                    <input
                      accept="image/*"
                      style={{ display: 'none' }}
                      id="bill-photos"
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                    />
                    <label htmlFor="bill-photos">
                      <Button
                        variant="outlined"
                        component="span"
                        fullWidth
                        startIcon={<Upload />}
                        sx={{ 
                          borderRadius: 2,
                          py: 1.5,
                          borderStyle: 'dashed',
                          borderWidth: 2
                        }}
                      >
                        Upload Bill Photos
                      </Button>
                    </label>

                    {billPhotos.length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {billPhotos.length} photo(s) selected
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {billPhotos.map((photo, index) => (
                            <Box
                              key={index}
                              sx={{
                                position: 'relative',
                                width: 80,
                                height: 80,
                                borderRadius: 2,
                                overflow: 'hidden',
                                border: '1px solid',
                                borderColor: 'grey.300'
                              }}
                            >
                              <img
                                src={photo.preview}
                                alt={photo.name}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover'
                                }}
                              />
                              <IconButton
                                size="small"
                                onClick={() => removeFile(index)}
                                sx={{
                                  position: 'absolute',
                                  top: 2,
                                  right: 2,
                                  bgcolor: 'rgba(0,0,0,0.5)',
                                  color: 'white',
                                  '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
                                }}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Submit Button */}
            <Grid item xs={12}>
              <Box sx={{ 
                p: 3, 
                borderRadius: 2,
                bgcolor: 'rgba(211, 47, 47, 0.05)',
                border: '1px solid rgba(211, 47, 47, 0.1)'
              }}>
                <Stack 
                  direction={isMobile ? "column" : "row"} 
                  spacing={2} 
                  justifyContent="space-between" 
                  alignItems={isMobile ? "stretch" : "center"}
                >
                  <Box>
                    <Typography variant="h6" fontWeight="bold">
                      {selectedCustomer ? 'Add Transaction to Existing Customer' : 'Create New Customer'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedCustomer 
                        ? `New amount will be added to existing balance`
                        : 'Customer will be created with initial purchase'}
                    </Typography>
                  </Box>
                  
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={!formData.amount || parseFloat(formData.amount) <= 0}
                    startIcon={selectedCustomer ? <Add /> : <PersonAdd />}
                    sx={{
                      px: 4,
                      py: 1.5,
                      borderRadius: 2,
                      background: 'linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)',
                      fontSize: '1rem',
                      fontWeight: 'bold',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #b71c1c 0%, #8b0000 100%)',
                        transform: 'translateY(-2px)',
                        boxShadow: 6
                      },
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {selectedCustomer 
                      ? `Add ₹${parseFloat(formData.amount || 0).toFixed(2)} Transaction` 
                      : 'Create Customer'}
                  </Button>
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>

      <style jsx="true">{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </Container>
  );
};

export default AddCustomer;