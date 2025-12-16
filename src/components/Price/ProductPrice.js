import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Box,
  Chip,
  Alert,
  MenuItem,
  Grid,
  useTheme,
  useMediaQuery,
  Card,
  CardContent,
  Stack,
  Avatar
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Search,
  FilterList,
  Inventory,
  Store,
  AttachMoney
} from '@mui/icons-material';
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '../../services/firebase';

const categories = ['Cement', 'Bricks', 'Steel', 'Sheat', 'Pipes', 'Other'];

const ProductPrice = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [successMessage, setSuccessMessage] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    productName: '',
    category: '',
    unit: '',
    price: '',
    hsnCode: '',
    gstRate: '',
    stock: '',
    supplier: '',
    description: ''
  });

  // Fetch products from Firestore
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('productName'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProducts(productsData);
      setFilteredProducts(productsData);
    });

    return unsubscribe;
  }, []);

  // Filter products based on search and category
  useEffect(() => {
    let filtered = products;

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.supplier?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredProducts(filtered);
  }, [searchTerm, selectedCategory, products]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleOpenDialog = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        productName: product.productName || '',
        category: product.category || '',
        unit: product.unit || '',
        price: product.price || '',
        hsnCode: product.hsnCode || '',
        gstRate: product.gstRate || '',
        stock: product.stock || '',
        supplier: product.supplier || '',
        description: product.description || ''
      });
    } else {
      setEditingProduct(null);
      setFormData({
        productName: '',
        category: '',
        unit: '',
        price: '',
        hsnCode: '',
        gstRate: '',
        stock: '',
        supplier: '',
        description: ''
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingProduct(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        gstRate: formData.gstRate ? parseFloat(formData.gstRate) : 0,
        stock: formData.stock ? parseInt(formData.stock) : 0,
        lastUpdated: serverTimestamp()
      };

      if (editingProduct) {
        // Update existing product
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
        setSuccessMessage('Product updated successfully!');
      } else {
        // Add new product
        productData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'products'), productData);
        setSuccessMessage('Product added successfully!');
      }

      handleCloseDialog();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error saving product. Please check console for details.');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteDoc(doc(db, 'products', productId));
        setSuccessMessage('Product deleted successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('Error deleting product.');
      }
    }
  };

  const calculateWithGST = (price, gstRate) => {
    if (!gstRate) return price;
    return price + (price * gstRate / 100);
  };

  // Mobile card view for products
  const ProductCard = ({ product }) => (
    <Card sx={{ mb: 2, boxShadow: 2 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              {product.productName}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Chip 
                label={product.category} 
                size="small" 
                color="primary" 
                variant="outlined"
              />
              <Typography variant="body2" color="text.secondary">
                {product.unit}
              </Typography>
            </Stack>
            {product.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {product.description.length > 60 ? product.description.substring(0, 60) + '...' : product.description}
              </Typography>
            )}
          </Box>
          <Stack direction="column" alignItems="flex-end">
            <IconButton
              size="small"
              color="primary"
              onClick={() => handleOpenDialog(product)}
              sx={{ mb: 1 }}
            >
              <Edit fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDeleteProduct(product.id)}
            >
              <Delete fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
        
        <Grid container spacing={1} sx={{ mt: 1 }}>
          <Grid item xs={6}>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <AttachMoney fontSize="small" color="primary" />
              <Typography variant="body2">
                <strong>Price:</strong> ₹{product.price?.toFixed(2)}
              </Typography>
            </Stack>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2">
              <strong>GST:</strong> {product.gstRate ? `${product.gstRate}%` : 'N/A'}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="success.main">
              <strong>Final:</strong> ₹{calculateWithGST(product.price, product.gstRate).toFixed(2)}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Inventory fontSize="small" />
              <Typography variant="body2">
                <strong>Stock:</strong> 
                <Chip 
                  label={product.stock || 0} 
                  size="small"
                  color={product.stock > 10 ? 'success' : product.stock > 0 ? 'warning' : 'error'}
                  sx={{ ml: 1, height: 20 }}
                />
              </Typography>
            </Stack>
          </Grid>
          {product.supplier && (
            <Grid item xs={12}>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Store fontSize="small" />
                <Typography variant="body2">
                  <strong>Supplier:</strong> {product.supplier}
                </Typography>
              </Stack>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );

  return (
    <Container maxWidth="lg" sx={{ px: isMobile ? 1 : 3, py: isMobile ? 1 : 2 }}>
      <Paper 
        elevation={isMobile ? 1 : 3} 
        sx={{ 
          p: isMobile ? 2 : 4, 
          mt: isMobile ? 1 : 4,
          borderRadius: isMobile ? 2 : 3
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row', 
          justifyContent: 'space-between', 
          alignItems: isMobile ? 'stretch' : 'center', 
          mb: 3,
          gap: isMobile ? 2 : 0
        }}>
          <Typography variant={isMobile ? "h5" : "h4"} color="primary">
            Product Price Management
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
            fullWidth={isMobile}
            size={isMobile ? "medium" : "large"}
          >
            {isMobile ? 'Add Product' : 'Add New Product'}
          </Button>
        </Box>

        {successMessage && (
          <Alert 
            severity="success" 
            sx={{ 
              mb: 3,
              fontSize: isMobile ? '0.875rem' : '1rem'
            }}
            onClose={() => setSuccessMessage('')}
          >
            {successMessage}
          </Alert>
        )}

        {/* Search and Filter Bar */}
        <Box sx={{ 
          mb: 4, 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          gap: 2,
          alignItems: isMobile ? 'stretch' : 'center'
        }}>
          <TextField
            label="Search Products"
            variant="outlined"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size={isMobile ? "small" : "medium"}
            fullWidth={isMobile}
            InputProps={{
              startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
            }}
          />
          
          <TextField
            select
            label="Filter by Category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            size={isMobile ? "small" : "medium"}
            fullWidth={isMobile}
            sx={{ minWidth: isMobile ? '100%' : 200 }}
          >
            <MenuItem value="All">All Categories</MenuItem>
            {categories.map((cat) => (
              <MenuItem key={cat} value={cat}>{cat}</MenuItem>
            ))}
          </TextField>
          
          {!isMobile && <Box sx={{ flexGrow: 1 }} />}
          
          <Typography 
            variant="body2" 
            color="text.secondary"
            align={isMobile ? "center" : "right"}
            sx={{ 
              pt: isMobile ? 1 : 0,
              width: isMobile ? '100%' : 'auto'
            }}
          >
            Showing {filteredProducts.length} of {products.length} products
          </Typography>
        </Box>

        {/* Products Display - Table for desktop, Cards for mobile */}
        {!isMobile ? (
          // Desktop Table View
          <TableContainer sx={{ maxHeight: isTablet ? 500 : 600 }}>
            <Table stickyHeader size={isTablet ? "small" : "medium"}>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Product Name</strong></TableCell>
                  <TableCell><strong>Category</strong></TableCell>
                  <TableCell><strong>Unit</strong></TableCell>
                  <TableCell><strong>Base Price</strong></TableCell>
                  <TableCell><strong>GST %</strong></TableCell>
                  <TableCell><strong>Price with GST</strong></TableCell>
                  <TableCell><strong>Stock</strong></TableCell>
                  <TableCell><strong>Supplier</strong></TableCell>
                  <TableCell><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id} hover>
                    <TableCell>
                      <Typography variant="body1" fontWeight="medium">
                        {product.productName}
                      </Typography>
                      {product.description && (
                        <Typography variant="caption" color="text.secondary">
                          {product.description.length > 50 ? product.description.substring(0, 50) + '...' : product.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={product.category} 
                        size="small" 
                        color="primary" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{product.unit || '-'}</TableCell>
                    <TableCell>
                      <Typography fontWeight="bold">
                        ₹{product.price?.toFixed(2) || '0.00'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {product.gstRate ? `${product.gstRate}%` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight="bold" color="success.main">
                        ₹{calculateWithGST(product.price, product.gstRate).toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={product.stock || 0} 
                        size="small"
                        color={product.stock > 10 ? 'success' : product.stock > 0 ? 'warning' : 'error'}
                      />
                    </TableCell>
                    <TableCell>{product.supplier || '-'}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleOpenDialog(product)}
                        >
                          <Edit fontSize={isTablet ? "small" : "medium"} />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteProduct(product.id)}
                        >
                          <Delete fontSize={isTablet ? "small" : "medium"} />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          // Mobile Card View
          <Box>
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </Box>
        )}

        {filteredProducts.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant={isMobile ? "h6" : "h5"} color="text.secondary" gutterBottom>
              No products found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {searchTerm || selectedCategory !== 'All' 
                ? 'Try changing your search or filter criteria'
                : 'Click "Add New Product" to get started'}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Add/Edit Product Dialog - Responsive */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog} 
        maxWidth="md" 
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: { 
            borderRadius: isMobile ? 0 : 3,
            m: isMobile ? 0 : 2
          }
        }}
      >
        <DialogTitle sx={{ 
          fontSize: isMobile ? '1.25rem' : '1.5rem',
          bgcolor: 'primary.main',
          color: 'white'
        }}>
          {editingProduct ? 'Edit Product' : 'Add New Product'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ pt: 3 }}>
            <Grid container spacing={isMobile ? 1 : 2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Product Name *"
                  name="productName"
                  value={formData.productName}
                  onChange={handleInputChange}
                  required
                  margin="normal"
                  size={isMobile ? "small" : "medium"}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  select
                  label="Category *"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                  margin="normal"
                  size={isMobile ? "small" : "medium"}
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Unit (e.g., Bag, Piece, Kg) *"
                  name="unit"
                  value={formData.unit}
                  onChange={handleInputChange}
                  required
                  margin="normal"
                  size={isMobile ? "small" : "medium"}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Base Price (₹) *"
                  name="price"
                  type="number"
                  value={formData.price}
                  onChange={handleInputChange}
                  required
                  margin="normal"
                  size={isMobile ? "small" : "medium"}
                  InputProps={{
                    startAdornment: <Typography sx={{ mr: 1 }}>₹</Typography>
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="GST Rate (%)"
                  name="gstRate"
                  type="number"
                  value={formData.gstRate}
                  onChange={handleInputChange}
                  margin="normal"
                  size={isMobile ? "small" : "medium"}
                  InputProps={{
                    endAdornment: <Typography>%</Typography>
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="HSN Code"
                  name="hsnCode"
                  value={formData.hsnCode}
                  onChange={handleInputChange}
                  margin="normal"
                  size={isMobile ? "small" : "medium"}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Current Stock"
                  name="stock"
                  type="number"
                  value={formData.stock}
                  onChange={handleInputChange}
                  margin="normal"
                  size={isMobile ? "small" : "medium"}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Supplier"
                  name="supplier"
                  value={formData.supplier}
                  onChange={handleInputChange}
                  margin="normal"
                  size={isMobile ? "small" : "medium"}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  name="description"
                  multiline
                  rows={isMobile ? 2 : 3}
                  value={formData.description}
                  onChange={handleInputChange}
                  margin="normal"
                  size={isMobile ? "small" : "medium"}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ 
            p: 2,
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 1 : 0
          }}>
            <Button 
              onClick={handleCloseDialog} 
              fullWidth={isMobile}
              size={isMobile ? "medium" : "large"}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="contained" 
              color="primary" 
              fullWidth={isMobile}
              size={isMobile ? "medium" : "large"}
            >
              {editingProduct ? 'Update Product' : 'Add Product'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default ProductPrice;