import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from './services/firebase';

const createOwner = async () => {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      'owner@shop.com',
      'Owner@123'
    );
    console.log('✅ Owner created:', userCredential.user.uid);
    console.log('Email: owner@shop.com');
    console.log('Password: Owner@123');
  } catch (error) {
    console.error('Error:', error.message);
  }
};

createOwner();