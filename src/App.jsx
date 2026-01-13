import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from "react-router-dom";
import ChatWindow from "./components/ChatWindow";
import ChatInput from "./components/ChatInput";
import Login from "./components/Login";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import { 
  sendMessage, 
  resetChat, 
  setCurrentConversation, 
  fetchConversations, 
  loadConversation,
  deleteConversation 
} from "./store/slices/chatSlice";
import { loginUser, logout } from "./store/slices/authSlice";
import { toggleSidebar } from "./store/slices/uiSlice";

// Conversation component that loads specific conversation
function ConversationRoute() {
  const { conversationId } = useParams();
  const dispatch = useDispatch();
  const { conversations, loading } = useSelector(state => state.chat);
  const { user } = useSelector(state => state.auth);
  const navigate = useNavigate();
  
  useEffect(() => {
    if (conversationId && conversations.length > 0) {
      const conversation = conversations.find(c => c.id === conversationId);
      if (conversation) {
        dispatch(setCurrentConversation(conversation));
        dispatch(loadConversation(conversationId));
      } else {
        // If conversation not found, redirect to home
        navigate("/");
      }
    }
  }, [conversationId, conversations, dispatch, navigate]);

  return <ChatApp />;
}

// Main chat application UI
function ChatApp() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useSelector(state => state.auth);
  const { messages, conversations, currentConversation, loading } = useSelector(state => state.chat);
  const { isSidebarOpen } = useSelector(state => state.ui);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        dispatch(toggleSidebar(true));
      } else {
        dispatch(toggleSidebar(false));
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [dispatch]);

  const handleSend = async (text, file, metadata) => {
    if (!user?.email) {
      console.error('Cannot send message: user not authenticated', { user });
      return;
    }
    
    try {
      await dispatch(sendMessage(text, file, user, metadata));
      
      // If this is a new conversation, update URL once we have the conversation ID
      if (currentConversation && !window.location.pathname.includes(currentConversation.id)) {
        navigate(`/${currentConversation.id}`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      if (error.response?.status === 401 || error.message?.includes('not authenticated')) {
        handleLogout();
      }
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchConversations(user));
    }
  }, [isAuthenticated, dispatch, user]);

  const handleLogout = () => {
    dispatch(logout());
    dispatch(resetChat());
    navigate("/");
  };

  const handleNewChat = () => {
    dispatch(setCurrentConversation(null));
    dispatch(resetChat());
    if (window.innerWidth < 1024) {
      dispatch(toggleSidebar(false));
    }
    navigate("/");
  };

  const handleSelectConversation = (conversation) => {
    dispatch(setCurrentConversation(conversation));
    dispatch(loadConversation(conversation.id));
    if (window.innerWidth < 1024) {
      dispatch(toggleSidebar(false));
    }
    // Navigate to the conversation URL
    navigate(`/${conversation.id}`);
  };

  const handleDeleteConversation = (conversationId) => {
    dispatch(deleteConversation(conversationId, user));
    // If we're deleting the current conversation, go back to home
    if (currentConversation && currentConversation.id === conversationId) {
      navigate("/");
    }
  };

  return (
    <div className="flex h-screen bg-background text-white">
      <Sidebar 
        conversations={conversations}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        isOpen={isSidebarOpen}
        onToggle={(value) => dispatch(toggleSidebar(value))}
        currentConversation={currentConversation}
      />
      
      <div className="flex-1 flex flex-col h-full w-full">
        <Header 
          onLogout={handleLogout}
          onMenuClick={() => dispatch(toggleSidebar(true))}
          showMenuButton={!isSidebarOpen}
        />
        <div className="flex-1 flex flex-col overflow-auto w-full">
          <ChatWindow 
            messages={messages} 
            isLoading={loading} 
            conversation={currentConversation}
          />
          <ChatInput 
            onSend={handleSend} 
            disabled={loading} 
          />
        </div>
      </div>
    </div>
  );
}

function App() {
  const { isAuthenticated, user } = useSelector(state => state.auth);

  useEffect(() => {
    const reactOrigin = window.location.origin; // E.g., https://ai.surgbay.com or http://127.0.0.1:3000
    const parentOrigin = window.location.hostname === "127.0.0.1" ? "http://127.0.0.1:8000" : "https://rl3.surgbay.com"; // Adjust for parent

    // Send ready message to parent (iframe) or opener (new window)
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ ready: true }, parentOrigin);
    }
    if (window.opener) {
      window.opener.postMessage({ ready: true }, parentOrigin);
    }

    const handleMessage = (event) => {
      if (event.origin !== parentOrigin) {
        return;
      }
      if (event.data?.token) {
        localStorage.setItem("jwt", event.data.token);
        localStorage.setItem("user", event.data.user);
        const eventData = JSON.parse(event.data.user);
        if (!isAuthenticated || user.displayName !== eventData.displayName) {
          window.location.reload();
        }
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);
  
  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChatApp />} />
        <Route path="/:conversationId" element={<ConversationRoute />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;