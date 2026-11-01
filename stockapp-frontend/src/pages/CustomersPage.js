import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { addCustomer, deleteCustomer, updateCustomer } from '../api/customers';
import { fetchCustomerSummaries } from '../api/reports';
import { RankBars } from '../components/charts';
import { Alert, Badge, Button, Card, EmptyState, Input, Modal, PageHeader, PageLoading, Stat, Table, Td, Th, useToast } from '../components/ui';
import CustomerForm from '../components/sales/CustomerForm';
import { apiError, formatDay, money } from '../utils/format';

const CustomersPage = () => {
  const toast = useToast();
  const [customers, setCustomers] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // {} adds a new customer
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const load = useCallback(async () => {
    try {
      setCustomers(await fetchCustomerSummaries());
    } catch (err) {
      setError(apiError(err, 'Could not load customers.'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (values) => {
    if (editing._id) await updateCustomer(editing._id, values);
    else await addCustomer(values);
    setEditing(null);
    toast('Customer saved.');
    load();
  };

  const confirmDelete = async () => {
    setDeleteError('');
    try {
      await deleteCustomer(deleting._id);
      setDeleting(null);
      toast('Customer deleted.');
      load();
    } catch (err) {
      setDeleteError(apiError(err, 'Could not delete this customer.'));
    }
  };

  const addButton = <Button onClick={() => setEditing({})}><Plus className="h-4 w-4" aria-hidden="true" /> Add customer</Button>;
  if (!customers) return <><PageHeader title="Customers" action={addButton} />{error ? <Alert>{error}</Alert> : <PageLoading />}</>;

  const shown = customers.filter((c) => `${c.name} ${c.phone || ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const unset = customers.filter((c) => !c.customerType).length;

  return (
    <>
      <PageHeader title="Customers" subtitle={`${customers.length} in total`} action={addButton} />
      <div className="mb-6 grid gap-3 lg:grid-cols-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
          <Stat label="Total sales" value={money(customers.reduce((sum, c) => sum + c.totalSales, 0))} />
          <Stat label="Customers owe" value={money(customers.reduce((sum, c) => sum + c.owed, 0))} note={`${customers.filter((c) => c.owed > 0).length} with open bills`} />
          <Stat label="Bought something" value={customers.filter((c) => c.bills > 0).length} note={`of ${customers.length} customers`} />
          <Stat label="No bills yet" value={customers.filter((c) => c.bills === 0).length} />
        </div>
        <Card title="Top customers">
          {customers.some((c) => c.totalSales > 0) ? <RankBars rows={[...customers].filter((c) => c.totalSales > 0).sort((a, b) => b.totalSales - a.totalSales).slice(0, 5).map((c) => ({ key: c._id, label: c.name, value: c.totalSales }))} format={money} /> : <p className="text-sm text-slate-500">No sales yet.</p>}
        </Card>
      </div>
      {unset > 0 && <Alert tone="warning" className="mb-4">{unset} customer{unset === 1 ? ' has' : 's have'} no type set. Edit them to choose how they usually pay.</Alert>}
      <div className="relative mb-3 sm:max-w-xs">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
        <Input className="pl-9" placeholder="Search name or phone" aria-label="Search customers" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <Card flush>
        {shown.length === 0 ? (
          <EmptyState icon={Users} title={customers.length ? 'No customers match' : 'No customers yet'} />
        ) : (
          <Table>
            <thead><tr><Th>Name</Th><Th>Usually pays</Th><Th>Last bill</Th><Th align="right">Total bought</Th><Th align="right">Owes</Th><Th align="right"><span className="sr-only">Actions</span></Th></tr></thead>
            <tbody>
              {shown.map((customer) => (
                <tr key={customer._id} className="hover:bg-slate-50">
                  <Td><Link to={`/customers/${customer._id}`} className="font-medium text-brand-700 hover:underline">{customer.name}</Link>{customer.phone && <div className="text-xs text-slate-500">{customer.phone}</div>}</Td>
                  <Td>{customer.customerType ? <Badge tone={customer.customerType === 'credit' ? 'info' : 'neutral'}>{customer.customerType === 'credit' ? 'Credit' : 'Cash'}</Badge> : <Badge tone="warning">Not set</Badge>}</Td>
                  <Td className="whitespace-nowrap text-slate-600">{customer.lastSale ? formatDay(customer.lastSale) : '-'}</Td>
                  <Td align="right" className="whitespace-nowrap">{money(customer.totalSales)}</Td>
                  <Td align="right" className={`whitespace-nowrap font-medium ${customer.owed > 0 ? 'text-red-700' : ''}`}>{customer.owed > 0 ? money(customer.owed) : '-'}</Td>
                  <Td align="right" className="whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(customer)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setDeleteError(''); setDeleting(customer); }}>Delete</Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {editing && <Modal title={editing._id ? `Edit ${editing.name}` : 'Add customer'} onClose={() => setEditing(null)}><CustomerForm customer={editing} onSave={save} onCancel={() => setEditing(null)} /></Modal>}
      {deleting && (
        <Modal title={`Delete ${deleting.name}?`} onClose={() => setDeleting(null)} footer={<><Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" onClick={confirmDelete}>Delete</Button></>}>
          {deleteError ? <Alert>{deleteError}</Alert> : <p className="text-sm text-slate-600">This cannot be undone. A customer with open bills or cheques cannot be deleted.</p>}
        </Modal>
      )}
    </>
  );
};

export default CustomersPage;
