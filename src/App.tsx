import { useState, useEffect } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import { 
  ShoppingCart, 
  Package, 
  LayoutDashboard, 
  FileText, 
  BookOpen, 
  User,
  AlertCircle
} from 'lucide-react';
import SalesPage from './pages/SalesPage';
import InventoryPage from './pages/InventoryPage';
import DashboardPage from './pages/DashboardPage';
import InvoicesPage from './pages/InvoicesPage';
import DebtLedgerPage from './pages/DebtLedgerPage';
import SummaryPage from './pages/SummaryPage';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { cn } from './utils/cn';

const NavItem = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick, 
  disabled 
}: { 
  icon: any, 
  label: string, 
  active: boolean, 
  onClick: () => void,
  disabled?: boolean
}) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "flex flex-col items-center justify-center w-full py-2 transition-all duration-200",
      active ? "text-blue-600" : "text-gray-400",
      disabled && "opacity-20 cursor-not-allowed"
    )}
  >
    <div className={cn(
      "p-1 rounded-xl transition-all duration-200",
      active ? "bg-blue-50" : "bg-transparent"
    )}>
      <Icon size={22} strokeWidth={active ? 2.5 : 2} />
    </div>
    <span className={cn(
      "text-[10px] mt-0.5 font-bold transition-all duration-200",
      active ? "opacity-100 scale-105" : "opacity-60"
    )}>{label}</span>
  </button>
);

function AppContent() {
  const { user, activeTab, setActiveTab } = useAppContext();

  // Permissions check
  const canAccess = (tab: string) => {
    if (!user) return false;
    if (user.role === 'guest') {
      return tab === 'sales' || tab === 'summary';
    }
    
    switch (tab) {
      case 'sales': return true;
      case 'inventory': return user.role !== 'regular';
      case 'dashboard': return user.role === 'manager' || user.role === 'deputy';
      case 'invoices': return true;
      case 'debt': return user.role !== 'regular' || user.role === 'manager'; // "موظف ثاني ومدير ونائبه"
      case 'summary': return true;
      default: return false;
    }
  };

  const renderPage = () => {
    switch (activeTab) {
      case 'sales': return <SalesPage />;
      case 'inventory': return <InventoryPage />;
      case 'dashboard': return <DashboardPage />;
      case 'invoices': return <InvoicesPage />;
      case 'debt': return <DebtLedgerPage />;
      case 'summary': return <SummaryPage />;
      default: return <SalesPage />;
    }
  };

  if (!user) return <div className="flex items-center justify-center h-screen">جاري التحميل...</div>;

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900">
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24 no-scrollbar">
        {renderPage()}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around items-center z-20 pb-safe h-16 px-4 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        <NavItem 
          icon={ShoppingCart} 
          label="البيع" 
          active={activeTab === 'sales'} 
          onClick={() => setActiveTab('sales')} 
        />
        <NavItem 
          icon={Package} 
          label="المخزون" 
          active={activeTab === 'inventory'} 
          onClick={() => setActiveTab('inventory')}
          disabled={!canAccess('inventory')}
        />
        <NavItem 
          icon={LayoutDashboard} 
          label="اللوحة" 
          active={activeTab === 'dashboard'} 
          onClick={() => setActiveTab('dashboard')}
          disabled={!canAccess('dashboard')}
        />
        <NavItem 
          icon={BookOpen} 
          label="الديون" 
          active={activeTab === 'debt'} 
          onClick={() => setActiveTab('debt')}
          disabled={!canAccess('debt')}
        />
        <NavItem 
          icon={User} 
          label="الملخص" 
          active={activeTab === 'summary'} 
          onClick={() => setActiveTab('summary')} 
        />
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
