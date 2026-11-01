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

const isTotalLine = (line) => /\b(sub\s*total|grand\s*total|net\s*total|total|amount due|balance)\b/i.test(line);
const isHeaderLine = (line) => /\b(date|invoice|bill\s*no|tel|phone|fax|mobile|discount|cheque|chq|thank|page|qty|price)\b/i.test(line);

const findBillTotal = (lines) => {
  const totals = lines.filter(isTotalLine).filter((line) => !/sub\s*total|balance/i.test(line) && /\d/.test(line));
  const line = totals.find((l) => /grand|net|amount due/i.test(l)) || totals[totals.length - 1];
  return line ? lastAmount(line) : null;
};

const findPaymentHint = (text) => {
  const chequeNumber = text.match(/(?:cheque|chq)\s*(?:no|number|#)?\.?\s*:?\s*(\d{4,})/i)?.[1];
  const found = ['cheque', 'credit', 'cash'].filter((word) =>
    new RegExp(word === 'cheque' ? '\\b(cheque|chq)\\b' : `\\b${word}\\b`, 'i').test(text));
  // A printed form often lists every option, so several words tell us nothing.
  return { method: found.length === 1 ? found[0] : null, chequeNumber: chequeNumber || '' };
};

// Longer names first, so "Soap Large" is not read as "Soap". Same-named stock in several locations is grouped.
const groupStock = (inventory) => {
  const groups = new Map();
  inventory.forEach((stock) => {
    const key = normalize(stock.name);
    groups.set(key, [...(groups.get(key) || []), stock]);
  });
  return [...groups.values()].sort((a, b) => b[0].name.length - a[0].name.length);
};

export const parseBill = (text, customers, inventory) => {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const stockGroups = groupStock(inventory);
  const items = [];
  const notes = [];
  const unread = [];
  const usedLines = new Set();

  lines.forEach((line) => {
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
  lines.filter((line) => !usedLines.has(line)).forEach((line) => {
    customers.forEach((candidate) => {
      const match = findName(line, candidate.name);
      if (match && match.score > bestScore) {
        customer = candidate;
        bestScore = match.score;
      }
    });
  });

  lines.forEach((line) => {
    const looksLikeItem = /[a-z]{3}/i.test(line) && /\d/.test(line);
    if (looksLikeItem && !usedLines.has(line) && !isTotalLine(line) && !isHeaderLine(line)) unread.push(line);
  });

  return {
    customer,
    items,
    notes,
    unread,
    billTotal: findBillTotal(lines),
    payment: findPaymentHint(text),
  };
};
