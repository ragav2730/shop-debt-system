// src/services/pdfService.js

class PDFService {
  constructor() {
    this.jsPDF = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return true;
    
    try {
      const module = await import('jspdf');
      this.jsPDF = module.default;
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize PDF service:', error);
      return false;
    }
  }

  getInstance() {
    if (!this.initialized) {
      throw new Error('PDF service not initialized. Call initialize() first.');
    }
    return this.jsPDF;
  }

  createPDF(options = {}) {
    if (!this.initialized) {
      throw new Error('PDF service not initialized');
    }
    
    const defaults = {
      unit: 'mm',
      format: 'a4',
      compress: true,
      orientation: 'portrait'
    };
    
    return new this.jsPDF({ ...defaults, ...options });
  }
}

// Singleton instance
const pdfService = new PDFService();
export default pdfService;