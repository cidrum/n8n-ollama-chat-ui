import ReactMarkdown from 'react-markdown';
import SyntaxHighlighter from 'react-syntax-highlighter';
import remarkGfm from 'remark-gfm';
import { useState, useEffect } from 'react';
import { getFileContent, getFileInfo } from '../api/chatService';
import { useDispatch, useSelector } from 'react-redux';
import { downloadAssistantFile } from '../store/slices/chatSlice';
import ExcelJS from 'exceljs';

function MessageBubble({ message }) {

  const dispatch = useDispatch();
  const { currentConversation } = useSelector(state => state.chat);
  const [fileUrls, setFileUrls] = useState({});
  const [loading, setLoading] = useState(false);
  const [contentFile, setContentFile] = useState(false);

  // Add this function to handle file downloads
  const handleFileDownload = (fileId) => {
    if (currentConversation?.thread_id) {
      dispatch(downloadAssistantFile(currentConversation.thread_id, fileId));
    }
  };

  useEffect(() => {
    const loadFileAttachments = async () => {
      if (message.file?.attachments && message.file.attachments.length > 0) {
        setLoading(true);
        const urls = {};
        
        for (const attachment of message.file.attachments) {
          try {
            // Get file info to get the filename
            const fileInfo = await getFileInfo(attachment.file_id);
            
            // Get file content
            const fileContent = await getFileContent(attachment.file_id);
            
            // Convert to blob and create URL
            const blob = await fileContent.blob();
            const url = URL.createObjectURL(blob);
            
            urls[attachment.file_id] = {
              url,
              filename: fileInfo.filename || `file-${attachment.file_id.substring(0, 8)}`
            };
          } catch (error) {
            console.error("Error loading file:", error);
          }
        }
        
        setFileUrls(urls);
        setLoading(false);
      }
    };
    
    loadFileAttachments();
    
    // Cleanup URLs on unmount
    return () => {
      Object.values(fileUrls).forEach(file => URL.revokeObjectURL(file.url));
    };
  }, [message.file?.attachments]);

  const isUser = message.sender === "user";

  // In your render function, add UI for file attachments
  const renderAttachments = () => {
    if (!message.attachments || message.attachments.length === 0) return null;
    
    return (
      <div className="mt-2 space-y-2">
        {message.attachments.map((attachment) => (
          <div key={attachment.file_id} className="flex justify-end items-center gap-2 p-2 bg-secondary/10 rounded-lg">
            <span className="text-sm">{fileUrls[attachment.file_id]?.filename || 'Generated file'}</span>
            <button
              onClick={() => handleFileDownload(attachment.file_id)}
              className="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary/80"
            >
              Download
            </button>
          </div>
        ))}
      </div>
    );
  };

  const handleExcelDownload = (data) => {
    try {
      // Create workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Results');
      
      // Add headers if data has any
      if (data.length > 0) {
        worksheet.columns = Object.keys(data[0]).map(key => ({ header: key, key }));
      }
      
      // Add rows
      worksheet.addRows(data);
      
      // Generate and download file
      workbook.xlsx.writeBuffer().then(buffer => {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `download-full-report-${new Date().toISOString().slice(0,10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    } catch (error) {
      console.error("Error generating Excel file:", error);
    }
  };

  const filterFileName = (text) => {

    const links = [...text.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map(match => ({
      name: match[1],
      url: match[2]
    }));

    return links;
  };

  const getFilenameFromUrl = (url) => {
    const match = url.match(/\/mnt\/data\/(.+)$/);
    return match ? `/mnt/data/${match[1]}` : null;
  };

  return (
    <div className={`message-bubble flex ${isUser ? "justify-end" : "justify-start chat-content"} mb-4`}>
      <div 
        className={`max-w-[85%] sm:max-w-[75%] flex flex-col p-4 rounded-2xl break-words shadow-md
          ${isUser 
            ? "bg-primary text-white rounded-br-none" 
            : "bg-secondary text-white rounded-bl-none"
          }
          text-sm sm:text-base`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{message.text}</div>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({node, inline, className, children, ...props}) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <SyntaxHighlighter
                    language={match[1]}
                    className="overflow-x-auto rounded-lg my-2 overflow-auto break-words"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className="bg-gray-800 overflow-x-auto px-1 py-0.5 rounded-lg break-words" {...props}>
                    {children}
                  </code>
                );
              },
              a({node, children, href, ...props}) {
                
                let links = filterFileName(message?.text)

                let filteredUrls = [];
                if (links.length > 0) {
                    filteredUrls = links.map(link => {
                    const filename = getFilenameFromUrl(link.url);

                    const fileMeta = Object.values(fileUrls).find(file =>
                      file.filename === filename
                    );
                    link.download = link.url;
                    link.url = link.url.replace("sandbox:/mnt/data/", '');

                    return {
                      ...link,
                      blobUrl: fileMeta?.url || null
                    };
                  });
                }
                if (filteredUrls.length > 0) {
                  for (const url of filteredUrls) {
                    if (children.includes(url.url)) {
                      setContentFile(true);
                      return (
                        <a href={url.blobUrl} download={url.download} className="hover:text-blue-200 transition-colors aaa">
                          {url.name}
                        </a>
                      );
                    }
                  }
                }
                
                // Check if this is a CSV download link (from message.file.csv_url)
                if (message?.file?.csv_url && href === message.file.csv_url) {
                  const filename = message.file.csv_filename || 'report.csv';
                  return (
                    <a 
                      href={href} 
                      download={filename}
                      target="_blank"
                      className="hover:text-blue-200 transition-colors underline"
                      onClick={async (e) => {
                        // Force download by fetching and creating blob
                        e.preventDefault();
                        try {
                          const response = await fetch(href);
                          if (!response.ok) throw new Error('Failed to fetch file');
                          const blob = await response.blob();
                          const url = window.URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = filename;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          window.URL.revokeObjectURL(url);
                        } catch (error) {
                          console.error('Error downloading file:', error);
                          // Fallback: open in new tab
                          window.open(href, '_blank');
                        }
                      }}
                    >
                      {children}
                    </a>
                  );
                }
                
                // Default: open in new tab
                return (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-blue-200 transition-colors">
                    {children}
                  </a>
                );
              },
              table({node, ...props}) {
                return (
                  <div className="overflow-x-auto w-full my-4 border grid border-gray-700/30 rounded-lg">
                    <table className="min-w-full border-collapse text-sm" {...props} />
                  </div>
                );
              },
              thead({node, ...props}) {
                return <thead className="bg-gray-800/50" {...props} />;
              },
              tbody({node, ...props}) {
                return <tbody className="divide-y divide-gray-700/30" {...props} />;
              },
              tr({node, ...props}) {
                return <tr className="hover:bg-gray-800/30" {...props} />;
              },
              th({node, ...props}) {
                return <th className="px-4 py-3 text-left font-medium border-b border-gray-700/30 break-words max-w-[12rem] sm:max-w-none" {...props} />;
              },
              td({node, ...props}) {
                return <td className="px-4 py-3 border-gray-700/30 break-words max-w-[12rem] sm:max-w-none" {...props} />;
              },
              p({node, ...props}) {
                return <p className="mb-2" {...props} />;
              }
            }}
          >
            {message.text}
          </ReactMarkdown>
        )}
        
        {/* File attachments section */}
        { !contentFile && (message.file || Object.keys(fileUrls).length > 0) && (
          <div className={`${message.text ? "mt-3 pt-2 border-t border-white/20" : ""} break-words`}>
            {/* User uploaded file */}
            {message.file?.name && (
              <a href={message.file.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-200 transition-colors">
                {message.file.name}
              </a>
            )}
            
            {/* Assistant generated files */}
            {message.file?.attachments && (
              <div className="mt-2">
                {loading ? (
                  <div className="text-sm text-gray-400">Loading attachments...</div>
                ) : (
                  <div className="flex justify-end gap-2 download-files">
                    {message.file.attachments.map(attachment => {
                      const fileData = fileUrls[attachment.file_id];
                      console.log(fileUrls);
                      return fileData ? (
                        <a 
                          key={attachment.file_id}
                          href={fileData.url} 
                          download={fileData.filename}
                          className="text-sm hover:text-blue-200 transition-colors flex items-center gap-1 wrap-anywhere cursor-pointer"
                        >
                          {fileData.filename}
                        </a>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            )}
            
            {/* Show CSV download link if available */}
            {message.file?.csv_url && (
              <div className="mt-2">
                <a 
                  href={message.file.csv_url}
                  download={message.file.csv_filename || 'report.csv'}
                  target="_blank"
                  className="text-sm hover:text-blue-200 transition-colors flex items-center gap-1 wrap-anywhere cursor-pointer underline"
                  onClick={async (e) => {
                    // Force download by fetching and creating blob
                    e.preventDefault();
                    try {
                      const response = await fetch(message.file.csv_url);
                      if (!response.ok) throw new Error('Failed to fetch file');
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = message.file.csv_filename || 'report.csv';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(url);
                    } catch (error) {
                      console.error('Error downloading file:', error);
                      // Fallback: open in new tab
                      window.open(message.file.csv_url, '_blank');
                    }
                  }}
                >
                  📥 {message.file.csv_filename || 'Download CSV Report'}
                </a>
              </div>
            )}
            
            {/* Show attachment count if no specific files are loaded yet */}
            {!contentFile && !loading && Object.keys(fileUrls).length === 0 && message.file?.attachments && (
              <div className="text-sm text-gray-400">
                {message.file.attachments.length === 1 ? 
                  "1 file attachment" : 
                  `${message.file.attachments.length} file attachments`}
              </div>
            )}
          </div>
        )}
        {renderAttachments()}
        {message?.function_results?.length > 0 && (
          <div className="mt-2">
              <div className="flex justify-end gap-2 download-files">
                    <a 
                      onClick={() => handleExcelDownload(message?.function_results)}
                      className="text-sm hover:text-blue-200 transition-colors flex items-center gap-1 wrap-anywhere cursor-pointer"
                    >
                      Download full report
                    </a>
              </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MessageBubble;
