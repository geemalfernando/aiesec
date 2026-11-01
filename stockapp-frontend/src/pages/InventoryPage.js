import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, Boxes, Plus, Search } from 'lucide-react';
import { addInventoryItem, fetchInventoryItems, fetchLocations } from '../api/inventory';
import { Alert, Badge, Button, buttonClass, Card, EmptyState, Field, Input, Modal, PageHeader, PageLoading, Select, Stat, Table, Td, Th, useToast } from '../components/ui';
import { apiError, locationName, money, plural, stockText } from '../utils/format';

const LOW_STOCK_PIECES = 10;
const EMPTY_ITEM = { name: '', price: '', mrp: '', cases: '', pieces: '', piecesPerCase: '', location: '' };

const AddItemModal = ({ stock, locations, onClose, onAdded }) => {
  const [item, setItem] = useState(EMPTY_ITEM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (field) => (e) => setItem({ ...item, [field]: e.target.value });
  const names = [...new Set(stock.map((s) => s.name))];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: item.name.trim(),
      price: Number(item.price),
      ...(item.mrp !== '' && { mrp: Number(item.mrp) }),
      cases: Number(item.cases) || 0,
      pieces: Number(item.pieces) || 0,
      piecesPerCase: Number(item.piecesPerCase),
      location: item.location,
    };
    if (payload.pieces >= payload.piecesPerCase) {
      setError('Pieces must be fewer than the pieces in one case.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await addInventoryItem(payload);
      onAdded(payload.name);
    } catch (err) {
      setError(apiError(err, 'Could not add this item.'));
      setSaving(false);
    }
  };

  return (
    <Modal title="Add stock" onClose={onClose}>
      <form onSubmit={handleSubmit} className="grid gap-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Item name" hint="Pick a suggestion to keep one spelling for each item.">
          <Input list="stock-names" value={item.name} onChange={set('name')} maxLength={50} required />
        </Field>
        <datalist id="stock-names">{names.map((name) => <option key={name} value={name} />)}</datalist>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Price per piece (Rs.)"><Input type="number" min="0" step="0.01" value={item.price} onChange={set('price')} required /></Field>
          <Field label="MRP (Rs.)"><Input type="number" min="0" step="0.01" value={item.mrp} onChange={set('mrp')} /></Field>
          <Field label="Location">
            <Select value={item.location} onChange={set('location')} required>
              <option value="">Select</option>
              {locations.map((loc) => <option key={loc} value={loc}>{locationName(loc)}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Cases"><Input type="number" min="0" value={item.cases} onChange={set('cases')} placeholder="0" /></Field>
          <Field label="Pieces"><Input type="number" min="0" value={item.pieces} onChange={set('pieces')} placeholder="0" /></Field>
          <Field label="Pieces per case"><Input type="number" min="1" value={item.piecesPerCase} onChange={set('piecesPerCase')} required /></Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={saving}>Add stock</Button>
        </div>
      </form>
    </Modal>
  );
};

const InventoryPage = () => {
  const toast = useToast();
  const [stock, setStock] = useState(null);
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const [items, locs] = await Promise.all([fetchInventoryItems(), fetchLocations()]);
      setStock(items);
      setLocations(locs);
    } catch (err) {
      setError(apiError(err, 'Could not load stock.'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const sorters = {
      name: (a, b) => a.name.localeCompare(b.name),
      price: (a, b) => b.price - a.price,
      quantity: (a, b) => a.quantity - b.quantity,
      location: (a, b) => a.location.localeCompare(b.location),
    };
    return (stock || [])
      .filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()) && (!locationFilter || s.location === locationFilter))
      .sort(sorters[sortBy]);
  }, [stock, search, locationFilter, sortBy]);

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Link to="/stock/transfer" className={buttonClass('secondary')}><ArrowLeftRight className="h-4 w-4" aria-hidden="true" /> Transfer</Link>
      <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden="true" /> Add stock</Button>
    </div>
  );

  if (!stock) return <><PageHeader title="Stock" />{error ? <Alert>{error}</Alert> : <PageLoading />}</>;

  const value = stock.reduce((sum, s) => sum + s.price * s.quantity, 0);
  const low = stock.filter((s) => s.quantity > 0 && s.quantity < LOW_STOCK_PIECES).length;
  const out = stock.filter((s) => s.quantity === 0).length;

  return (
    <>
      <PageHeader title="Stock" subtitle={`${new Set(stock.map((s) => s.name)).size} items in ${plural(new Set(stock.map((s) => s.location)).size, 'location')}`} action={actions} />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Stock value" value={money(value)} />
        <Stat label="Low stock" value={plural(low, 'line')} tone={low ? 'warning' : 'default'} note={`Under ${LOW_STOCK_PIECES} pieces`} />
        <Stat label="Out of stock" value={plural(out, 'line')} tone={out ? 'danger' : 'default'} />
      </div>
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <Field label="Item">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
            <Input className="pl-9" placeholder="Search item" aria-label="Search item" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </Field>
        <Field label="Location">
          <Select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
            <option value="">All locations</option>
            {locations.map((loc) => <option key={loc} value={loc}>{locationName(loc)}</option>)}
          </Select>
        </Field>
        <Field label="Sort by">
          <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="name">Name</option>
            <option value="quantity">Lowest stock first</option>
            <option value="price">Highest price first</option>
            <option value="location">Location</option>
          </Select>
        </Field>
      </div>
      <Card flush>
        {shown.length === 0 ? (
          <EmptyState icon={Boxes} title={stock.length ? 'No stock matches' : 'No stock yet'}>{stock.length ? 'Try another search.' : 'Add your first item to get started.'}</EmptyState>
        ) : (
          <Table>
            <thead><tr><Th>Item</Th><Th>Location</Th><Th>Stock</Th><Th>Level</Th><Th align="right">MRP</Th><Th align="right">Price</Th><Th align="right">Value</Th></tr></thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s._id} className="hover:bg-slate-50">
                  <Td className="font-medium">{s.name}</Td>
                  <Td className="whitespace-nowrap text-slate-600">{locationName(s.location)}</Td>
                  <Td className="tabular whitespace-nowrap">{stockText(s.cases, s.pieces)}<div className="text-xs text-slate-500">{s.quantity} pieces, {s.piecesPerCase} per case</div></Td>
                  <Td>{s.quantity === 0 ? <Badge tone="danger">Out</Badge> : s.quantity < LOW_STOCK_PIECES ? <Badge tone="warning">Low</Badge> : <Badge tone="good">OK</Badge>}</Td>
                  <Td align="right" className="whitespace-nowrap text-slate-600">{s.mrp ? money(s.mrp) : '-'}</Td>
                  <Td align="right" className="whitespace-nowrap text-slate-600">{money(s.price)}</Td>
                  <Td align="right" className="whitespace-nowrap font-medium">{money(s.price * s.quantity)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {adding && <AddItemModal stock={stock} locations={locations} onClose={() => setAdding(false)} onAdded={(name) => { setAdding(false); toast(`${name} added.`); load(); }} />}
    </>
  );
};

export default InventoryPage;
