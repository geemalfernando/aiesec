// utils/imageStore.js
// Keeps a copy of every accepted image on this computer:
//   <folder>/Daily Bills/<Agency>/<YYYY-MM-DD>/bill-<id>.jpg
//   <folder>/Company Invoices/<YYYY-MM-DD>/<company>-<bill>-<id>.jpg
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const BillPhoto = require('../models/BillPhoto');

const SYNC_MS = 60 * 1000;
const RECONCILE_DAYS = 7;
const SAVABLE = ['pending', 'done', 'skipped'];
const EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic' };

const imagesDir = () => process.env.IMAGES_DIR || path.join(os.homedir(), 'StockApp Images');
const safeName = (text) => String(text || '').replace(/[^A-Za-z0-9 ._-]+/g, ' ').replace(/^[. ]+/, '').trim().slice(0, 60) || 'Unknown';
const titleCase = (text) => safeName(text).replace(/^\w/, (letter) => letter.toUpperCase());
const dayOf = (date) => (date ? new Date(date).toISOString().slice(0, 10) : new Intl.DateTimeFormat('en-CA', { timeZone: process.env.BUSINESS_TZ || 'Asia/Colombo' }).format(new Date()));

// Written to a temporary name first, so a crash cannot leave half an image.
const writeFile = async (file, data) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.part`;
  await fs.writeFile(temporary, data);
  await fs.rename(temporary, file);
  return file;
};

const dailyBillFolder = (agency, day) => path.join(imagesDir(), 'Daily Bills', titleCase(agency), safeName(day));

const saveDailyBill = ({ agency, day, id, data, type = 'image/jpeg' }) =>
  writeFile(path.join(dailyBillFolder(agency, day), `bill-${id}${EXTENSIONS[type] || '.jpg'}`), data);

const saveCompanyInvoice = ({ supplierName, billNumber, day, id, data, type = 'image/jpeg' }) => {
  const label = [safeName(supplierName), billNumber && safeName(billNumber), id].filter(Boolean).join('-');
  return writeFile(path.join(imagesDir(), 'Company Invoices', safeName(day), `${label}${EXTENSIONS[type] || '.jpg'}`), data);
};

// A photo an agency removed from the collector is moved aside here, never deleted.
const moveRemovedPhotos = async () => {
  const root = path.join(imagesDir(), 'Daily Bills');
  const cutoff = dayOf(new Date(Date.now() - RECONCILE_DAYS * 86400000));
  const agencies = await fs.readdir(root).catch(() => []);
  for (const agency of agencies.filter((name) => name !== 'Office')) {
    const days = await fs.readdir(path.join(root, agency)).catch(() => []);
    for (const day of days.filter((name) => name >= cutoff)) {
      const files = await fs.readdir(path.join(root, agency, day)).catch(() => []);
      for (const file of files) {
        const id = file.match(/^bill-([0-9a-f]{24})\./)?.[1];
        if (id && !(await BillPhoto.exists({ _id: id }))) {
          const target = path.join(imagesDir(), 'Removed By Agency', agency, day);
          await fs.mkdir(target, { recursive: true });
          await fs.rename(path.join(root, agency, day, file), path.join(target, file));
        }
      }
    }
  }
};

// Copies photos that have arrived in the database and are accepted. Returns how many were saved.
const runSync = async () => {
  const waiting = await BillPhoto.find({ status: { $in: SAVABLE }, savedPath: { $exists: false } }).select('agency billDate').limit(200).lean();
  let saved = 0;
  for (const { _id } of waiting) {
    const photo = await BillPhoto.findById(_id);
    if (!photo) continue;
    const savedPath = await saveDailyBill({ agency: photo.agency, day: photo.billDate, id: photo._id, data: photo.image });
    await BillPhoto.updateOne({ _id }, { $set: { savedPath } });
    saved += 1;
  }
  await moveRemovedPhotos();
  return saved;
};

// Only one copy runs at a time: the timer and an Accept can both ask at the same moment.
let running = null;
const syncBillPhotos = () => {
  if (!running) running = runSync().finally(() => { running = null; });
  return running;
};

const startImageSync = () => {
  const run = () => syncBillPhotos().catch((error) => console.error('Could not save bill photos:', error.message));
  run();
  return setInterval(run, SYNC_MS);
};

module.exports = { imagesDir, dayOf, saveDailyBill, saveCompanyInvoice, syncBillPhotos, startImageSync };
