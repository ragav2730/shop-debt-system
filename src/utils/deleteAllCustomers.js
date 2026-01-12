import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

export const deleteAllCustomersData = async () => {
  const collectionsToClear = [
    'customers',
    'transactions',
    'payments',
    'purchases'
  ];

  for (const col of collectionsToClear) {
    const snap = await getDocs(collection(db, col));
    for (const d of snap.docs) {
      await deleteDoc(doc(db, col, d.id));
    }
    console.log(`Deleted all documents in ${col}`);
  }

  alert('ALL customer-related data deleted');
};
