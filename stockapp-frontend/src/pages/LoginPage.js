import React from 'react';
import Login from '../components/Auth/Login'; // Import the Login component

const LoginPage = () => {
  return (
    <div>
      {/* You could add more page-specific elements here if needed,
          but for now, it just renders the Login component. */}
      <Login />
    </div>
  );
};

export default LoginPage;