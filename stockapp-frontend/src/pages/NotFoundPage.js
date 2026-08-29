import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage = () => {
  return (
    <div className="text-center mt-20">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
        404 - Not Found
      </h1>
      <p className="text-lg text-gray-700 mb-6">
        The page you are looking for does not exist.
      </p>
      <Link
        to="/"
        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition duration-300 ease-in-out"
      >
        Go to Homepage
      </Link>
    </div>
  );
};

export default NotFoundPage;