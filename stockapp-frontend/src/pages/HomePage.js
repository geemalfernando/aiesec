import React, { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const HomePage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const fileInput = useRef(null);

  const handleBillChosen = (e) => {
    const file = e.target.files[0];
    if (file) navigate('/admin/sales-entry', { state: { billFile: file } });
  };

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
        <>
          {currentUser.role === 'admin' && (
            <section className="card mx-auto my-4" style={{ maxWidth: 560 }} aria-label="Enter a bill">
              <div className="card-body">
                <h2 className="h4 card-title">Enter a bill</h2>
                <p className="card-text text-muted">
                  Add a photo and the details fill in for you to check, or type everything yourself.
                </p>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  className="d-none"
                  aria-label="Bill image"
                  onChange={handleBillChosen}
                />
                <div className="d-flex flex-wrap justify-content-center gap-2">
                  <button type="button" className="btn btn-primary" onClick={() => fileInput.current.click()}>
                    Add bill image
                  </button>
                  <Link to="/admin/sales-entry" className="btn btn-outline-secondary">Enter manually</Link>
                </div>
              </div>
            </section>
          )}
          <p className="text-lg text-gray-700">
            You are logged in. Go to your <Link to="/dashboard" className="text-indigo-600 hover:underline">Dashboard</Link>.
          </p>
        </>
      )}
    </div>
  );
};

export default HomePage;
