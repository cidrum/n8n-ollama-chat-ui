import { useState, useEffect } from 'react';
import ToggleIcon from './icons/ToggleIcon';
import NewChatIcon from './icons/NewChatIcon';

function Sidebar({ conversations, onSelectConversation, onNewChat, onDeleteConversation, isOpen, onToggle, currentConversation }) {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && !isDesktop && (
        <div 
          className="fixed inset-0 bg-black/60 z-20"
          onClick={() => onToggle(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-full bg-[#202021] w-[260px] flex flex-col
        transform transition-transform duration-300 ease-in-out z-30 
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        {/* Header */}
        <div className="flex items-center justify-between py-4 px-2 border-b border-white/20">
          {!isDesktop && (
            <button
              onClick={() => onToggle(false)}
              className="p-2 hover:bg-white/10 rounded-lg ml-2 transition-colors"
            >
              <ToggleIcon />
            </button>
          )}
          <button
            onClick={onNewChat}
            className="hover:bg-white/10 cursor-pointer p-2 rounded-lg text-white flex items-center justify-center transition-colors"
          >
            <NewChatIcon />
          </button>
          
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto space-y-2 p-2">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => onSelectConversation(conv)}
              className={`flex items-center cursor-pointer justify-between w-full p-3 rounded-lg hover:bg-white/10 text-white transition-colors ${currentConversation?.id == conv.id ? 'bg-white/10' : ''}`}
            >
              <button
                className="text-left truncate flex-1 cursor-pointer"
              >
                {conv.title || 'New Conversation'}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('Are you sure you want to delete this conversation?')) {
                    onDeleteConversation(conv.id);
                  }
                }}
                className="p-1 hover:bg-white/20 rounded-full ml-2 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Toggle button */}
      {!isOpen && (
        <button
          onClick={() => onToggle(true)}
          className="fixed top-4 left-4 p-2 hover:bg-white/10 rounded-lg z-30 transition-colors"
        >
          <ToggleIcon />
        </button>
      )}
    </>
  );
}

export default Sidebar;
