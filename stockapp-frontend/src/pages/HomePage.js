import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const HomePage = () => {
  const { currentUser } = useAuth();

  return (
    <div className="text-center mt-20">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
        Welcome to the Fullstack Authentication App!
      </h1>
      <p className="text-lg text-gray-600 mb-8">
        Securely manage users with role-based access control.
      </p>
      {!currentUser ? (
        <div className="space-x-4">
          <Link
            to="/login"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition duration-300 ease-in-out"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-lg text-lg transition duration-300 ease-in-out"
          >
            Sign Up
          </Link>
        </div>
      ) : (
        <p className="text-lg text-gray-700">
          You are logged in. Go to your <Link to="/dashboard" className="text-indigo-600 hover:underline">Dashboard</Link>.
        </p>
      )}
    </div>
  );
};

export default HomePage;