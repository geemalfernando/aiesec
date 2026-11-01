import React from 'react';
import ReactDOM from 'react-dom/client'; // For React 18+
import './index.css'; // Assuming you might have some global styles
import App from './App';

// Find the DOM element with the ID 'root'
const container = document.getElementById('root');

// Create a React root attached to that DOM element
const root = ReactDOM.createRoot(container);

// Render the application
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);