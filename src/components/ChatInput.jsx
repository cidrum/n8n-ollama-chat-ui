import { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { validateFile, formatFileSize, getNearlyExpiredProductsReport, getRecalledProductsReport, getHighQualityProductsReport, downloadBlob, getNearlyExpiredProductsCSVUrl, getRecalledProductsCSVUrl, getHighQualityProductsCSVUrl, getNearlyExpiredProducts, getRecalledProducts, getHighQualityProducts } from '../api/n8nService';
import UploadIcon from './icons/UploadIcon';

function ChatInput({ onSend, disabled }) {
  const { user } = useSelector(state => state.auth);
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [loadingAction, setLoadingAction] = useState(null); // Track which button is loading: 'nearly-expired', 'recalled', 'high-quality', or null
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Detect Android
    const userAgent = navigator.userAgent.toLowerCase();
    const isAndroid = userAgent.indexOf("android") > -1;
    setIsAndroid(isAndroid);
  }, []);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  const handleSend = () => {
    if (input.trim() || file) {
      onSend(input, file);
      setInput("");
      setFile(null);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      try {
        const validation = validateFile(selectedFile);
        if (validation.valid) {
          setFile(selectedFile);
          
          if (!validation.openaiSupported) {
            // Show warning for unsupported files
            alert("Note: This file type is supported for upload but not for AI processing. The assistant may not be able to read its contents.");
          }
        }
      } catch (error) {
        alert(error.message);
        e.target.value = ''; // Reset file input
      }
    }
  };

  const _handleDownload = async (action) => {
    if (disabled || isDownloading) return;
    setIsDownloading(true);
    try {
      let res;
      if (action === 'nearly-expired') {
        res = await getNearlyExpiredProductsReport(3);
      } else if (action === 'recalled') {
        res = await getRecalledProductsReport();
      } else if (action === 'high-quality') {
        res = await getHighQualityProductsReport(2.0);
      }
        if (res?.success) {
        downloadBlob(res.blob, res.filename);
      } else {
        alert('Failed to generate report.');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadCSV = async (action) => {
    if (disabled || loadingAction || !user?.id) {
      if (!user?.id) {
        alert('Please log in to download products.');
      }
      return;
    }
    
    // Map actions to chat messages
    const actionMessages = {
      'nearly-expired': 'Could you please show nearly expired products?',
      'recalled': 'Could you please show recalled products?',
      'high-quality': 'Could you please show high-quality products?'
    };
    
    setLoadingAction(action); // Set the specific action as loading
    try {
      let csvResult;
      let dataResult;
      
      // Get both data and CSV URL
      if (action === 'nearly-expired') {
        csvResult = await getNearlyExpiredProductsCSVUrl({ vendor_id: user.id });
        dataResult = await getNearlyExpiredProducts({ vendor_id: user.id });
      } else if (action === 'recalled') {
        csvResult = await getRecalledProductsCSVUrl({ vendor_id: user.id });
        dataResult = await getRecalledProducts({ vendor_id: user.id });
      } else if (action === 'high-quality') {
        csvResult = await getHighQualityProductsCSVUrl({ min_quality: 3.0, vendor_id: user.id });
        dataResult = await getHighQualityProducts({ min_quality: 3.0, vendor_id: user.id });
      }
      
      if (!csvResult?.success) {
        alert(csvResult?.message || csvResult?.error || 'Unable to generate CSV file. Please try again.');
        return;
      }
      
      // Send message to chat with CSV URL and data as metadata
      const message = actionMessages[action];
      if (message && onSend) {
        // Pass the CSV URL, filename, and data as metadata
        // Use data.data from the API response (response.data.data)
        const productsData = dataResult?.success && dataResult?.data?.data ? dataResult.data.data : null;
        onSend(message, null, {
          csv_url: csvResult.csv_url,
          csv_filename: csvResult.filename,
          action: action,
          products_data: productsData
        });
      }
    } catch (error) {
      console.error('Error getting CSV URL:', error);
      alert('An error occurred while generating the CSV file. Please try again.');
    } finally {
      setLoadingAction(null); // Clear loading state
    }
  };

  return (
    <div className={`flex flex-col gap-3 p-4 bg-background border-t border-section ${isAndroid ? 'android-chat-input' : ''}`}>
      {file && (
        <div className="flex items-center gap-2 p-2 bg-secondary/20 rounded-lg">
          <span className="text-sm truncate">
            {file.name} ({formatFileSize(file.size)})
          </span>
          <button
            onClick={() => setFile(null)}
            className="p-1 hover:bg-secondary/40 rounded-full"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
      
      <div className="flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 hover:bg-secondary/20 rounded-lg cursor-pointer"
          disabled={disabled}
        >
          <UploadIcon />
        </button>

        <textarea
          ref={textareaRef}
          rows="1"
          className="flex-1 resize-none rounded-2xl px-4 py-3 bg-white 
           text-black placeholder-gray-400 focus:outline-none focus:ring-2 
            focus:ring-primary text-sm sm:text-base min-h-[44px] max-h-[150px]
            disabled:opacity-50"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          disabled={disabled}
        />
        
        <button
          onClick={handleSend}
          className="bg-primary hover:bg-primary/80 text-white px-6 py-3 
            rounded-full text-sm sm:text-base transition-colors min-h-[44px]
            disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          disabled={(!input.trim() && !file) || disabled}
        >
          {isDownloading ? 'Working…' : 'Send'}
        </button>
      </div>
      {/* Quick action report buttons */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 mr-2 flex-none overflow-x-auto">
            <button
              onClick={() => handleDownloadCSV('nearly-expired')}
              className="h-10 px-3 rounded-full bg-primary hover:bg-primary/80 text-sm whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={disabled || loadingAction === 'nearly-expired'}
            >
              {loadingAction === 'nearly-expired' ? 'Loading...' : 'Nearly Expired Products'}
            </button>
            <button
              onClick={() => handleDownloadCSV('recalled')}
              className="h-10 px-3 rounded-full bg-primary hover:bg-primary/80 text-sm whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={disabled || loadingAction === 'recalled'}
            >
              {loadingAction === 'recalled' ? 'Loading...' : 'Recalled Products'}
            </button>
            <button
              onClick={() => handleDownloadCSV('high-quality')}
              className="h-10 px-3 rounded-full bg-primary hover:bg-primary/80 text-sm whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={disabled || loadingAction === 'high-quality'}
            >
              {loadingAction === 'high-quality' ? 'Loading...' : 'High Quality Products'}
            </button>
          </div>
        </div>
    </div>
  );
}

export default ChatInput;