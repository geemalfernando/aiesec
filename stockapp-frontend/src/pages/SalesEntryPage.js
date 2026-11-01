import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Camera, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { addCustomer, fetchCustomers } from '../api/customers';
import { fetchInventoryItems, fetchLocations } from '../api/inventory';
import { recordSale } from '../api/sales';
import { Alert, Badge, Button, buttonClass, Card, EmptyState, Field, Input, Modal, PageHeader, PageLoading, Select, Table, Td, Th, useToast } from '../components/ui';
import ChequeFields, { EMPTY_CHEQUE, chequeComplete } from '../components/sales/ChequeFields';
import CustomerForm from '../components/sales/CustomerForm';
import { fillUnreadLines, parseBill } from '../utils/billParser';
import { readBillText } from '../utils/billOcr';
import { apiError, locationName, money, stockText } from '../utils/format';

const METHODS = [['cash', 'Cash'], ['cheque', 'Cheque'], ['credit', 'Credit']];
const EMPTY_LINE = { name: '', stockId: '', cases: '', pieces: '' };

const mergeScannedItems = (items) => {
  const merged = new Map();
  items.forEach((item) => {
    const key = `${item.itemId || item.name}-${item.priceAtSale}`;
    const existing = merged.get(key);
    if (!existing) { merged.set(key, { ...item }); return; }
    existing.quantity += item.quantity;
    existing.cases = Math.floor(existing.quantity / existing.piecesPerCase);
    existing.pieces = existing.quantity % existing.piecesPerCase;
  });
  return [...merged.values()];
};

