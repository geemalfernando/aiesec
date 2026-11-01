// src/utils/billParser.js
// Turns the text read from a bill photo into a suggested sale. Everything here is a suggestion:
// the person entering the sale reviews it before anything is saved.
const MATCH_THRESHOLD = 0.8;

const normalize = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const editDistance = (a, b) => {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    row = next;
  }
  return row[b.length];
};

const similarity = (a, b) => 1 - editDistance(a, b) / Math.max(a.length, b.length, 1);

// Finds a name inside a line, allowing for small OCR mistakes. Returns the words around the match.
const findName = (line, name) => {
  const words = normalize(line).split(' ');
  const target = normalize(name);
  const size = target.split(' ').length;
  let best = null;
  for (let start = 0; start + size <= words.length; start++) {
    const score = similarity(words.slice(start, start + size).join(' '), target);
    if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { score, before: words.slice(0, start).join(' '), after: words.slice(start + size).join(' ') };
    }
  }
  return best;
};

// The same text with punctuation kept, so 100.00 stays a price and does not look like a quantity.
const afterNameRaw = (line, match) => {
  const words = line.trim().split(/\s+/);
  const skip = match.before ? match.before.split(' ').length : 0;
  const nameWords = normalize(line).split(' ').length - skip - (match.after ? match.after.split(' ').length : 0);
  return words.slice(skip + nameWords).join(' ');
};

const parseQuantity = (line, match) => {
  const raw = afterNameRaw(line, match);
  const cases = raw.match(/(\d+)\s*(?:cases?|cs|ctns?|cartons?)\b/i);
  const pieces = raw.match(/(\d+)\s*(?:pieces?|pcs?|nos?)\b/i);
  if (cases || pieces) {
    return { cases: Number(cases?.[1] || 0), pieces: Number(pieces?.[1] || 0), unitKnown: true };
  }
  const plain = raw.match(/(?:^|\s)(\d+)(?=\s|$)/);
  if (plain) return { cases: 0, pieces: Number(plain[1]), unitKnown: false };
  const leading = match.before.match(/(\d+) x$/);
  if (leading) return { cases: 0, pieces: Number(leading[1]), unitKnown: false };
  return null;
};

const lastAmount = (line) => {
  const amounts = line.match(/\d[\d,]*(?:\.\d+)?/g);
  return amounts ? Number(amounts[amounts.length - 1].replace(/,/g, '')) : null;
};

const isTotalLine = (line) => /\b(sub\s*total|grand\s*total|net\s*total|total|amount due|balance|net|gross|returns?)\b/i.test(line);
const isHeaderLine = (line) => /\b(date|invoice|bill\s*no|serial|outlet|sku|signature|printed|customer|tel|phone|fax|mobile|discount|cheque|chq|thank|page|qty|price)\b/i.test(line);

const findBillTotal = (lines) => {
  const totals = lines.filter(isTotalLine).filter((line) => !/sub\s*total|balance|gross|^\W*returns?\b/i.test(line) && /\d/.test(line));
  const line = totals.filter((l) => /grand|net|amount due/i.test(l)).pop() || totals[totals.length - 1];
  return line ? lastAmount(line) : null;
};

