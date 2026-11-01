import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Camera, PackagePlus, Plus, Trash2 } from 'lucide-react';
import { fetchInventoryItems, fetchLocations } from '../api/inventory';
import { fetchRestocks, recordRestock } from '../api/reports';
import { Alert, Badge, Button, buttonClass, Card, EmptyState, Field, Input, PageHeader, PageLoading, Select, Table, Td, Th, useToast } from '../components/ui';
import { fillUnreadLines, parseBill } from '../utils/billParser';
import { readBillText } from '../utils/billOcr';
import { apiError, formatDay, locationName, money, plural } from '../utils/format';

const EMPTY_ROW = { name: '', mrp: null, piecesPerCase: 1, cases: 0, pieces: 0, costPrice: 0, free: false, isNew: true };
const quantityOf = (row) => (Number(row.cases) || 0) * (Number(row.piecesPerCase) || 1) + (Number(row.pieces) || 0);

const RestockPage = () => {
  const toast = useToast();
  const routerLocation = useLocation();
  const navigate = useNavigate();
  // Sent here by a sale that needs stock: the bill goes back to the sale once this is saved.
  const fromSale = useRef(routerLocation.state?.needed ? routerLocation.state : null);
  const [restocks, setRestocks] = useState(null);
  const [stock, setStock] = useState([]);
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState('');
  const [location, setLocation] = useState(fromSale.current?.needed.find((need) => need.location)?.location || '');
  const [rows, setRows] = useState(() => (fromSale.current ? fromSale.current.needed.map((need) => ({
    name: need.name,
    mrp: need.mrp,
    piecesPerCase: need.piecesPerCase,
    cases: Math.floor(need.quantity / need.piecesPerCase),
    pieces: need.quantity % need.piecesPerCase,
    costPrice: 0,
    sellingPrice: need.sellingPrice,
    free: false,
    isNew: need.isNew,
  })) : []));
  const [saving, setSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [progress, setProgress] = useState(null);
  const [scan, setScan] = useState(null);
  const [scanError, setScanError] = useState('');

  const load = useCallback(async () => {
    try {
      const [history, items, locs] = await Promise.all([fetchRestocks(), fetchInventoryItems(), fetchLocations()]);
      setRestocks(history);
      setStock(items);
      setLocations(locs);
      setLocation((current) => current || locs[0] || '');
    } catch (err) {
      setError(apiError(err, 'Could not load restocks.'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const readImage = async (file) => {
    setImageUrl(URL.createObjectURL(file));
    setScan(null);
    setScanError('');
    setProgress(0);
    try {
      const text = await readBillText(file, setProgress);
      let result = parseBill(text, [], stock);
      if (result.unread.some((line) => line.startsWith('Name could not be read'))) {
        result = fillUnreadLines(result, parseBill(await readBillText(file, setProgress, '4'), [], stock));
      }
      setScan(result);
      setSupplierName(result.supplierName);
      setBillNumber(result.billNumber);
      setBillDate(result.billDate);
      setRows(result.items.map((item) => ({ name: item.name, mrp: item.mrp, piecesPerCase: item.piecesPerCase, cases: item.cases, pieces: item.pieces, costPrice: item.priceAtSale, free: item.free, isNew: item.isNew })));
    } catch (err) {
      console.error('Order scan error:', err);
      setScanError('Could not read this image. Try a clearer photo, or enter the order by hand.');
    } finally {
      setProgress(null);
    }
  };

  const updateRow = (index, changes) => setRows(rows.map((row, i) => (i === index ? { ...row, ...changes } : row)));

  // Choosing an existing name fills its pack size and MRP.
  const changeName = (index, name) => {
    const known = stock.find((s) => s.name.toLowerCase() === name.trim().toLowerCase());
    updateRow(index, known ? { name: known.name, piecesPerCase: known.piecesPerCase, mrp: rows[index].mrp ?? known.mrp ?? null, isNew: false } : { name, isNew: true });
  };

  const total = rows.reduce((sum, row) => sum + quantityOf(row) * (Number(row.costPrice) || 0), 0);
  const blocker = !supplierName.trim() ? 'Enter the company name.'
    : rows.length === 0 ? 'Add at least one item.'
    : rows.some((row) => !row.name.trim()) ? 'Every item needs a name.'
    : rows.some((row) => quantityOf(row) < 1) ? 'Every item needs at least 1 piece.'
    : '';

  const reset = () => {
    setSupplierName('');
    setBillNumber('');
    setBillDate('');
    setRows([]);
    setImageUrl('');
    setScan(null);
    setScanError('');
  };

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      await recordRestock({ supplierName, billDate, billNumber, location, items: rows });
      toast(`Added ${plural(rows.length, 'item')} to ${locationName(location)}. Stock increased.`);
      if (fromSale.current) {
        navigate('/sales/new', { state: { billFile: fromSale.current.billFile, photo: fromSale.current.photo } });
        return;
      }
      reset();
      await load();
    } catch (err) {
      setError(apiError(err, 'Could not save this restock.'));
    } finally {
      setSaving(false);
    }
  };

  if (!restocks) return <><PageHeader title="Restock" />{error ? <Alert>{error}</Alert> : <PageLoading />}</>;
  const reading = progress !== null;

  return (
    <>
      <PageHeader
        title="Restock"
        subtitle="Add a company order to your stock, from an image or by hand."
        action={(
          <label className={`${buttonClass()} cursor-pointer ${reading ? 'pointer-events-none opacity-50' : ''}`}>
            <Camera className="h-4 w-4" aria-hidden="true" /> {imageUrl ? 'Use another image' : 'Add order image'}
            <input type="file" accept="image/*" className="sr-only" aria-label="Choose order image" disabled={reading} onChange={(e) => { if (e.target.files[0]) readImage(e.target.files[0]); e.target.value = ''; }} />
          </label>
        )}
      />
      {fromSale.current && (
        <Alert tone="warning" className="mb-4">These items are what your sale needs. Enter the company and the cost, change the amounts to what you really received, then add them to stock. You will go back to the sale afterwards.</Alert>
      )}
      {reading && <div role="status" className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-900">Reading the order... {progress}%</div>}
      {scanError && <Alert className="mb-4">{scanError}</Alert>}
      {imageUrl && scan && (
        <Card title="Check this against the order" className="mb-6">
          <div className="grid gap-5 md:grid-cols-3">
            <a href={imageUrl} target="_blank" rel="noreferrer"><img src={imageUrl} alt="The order you added" className="max-h-72 w-full rounded-lg border border-slate-200 object-contain" /></a>
            <div className="text-sm md:col-span-2">
              <p>Items filled in: <strong>{scan.items.length}</strong></p>
              {scan.billTotal !== null && <p className="mt-1">Total on the order: <strong className="tabular">{money(scan.billTotal)}</strong> {Math.abs(scan.billTotal - total) >= 0.01 && <Badge tone="warning">This restock is {money(total)}</Badge>}</p>}
              {scan.notes.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5">{scan.notes.map((note) => <li key={note}>{note}</li>)}</ul>}
              {scan.unread.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5">{scan.unread.map((line) => <li key={line}>{line}</li>)}</ul>}
            </div>
          </div>
        </Card>
      )}
      <Card title="Company order" className="mb-6" flush>
        <div className="grid gap-3 border-b border-slate-200 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Company"><Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} /></Field>
          <Field label="Order or bill number"><Input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} /></Field>
          <Field label="Date"><Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} /></Field>
          <Field label="Receive into">
            <Select value={location} onChange={(e) => setLocation(e.target.value)}>
              {locations.map((loc) => <option key={loc} value={loc}>{locationName(loc)}</option>)}
            </Select>
          </Field>
        </div>
        <datalist id="restock-names">{[...new Set(stock.map((s) => s.name))].map((name) => <option key={name} value={name} />)}</datalist>
        {rows.length === 0 ? (
          <EmptyState icon={PackagePlus} title="No items yet">Add an order image, or add items by hand.</EmptyState>
        ) : (
          <Table>
            <thead><tr><Th>Item</Th><Th>MRP</Th><Th>Per case</Th><Th>Cases</Th><Th>Pieces</Th><Th>Cost per piece</Th><Th align="right">Total</Th><Th align="right"><span className="sr-only">Remove</span></Th></tr></thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <Td className="min-w-[260px]">
                    <Input list="restock-names" aria-label={`Name of item ${index + 1}`} value={row.name} onChange={(e) => changeName(index, e.target.value)} />
                    <div className="mt-1 flex gap-1">{row.isNew ? <Badge tone="info">New item</Badge> : <Badge>In stock list</Badge>}{row.free && <Badge tone="good">Free</Badge>}</div>
                  </Td>
                  <Td><Input className="!w-24" type="number" min="0" step="0.01" aria-label={`MRP of item ${index + 1}`} value={row.mrp ?? ''} onChange={(e) => updateRow(index, { mrp: e.target.value === '' ? null : Number(e.target.value) })} /></Td>
                  <Td><Input className="!w-20" type="number" min="1" disabled={!row.isNew} aria-label={`Pieces per case of item ${index + 1}`} value={row.piecesPerCase} onChange={(e) => updateRow(index, { piecesPerCase: Math.max(1, parseInt(e.target.value, 10) || 1) })} /></Td>
                  <Td><Input className="!w-20" type="number" min="0" aria-label={`Cases of item ${index + 1}`} value={row.cases} onChange={(e) => updateRow(index, { cases: Math.max(0, parseInt(e.target.value, 10) || 0) })} /></Td>
                  <Td><Input className="!w-20" type="number" min="0" aria-label={`Pieces of item ${index + 1}`} value={row.pieces} onChange={(e) => updateRow(index, { pieces: Math.max(0, parseInt(e.target.value, 10) || 0) })} /></Td>
                  <Td><Input className="!w-24" type="number" min="0" step="0.01" aria-label={`Cost of item ${index + 1}`} value={row.costPrice} onChange={(e) => updateRow(index, { costPrice: Math.max(0, parseFloat(e.target.value) || 0) })} /></Td>
                  <Td align="right" className="whitespace-nowrap font-medium">{money(quantityOf(row) * row.costPrice)}</Td>
                  <Td align="right"><button type="button" className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove item ${index + 1}`} onClick={() => setRows(rows.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></button></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <Button variant="secondary" onClick={() => setRows([...rows, EMPTY_ROW])}><Plus className="h-4 w-4" aria-hidden="true" /> Add item</Button>
          <div className="flex flex-wrap items-center gap-4">
            <span className="tabular text-lg font-semibold">{money(total)}</span>
            <Button busy={saving} disabled={Boolean(blocker)} onClick={handleSave}>Add to stock</Button>
          </div>
        </div>
        {blocker && <p className="px-5 pb-4 text-right text-xs text-slate-500">{blocker}</p>}
        {error && <div className="px-5 pb-5"><Alert>{error}</Alert></div>}
      </Card>
      <Card title={`Past restocks (${restocks.length})`} flush>
        {restocks.length === 0 ? <EmptyState title="No restocks yet" /> : (
          <Table>
            <thead><tr><Th>Date</Th><Th>Company</Th><Th>Bill</Th><Th>Into</Th><Th align="right">Items</Th><Th align="right">Total</Th></tr></thead>
            <tbody>
              {restocks.map((row) => (
                <tr key={row._id} className="hover:bg-slate-50">
                  <Td className="whitespace-nowrap text-slate-600">{formatDay(row.billDate || row.createdAt)}</Td>
                  <Td className="font-medium">{row.supplierName}</Td>
                  <Td className="tabular text-slate-600">{row.billNumber || '-'}</Td>
                  <Td className="whitespace-nowrap text-slate-600">{locationName(row.location)}</Td>
                  <Td align="right">{row.items.length}</Td>
                  <Td align="right" className="whitespace-nowrap font-medium">{money(row.totalAmount)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
};

export default RestockPage;
