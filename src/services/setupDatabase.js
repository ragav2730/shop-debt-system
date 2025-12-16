import { db, auth } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc,
  writeBatch,
  serverTimestamp,
  getDocs // ADD getDocs
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';

// Also remove unused setDoc if you're not using it, but keep it since you might need it
// The setDoc import is actually used in the code (line: const ownerRef = doc(db, 'users', ownerUid); batch.set(ownerRef, {...}))

// MAIN FUNCTION - RUN THIS ONCE
export const initializeCompleteDatabase = async () => {
  console.log("🚀 Starting complete database initialization...");
  
  try {
    // ============================================
    // 1. FIRST: CREATE OWNER ACCOUNT (AUTH + FIRESTORE)
    // ============================================
    console.log("📧 Creating owner account...");
    
    const ownerEmail = "owner@shop.com";
    const ownerPassword = "Owner@123"; // Change this!
    
    // Create auth account
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      ownerEmail, 
      ownerPassword
    );
    
    const ownerUid = userCredential.user.uid;
    console.log("✅ Owner UID:", ownerUid);
    
    // ============================================
    // 2. CREATE ALL COLLECTIONS WITH SAMPLE DATA
    // ============================================
    const batch = writeBatch(db);
    
    // A) Create Owner User Document
    const ownerRef = doc(db, 'users', ownerUid);
    batch.set(ownerRef, {
      email: ownerEmail,
      name: "Shop Owner",
      role: "owner",
      phone: "9876543210",
      createdAt: serverTimestamp(),
      isActive: true,
      permissions: {
        canAddCustomers: true,
        canEditCustomers: true,
        canDeleteCustomers: true,
        canAddTransactions: true,
        canAddPayments: true,
        canAddProducts: true,
        canEditProducts: true,
        canAddUsers: true,
        canViewReports: true,
        canManageSettings: true
      }
    });
    
    // B) Create Sample Products
    const products = [
      {
        productName: "OPC Cement 50kg",
        category: "Cement",
        unit: "Bag",
        price: 350,
        hsnCode: "25232910",
        gstRate: 18,
        stock: 1000,
        supplier: "ACC Cement",
        createdAt: serverTimestamp()
      },
      {
        productName: "PPC Cement 50kg",
        category: "Cement",
        unit: "Bag",
        price: 340,
        hsnCode: "25232920",
        gstRate: 18,
        stock: 800,
        supplier: "UltraTech",
        createdAt: serverTimestamp()
      },
      {
        productName: "Red Bricks",
        category: "Bricks",
        unit: "Piece",
        price: 10,
        hsnCode: "69010010",
        gstRate: 5,
        stock: 50000,
        supplier: "Local",
        createdAt: serverTimestamp()
      },
      {
        productName: "Fly Ash Bricks",
        category: "Bricks",
        unit: "Piece",
        price: 12,
        hsnCode: "69010020",
        gstRate: 5,
        stock: 30000,
        supplier: "Eco Bricks",
        createdAt: serverTimestamp()
      },
      {
        productName: "TMT Steel Bar 12mm",
        category: "Steel",
        unit: "Quintal",
        price: 52000,
        hsnCode: "72142090",
        gstRate: 18,
        stock: 50,
        supplier: "JSW Steel",
        createdAt: serverTimestamp()
      },
      {
        productName: "TMT Steel Bar 16mm",
        category: "Steel",
        unit: "Quintal",
        price: 51500,
        hsnCode: "72142090",
        gstRate: 18,
        stock: 40,
        supplier: "Tata Steel",
        createdAt: serverTimestamp()
      },
      {
        productName: "Galvanized Sheet 24G",
        category: "Sheat",
        unit: "Sheet",
        price: 1500,
        hsnCode: "72104900",
        gstRate: 18,
        stock: 200,
        supplier: "Essar",
        createdAt: serverTimestamp()
      },
      {
        productName: "GI Pipe 1 inch",
        category: "Pipes",
        unit: "Piece",
        price: 850,
        hsnCode: "73063000",
        gstRate: 18,
        stock: 150,
        supplier: "Jindal",
        createdAt: serverTimestamp()
      }
    ];
    
    products.forEach(product => {
      const productRef = doc(collection(db, 'products'));
      batch.set(productRef, product);
    });
    
    // C) Create Sample Customers
    const customers = [
      {
        customerName: "Ramesh Construction",
        phone: "9876543210",
        email: "ramesh@const.com",
        address: "123 MG Road, Bangalore",
        totalAmount: 150000,
        balance: 50000,
        status: "pending",
        category: "Regular",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      {
        customerName: "Suresh Builders",
        phone: "9876543211",
        address: "456 Koramangala, Bangalore",
        totalAmount: 250000,
        balance: 0,
        status: "paid",
        category: "Regular",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      {
        customerName: "Anita Developers",
        phone: "9876543212",
        email: "anita@dev.com",
        address: "789 Indiranagar, Bangalore",
        totalAmount: 75000,
        balance: 75000,
        status: "pending",
        category: "VIP",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    ];
    
    const customerRefs = [];
    customers.forEach(customer => {
      const customerRef = doc(collection(db, 'customers'));
      customerRefs.push(customerRef);
      batch.set(customerRef, customer);
    });
    
    // ============================================
    // 3. CREATE SAMPLE TRANSACTIONS
    // ============================================
    const transactions = [
      {
        customerId: customerRefs[0].id,
        customerName: "Ramesh Construction",
        productName: "OPC Cement 50kg",
        category: "Cement",
        quantity: 100,
        rate: 350,
        amount: 35000,
        billNumber: "BL-2024-001",
        description: "For apartment construction",
        paymentMode: "Credit",
        date: serverTimestamp(),
        createdAt: serverTimestamp()
      },
      {
        customerId: customerRefs[0].id,
        customerName: "Ramesh Construction",
        productName: "TMT Steel Bar 12mm",
        category: "Steel",
        quantity: 2,
        rate: 52000,
        amount: 104000,
        billNumber: "BL-2024-002",
        description: "Structural steel",
        paymentMode: "Credit",
        date: serverTimestamp(),
        createdAt: serverTimestamp()
      },
      {
        customerId: customerRefs[2].id,
        customerName: "Anita Developers",
        productName: "Red Bricks",
        category: "Bricks",
        quantity: 5000,
        rate: 10,
        amount: 50000,
        billNumber: "BL-2024-003",
        description: "For boundary wall",
        paymentMode: "Credit",
        date: serverTimestamp(),
        createdAt: serverTimestamp()
      },
      {
        customerId: customerRefs[2].id,
        customerName: "Anita Developers",
        productName: "Galvanized Sheet 24G",
        category: "Sheat",
        quantity: 25,
        rate: 1500,
        amount: 37500,
        billNumber: "BL-2024-004",
        description: "Roofing material",
        paymentMode: "Credit",
        date: serverTimestamp(),
        createdAt: serverTimestamp()
      }
    ];
    
    transactions.forEach(transaction => {
      const transactionRef = doc(collection(db, 'transactions'));
      batch.set(transactionRef, transaction);
    });
    
    // ============================================
    // 4. CREATE SAMPLE PAYMENTS
    // ============================================
    const payments = [
      {
        customerId: customerRefs[0].id,
        customerName: "Ramesh Construction",
        amountPaid: 100000,
        paymentMode: "Bank Transfer",
        previousBalance: 150000,
        newBalance: 50000,
        receiptNumber: "RCPT-2024-001",
        notes: "First installment",
        date: serverTimestamp(),
        createdAt: serverTimestamp()
      },
      {
        customerId: customerRefs[1].id,
        customerName: "Suresh Builders",
        amountPaid: 250000,
        paymentMode: "Cash",
        previousBalance: 250000,
        newBalance: 0,
        receiptNumber: "RCPT-2024-002",
        notes: "Full payment",
        date: serverTimestamp(),
        createdAt: serverTimestamp()
      }
    ];
    
    payments.forEach(payment => {
      const paymentRef = doc(collection(db, 'payments'));
      batch.set(paymentRef, payment);
    });
    
    // ============================================
    // 5. COMMIT EVERYTHING AT ONCE
    // ============================================
    console.log("💾 Committing all data to Firestore...");
    await batch.commit();
    
    console.log("🎉 Database initialization COMPLETE!");
    console.log("========================================");
    console.log("📊 Collections created:");
    console.log("   ✅ users (with owner account)");
    console.log("   ✅ products (8 sample products)");
    console.log("   ✅ customers (3 sample customers)");
    console.log("   ✅ transactions (4 sample transactions)");
    console.log("   ✅ payments (2 sample payments)");
    console.log("========================================");
    console.log("🔑 Login Credentials:");
    console.log("   Email: owner@shop.com");
    console.log("   Password: Owner@123");
    console.log("========================================");
    
    return {
      success: true,
      ownerEmail,
      ownerPassword,
      collections: ['users', 'products', 'customers', 'transactions', 'payments']
    };
    
  } catch (error) {
    console.error("❌ Initialization failed:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

// ============================================
// 6. ADDITIONAL UTILITY FUNCTIONS
// ============================================

// Function to add a single product
export const addProduct = async (productData) => {
  try {
    const docRef = await addDoc(collection(db, 'products'), {
      ...productData,
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp()
    });
    return { id: docRef.id, ...productData };
  } catch (error) {
    console.error("Error adding product:", error);
    throw error;
  }
};

// Function to add a customer
export const addCustomer = async (customerData) => {
  try {
    const docRef = await addDoc(collection(db, 'customers'), {
      ...customerData,
      balance: customerData.totalAmount || 0,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { id: docRef.id, ...customerData };
  } catch (error) {
    console.error("Error adding customer:", error);
    throw error;
  }
};

// Function to check if database is initialized
export const checkDatabaseStatus = async () => {
  try {
    // Check if users collection exists by trying to read it
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const productsSnapshot = await getDocs(collection(db, 'products'));
    
    return {
      usersExist: !usersSnapshot.empty,
      productsExist: !productsSnapshot.empty,
      totalUsers: usersSnapshot.size,
      totalProducts: productsSnapshot.size
    };
  } catch (error) {
    return { error: error.message };
  }
};