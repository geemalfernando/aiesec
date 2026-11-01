import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { fetchInventoryItems, fetchLocations, transferInventory } from '../api/inventory';
import { Alert, Button, Card, Field, Input, PageHeader, PageLoading, Select, useToast } from '../components/ui';
import { apiError, locationName, stockText } from '../utils/format';

const StockTransferPage = () => {
  const toast = useToast();
  const [stock, setStock] = useState(null);
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [cases, setCases] = useState('');
  const [pieces, setPieces] = useState('');

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

  if (!stock) return <><PageHeader title="Stock transfer" />{error ? <Alert>{error}</Alert> : <PageLoading />}</>;

  // Each location holds its own record, so the source record decides the item being moved.
  const names = [...new Set(stock.map((s) => s.name))].sort((a, b) => a.localeCompare(b));
  const holdings = stock.filter((s) => s.name === name);
  const sources = holdings.filter((s) => s.quantity > 0);
  const source = stock.find((s) => s._id === sourceId);
  const quantity = source ? (Number(cases) || 0) * source.piecesPerCase + (Number(pieces) || 0) : 0;
  const tooMany = source && quantity > source.quantity;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await transferInventory({ itemId: source._id, fromLocation: source.location, toLocation, quantity });
      toast(`Moved ${quantity} pieces of ${source.name} to ${locationName(toLocation)}.`);
      setName('');
      setSourceId('');
      setToLocation('');
      setCases('');
      setPieces('');
      await load();
    } catch (err) {
      setError(apiError(err, 'Could not transfer this stock.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Stock transfer" subtitle="Move stock between your stores and lorries." />
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card title="Transfer" className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="grid gap-4">
            {error && <Alert>{error}</Alert>}
            <Field label="Item">
              <Select value={name} onChange={(e) => { setName(e.target.value); setSourceId(''); setToLocation(''); setCases(''); setPieces(''); }} required>
                <option value="">Select an item</option>
                {names.map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </Field>
            <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
              <Field label="From">
                <Select value={sourceId} disabled={!name} onChange={(e) => { setSourceId(e.target.value); setToLocation(''); }} required>
                  <option value="">{name && sources.length === 0 ? 'Out of stock' : 'Select location'}</option>
                  {sources.map((s) => <option key={s._id} value={s._id}>{locationName(s.location)} ({stockText(s.cases, s.pieces)})</option>)}
                </Select>
              </Field>
              <ArrowRight className="mb-3 hidden h-4 w-4 text-slate-400 sm:block" aria-hidden="true" />
              <Field label="To">
                <Select value={toLocation} disabled={!source} onChange={(e) => setToLocation(e.target.value)} required>
                  <option value="">Select location</option>
                  {locations.filter((loc) => loc !== source?.location).map((loc) => <option key={loc} value={loc}>{locationName(loc)}</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
              <Field label="Cases"><Input type="number" min="0" disabled={!source} value={cases} onChange={(e) => setCases(e.target.value)} placeholder="0" /></Field>
              <Field label="Pieces"><Input type="number" min="0" disabled={!source} value={pieces} onChange={(e) => setPieces(e.target.value)} placeholder="0" /></Field>
            </div>
            {tooMany && <Alert>Only {stockText(source.cases, source.pieces)} available at {locationName(source.location)}.</Alert>}
            <div><Button type="submit" busy={saving} disabled={!source || !toLocation || quantity < 1 || tooMany}>Transfer {quantity > 0 ? `${quantity} pieces` : 'stock'}</Button></div>
          </form>
        </Card>
        <Card title={name ? `${name} by location` : 'Stock by location'} flush>
          {!name ? (
            <p className="px-5 py-4 text-sm text-slate-500">Choose an item to see where it is.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {holdings.map((s) => (
                <li key={s._id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span className="text-slate-700">{locationName(s.location)}</span>
                  <span className="tabular font-medium">{stockText(s.cases, s.pieces)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
};

export default StockTransferPage;
