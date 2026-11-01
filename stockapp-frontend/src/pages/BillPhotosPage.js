import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImageOff, Images } from 'lucide-react';
import { billPhotoUrl, fetchBillPhotoFile, fetchBillPhotos, setBillPhotoStatus } from '../api/billPhotos';
import { Alert, Badge, Button, Card, EmptyState, PageHeader, PageLoading, Stat, useToast } from '../components/ui';
import { apiError, plural } from '../utils/format';

const AGENCIES = [['', 'All agencies'], ['piliyandala', 'Piliyandala'], ['katubedda', 'Katubedda']];
const STATUSES = [['awaiting_approval', 'Late: needs OK'], ['pending', 'To enter'], ['done', 'Entered'], ['skipped', 'Skipped'], ['rejected', 'Not accepted']];
const MESSAGES = { pending: 'Photo accepted.', rejected: 'Photo not accepted.', skipped: 'Photo skipped.' };
const timeText = (date) => new Date(date).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const agencyName = (id) => AGENCIES.find(([key]) => key === id)?.[1] || id;

const Tabs = ({ options, value, onChange, label }) => (
  <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5" role="group" aria-label={label}>
    {options.map(([key, text]) => (
      <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${value === key ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{text}</button>
    ))}
  </div>
);

const BillPhotosPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [agency, setAgency] = useState('');
  const [status, setStatus] = useState('pending');
  const [opening, setOpening] = useState(null);

  const load = useCallback(async () => {
    try {
      setError('');
      setResult(await fetchBillPhotos({ status, ...(agency && { agency }) }));
    } catch (err) {
      setError(apiError(err, 'Could not load bill photos.'));
    }
  }, [agency, status]);

  useEffect(() => { load(); }, [load]);

  const enterSale = async (photo) => {
    setOpening(photo._id);
    try {
      const billFile = await fetchBillPhotoFile(photo);
      navigate('/sales/new', { state: { billFile, photo: { _id: photo._id, agency: photo.agency, billDate: photo.billDate } } });
    } catch (err) {
      setError(apiError(err, 'Could not open this photo.'));
      setOpening(null);
    }
  };

  const changeStatus = async (photo, next) => {
    try {
      await setBillPhotoStatus(photo._id, next);
      toast(MESSAGES[next]);
      load();
    } catch (err) {
      setError(apiError(err, 'Could not change this photo.'));
    }
  };

  if (!result) return <><PageHeader title="Bill photos" />{error ? <Alert>{error}</Alert> : <PageLoading />}</>;

  const late = result.counts.filter((row) => row.status === 'awaiting_approval').reduce((sum, row) => sum + row.count, 0);
  const waiting = (id) => result.counts.filter((row) => row.status === 'pending' && row.agency === id).reduce((sum, row) => sum + row.count, 0);
  const bytes = result.counts.reduce((sum, row) => sum + (row.bytes || 0), 0);

  return (
    <>
      <PageHeader title="Bill photos" subtitle="Photos sent by the agencies. Open one to enter it as a sale." action={<Button variant="secondary" onClick={load}>Refresh</Button>} />
      {error && <Alert className="mb-4">{error}</Alert>}
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Late: needs OK" value={late} tone={late ? 'danger' : 'default'} note="Sent after midnight" />
        <Stat label="Piliyandala to enter" value={waiting('piliyandala')} tone={waiting('piliyandala') ? 'warning' : 'default'} />
        <Stat label="Katubedda to enter" value={waiting('katubedda')} tone={waiting('katubedda') ? 'warning' : 'default'} />
        <Stat label="Photo storage used" value={`${(bytes / 1048576).toFixed(1)} MB`} />
      </div>
      <p className="mb-6 break-all text-sm text-slate-500">Accepted images are saved on this computer in: <span className="font-medium text-slate-700">{result.imagesDir}</span></p>
      <div className="mb-3 flex flex-wrap gap-3">
        <Tabs label="Agency" options={AGENCIES} value={agency} onChange={setAgency} />
        <Tabs label="Status" options={STATUSES} value={status} onChange={setStatus} />
      </div>
      {result.photos.length === 0 ? (
        <Card flush><EmptyState icon={status === 'pending' ? Images : ImageOff} title={status === 'pending' || status === 'awaiting_approval' ? 'No photos waiting' : 'Nothing here'} /></Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500">{plural(result.photos.length, 'photo')}, oldest first</p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {result.photos.map((photo) => (
              <li key={photo._id} className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
                <a href={billPhotoUrl(photo._id)} target="_blank" rel="noreferrer" className="block h-56 bg-slate-100">
                  <img src={billPhotoUrl(photo._id)} alt={`Bill from ${agencyName(photo.agency)}, ${photo.billDate}`} loading="lazy" className="h-full w-full object-contain" />
                </a>
                <div className="flex flex-1 flex-col gap-3 p-3">
                  <div className="flex items-center justify-between gap-2 text-sm"><Badge tone="info">{agencyName(photo.agency)}</Badge><span className="tabular text-slate-600">{photo.billDate}</span></div>
                  {photo.late && (
                    <p className="text-xs text-slate-600"><Badge tone="warning">Late</Badge> Sent {timeText(photo.uploadedAt)}{photo.takenAt ? `, phone says taken ${timeText(photo.takenAt)}` : ''}</p>
                  )}
                  {status === 'pending' && (
                    <div className="mt-auto flex gap-2">
                      <Button className="flex-1" size="sm" busy={opening === photo._id} onClick={() => enterSale(photo)}>Enter sale</Button>
                      <Button size="sm" variant="secondary" onClick={() => changeStatus(photo, 'skipped')}>Skip</Button>
                    </div>
                  )}
                  {status === 'awaiting_approval' && (
                    <div className="mt-auto flex gap-2">
                      <Button className="flex-1" size="sm" onClick={() => changeStatus(photo, 'pending')}>Accept</Button>
                      <Button size="sm" variant="secondary" onClick={() => changeStatus(photo, 'rejected')}>Do not accept</Button>
                    </div>
                  )}
                  {status === 'rejected' && <Button size="sm" variant="secondary" onClick={() => changeStatus(photo, 'pending')}>Accept after all</Button>}
                  {status === 'skipped' && <Button size="sm" variant="secondary" onClick={() => changeStatus(photo, 'pending')}>Move back</Button>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
};

export default BillPhotosPage;
