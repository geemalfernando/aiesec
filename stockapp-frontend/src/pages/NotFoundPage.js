import React from 'react';
import { Link } from 'react-router-dom';
import { buttonClass, EmptyState } from '../components/ui';

const NotFoundPage = () => (
  <EmptyState title="Page not found">
    <p className="mb-4">This page does not exist.</p>
    <Link to="/" className={buttonClass()}>Go to Home</Link>
  </EmptyState>
);

export default NotFoundPage;