const findPaymentHint = (text) => {
  const chequeNumber = text.match(/(?:cheque|chq)\s*(?:no|number|#)?\.?\s*:?\s*(\d{4,})/i)?.[1];
  const found = ['cheque', 'credit', 'cash'].filter((word) =>
    new RegExp(word === 'cheque' ? '\\b(cheque|chq)\\b' : `\\b${word}\\b`, 'i').test(text));
  // A printed form often lists every option, so several words tell us nothing.
  return { method: found.length === 1 ? found[0] : null, chequeNumber: chequeNumber || '' };
};

const amount = (text) => Number(text.replace(/,/g, ''));

// OCR splits and misreads numbers on receipts: "147. 90", "1, 980. 00", "170. OO", "0, 00".
export const cleanOcrText = (text) => text
  .replace(/(\d),\s+(\d{3})/g, '$1,$2')
  .replace(/(\d)[.,]\s*([0-9OoQ]{2})(?![0-9A-Za-z])/g, (_, whole, cents) => `${whole}.${cents.replace(/[OoQ]/g, '0')}`);

// Each item is a product line, sometimes wrapped, then a line such as: PKT 6 147.90 887.40.
const UNIT_LINE = /(?:^|[^A-Za-z])(P[KR]T?|[PF]KT|PCT|PCS?|NOS?|CS|CASE|CTN|BOX|BTL|PACK)\W+(\d{1,4})\W+([\d,]+\.\d{2})\W+([\d,]+\.\d{2})\s*$/i;
const CASE_UNITS = /^(cs|case|ctn|box)$/i;
const PRODUCT_LINE = /\d\s*(?:kg|g|ml|l)\s*x\s*\d|m[ra]p\s*\d/i;
const PACK = /^(.*?\d+(?:\.\d+)?\s*(?:kg|g|ml|l))\s*x\s*(\d+)/i;

const titleCase = (text) => text.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase()).replace(/(\d)(Kg|G|Ml|L)\b/g, (_, digit, unit) => digit + unit.toLowerCase());

// "SERA POL KIRI 180MLX24-MRP130.00-NEW PRICE" gives the name, pieces per case and MRP.
export const parseProduct = (description) => {
  const text = description.replace(/^[^A-Za-z]*(?:\d+\s+)?/, '').replace(/[^A-Za-z0-9 ./-]/g, ' ').replace(/\s+/g, ' ').trim();
  const pack = text.match(PACK);
  const mrp = text.match(/m[ra]p\s*([\d ]+(?:\.\d+)?)/i);
  const name = pack ? pack[1] : text.split(/-?\s*m[ra]p/i)[0];
  return {
    name: titleCase(name.replace(/\s*-\s*$/, '').trim()),
    piecesPerCase: pack ? Number(pack[2]) : 1,
    mrp: mrp ? Number(mrp[1].replace(/\s/g, '')) : null,
  };
};

const findInvoiceLines = (lines) => {
  const rows = [];
  let pending = [];
  let inFree = false;
  lines.forEach((line) => {
    const unitLine = line.match(UNIT_LINE);
    if (unitLine) {
      const [, unit, quantityText, rateText, totalText] = unitLine;
      const rate = amount(rateText);
      const total = amount(totalText);
      let quantity = Number(quantityText);
      let corrected = false;
      // The line must add up. If it does not, the amount and rate can correct a misread quantity.
      if (rate > 0 && Math.abs(quantity * rate - total) >= 0.01) {
        const implied = total / rate;
        if (Math.abs(implied - Math.round(implied)) < 0.001) {
          quantity = Math.round(implied);
          corrected = true;
        }
      }
      const head = pending.map((text) => PRODUCT_LINE.test(text)).lastIndexOf(true);
      rows.push({
        description: head >= 0 ? pending.slice(head).join(' ') : '',
        unit,
        isCases: CASE_UNITS.test(unit),
        quantity,
        rate,
        total,
        corrected,
        free: inFree || rate === 0,
      });
      pending = [];
    } else if (/^\W*free\b/i.test(line)) {
      inFree = true;
      pending = [];
    } else if (isTotalLine(line)) {
      pending = [];
    } else {
      pending.push(line);
    }
  });
  return rows;
};

const findCustomerBlock = (lines) => {
  const index = lines.findIndex((line) => /^\W*customer\b(?!\s*signature)/i.test(line));
  if (index < 0) return null;
  const block = [];
  const sameLine = lines[index].replace(/^\W*customer\b\s*:?\s*/i, '').trim();
  if (sameLine) block.push(sameLine);
  for (let i = index + 1; i < lines.length && block.length < 4 && !/\b(sku|unit|qty|rate|amount)\b/i.test(lines[i]) && !/^\W*\*/.test(lines[i]); i++) {
    const clean = lines[i].replace(/^[^A-Za-z0-9]+/, '').trim();
    if (clean) block.push(clean);
  }
  return block.length ? { name: block[0], address: block.slice(1).join(', ') } : null;
};

// The company's name is the line under INVOICE, or else the first line with words.
const findSupplierName = (lines) => {
  const index = lines.findIndex((line) => /^\W*invoice\b/i.test(line));
  const line = index >= 0 ? lines[index + 1] : lines.find((text) => /[a-z]{3}/i.test(text));
  return line ? titleCase(line.replace(/^[^A-Za-z0-9]+/, '').trim()) : '';
};

const findBillDate = (text) => {
  const iso = text.match(/\bdate\s*:?\s*(\d{4})-(\d{2})-(\d{2})/i);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = text.match(/\bdate\s*:?\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})/i);
  return dmy ? `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}` : '';
};

const findBillNumber = (text) => text.match(/\b(?:serial|bill|invoice)\s*no\.?\s*:?\s*([a-z0-9-]+)/i)?.[1] || '';

// Longer names first, so "Soap Large" is not read as "Soap". Same-named stock in several locations is grouped.
const groupStock = (inventory) => {
  const groups = new Map();
  inventory.forEach((stock) => {
    const key = normalize(stock.name);
    groups.set(key, [...(groups.get(key) || []), stock]);
  });
  return [...groups.values()].sort((a, b) => b[0].name.length - a[0].name.length);
};

