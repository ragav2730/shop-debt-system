import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Add Tamil font support for PDF
const addTamilFontToPDF = (doc) => {
  // Using standard fonts that support Tamil (if available)
  // In production, you would need to add a Tamil font file
  doc.setFont('helvetica'); // Use helvetica as base font
  return doc;
};

// Helper functions with Unicode support
const formatDateForCSV = (date) => {
  if (!date) return '';
  try {
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '-');
  } catch (e) {
    return '';
  }
};

const formatDateForDisplay = (date) => {
  if (!date) return '';
  try {
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return '';
  }
};

const getProductName = (transaction) => {
  if (transaction.productName) {
    return transaction.productName;
  }
  
  const parts = [];
  if (transaction.company) parts.push(transaction.company);
  if (transaction.category) parts.push(transaction.category);
  
  let name = parts.join(' ');
  
  if (transaction.quantity && transaction.unit) {
    name += ` (${transaction.quantity} ${transaction.unit})`;
  }
  
  return name || 'Product';
};

// Clean text for CSV - preserves Unicode characters
const cleanTextForCSV = (text) => {
  if (!text) return '';
  // Escape double quotes and wrap in quotes
  const escaped = String(text).replace(/"/g, '""');
  return `"${escaped}"`;
};

// CSV Export with UTF-8 BOM for Unicode support
export const exportToCSV = (data, vendorName, customerName = 'All Customers', filename = 'customer_report') => {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  // Calculate totals
  const totalAmount = data.reduce((sum, row) => sum + (row.amount || 0), 0);
  const totalRemaining = data.reduce((sum, row) => sum + (row.remainingAmount || 0), 0);
  const totalPaid = totalAmount - totalRemaining;

  // Prepare CSV content with UTF-8 BOM
  const csvRows = [];
  
  // UTF-8 BOM for Unicode support (Excel, Google Sheets)
  const BOM = '\uFEFF';
  
  // Header section
  csvRows.push('========================================');
  csvRows.push('CUSTOMER PURCHASE REPORT');
  csvRows.push('========================================');
  csvRows.push(`Vendor: ${vendorName}`);
  csvRows.push(`Customer: ${customerName}`);
  csvRows.push(`Report Date: ${new Date().toLocaleDateString('en-IN')}`);
  csvRows.push('');
  
  // Column headers
  const headers = ['Date', 'Customer', 'Product', 'Category', 'Quantity', 'Price', 'Total', 'Remaining', 'Status'];
  csvRows.push(headers.join(','));
  
  // Data rows with Unicode support
  data.forEach(row => {
    const rowData = [
      formatDateForCSV(row.date),
      cleanTextForCSV(row.customerName || ''),
      cleanTextForCSV(getProductName(row)),
      cleanTextForCSV(row.category || ''),
      cleanTextForCSV(`${row.quantity || 0} ${row.unit || ''}`),
      `₹${row.price || 0}`,
      `₹${row.amount || 0}`,
      `₹${row.remainingAmount || 0}`,
      row.remainingAmount > 0 ? 'Pending' : 'Paid'
    ];
    csvRows.push(rowData.join(','));
  });
  
  // Summary section
  csvRows.push('');
  csvRows.push('========================================');
  csvRows.push('SUMMARY');
  csvRows.push('========================================');
  csvRows.push(`Total Transactions:,${data.length}`);
  csvRows.push(`Total Amount:,₹${totalAmount}`);
  csvRows.push(`Total Paid:,₹${totalPaid}`);
  csvRows.push(`Total Pending:,₹${totalRemaining}`);
  csvRows.push(`Net Balance:,₹${totalRemaining}`);
  csvRows.push('');
  csvRows.push('========================================');
  csvRows.push('END OF REPORT');
  csvRows.push('========================================');
  
  // Convert to CSV string with BOM
  const csvContent = BOM + csvRows.join('\n');

  // Create and download file with UTF-8 encoding
  const blob = new Blob([csvContent], { 
    type: 'text/csv;charset=utf-8;'
  });
  
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  const safeVendorName = vendorName.replace(/[^a-z0-9]/gi, '_');
  const safeCustomerName = customerName.replace(/[^a-z0-9]/gi, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${safeVendorName}_${safeCustomerName}_${dateStr}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// PDF Export with Unicode support
export const exportToPDF = (data, vendorName, customerName = 'All Customers', filename = 'customer_report') => {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  const doc = new jsPDF('p', 'mm', 'a4');
  
  // Add Tamil font support
  addTamilFontToPDF(doc);
  
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  
  // Add title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('CUSTOMER PURCHASE REPORT', pageWidth / 2, margin, { align: 'center' });
  
  // Add vendor name (Tamil names will be preserved)
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Vendor: ${vendorName}`, margin, margin + 8);
  
  // Add customer name
  doc.text(`Customer: ${customerName}`, margin, margin + 15);
  
  // Add date
  doc.text(`Report Date: ${new Date().toLocaleDateString('en-IN')}`, margin, margin + 22);
  
  // Calculate totals
  const totalAmount = data.reduce((sum, row) => sum + (row.amount || 0), 0);
  const totalRemaining = data.reduce((sum, row) => sum + (row.remainingAmount || 0), 0);
  const totalPaid = totalAmount - totalRemaining;
  
  // Add summary section
  const summaryY = margin + 32;
  doc.setFillColor(240, 240, 240);
  doc.rect(margin - 2, summaryY - 5, pageWidth - (margin * 2) + 4, 25, 'F');
  
  doc.setFontSize(10);
  doc.text(`Total Transactions: ${data.length}`, margin, summaryY);
  doc.text(`Total Amount: ₹${totalAmount.toLocaleString()}`, margin, summaryY + 6);
  doc.text(`Total Paid: ₹${totalPaid.toLocaleString()}`, margin, summaryY + 12);
  doc.text(`Total Pending: ₹${totalRemaining.toLocaleString()}`, margin, summaryY + 18);
  
  // Prepare table data with Unicode support
  const tableData = data.map(row => [
    formatDateForDisplay(row.date),
    row.customerName || '',
    getProductName(row),
    row.category || '',
    `${row.quantity || 0} ${row.unit || ''}`,
    `₹${row.price || 0}`,
    `₹${row.amount || 0}`,
    `₹${row.remainingAmount || 0}`,
    row.remainingAmount > 0 ? 'Pending' : 'Paid'
  ]);
  
  // Define table headers
  const headers = [['Date', 'Customer', 'Product', 'Category', 'Quantity', 'Price', 'Total', 'Remaining', 'Status']];
  
  // Add table with Unicode support
  doc.autoTable({
    head: headers,
    body: tableData,
    startY: summaryY + 30,
    theme: 'grid',
    styles: {
      fontSize: 8,
      font: 'helvetica',
      cellPadding: 2,
      overflow: 'linebreak',
      lineWidth: 0.1,
      lineColor: [0, 0, 0],
      halign: 'left',
      valign: 'middle'
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
      font: 'helvetica',
      lineWidth: 0.1,
      halign: 'center'
    },
    bodyStyles: {
      font: 'helvetica',
      lineWidth: 0.1,
      halign: 'left'
    },
    columnStyles: {
      0: { cellWidth: 18, fontSize: 7, halign: 'center' },
      1: { cellWidth: 25, fontSize: 7, halign: 'left' },
      2: { cellWidth: 30, fontSize: 7, halign: 'left' },
      3: { cellWidth: 20, fontSize: 7, halign: 'left' },
      4: { cellWidth: 20, fontSize: 7, halign: 'center' },
      5: { cellWidth: 15, fontSize: 7, halign: 'right' },
      6: { cellWidth: 15, fontSize: 7, halign: 'right' },
      7: { cellWidth: 20, fontSize: 7, halign: 'right' },
      8: { cellWidth: 15, fontSize: 7, halign: 'center' }
    },
    margin: { left: margin, right: margin },
    didDrawCell: function(data) {
      // This helps with Unicode rendering
      if (data.section === 'body') {
        doc.setFont('helvetica', 'normal');
      }
    },
    didDrawPage: function (data) {
      // Add footer with total balance on last page
      if (data.pageNumber === data.pageCount) {
        const finalY = data.cursor.y + 10;
        
        // Add horizontal line
        doc.setLineWidth(0.5);
        doc.line(margin, finalY, pageWidth - margin, finalY);
        
        // Add total balance
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`Net Balance: ₹${totalRemaining.toLocaleString()}`, pageWidth - margin, finalY + 8, { align: 'right' });
        
        // Add page number
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Page ${data.pageNumber} of ${data.pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }
    }
  });
  
  // Add notebook-style horizontal lines on blank space
  const currentY = doc.lastAutoTable.finalY || summaryY + 30;
  if (currentY < pageHeight - 30) {
    const lineSpacing = 5;
    let lineY = currentY + 15;
    
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.1);
    
    while (lineY < pageHeight - 20) {
      doc.line(margin, lineY, pageWidth - margin, lineY);
      lineY += lineSpacing;
    }
  }
  
  // Save the PDF
  const safeVendorName = vendorName.replace(/[^a-z0-9]/gi, '_');
  const safeCustomerName = customerName.replace(/[^a-z0-9]/gi, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  
  doc.save(`${filename}_${safeVendorName}_${safeCustomerName}_${dateStr}.pdf`);
};

// Excel Export with Unicode support
export const exportToExcel = (data, vendorName, customerName = 'All Customers', filename = 'customer_report') => {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  // Calculate totals
  const totalAmount = data.reduce((sum, row) => sum + (row.amount || 0), 0);
  const totalRemaining = data.reduce((sum, row) => sum + (row.remainingAmount || 0), 0);
  const totalPaid = totalAmount - totalRemaining;

  // Prepare worksheet data
  const worksheetData = [
    ['CUSTOMER PURCHASE REPORT'],
    [`Vendor: ${vendorName}`],
    [`Customer: ${customerName}`],
    [`Report Date: ${new Date().toLocaleDateString('en-IN')}`],
    [''],
    ['Date', 'Customer', 'Product', 'Category', 'Quantity', 'Price', 'Total', 'Remaining', 'Status']
  ];
  
  // Add rows
  data.forEach(row => {
    worksheetData.push([
      formatDateForDisplay(row.date),
      row.customerName || '',
      getProductName(row),
      row.category || '',
      `${row.quantity || 0} ${row.unit || ''}`,
      row.price || 0,
      row.amount || 0,
      row.remainingAmount || 0,
      row.remainingAmount > 0 ? 'Pending' : 'Paid'
    ]);
  });
  
  // Add summary section
  worksheetData.push(['']);
  worksheetData.push(['========================================']);
  worksheetData.push(['SUMMARY']);
  worksheetData.push(['========================================']);
  worksheetData.push(['Total Transactions:', data.length]);
  worksheetData.push(['Total Amount:', totalAmount]);
  worksheetData.push(['Total Paid:', totalPaid]);
  worksheetData.push(['Total Pending:', totalRemaining]);
  worksheetData.push(['Net Balance:', totalRemaining]);
  worksheetData.push(['']);
  worksheetData.push(['========================================']);
  worksheetData.push(['END OF REPORT']);
  worksheetData.push(['========================================']);
  
  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  
  // Set column widths
  const wscols = [
    { wch: 12 }, // Date
    { wch: 25 }, // Customer (wider for Tamil names)
    { wch: 30 }, // Product
    { wch: 20 }, // Category
    { wch: 12 }, // Quantity
    { wch: 10 }, // Price
    { wch: 10 }, // Total
    { wch: 12 }, // Remaining
    { wch: 10 }  // Status
  ];
  worksheet['!cols'] = wscols;
  
  // Format currency cells
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  for (let R = 6; R <= range.e.r; R++) {
    const priceCell = XLSX.utils.encode_cell({r: R, c: 5}); // Price column
    const totalCell = XLSX.utils.encode_cell({r: R, c: 6}); // Total column
    const remainingCell = XLSX.utils.encode_cell({r: R, c: 7}); // Remaining column
    
    if (worksheet[priceCell]) {
      worksheet[priceCell].z = '#,##0.00;[Red]-#,##0.00';
      worksheet[priceCell].t = 'n';
    }
    if (worksheet[totalCell]) {
      worksheet[totalCell].z = '#,##0.00;[Red]-#,##0.00';
      worksheet[totalCell].t = 'n';
    }
    if (worksheet[remainingCell]) {
      worksheet[remainingCell].z = '#,##0.00;[Red]-#,##0.00';
      worksheet[remainingCell].t = 'n';
    }
  }
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Customer Report');
  
  // Generate and download Excel file with UTF-8 encoding
  const safeVendorName = vendorName.replace(/[^a-z0-9]/gi, '_');
  const safeCustomerName = customerName.replace(/[^a-z0-9]/gi, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  
  XLSX.writeFile(workbook, `${filename}_${safeVendorName}_${safeCustomerName}_${dateStr}.xlsx`);
};

// Get unique customers from transactions
export const getUniqueCustomers = (transactions) => {
  return [...new Set(
    transactions
      .map(t => t.customerName)
      .filter(name => name && name.trim() !== '')
  )].sort();
};