import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// เราใช้ Style inline ใน App.jsx แล้ว เลยไม่ต้อง import css ที่นี่ก็ได้
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)