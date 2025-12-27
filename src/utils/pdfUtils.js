// src/utils/pdfUtils.js

// Utility functions for PDF generation

// Format currency with Indian Rupee symbol
export const formatCurrency = (amount) => {
  if (amount === 0) return '₹0';
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(1)}Cr`;
  } else if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  } else if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`;
  }
  return `₹${amount.toFixed(0)}`;
};

// Format date in Indian format
export const formatIndianDate = (date) => {
  if (!date) return 'N/A';
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

// Ensure text is safe for PDF
export const safeText = (text) => {
  if (!text) return '';
  return String(text).replace(/[^\x00-\x7F]/g, ''); // Remove non-ASCII characters for now
};

// Get PDF settings from localStorage
export const getPDFSettings = () => {
  const saved = localStorage.getItem('billSettings');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Error parsing bill settings:', e);
    }
  }
  return {
    companyName: 'Shop Debt System',
    companyAddress: '123 Main Street, Chennai',
    companyPhone: '+91 9876543210',
    footerText: 'Thank you for your business!'
  };
};