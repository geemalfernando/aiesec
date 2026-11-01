import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil } from 'lucide-react';
import { fetchItemReport, setStockCount, updateItem } from '../api/reports';
import { BarChart, lastMonths, RankBars } from '../components/charts';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, PageLoading, Stat, Table, Td, Th, useToast } from '../components/ui';
import { apiError, formatDay, locationName, money, plural, stockText } from '../utils/format';

const piecesText = (count) => plural(count, 'piece');

const EditItemModal = ({ item, onClose, onSaved }) => {
  const [values, setValues] = useState({ name: item.name, mrp: item.mrp ?? '', price: item.price });
  const [error, setError] = useState('');
  const set = (field) => (e) => setValues({ ...values, [field]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    try {
      onSaved(await updateItem(item.name, values));
    } catch (err) {
      setError(apiError(err, 'Could not save this item.'));
    }
  };
  return (
    <Modal title={`Edit ${item.name}`} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Name" hint="Past sales and restocks will show the new name."><Input value={values.name} onChange={set('name')} maxLength={50} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="MRP (Rs.)"><Input type="number" min="0" step="0.01" value={values.mrp} onChange={set('mrp')} /></Field>
          <Field label="Selling price per piece (Rs.)"><Input type="number" min="0" step="0.01" value={values.price} onChange={set('price')} required /></Field>
        </div>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Save item</Button></div>
      </form>
    </Modal>
  );
};

const CountModal = ({ record, name, onClose, onSaved }) => {
  const [cases, setCases] = useState(record.cases);
  const [pieces, setPieces] = useState(record.pieces);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    try {
      await setStockCount(record._id, { cases, pieces });
      onSaved();
    } catch (err) {
      setError(apiError(err, 'Could not save the count.'));
    }
  };
  return (
    <Modal title={`Count ${name} at ${locationName(record.location)}`} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4">
        {error && <Alert>{error}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cases"><Input type="number" min="0" value={cases} onChange={(e) => setCases(e.target.value)} /></Field>
          <Field label="Pieces"><Input type="number" min="0" value={pieces} onChange={(e) => setPieces(e.target.value)} /></Field>
        </div>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Save count</Button></div>
      </form>
    </Modal>
  );
};

const ItemDetailPage = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [counting, setCounting] = useState(null);

  const load = useCallback(async () => {
    try {
      setReport(await fetchItemReport(name));
    } catch (err) {
      setError(apiError(err, 'Could not load this item.'));
    }
  }, [name]);

  useEffect(() => { load(); }, [load]);

  const back = <Link to="/stock" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Stock</Link>;
  if (!report) return <>{back}{error ? <Alert>{error}</Alert> : <PageLoading />}</>;

  const { item, monthly, topCustomers, movements } = report;
  const details = [item.mrp ? `MRP ${money(item.mrp)}` : 'No MRP', `Sells at ${money(item.price)}`, item.costPrice ? `Cost ${money(item.costPrice)}` : null, `${item.piecesPerCase} per case`].filter(Boolean).join(' · ');

  return (
    <>
      {back}
      <PageHeader title={item.name} subtitle={details} action={<Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" aria-hidden="true" /> Edit</Button>} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="In stock" value={piecesText(item.stock)} note={stockText(Math.floor(item.stock / item.piecesPerCase), item.stock % item.piecesPerCase)} tone={item.stock === 0 ? 'danger' : 'default'} />
        <Stat label="Sold" value={piecesText(item.sold)} note={item.lastSold ? `Last ${formatDay(item.lastSold)}` : 'Not sold yet'} />
        <Stat label="Sales value" value={money(item.soldValue)} />
        <Stat label="Received from company" value={piecesText(item.received)} />
      </div>
      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card title="Stock by location" flush>
          <ul className="divide-y divide-slate-100">
            {item.locations.map((record) => (
              <li key={record._id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span><span className="block text-slate-700">{locationName(record.location)}</span><span className="tabular block text-xs text-slate-500">{stockText(record.cases, record.pieces)}</span></span>
                <Button size="sm" variant="ghost" onClick={() => setCounting(record)}>Correct count</Button>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Sold per month (pieces)"><BarChart data={lastMonths(monthly, 'sold')} format={piecesText} emptyTitle="Not sold yet" label="Pieces sold per month" /></Card>
        <Card title="Received per month (pieces)"><BarChart data={lastMonths(monthly, 'received')} format={piecesText} emptyTitle="Nothing received yet" label="Pieces received per month" /></Card>
      </div>
      {topCustomers.length > 0 && <Card title="Who buys it most" className="mb-6"><RankBars rows={topCustomers.map((row) => ({ key: row._id, label: row.name, value: row.quantity }))} format={piecesText} /></Card>}
      <Card title={`History (${movements.length})`} flush>
        {movements.length === 0 ? <EmptyState title="No sales or restocks yet" /> : (
          <Table>
            <thead><tr><Th>Date</Th><Th>Type</Th><Th>Customer or company</Th><Th>Bill</Th><Th>Location</Th><Th align="right">Rate</Th><Th align="right">Pieces</Th></tr></thead>
            <tbody>
              {movements.map((row, index) => (
                <tr key={`${row.type}-${index}`} className="hover:bg-slate-50">
                  <Td className="whitespace-nowrap text-slate-600">{formatDay(row.date)}</Td>
                  <Td>{row.type === 'sale' ? <Badge>Sold</Badge> : <Badge tone="good">Received</Badge>}</Td>
                  <Td className="font-medium">{row.partyId ? <Link className="hover:underline" to={`/customers/${row.partyId}`}>{row.party}</Link> : row.party}</Td>
                  <Td className="tabular text-slate-600">{row.ref || '-'}</Td>
                  <Td className="whitespace-nowrap text-slate-600">{locationName(row.location)}</Td>
                  <Td align="right" className="whitespace-nowrap text-slate-600">{money(row.rate)}</Td>
                  <Td align="right" className="font-medium">{row.type === 'sale' ? '-' : '+'}{row.quantity}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {editing && <EditItemModal item={item} onClose={() => setEditing(false)} onSaved={({ name: saved }) => { setEditing(false); toast('Item saved.'); if (saved !== name) navigate(`/stock/items/${encodeURIComponent(saved)}`, { replace: true }); else load(); }} />}
      {counting && <CountModal record={counting} name={item.name} onClose={() => setCounting(null)} onSaved={() => { setCounting(null); toast('Count saved.'); load(); }} />}
    </>
  );
};

export default ItemDetailPage;
