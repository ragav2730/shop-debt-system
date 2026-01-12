import React, { useEffect, useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Grid,
  TextField,
  Button,
  MenuItem,
  Card,
  CardContent,
  Stack,
  Chip,
  IconButton
} from '@mui/material';

import { Delete } from '@mui/icons-material';

import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';

import { db } from '../../services/firebase';

/* ------------------ ALLOWED CATEGORIES ------------------ */
const CATEGORIES = [
  'Cement',
  'Bricks',
  'Steel',
  'Sheet',
  'Pipes',
  'Other'
];

const ProductManager = () => {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    category: '',
    company: '',
    unit: ''
  });

  /* ------------------ REALTIME FETCH ------------------ */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  /* ------------------ HANDLERS ------------------ */
  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAdd = async () => {
    if (!form.category || !form.company || !form.unit) {
      alert('Please fill Category, Company and Unit');
      return;
    }

    // Prevent duplicate company under same category
    const exists = products.some(
      p =>
        p.category === form.category &&
        p.company.toLowerCase() === form.company.toLowerCase()
    );

    if (exists) {
      alert('This company already exists under the selected category');
      return;
    }

    await addDoc(collection(db, 'products'), {
      category: form.category,
      company: form.company.trim(),
      unit: form.unit.trim(),
      active: true,
      createdAt: serverTimestamp()
    });

    setForm({ category: '', company: '', unit: '' });
  };

  const handleDelete = async id => {
    await deleteDoc(doc(db, 'products', id));
  };

  /* ------------------ GROUP BY CATEGORY ------------------ */
  const grouped = products.reduce((acc, p) => {
    acc[p.category] = acc[p.category] || [];
    acc[p.category].push(p);
    return acc;
  }, {});

  /* ------------------ UI ------------------ */
  return (
    <Container maxWidth="lg">
      <Typography variant="h5" fontWeight={700} mb={2}>
        Product Manager
      </Typography>

      {/* ADD COMPANY */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography fontWeight={700} mb={2}>
          Add Company
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              select
              fullWidth
              label="Category"
              name="category"
              value={form.category}
              onChange={handleChange}
            >
              {CATEGORIES.map(c => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Company Name"
              name="company"
              value={form.company}
              onChange={handleChange}
              placeholder="Ex: Dalmia, ACC, Tata"
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label="Unit"
              name="unit"
              value={form.unit}
              onChange={handleChange}
              placeholder="bags / kg / pieces"
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant="contained"
              sx={{ height: '56px' }}
              onClick={handleAdd}
            >
              ADD
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* LIST */}
      {Object.keys(grouped).map(category => (
        <div key={category}>
          <Typography variant="h6" fontWeight={700} mb={1}>
            {category}
          </Typography>

          <Grid container spacing={2} mb={3}>
            {grouped[category].map(p => (
              <Grid item xs={12} sm={6} md={3} key={p.id}>
                <Card>
                  <CardContent>
                    <Typography fontWeight={700}>
                      {p.company}
                    </Typography>

                    <Typography variant="body2">
                      Unit: {p.unit}
                    </Typography>

                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      mt={2}
                    >
                      <Chip
                        label={p.active ? 'Active' : 'Inactive'}
                        color="success"
                        size="small"
                      />
                      <IconButton
                        color="error"
                        onClick={() => handleDelete(p.id)}
                      >
                        <Delete />
                      </IconButton>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </div>
      ))}
    </Container>
  );
};

export default ProductManager;
