import { parseBill } from './billParser';

const customers = [{ _id: 'c1', name: 'Perera Stores' }, { _id: 'c2', name: 'Silva Cash Shop' }];
const stock = (id, name, location, quantity = 100, piecesPerCase = 10, price = 50) =>
  ({ _id: id, name, location, quantity, piecesPerCase, price });
const inventory = [stock('s1', 'Soap', 'storeA'), stock('s2', 'Soap Large', 'storeA'), stock('t1', 'Tea 100g', 'storeB')];

test('reads customer, items, total and payment from a printed bill', () => {
  const bill = parseBill(
    'ABC Distributors\nCustomer: Perera Stores\nDate: 01/11/2026\nSoap 2 cases 3 pcs 50.00 1150.00\nTea 100g 5 pcs 80.00 400.00\nGrand Total 1,550.00\nCredit bill',
    customers, inventory);
  expect(bill.customer._id).toBe('c1');
  expect(bill.items.map((i) => [i.itemId, i.cases, i.pieces])).toEqual([['s1', 2, 3], ['t1', 0, 5]]);
  expect(bill.billTotal).toBe(1550);
  expect(bill.payment.method).toBe('credit');
  expect(bill.notes).toEqual([]);
});

test('tolerates small OCR mistakes', () => {
  const bill = parseBill('Perrera Stores\nSoap Larqe 4 pcs', customers, inventory);
  expect(bill.customer._id).toBe('c1');
  expect(bill.items[0].itemId).toBe('s2');
});

test('does not read the longer item as the shorter one', () => {
  expect(parseBill('Soap Large 1 pcs', customers, inventory).items[0].itemId).toBe('s2');
});

test('a number in the item name is not the quantity', () => {
  expect(parseBill('Tea 100g 3 pcs', customers, inventory).items[0].quantity).toBe(3);
});

test('a price is not read as a quantity', () => {
  const bill = parseBill('Soap 100.00', customers, inventory);
  expect(bill.items[0].quantity).toBe(1);
  expect(bill.notes[0]).toMatch(/no quantity found/);
});

test('a plain number is flagged because the unit is a guess', () => {
  const bill = parseBill('Soap 12 50.00 600.00', customers, inventory);
  expect(bill.items[0]).toMatchObject({ quantity: 12, cases: 1, pieces: 2 });
  expect(bill.notes[0]).toMatch(/taken as pieces/);
});

test('picks a location with enough stock', () => {
  const split = [stock('a', 'Soap', 'lorry1', 2), stock('b', 'Soap', 'storeB', 50)];
  expect(parseBill('Soap 10 pcs', customers, split).items[0]).toMatchObject({ itemId: 'b', locationTakenFrom: 'storeB' });
});

test('more than the stock is reported, not added', () => {
  const bill = parseBill('Soap 50 cases', customers, inventory);
  expect(bill.items).toEqual([]);
  expect(bill.notes[0]).toMatch(/no location has that much stock/);
});

test('an unknown customer stays unselected', () => {
  expect(parseBill('Fernando Traders\nSoap 1 pcs', customers, inventory).customer).toBeNull();
});

test('lines that look like items but match nothing are listed', () => {
  expect(parseBill('Biscuits 3 pcs 40.00', customers, inventory).unread).toEqual(['Biscuits 3 pcs 40.00']);
});

test('a form printing every payment option gives no suggestion', () => {
  expect(parseBill('Cash / Credit / Cheque', customers, inventory).payment.method).toBeNull();
});

test('reads a cheque number', () => {
  expect(parseBill('Cheque No: 556677', customers, inventory).payment).toEqual({ method: 'cheque', chequeNumber: '556677' });
});

test('sub total is not the bill total', () => {
  expect(parseBill('Sub Total 900.00\nDiscount 100.00\nNet Total 800.00', customers, inventory).billTotal).toBe(800);
});
