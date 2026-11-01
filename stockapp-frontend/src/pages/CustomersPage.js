import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Users } from 'lucide-react';
import { addCustomer, deleteCustomer, fetchCustomers, updateCustomer } from '../api/customers';
import { fetchDueBills, fetchOverdueBills } from '../api/sales';
import { Alert, Badge, Button, Card, EmptyState, Input, Modal, PageHeader, PageLoading, Table, Td, Th, useToast } from '../components/ui';
import CustomerForm from '../components/sales/CustomerForm';
import { apiError, money } from '../utils/format';

const CustomersPage = () => {
  const toast = useToast();
  const [customers, setCustomers] = useState(null);
  const [owed, setOwed] = useState({});
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // {} adds a new customer
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const load = useCallback(async () => {
    try {
      const [list, due, overdue] = await Promise.all([fetchCustomers(), fetchDueBills(), fetchOverdueBills()]);
      setCustomers([...list].sort((a, b) => a.name.localeCompare(b.name)));
      const totals = {};
      [...due, ...overdue].forEach((bill) => { totals[bill.customerId] = (totals[bill.customerId] || 0) + (bill.balanceDue || 0); });
      setOwed(totals);
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
      {unset > 0 && <Alert tone="warning" className="mb-4">{unset} customer{unset === 1 ? ' has' : 's have'} no type set. They can still buy on credit until you choose Cash or Credit.</Alert>}
      <div className="relative mb-3 sm:max-w-xs">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
        <Input className="pl-9" placeholder="Search name or phone" aria-label="Search customers" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <Card flush>
        {shown.length === 0 ? (
          <EmptyState icon={Users} title={customers.length ? 'No customers match' : 'No customers yet'} />
        ) : (
          <Table>
            <thead><tr><Th>Name</Th><Th>Phone</Th><Th>Type</Th><Th>Credit days</Th><Th align="right">Owes</Th><Th align="right"><span className="sr-only">Actions</span></Th></tr></thead>
            <tbody>
              {shown.map((customer) => (
                <tr key={customer._id} className="hover:bg-slate-50">
                  <Td className="font-medium">{customer.name}</Td>
                  <Td className="text-slate-600">{customer.phone || '-'}</Td>
                  <Td>{customer.customerType ? <Badge tone={customer.customerType === 'credit' ? 'info' : 'neutral'}>{customer.customerType === 'credit' ? 'Credit' : 'Cash'}</Badge> : <Badge tone="warning">Not set</Badge>}</Td>
                  <Td className="tabular text-slate-600">{customer.customerType === 'cash' ? '-' : customer.creditDays}</Td>
                  <Td align="right" className="font-medium">{owed[customer._id] ? money(owed[customer._id]) : '-'}</Td>
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