const SalesEntryPage = () => {
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const pendingBill = useRef(location.state?.billFile || null);

  const [customers, setCustomers] = useState([]);
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [locations, setLocations] = useState([]);
  const [newItemLocation, setNewItemLocation] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState('');
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [line, setLine] = useState(EMPTY_LINE);
  const [saleItems, setSaleItems] = useState([]);
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [dueDate, setDueDate] = useState('');
  const [cheque, setCheque] = useState(EMPTY_CHEQUE);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [billImageUrl, setBillImageUrl] = useState('');
  const [scanProgress, setScanProgress] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState('');
  const [billText, setBillText] = useState('');

  const selectedCustomer = customers.find((c) => c._id === customerId);
  const creditAllowed = selectedCustomer?.customerType !== 'cash';

  const loadData = useCallback(async () => {
    try {
      const [customerList, items, locationList] = await Promise.all([fetchCustomers(), fetchInventoryItems(), fetchLocations()]);
      setLocations(locationList);
      setNewItemLocation((current) => current || locationList[0] || '');
      setCustomers([...customerList].sort((a, b) => a.name.localeCompare(b.name)));
      setStock(items);
    } catch (err) {
      setLoadError(apiError(err, 'Could not load customers and stock.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // A cash customer cannot buy on credit; a credit bill defaults to the customer's credit days.
  useEffect(() => {
    if (paymentMethod !== 'credit') return;
    if (!creditAllowed) {
      setPaymentMethod('cash');
      return;
    }
    const due = billDate ? new Date(`${billDate}T00:00:00`) : new Date();
    due.setDate(due.getDate() + (selectedCustomer?.creditDays ?? 21));
    setDueDate(due.toLocaleDateString('en-CA'));
  }, [paymentMethod, creditAllowed, selectedCustomer, billDate]);

  // Stock is held per location; the picker shows each item once, then its locations.
  const itemNames = useMemo(() => [...new Set(stock.map((s) => s.name))].sort((a, b) => a.localeCompare(b)), [stock]);
  const lineLocations = stock.filter((s) => s.name === line.name && s.quantity > 0);
  const lineStock = stock.find((s) => s._id === line.stockId);

  // Paid and free lines of one stock record share its quantity.
  const inCart = (stockId, exceptIndex) => saleItems.reduce((sum, item, i) => (item.itemId === stockId && i !== exceptIndex ? sum + item.quantity : sum), 0);

  const handleAddLine = (e) => {
    e.preventDefault();
    setError('');
    if (!lineStock) { setError('Choose an item and a location.'); return; }
    const quantity = (Number(line.cases) || 0) * lineStock.piecesPerCase + (Number(line.pieces) || 0);
    if (quantity < 1) { setError('Enter at least 1 case or piece.'); return; }
    if (inCart(lineStock._id) + quantity > lineStock.quantity) {
      setError(`Only ${stockText(lineStock.cases, lineStock.pieces)} of ${lineStock.name} at ${locationName(lineStock.location)}.`);
      return;
    }
    const existingIndex = saleItems.findIndex((item) => item.itemId === lineStock._id && !item.free);
    const total = quantity + (existingIndex >= 0 ? saleItems[existingIndex].quantity : 0);
    const row = {
      itemId: lineStock._id,
      name: lineStock.name,
      quantity: total,
      cases: Math.floor(total / lineStock.piecesPerCase),
      pieces: total % lineStock.piecesPerCase,
      piecesPerCase: lineStock.piecesPerCase,
      priceAtSale: existingIndex >= 0 ? saleItems[existingIndex].priceAtSale : lineStock.price,
      locationTakenFrom: lineStock.location,
    };
    setSaleItems(existingIndex >= 0 ? saleItems.map((item, i) => (i === existingIndex ? row : item)) : [...saleItems, row]);
    setLine(EMPTY_LINE);
  };

  const handleQuantity = (index, field, value) => {
    const entered = Math.max(0, parseInt(value, 10) || 0);
    const item = saleItems[index];
    const quantity = (field === 'cases' ? entered : item.cases) * item.piecesPerCase + (field === 'pieces' ? entered : item.pieces);
    const available = stock.find((s) => s._id === item.itemId);
    if (!item.topUp && available && quantity + inCart(item.itemId, index) > available.quantity) {
      setError(`Only ${stockText(available.cases, available.pieces)} of ${item.name} at ${locationName(item.locationTakenFrom)}.`);
      return;
    }
    setError('');
    setSaleItems(saleItems.map((row, i) => (i === index ? {
      ...row,
      quantity,
      cases: Math.floor(quantity / row.piecesPerCase),
      pieces: quantity % row.piecesPerCase,
    } : row)));
  };

  const updateRow = (index, changes) => setSaleItems(saleItems.map((row, i) => (i === index ? { ...row, ...changes } : row)));

  const shortBy = (item) => {
    const available = stock.find((s) => s._id === item.itemId);
    if (!item.topUp || !available) return 0;
    return Math.max(0, inCart(item.itemId) - available.quantity);
  };

  const handlePrice = (index, value) => {
    setSaleItems(saleItems.map((row, i) => (i === index ? { ...row, priceAtSale: Math.max(0, parseFloat(value) || 0), free: false } : row)));
  };

  const scanBill = useCallback(async (file) => {
    setBillImageUrl(URL.createObjectURL(file));
    setScanResult(null);
    setScanError('');
    setScanProgress(0);
    try {
      const text = await readBillText(file, setScanProgress);
      let result = parseBill(text, customers, stock);
      if (result.unread.some((line) => line.startsWith('Name could not be read'))) {
        const secondText = await readBillText(file, setScanProgress, '4');
        result = fillUnreadLines(result, parseBill(secondText, customers, stock));
      }
      setBillText(text);
      setScanResult(result);
      setSaleItems(mergeScannedItems(result.items));
      // An unrecognised customer stays blank so the bill cannot go to the wrong account.
      setCustomerId(result.customer?._id || '');
      setBillNumber(result.billNumber);
      setBillDate(result.billDate);
      // Printed bills rarely say how they were paid, so start from how this customer usually pays.
      setPaymentMethod(result.payment.method || (result.customer?.customerType === 'credit' ? 'credit' : 'cash'));
      setDueDate('');
      setCheque({ ...EMPTY_CHEQUE, chequeNumber: result.payment.chequeNumber });
    } catch (err) {
      console.error('Bill scan error:', err);
      setScanError('Could not read this image. Try a clearer photo, or enter the bill by hand.');
    } finally {
      setScanProgress(null);
    }
  }, [customers, stock]);

  // A bill chosen on the home page is read once customers and stock have loaded.
  useEffect(() => {
    if (!pendingBill.current || loading) return;
    const file = pendingBill.current;
    pendingBill.current = null;
    navigate(location.pathname, { replace: true, state: null });
    scanBill(file);
  }, [loading, scanBill, navigate, location.pathname]);

  const subtotal = saleItems.reduce((sum, item) => sum + item.priceAtSale * item.quantity, 0);
  const percent = Number(discountPercentage) || 0;
  const flat = Number(discountAmount) || 0;
  const discount = percent > 0 ? (subtotal * percent) / 100 : flat;
  const total = Math.max(0, subtotal - discount);

  const resetSale = () => {
    setCustomerId('');
    setBillNumber('');
    setBillDate('');
    setSaleItems([]);
    setLine(EMPTY_LINE);
    setDiscountAmount('');
    setDiscountPercentage('');
    setPaymentMethod('cash');
    setDueDate('');
    setCheque(EMPTY_CHEQUE);
    setScanResult(null);
    setBillImageUrl('');
    setBillText('');
    setScanError('');
  };

  // The first thing still missing, shown beside the disabled button.
  const blocker = !customerId ? 'Select a customer.'
    : saleItems.length === 0 ? 'Add at least one item.'
    : saleItems.some((item) => item.isNew && !item.name.trim()) ? 'Every new item needs a name.'
    : saleItems.some((item) => item.isNew && !(item.piecesPerCase >= 1)) ? 'Every new item needs pieces per case.'
    : saleItems.some((item) => item.quantity < 1) ? 'Every item needs at least 1 piece. Remove any you do not want.'
    : paymentMethod === 'credit' && !dueDate ? 'Set a due date.'
    : paymentMethod === 'cheque' && !chequeComplete(cheque) ? 'Enter the cheque number, bank and date.'
    : '';

  const handleConfirm = async () => {
    setError('');
    setSaving(true);
    try {
      await recordSale({
        customerId,
        items: saleItems.map(({ itemId, isNew, topUp, mrp, quantity, cases, pieces, piecesPerCase, priceAtSale, name, locationTakenFrom }) => ({
          itemId, topUp, mrp, quantity, cases, pieces, piecesPerCase, priceAtSale, name,
          locationTakenFrom: isNew ? newItemLocation : locationTakenFrom,
          ...(isNew && { newItem: true }),
        })),
        discountAmount: percent > 0 ? 0 : flat,
        discountPercentage: percent,
        paymentMethod,
        ...(billNumber.trim() && { billNumber }),
        ...(billDate && { billDate }),
        ...(paymentMethod === 'credit' && { dueDate }),
        ...(paymentMethod === 'cheque' && { cheque }),
      });
      toast(`Sale saved for ${selectedCustomer.name}: ${money(total)}.`);
      resetSale();
      await loadData();
    } catch (err) {
      setError(apiError(err, 'Could not save the sale. Check the stock and try again.'));
    } finally {
      setSaving(false);
    }
  };

  const saveCustomer = async (values) => {
    const created = await addCustomer(values);
    setCustomers((list) => [...list, created].sort((a, b) => a.name.localeCompare(b.name)));
    setCustomerId(created._id);
    setAddingCustomer(false);
    if (scanResult && created.customerType === 'credit') setPaymentMethod('credit');
    toast('Customer added.');
  };

  if (loading) return <><PageHeader title="New sale" /><PageLoading /></>;
  if (loadError) return <><PageHeader title="New sale" /><Alert>{loadError}</Alert></>;

  const reading = scanProgress !== null;
  const billInput = (
    <label className={`${buttonClass('secondary')} cursor-pointer ${reading ? 'pointer-events-none opacity-50' : ''}`}>
      <Camera className="h-4 w-4" aria-hidden="true" /> {billImageUrl ? 'Use another image' : 'Add bill image'}
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Choose bill image"
        disabled={reading}
        onChange={(e) => { if (e.target.files[0]) scanBill(e.target.files[0]); e.target.value = ''; }}
      />
    </label>
  );

  return (
    <>
      <PageHeader title="New sale" subtitle="Fill this in by hand, or add a bill image to fill it in for you." action={billInput} />

      {reading && <div role="status" className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-900">Reading the bill... {scanProgress}%</div>}
      {scanError && <Alert className="mb-4">{scanError}</Alert>}
      {billImageUrl && scanResult && (
        <Card title="Check this against the bill" className="mb-6">
          <div className="grid gap-5 md:grid-cols-3">
            <a href={billImageUrl} target="_blank" rel="noreferrer" className="block"><img src={billImageUrl} alt="The bill you added" className="max-h-72 w-full rounded-lg border border-slate-200 object-contain" /></a>
            <div className="text-sm md:col-span-2">
              <dl className="grid gap-2 sm:grid-cols-2">
                <div><dt className="text-slate-500">Customer</dt><dd className="font-medium">{scanResult.customer ? scanResult.customer.name : (scanResult.customerName ? (
                  <span className="flex flex-wrap items-center gap-2">{scanResult.customerName} <Badge tone="warning">New</Badge> {!customerId && <Button size="sm" onClick={() => setAddingCustomer(true)}>Add customer</Button>}</span>
                ) : <Badge tone="warning">Not recognised, please select</Badge>)}</dd></div>
                <div><dt className="text-slate-500">Payment</dt><dd className="font-medium">{scanResult.payment.method ? <span className="capitalize">{scanResult.payment.method}</span> : <Badge tone="warning">Not on the bill, choose below</Badge>}</dd></div>
                <div><dt className="text-slate-500">Bill</dt><dd className="font-medium">{scanResult.billNumber || 'No number found'}{scanResult.billDate ? `, ${scanResult.billDate}` : ''}</dd></div>
                <div><dt className="text-slate-500">Items filled in</dt><dd className="font-medium">{scanResult.items.length}</dd></div>
                {scanResult.billTotal !== null && (
                  <div>
                    <dt className="text-slate-500">Total on the bill</dt>
                    <dd className="tabular font-medium">{money(scanResult.billTotal)} {Math.abs(scanResult.billTotal - total) >= 0.01 && <Badge tone="warning">This sale is {money(total)}</Badge>}</dd>
                  </div>
                )}
              </dl>
              {saleItems.some((item) => item.isNew) && (
                <div className="mt-3 rounded-lg bg-slate-50 p-3">
                  <p className="font-medium text-slate-800">{saleItems.filter((item) => item.isNew).length} new items will be saved to Stock with their MRP</p>
                  <Field label="Stock location for new items" className="mt-2 sm:max-w-xs">
                    <Select value={newItemLocation} onChange={(e) => setNewItemLocation(e.target.value)}>
                      {locations.map((loc) => <option key={loc} value={loc}>{locationName(loc)}</option>)}
                    </Select>
                  </Field>
                </div>
              )}
              {scanResult.notes.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-700">{scanResult.notes.map((note) => <li key={note}>{note}</li>)}</ul>}
              {scanResult.unread.length > 0 && (
                <div className="mt-3"><p className="font-medium text-slate-700">Lines not matched to your stock</p><ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">{scanResult.unread.map((text) => <li key={text}>{text}</li>)}</ul></div>
              )}
              <details className="mt-3 text-slate-500"><summary className="cursor-pointer">Text read from the image</summary><pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs">{billText}</pre></details>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6">
        <div className="grid min-w-0 gap-6">
          <Card title="Customer">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Customer" className="min-w-[220px] flex-1">
                <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Select a customer</option>
                  {customers.map((c) => <option key={c._id} value={c._id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>)}
                </Select>
              </Field>
              <Button variant="secondary" onClick={() => setAddingCustomer(true)}><Plus className="h-4 w-4" aria-hidden="true" /> New customer</Button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-md">
              <Field label="Bill number (optional)"><Input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} /></Field>
              <Field label="Bill date"><Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} /></Field>
            </div>
            {selectedCustomer?.customerType && <p className="mt-2 text-sm text-slate-500">{selectedCustomer.customerType === 'cash' ? 'Cash customer: cash or cheque only.' : `Credit customer: ${selectedCustomer.creditDays} days to pay.`}</p>}
          </Card>

          <Card title="Items" flush>
            <form onSubmit={handleAddLine} className="grid grid-cols-2 items-end gap-3 border-b border-slate-200 p-5 md:grid-cols-12">
              <Field label="Item" className="col-span-2 md:col-span-4">
                <Select value={line.name} onChange={(e) => setLine({ ...EMPTY_LINE, name: e.target.value })}>
                  <option value="">Select an item</option>
                  {itemNames.map((name) => <option key={name} value={name}>{name}</option>)}
                </Select>
              </Field>
              <Field label="From" className="col-span-2 md:col-span-3">
                <Select value={line.stockId} disabled={!line.name} onChange={(e) => setLine({ ...line, stockId: e.target.value })}>
                  <option value="">{line.name && lineLocations.length === 0 ? 'Out of stock' : 'Select location'}</option>
                  {lineLocations.map((s) => <option key={s._id} value={s._id}>{locationName(s.location)} ({stockText(s.cases, s.pieces)})</option>)}
                </Select>
              </Field>
              <Field label="Cases" className="md:col-span-2"><Input type="number" min="0" value={line.cases} onChange={(e) => setLine({ ...line, cases: e.target.value })} placeholder="0" /></Field>
              <Field label="Pieces" className="md:col-span-2"><Input type="number" min="0" value={line.pieces} onChange={(e) => setLine({ ...line, pieces: e.target.value })} placeholder="0" /></Field>
              <Button type="submit" variant="secondary" className="col-span-2 md:col-span-1" aria-label="Add item"><Plus className="h-4 w-4" aria-hidden="true" /><span className="md:hidden">Add item</span></Button>
            </form>
            {saleItems.length === 0 ? (
              <EmptyState icon={ShoppingCart} title="No items yet">Choose an item above to add it to this sale.</EmptyState>
            ) : (
              <Table>
                <thead><tr><Th>Item</Th><Th>MRP</Th><Th>Cases</Th><Th>Pieces</Th><Th>Rate per piece</Th><Th align="right">Total</Th><Th align="right"><span className="sr-only">Remove</span></Th></tr></thead>
                <tbody>
                  {saleItems.map((item, index) => (
                    <tr key={`${item.itemId}-${item.free ? 'free' : 'paid'}-${index}`}>
                      <Td className="min-w-[280px]">
                        {item.isNew
                          ? <Input aria-label={`Name of item ${index + 1}`} value={item.name} onChange={(e) => updateRow(index, { name: e.target.value })} />
                          : <span className="font-medium">{item.name}</span>}
                        <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                          {item.free && <Badge tone="good">Free</Badge>}
                          {item.isNew && <Badge tone="info">New item</Badge>}
                          {item.isNew && (
                            <label className="flex items-center gap-1">{'Per case'}<input className="h-6 w-12 rounded border border-slate-300 px-1" type="number" min="1" aria-label={`Pieces per case of item ${index + 1}`} value={item.piecesPerCase} onChange={(e) => {
                              const piecesPerCase = Math.max(1, parseInt(e.target.value, 10) || 1);
                              updateRow(index, { piecesPerCase, cases: Math.floor(item.quantity / piecesPerCase), pieces: item.quantity % piecesPerCase });
                            }} /></label>
                          )}
                          {!item.isNew && <span>{locationName(item.locationTakenFrom)}</span>}
                          {shortBy(item) > 0 && <Badge tone="warning">Adds {shortBy(item)} to stock</Badge>}
                        </div>
                      </Td>
                      <Td><Input className="!w-24" type="number" min="0" step="0.01" aria-label={`MRP of ${item.name}`} value={item.mrp ?? ''} onChange={(e) => updateRow(index, { mrp: e.target.value === '' ? null : Number(e.target.value) })} /></Td>
                      <Td><Input className="!w-20" type="number" min="0" aria-label={`Cases of ${item.name}`} value={item.cases} onChange={(e) => handleQuantity(index, 'cases', e.target.value)} /></Td>
                      <Td><Input className="!w-20" type="number" min="0" aria-label={`Pieces of ${item.name}`} value={item.pieces} onChange={(e) => handleQuantity(index, 'pieces', e.target.value)} /></Td>
                      <Td><Input className="!w-24" type="number" min="0" step="0.01" aria-label={`Price of ${item.name}`} value={item.priceAtSale} onChange={(e) => handlePrice(index, e.target.value)} /></Td>
                      <Td align="right" className="whitespace-nowrap font-medium">{money(item.priceAtSale * item.quantity)}</Td>
                      <Td align="right"><button type="button" className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${item.name}`} onClick={() => setSaleItems(saleItems.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></button></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <div className="ml-auto w-full min-w-0 lg:max-w-md">
          <Card title="Payment">
            <div className="grid gap-4">
              <div className="grid grid-cols-3 rounded-lg border border-slate-300 p-0.5" role="group" aria-label="Payment method">
                {METHODS.map(([value, label]) => {
                  const off = value === 'credit' && !creditAllowed;
                  return (
                    <button key={value} type="button" disabled={off} aria-pressed={paymentMethod === value} onClick={() => setPaymentMethod(value)} title={off ? 'Cash customers cannot buy on credit' : undefined} className={`rounded-md py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:text-slate-300 ${paymentMethod === value ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 disabled:hover:bg-transparent'}`}>{label}</button>
                  );
                })}
              </div>
              {paymentMethod === 'credit' && <Field label="Due date"><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>}
              {paymentMethod === 'cheque' && <ChequeFields cheque={cheque} onChange={setCheque} />}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Discount (Rs.)"><Input type="number" min="0" step="0.01" value={discountAmount} placeholder="0" onChange={(e) => { setDiscountAmount(e.target.value); setDiscountPercentage(''); }} /></Field>
                <Field label="Discount (%)"><Input type="number" min="0" max="100" step="0.01" value={discountPercentage} placeholder="0" onChange={(e) => { setDiscountPercentage(e.target.value); setDiscountAmount(''); }} /></Field>
              </div>
              <dl className="tabular grid gap-1 border-t border-slate-200 pt-4 text-sm">
                <div className="flex justify-between text-slate-600"><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
                {discount > 0 && <div className="flex justify-between text-slate-600"><dt>Discount</dt><dd>-{money(discount)}</dd></div>}
                <div className="mt-1 flex justify-between text-lg font-semibold text-slate-900"><dt>Total</dt><dd>{money(total)}</dd></div>
              </dl>
              {error && <Alert>{error}</Alert>}
              <Button size="lg" className="w-full" busy={saving} disabled={Boolean(blocker)} onClick={handleConfirm}>Confirm sale</Button>
              {blocker && <p className="-mt-2 text-center text-xs text-slate-500">{blocker}</p>}
            </div>
          </Card>
        </div>
      </div>

      {addingCustomer && <Modal title="Add customer" onClose={() => setAddingCustomer(false)}><CustomerForm customer={scanResult && !customerId ? { name: scanResult.customerName, address: scanResult.customerAddress, outletId: scanResult.outletId } : undefined} onSave={saveCustomer} onCancel={() => setAddingCustomer(false)} /></Modal>}
    </>
  );
};

export default SalesEntryPage;
