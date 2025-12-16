import React from 'react';
import { Container, Paper, Typography } from '@mui/material';

const AddUser = () => {
  return (
    <Container maxWidth="md">
      <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
        <Typography variant="h5">Add User</Typography>
        <Typography>User management will be here (Owner only).</Typography>
      </Paper>
    </Container>
  );
};

export default AddUser;