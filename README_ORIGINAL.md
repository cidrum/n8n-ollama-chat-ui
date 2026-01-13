# Chat UI

This application provides a seamless conversational experience with AI, complete with file handling, SQL query execution, and data visualization capabilities.

## Features

- **AI-Powered Chat**: Integrates with OpenAI's Assistant API for intelligent responses
- **Authentication**: User authentication via WooCommerce
- **Persistent Storage**: Conversations and messages stored in Supabase
- **File Handling**: Upload and process files within conversations
- **SQL Query Execution**: Run SQL queries against WooCommerce database
- **Data Visualization**: Generate charts and reports from data
- **Responsive Design**: Works on desktop and mobile devices
- **Markdown Support**: Rich text formatting with code syntax highlighting

## Tech Stack

- **Frontend**: React 19, Redux Toolkit, TailwindCSS
- **Build Tool**: Vite 6
- **APIs**: OpenAI, Supabase, n8n (for SQL queries)
- **Authentication**: JWT via WooCommerce
- **Data Visualization**: ExcelJS for report generation

## Project Structure

### Core Components

- `src/App.jsx`: Main application component with routing and layout
- `src/components/ChatWindow.jsx`: Displays conversation messages
- `src/components/ChatInput.jsx`: Handles user input and file uploads
- `src/components/MessageBubble.jsx`: Renders individual messages with markdown support
- `src/components/Sidebar.jsx`: Navigation sidebar with conversation history
- `src/components/Login.jsx`: Authentication interface
- `src/components/Header.jsx`: Application header with controls

### API Services

- `src/api/openaiService.js`: OpenAI integration for assistant functionality
- `src/api/supabaseService.js`: Supabase integration for data persistence
- `src/api/n8nService.js`: n8n webhook integration for SQL queries
- `src/api/authService.js`: Authentication service
- `src/api/assistantInstructions.js`: Instructions for the OpenAI assistant

### State Management

- `src/store/index.js`: Redux store configuration
- `src/store/slices/chatSlice.js`: Chat state management
- `src/store/slices/authSlice.js`: Authentication state
- `src/store/slices/uiSlice.js`: UI state (sidebar visibility, etc.)

### Configuration

- `vite.config.js`: Vite build configuration
- `eslint.config.js`: ESLint rules
- `tailwind.config.js`: TailwindCSS customization

### Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