export const parseBill = (rawText, customers, inventory) => {
  const text = cleanOcrText(rawText);
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const stockGroups = groupStock(inventory);
  const items = [];
  const notes = [];
  const unread = [];
  const usedLines = new Set();

  const invoiceLines = findInvoiceLines(lines);
  const reserved = new Map();

  // Every readable bill line becomes a row to review: known stock, or a new item to save with its MRP.
  invoiceLines.forEach((row) => {
    if (!row.description) {
      unread.push(`Name could not be read: ${row.quantity} ${row.unit}${row.free ? ' (free)' : ` at ${row.rate.toFixed(2)}`}`);
      return;
    }
    const product = parseProduct(row.description);
    const group = stockGroups.find((candidates) => findName(row.description, candidates[0].name));
    const piecesPerCase = group ? group[0].piecesPerCase : product.piecesPerCase;
    const total = row.isCases ? row.quantity * piecesPerCase : row.quantity;
    const stock = group && (group.find((s) => s.quantity - (reserved.get(s._id) || 0) >= total) || group[0]);
    if (stock) reserved.set(stock._id, (reserved.get(stock._id) || 0) + total);
    if (row.corrected) notes.push(`${product.name}: quantity read as ${row.quantity} because the rate and amount add up to that. Please check.`);
    else if (Math.abs(row.quantity * row.rate - row.total) >= 0.01) notes.push(`${product.name}: ${row.quantity} x ${row.rate.toFixed(2)} does not equal ${row.total.toFixed(2)}. Please check.`);
    items.push({
      itemId: stock?._id || null,
      isNew: !stock,
      name: stock?.name || product.name,
      mrp: product.mrp ?? stock?.mrp ?? null,
      quantity: total,
      cases: Math.floor(total / piecesPerCase),
      pieces: total % piecesPerCase,
      piecesPerCase,
      priceAtSale: row.free ? 0 : (row.isCases ? row.rate / piecesPerCase : row.rate),
      locationTakenFrom: stock?.location || '',
      free: row.free,
    });
  });

  // Bills without that layout: look for stock names anywhere in each line.
  (invoiceLines.length ? [] : lines).forEach((line) => {
    if (isTotalLine(line)) return;
    for (const group of stockGroups) {
      const match = findName(line, group[0].name);
      if (!match) continue;
      usedLines.add(line);
      const quantity = parseQuantity(line, match);
      const name = group[0].name;
      if (!quantity) notes.push(`${name}: no quantity found, entered as 1 piece. Line read: "${line}"`);
      else if (!quantity.unitKnown) notes.push(`${name}: quantity ${quantity.pieces} taken as pieces. Change it if the bill means cases.`);
      const { cases = 0, pieces = 1 } = quantity || {};
      const piecesPerCase = group[0].piecesPerCase;
      const total = cases * piecesPerCase + pieces;
      const stock = group.find((s) => s.quantity >= total);
      if (!stock) {
        notes.push(`${name}: the bill says ${total} pieces, but no location has that much stock. Not added.`);
        return;
      }
      items.push({
        itemId: stock._id,
        name: stock.name,
        quantity: total,
        cases: Math.floor(total / stock.piecesPerCase),
        pieces: total % stock.piecesPerCase,
        piecesPerCase: stock.piecesPerCase,
        priceAtSale: stock.price,
        locationTakenFrom: stock.location,
      });
      return;
    }
  });

  let customer = null;
  let bestScore = 0;
  const customerBlock = findCustomerBlock(lines);
  const outletId = text.match(/outlet\s*id\s*:?\s*(\d+)/i)?.[1] || '';
  (customerBlock ? [customerBlock.name] : lines.filter((line) => !usedLines.has(line))).forEach((line) => {
    customers.forEach((candidate) => {
      const match = findName(line, candidate.name);
      if (match && match.score > bestScore) {
        customer = candidate;
        bestScore = match.score;
      }
    });
  });

  (invoiceLines.length ? [] : lines).forEach((line) => {
    const looksLikeItem = /[a-z]{3}/i.test(line) && /\d/.test(line);
    if (looksLikeItem && !usedLines.has(line) && !isTotalLine(line) && !isHeaderLine(line)) unread.push(line);
  });

  return {
    customer: (outletId && customers.find((c) => c.outletId === outletId)) || customer,
    customerName: customerBlock ? titleCase(customerBlock.name) : '',
    customerAddress: customerBlock ? titleCase(customerBlock.address) : '',
    outletId,
    supplierName: findSupplierName(lines),
    billDate: findBillDate(text),
    billNumber: findBillNumber(text),
    items,
    notes,
    unread,
    billTotal: findBillTotal(lines),
    payment: findPaymentHint(text),
  };
};

// Fills in lines whose names could not be read, using a second reading of the same bill.
export const fillUnreadLines = (bill, secondReading) => {
  const known = (item) => bill.items.filter((i) => i.free === item.free && i.quantity === item.quantity && i.name === item.name).length;
  const recovered = secondReading.items.filter((item) => item.free && !known(item));
  if (recovered.length === 0) return bill;
  const unread = [...bill.unread];
  const items = [...bill.items];
  recovered.forEach((item) => {
    const index = unread.findIndex((line) => line.includes(`: ${item.quantity} `) && line.includes('(free)'));
    if (index < 0) return;
    unread.splice(index, 1);
    items.push(item);
  });
  return { ...bill, items, unread };
};
