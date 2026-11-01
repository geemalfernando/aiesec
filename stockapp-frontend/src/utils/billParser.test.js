import { fillUnreadLines, parseBill } from './billParser';

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

// Real OCR output from a photographed bill, with its mistakes left in.
const REAL_OCR = `| INVOICE
ABC DISTRIBUTORS
NO.1, MLE. PERERA ROAD, SAMPLE TOWN
0770000000
| CORIGINAL] DISTRIBUTOR COPY
Bill date : 2026-10-26 —
Serial No : 10001
RTE-A
So eee ae
Customer :
SILVA STORES
1 A
SAMPLETOWN
KU UNIT QTY RATE AMOUNT
BOSSES ULCER EURAIL ES ELM Bly
et (Rs) 5 281. 20
YK KK KK KK KKK KKK 9K KK KK 9 KK KKK KK KOCK KOC IC OK KKK KOK
VAT LIABLE PRODUCTS(inclusive VAT) :
1 LANKASOY CHICKEN 90GX25-PROMO MRP170. OO-NEW
PRICE
PKT 6 147. 90 887. 40
2 WALUSOY DEVILLED PRAWN 90GX50-MRP1 70. OO-NEW
PRICE
PKT 3 147.90 443. 70
3 MALUSOY CUTTLE FISH 90GX50-MRP170. OO-NEW PRI
CE
PK 3 147. 90 443. 70
4 BUDGET CHICKEN 50GX60-MRP70. 00
1 PKT 6 60. 90 365. 40
5 SERA TABLE SALT 400GX22-MRP120. 00
PKT 22 90.00 1, 980. 00
6 SERA POL KIRI 180MLX24-MRP130. 0O-NEW PRICE
PKT 4 117. 00 468. 00
SERA COCONUT MILK 330MLX24-MRP385. 00
PKT 2 346. 50 693. 00
5, 281. 20
NET TOTAL B/F RETURN 5, 281. 20
6. 0.0.6.4
Br NCEP ITN ONLY St Fae at a ak en ih act
ais »-2
PKT 3 0, 00 0,00
oe@f@4?¢
0. 00
Customer Signature il: Yd
CBL IT POS - 2021
printed by : RTE-A
96-10-2026 12:01
12. 431
All Rights Reserved`;

describe('real photographed bill, nothing in stock yet', () => {
  const bill = parseBill(REAL_OCR, [], []);

  test('finds all seven paid items as new items', () => {
    expect(bill.items).toHaveLength(7);
    expect(bill.items.every((i) => i.isNew)).toBe(true);
  });
  test('saves name, MRP, pack size, quantity and rate for each', () => {
    expect(bill.items[0]).toMatchObject({ name: 'Lankasoy Chicken 90g', mrp: 170, piecesPerCase: 25, quantity: 6, priceAtSale: 147.9 });
    expect(bill.items[4]).toMatchObject({ name: 'Sera Table Salt 400g', mrp: 120, piecesPerCase: 22, quantity: 22, priceAtSale: 90, cases: 1, pieces: 0 });
    expect(bill.items[6]).toMatchObject({ name: 'Sera Coconut Milk 330ml', mrp: 385, piecesPerCase: 24, quantity: 2, priceAtSale: 346.5 });
  });
  test('reads MRP through split digits and letter O', () => expect(bill.items[1].mrp).toBe(170));
  test('the items add up to the net total', () => {
    const sum = bill.items.reduce((total, i) => total + i.quantity * i.priceAtSale, 0);
    expect(sum).toBeCloseTo(5281.2);
    expect(bill.billTotal).toBe(5281.2);
  });
  test('reads date, serial, customer and address', () => {
    expect(bill.billDate).toBe('2026-10-26');
    expect(bill.billNumber).toBe('10001');
    expect(bill.customerName).toBe('Silva Stores');
    expect(bill.customerAddress).toBe('1 A, Sampletown');
  });
  test('reports a free line whose name is unreadable', () => expect(bill.unread.join()).toMatch(/Name could not be read: 3 PKT \(free\)/));
  test('a second reading recovers the free line', () => {
    const second = parseBill('5 SERA TABLE SALT 400GX22-MRP120.00\nPKT 22 90.00 1,980.00\nSERA » TABLE SALT 400GX22-MRP120. 00\nPKT 3 0, 00 0. 00', [], []);
    const merged = fillUnreadLines(bill, second);
    expect(merged.unread).toEqual([]);
    expect(merged.items[7]).toMatchObject({ name: 'Sera Table Salt 400g', quantity: 3, priceAtSale: 0, free: true, mrp: 120 });
  });
  test('corrects a misread quantity from the rate and amount', () => {
    const fixed = parseBill('VAT LIABLE\n5 SERA TABLE SALT 400GX22-MRP120. 00\nPKT 92 90.00 1, 980. 00', [], []);
    expect(fixed.items[0].quantity).toBe(22);
    expect(fixed.notes[0]).toMatch(/quantity read as 22/);
  });
});

describe('same bill with existing data', () => {
  const people = [{ _id: 'p', name: 'Perera Stores' }, { _id: 's', name: 'Silva Stores' }];
  const shelf = [
    stock('m', 'Malusoy Devilled Prawn 90g', 'lorry1', 500, 50, 150),
    stock('c', 'Sera Pol Kiri 180ml', 'storeA', 2, 24, 120),
  ];
  const bill = parseBill(REAL_OCR, people, shelf);

  test('takes the customer from the block, not the address', () => expect(bill.customer._id).toBe('s'));
  test('matches stock despite OCR mistakes, and keeps its location', () => {
    expect(bill.items[1]).toMatchObject({ itemId: 'm', isNew: false, locationTakenFrom: 'lorry1', priceAtSale: 147.9, mrp: 170 });
  });
  test('short stock is still a row, topped up on saving', () => expect(bill.items[5]).toMatchObject({ itemId: 'c', quantity: 4, topUp: true }));
  test('finds a customer by outlet ID when the name was misread', () => {
    const found = parseBill('OUTLET ID : 100001\nCustomer :\nSILVA STOKES XX', [{ _id: 'o', name: 'Other Name', outletId: '100001' }], []);
    expect(found.customer._id).toBe('o');
  });
  test('a free line is kept apart at no charge', () => {
    const free = parseBill('5 SERA TABLE SALT 400GX22-MRP120.00\nPKT 22 90.00 1,980.00\nNET TOTAL 1,980.00\nFREE :\nSERA TABLE SALT 400GX22-MRP120.00\nPKT 3 0.00 0.00', [], []);
    expect(free.items.map((i) => [i.quantity, i.priceAtSale, i.free])).toEqual([[22, 90, false], [3, 0, true]]);
  });
});
