import axios from "axios";
import { getToken } from "./authService";

// Base URL for the n8n webhooks
const WEBHOOK_BASE_URL = "https://webhook.surgbay.com/webhook";

// Base URL for the API endpoints (determined dynamically)
const getApiBaseURL = () => {
  return window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
    ? "http://127.0.0.1:8000/api/v1" 
    : "https://rl3.surgbay.com/api/v1";
};

// Create axios instance for webhooks with default headers
const webhookApi = axios.create({
  baseURL: WEBHOOK_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Create axios instance for API endpoints
const apiClient = axios.create({
  baseURL: getApiBaseURL(),
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor to include auth token for webhook API
webhookApi.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add request interceptor to include auth token for API client
apiClient.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const runSQLQuery = async (query) => {
  try {
    const response = await webhookApi.get(`/run-sql-query`, {
      params: { query: query }
    });
    
    return {
      success: true,
      results: response.data,
      message: "Query executed successfully"
    };
  } catch (error) {
    console.error("Error running SQL query:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to run SQL query",
      message: "There was an error executing your query. Please check your query syntax and try again."
    };
  }
};

export const lookupMarketValuesByn8n = async (query, site, api_key) => {
  try {
    const response = await webhookApi.get(`/lookup-market-values`, {
      params: { query: query, site: site, api_key: api_key }
    });
    
    return {
      success: true,
      data: response.data,
      message: "Query executed successfully"
    };
  } catch (error) { 
    console.error("Error looking up market values:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to look up market values",
      message: "There was an error looking up market values. Please check your input and try again."
    };
  }
};

// lookupMarketValuesByn8n("2089610-001+site:dotmed.com", "dotmed.com", "dcfe291c167a92321dcf57d5b33e1b9e87df5d9e47ada8d9ca1fc66735fa786a");

// Helper function to validate file before upload
export const validateFile = (file) => {
  // Maximum file size (10MB)
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  
  // Allowed file types for our application
  const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/csv'
  ];

  // File types supported by OpenAI for retrieval
  const OPENAI_SUPPORTED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File size exceeds 10MB limit');
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('File type not supported');
  }

  // Check if file is supported by OpenAI
  const isOpenAISupported = OPENAI_SUPPORTED_TYPES.includes(file.type);
  
  return {
    valid: true,
    openaiSupported: isOpenAISupported
  };
};

// Helper function to format file size for display
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// -------- Reports helpers --------
// Generic helper to fetch a report from n8n as a blob and derive filename
const fetchReportBlob = async (endpoint, params = {}) => {
  try {
    const response = await webhookApi.get(endpoint, {
      params,
      responseType: 'blob',
      headers: { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    });

    // Try to extract filename from Content-Disposition
    let filename = 'report.xlsx';
    const disposition = response.headers?.['content-disposition'] || response.headers?.get?.('content-disposition');
    if (disposition) {
      const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition);
      const raw = match?.[1] || match?.[2];
      if (raw) filename = decodeURIComponent(raw);
    }

    return { success: true, blob: response.data, filename };
  } catch (error) {
    console.error('Error fetching report blob', endpoint, error);
    return { success: false, error: error.response?.data || error.message };
  }
};

// Trigger download in browser for a given blob
export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'report.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

// Products expiring within N months (default 3)
export const getNearlyExpiredProductsReport = async (months = 3) => {
  return await fetchReportBlob('/reports/nearly-expired-products', { months });
};

// Products that have recalls (implementation depends on your n8n workflow)
export const getRecalledProductsReport = async () => {
  return await fetchReportBlob('/reports/recalled-products');
};

// Products with quality score over threshold (default 2.0)
export const getHighQualityProductsReport = async (minScore = 2.0) => {
  return await fetchReportBlob('/reports/high-quality-products', { min_score: minScore });
};

// -------- Product API endpoints --------
// Get nearly expired products for logged-in vendor
// Supports both query parameters and request body
// Example: getNearlyExpiredProducts({ vendor_id: 123, months: 3, limit: 50, skip: 0 })
export const getNearlyExpiredProducts = async (options = {}) => {
  try {
    const { vendor_id, months = 3, limit = 50, skip = 0 } = options;
    
    // Build query params and request body
    const params = {};
    const body = {};
    
    if (months !== undefined) {
      params.months = months;
      body.months = months;
    }
    if (limit !== undefined) {
      params.limit = limit;
      body.limit = limit;
    }
    if (skip !== undefined) {
      params.skip = skip;
      body.skip = skip;
    }
    if (vendor_id !== undefined) {
      body.vendor_id = vendor_id;
    }
    
    const response = await apiClient.post('/products/nearly-expired', body, {
      params: Object.keys(params).length > 0 ? params : undefined
    });
    
    return {
      success: true,
      data: response.data,
      message: "Nearly expired products retrieved successfully"
    };
  } catch (error) {
    console.error("Error fetching nearly expired products:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to fetch nearly expired products",
      message: "There was an error fetching nearly expired products. Please try again."
    };
  }
};

// Get recalled products for a specific vendor (admin)
// Supports both query parameters and request body
// Example: getRecalledProducts({ vendor_id: 123 })
export const getRecalledProducts = async (options = {}) => {
  try {
    const { vendor_id } = options;
    
    const params = {};
    const body = {};
    
    if (vendor_id !== undefined) {
      params.vendor_id = vendor_id;
      body.vendor_id = vendor_id;
    }
    
    const response = await apiClient.post('/products/recalled', body, {
      params: Object.keys(params).length > 0 ? params : undefined
    });
    
    return {
      success: true,
      data: response.data,
      message: "Recalled products retrieved successfully"
    };
  } catch (error) {
    console.error("Error fetching recalled products:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to fetch recalled products",
      message: "There was an error fetching recalled products. Please try again."
    };
  }
};

// Get high quality products with custom quality threshold
// Supports request body with min_quality, vendor_id, and limit
// Example: getHighQualityProducts({ min_quality: 3.0, vendor_id: 456, limit: 100 })
export const getHighQualityProducts = async (options = {}) => {
  try {
    const { min_quality = 3.0, vendor_id, limit } = options;
    
    const body = {
      min_quality
    };
    
    if (vendor_id !== undefined) {
      body.vendor_id = vendor_id;
    }
    if (limit !== undefined) {
      body.limit = limit;
    }
    
    const response = await apiClient.post('/products/high-quality', body);
    
    return {
      success: true,
      data: response.data,
      message: "High quality products retrieved successfully"
    };
  } catch (error) {
    console.error("Error fetching high quality products:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to fetch high quality products",
      message: "There was an error fetching high quality products. Please try again."
    };
  }
};

// Helper function to get CSV URL without downloading
export const getNearlyExpiredProductsCSVUrl = async (options = {}) => {
  try {
    const { vendor_id, months = 3, limit = 50, skip = 0 } = options;
    
    const params = {};
    const body = {};
    
    if (months !== undefined) {
      params.months = months;
      body.months = months;
    }
    if (limit !== undefined) {
      params.limit = limit;
      body.limit = limit;
    }
    if (skip !== undefined) {
      params.skip = skip;
      body.skip = skip;
    }
    if (vendor_id !== undefined) {
      body.vendor_id = vendor_id;
    }
    
    params.download_csv = true;
    body.download_csv = true;
    
    const response = await apiClient.post('/products/nearly-expired', body, {
      params: Object.keys(params).length > 0 ? params : undefined
    });
    
    const csvUrl = response.data?.data?.csv_url;
    
    if (!csvUrl) {
      return { 
        success: false, 
        error: 'No nearly expired products found. Please try again later.',
        message: 'No nearly expired products found. Please try again later.'
      };
    }
    
    return { success: true, csv_url: csvUrl, filename: 'nearly-expired-products.csv' };
  } catch (error) {
    console.error('Error getting nearly expired products CSV URL:', error);
    return { 
      success: false, 
      error: error.response?.data?.message || 'Unable to get CSV file URL. Please check your connection and try again.',
      message: error.response?.data?.message || 'Unable to get CSV file URL. Please check your connection and try again.'
    };
  }
};

export const getRecalledProductsCSVUrl = async (options = {}) => {
  try {
    const { vendor_id } = options;
    
    const params = {};
    const body = {};
    
    if (vendor_id !== undefined) {
      params.vendor_id = vendor_id;
      body.vendor_id = vendor_id;
    }
    
    params.download_csv = true;
    body.download_csv = true;
    
    const response = await apiClient.post('/products/recalled', body, {
      params: Object.keys(params).length > 0 ? params : undefined
    });
    
    const csvUrl = response.data?.data?.csv_url;
    
    if (!csvUrl) {
      return { 
        success: false, 
        error: 'Unable to generate CSV file. No recalled products found or the file could not be created. Please try again later.',
        message: 'Unable to generate CSV file. No recalled products found or the file could not be created. Please try again later.'
      };
    }
    
    return { success: true, csv_url: csvUrl, filename: 'recalled-products.csv' };
  } catch (error) {
    console.error('Error getting recalled products CSV URL:', error);
    return { 
      success: false, 
      error: error.response?.data?.message || 'Unable to get CSV file URL. Please check your connection and try again.',
      message: error.response?.data?.message || 'Unable to get CSV file URL. Please check your connection and try again.'
    };
  }
};

export const getHighQualityProductsCSVUrl = async (options = {}) => {
  try {
    const { min_quality = 3.0, vendor_id, limit } = options;
    
    const body = {
      min_quality,
      download_csv: true
    };
    
    if (vendor_id !== undefined) {
      body.vendor_id = vendor_id;
    }
    if (limit !== undefined) {
      body.limit = limit;
    }
    
    const response = await apiClient.post('/products/high-quality', body);
    
    const csvUrl = response.data?.data?.csv_url;
    
    if (!csvUrl) {
      return { 
        success: false, 
        error: 'No high quality products found. Please try again later.',
        message: 'No high quality products found. Please try again later.'
      };
    }
    
    return { success: true, csv_url: csvUrl, filename: 'high-quality-products.csv' };
  } catch (error) {
    console.error('Error getting high quality products CSV URL:', error);
    return { 
      success: false, 
      error: error.response?.data?.message || 'Unable to get CSV file URL. Please check your connection and try again.',
      message: error.response?.data?.message || 'Unable to get CSV file URL. Please check your connection and try again.'
    };
  }
};

// Helper function to download CSV from URL using direct link (bypasses CORS)
const downloadCSVFromURL = (csvUrl, defaultFilename) => {
  try {
    if (!csvUrl) {
      return { success: false, error: 'CSV file is not available for download. Please try again later.' };
    }
    
    // Extract filename from URL or use default
    let filename = defaultFilename;
    try {
      const urlParts = new URL(csvUrl);
      const pathParts = urlParts.pathname.split('/');
      const urlFilename = pathParts[pathParts.length - 1];
      if (urlFilename && urlFilename.endsWith('.csv')) {
        filename = urlFilename;
      }
    } catch {
      // If URL parsing fails, use default filename
    }
    
    // Create a direct download link to bypass CORS restrictions
    const link = document.createElement('a');
    link.href = csvUrl;
    link.download = filename;
    link.target = '_blank'; // Open in new tab as fallback
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return { success: true, url: csvUrl, filename };
  } catch (error) {
    console.error('Error downloading CSV from URL:', error);
    return { success: false, error: 'Unable to download CSV file. Please check your connection and try again.' };
  }
};

// -------- CSV Download functions for Product endpoints --------
// Download nearly expired products as CSV
export const downloadNearlyExpiredProductsCSV = async (options = {}) => {
  try {
    const { vendor_id, months = 3, limit = 50, skip = 0 } = options;
    
    const params = {};
    const body = {};
    
    if (months !== undefined) {
      params.months = months;
      body.months = months;
    }
    if (limit !== undefined) {
      params.limit = limit;
      body.limit = limit;
    }
    if (skip !== undefined) {
      params.skip = skip;
      body.skip = skip;
    }
    if (vendor_id !== undefined) {
      body.vendor_id = vendor_id;
    }
    
    // Add download_csv parameter to request CSV URL
    params.download_csv = true;
    body.download_csv = true;
    
    // First, get the JSON response with csv_url
    const response = await apiClient.post('/products/nearly-expired', body, {
      params: Object.keys(params).length > 0 ? params : undefined
    });
    
    // Extract csv_url from response
    const csvUrl = response.data?.data?.csv_url;
    
    if (!csvUrl) {
      return { 
        success: false, 
        error: 'No nearly expired products found. Please try again later.',
        message: 'No nearly expired products found. Please try again later.'
      };
    }
    
    // Download CSV from the URL
    return await downloadCSVFromURL(csvUrl, 'nearly-expired-products.csv');
  } catch (error) {
    console.error('Error downloading nearly expired products CSV:', error);
    return { 
      success: false, 
      error: error.response?.data?.message || 'Unable to download CSV file. Please check your connection and try again.',
      message: error.response?.data?.message || 'Unable to download CSV file. Please check your connection and try again.'
    };
  }
};

// Download recalled products as CSV
export const downloadRecalledProductsCSV = async (options = {}) => {
  try {
    const { vendor_id } = options;
    
    const params = {};
    const body = {};
    
    if (vendor_id !== undefined) {
      params.vendor_id = vendor_id;
      body.vendor_id = vendor_id;
    }
    
    // Add download_csv parameter to request CSV URL
    params.download_csv = true;
    body.download_csv = true;
    
    // First, get the JSON response with csv_url
    const response = await apiClient.post('/products/recalled', body, {
      params: Object.keys(params).length > 0 ? params : undefined
    });
    
    // Extract csv_url from response
    const csvUrl = response.data?.data?.csv_url;
    
    if (!csvUrl) {
      return { 
        success: false, 
        error: 'Unable to generate CSV file. No recalled products found or the file could not be created. Please try again later.',
        message: 'Unable to generate CSV file. No recalled products found or the file could not be created. Please try again later.'
      };
    }
    
    // Download CSV from the URL
    return await downloadCSVFromURL(csvUrl, 'recalled-products.csv');
  } catch (error) {
    console.error('Error downloading recalled products CSV:', error);
    return { 
      success: false, 
      error: error.response?.data?.message || 'Unable to download CSV file. Please check your connection and try again.',
      message: error.response?.data?.message || 'Unable to download CSV file. Please check your connection and try again.'
    };
  }
};

// Download high quality products as CSV
export const downloadHighQualityProductsCSV = async (options = {}) => {
  try {
    const { min_quality = 3.0, vendor_id, limit } = options;
    
    const body = {
      min_quality,
      download_csv: true
    };
    
    if (vendor_id !== undefined) {
      body.vendor_id = vendor_id;
    }
    if (limit !== undefined) {
      body.limit = limit;
    }
    
    // First, get the JSON response with csv_url
    const response = await apiClient.post('/products/high-quality', body);
    
    // Extract csv_url from response
    const csvUrl = response.data?.data?.csv_url;
    
    if (!csvUrl) {
      return { 
        success: false, 
        error: 'No high quality products found. Please try again later.',
        message: 'No high quality products found. Please try again later.'
      };
    }
    
    // Download CSV from the URL
    return await downloadCSVFromURL(csvUrl, 'high-quality-products.csv');
  } catch (error) {
    console.error('Error downloading high quality products CSV:', error);
    return { 
      success: false, 
      error: error.response?.data?.message || 'Unable to download CSV file. Please check your connection and try again.',
      message: error.response?.data?.message || 'Unable to download CSV file. Please check your connection and try again.'
    };
  }
};