import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Toaster } from "@/components/ui/sonner"
import { SocketProvider } from "@/context/SocketContext"
ReactDOM.createRoot(document.getElementById('root')).render(
  //<React.StrictMode>
  <SocketProvider>
    <App />
    <Toaster closeButton />
  
  </SocketProvider>
  //</React.StrictMode>,
)
