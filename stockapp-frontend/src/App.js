import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { ToastProvider } from './components/ui';
import HomePage from './pages/HomePage';
import SalesEntryPage from './pages/SalesEntryPage';
import SalesHistoryPage from './pages/SalesHistoryPage';
import CreditBillsPage from './pages/CreditBillsPage';
import ChequeTrackerPage from './pages/ChequeTrackerPage';
import CustomersPage from './pages/CustomersPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import ItemDetailPage from './pages/ItemDetailPage';
import RestockPage from './pages/RestockPage';
import BillPhotosPage from './pages/BillPhotosPage';
import OrderForecastPage from './pages/OrderForecastPage';
import InventoryPage from './pages/InventoryPage';
import StockTransferPage from './pages/StockTransferPage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <Router>
      <ToastProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/photos" element={<BillPhotosPage />} />
            <Route path="/sales/new" element={<SalesEntryPage />} />
            <Route path="/sales" element={<SalesHistoryPage />} />
            <Route path="/credit" element={<CreditBillsPage />} />
            <Route path="/cheques" element={<ChequeTrackerPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/:customerId" element={<CustomerDetailPage />} />
            <Route path="/stock" element={<InventoryPage />} />
            <Route path="/stock/items/:name" element={<ItemDetailPage />} />
            <Route path="/stock/forecast" element={<OrderForecastPage />} />
            <Route path="/stock/receive" element={<RestockPage />} />
            <Route path="/stock/transfer" element={<StockTransferPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Layout>
      </ToastProvider>
    </Router>
  );
}

export default App;
