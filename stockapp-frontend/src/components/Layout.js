// src/components/Layout.js
import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowLeftRight, Boxes, ClipboardList, FileClock, Home, Images, Landmark, Menu, PackagePlus, Receipt, ShoppingCart, Users, X } from 'lucide-react';

const NAV = [
  { items: [{ to: '/', label: 'Home', icon: Home }] },
  { title: 'Sales', items: [
    { to: '/photos', label: 'Bill photos', icon: Images },
    { to: '/sales/new', label: 'New sale', icon: ShoppingCart },
    { to: '/sales', label: 'Sales history', icon: FileClock },
  ] },
  { title: 'Money', items: [
    { to: '/credit', label: 'Credit bills', icon: Receipt },
    { to: '/cheques', label: 'Cheques', icon: Landmark },
  ] },
  { title: 'Records', items: [
    { to: '/customers', label: 'Customers', icon: Users },
    { to: '/stock', label: 'Stock', icon: Boxes },
    { to: '/stock/forecast', label: 'What to order', icon: ClipboardList },
    { to: '/stock/receive', label: 'Restock', icon: PackagePlus },
    { to: '/stock/transfer', label: 'Stock transfer', icon: ArrowLeftRight },
  ] },
];

const NavItems = ({ onNavigate }) => (
  <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Main">
    {NAV.map((group, index) => (
      <div key={group.title || index}>
        {group.title && <p className="mb-1 px-3 text-xs font-medium text-brand-100/60">{group.title}</p>}
        {group.items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            onClick={onNavigate}
            className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-white/15 text-white' : 'text-brand-100/80 hover:bg-white/10 hover:text-white'}`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> {label}
          </NavLink>
        ))}
      </div>
    ))}
  </nav>
);

const Brand = () => <Link to="/" className="text-lg font-semibold tracking-tight text-white">StockApp</Link>;

const Layout = ({ children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-brand-950 lg:flex">
        <div className="flex h-16 items-center px-6"><Brand /></div>
        <NavItems />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-brand-950 px-4 lg:hidden">
        <Brand />
        <button type="button" className="rounded p-2 text-white" aria-label="Open menu" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-brand-950">
            <div className="flex h-14 items-center justify-between px-6">
              <Brand />
              <button type="button" className="rounded p-1 text-white" aria-label="Close menu" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <NavItems onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
  );
};

export default Layout;
