import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { 
  TrendingUp, 
  Package, 
  DollarSign, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  Trash2,
  FileText,
  ShoppingCart,
  BookOpen
} from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '../utils/cn';

interface Sale {
  id: number;
  total: number;
  timestamp: string;
}

export default function DashboardPage() {
  const { user, setActiveTab } = useAppContext();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [filter, setFilter] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily');
  
  useEffect(() => {
    if (user) {
      const managerId = user.accountType === 'manager' ? user.id : user.manager_id;
      fetch(`/api/sales/${managerId}`).then(res => res.json()).then(setSales);
      fetch(`/api/products/${managerId}`).then(res => res.json()).then(setProducts);
    }
  }, [user]);

  const getFilteredSales = () => {
    const now = new Date();
    let start: Date, end: Date;

    switch (filter) {
      case 'daily':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'weekly':
        start = startOfWeek(now);
        end = endOfWeek(now);
        break;
      case 'monthly':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      default:
        return sales;
    }

    return sales.filter(s => {
      const d = new Date(s.timestamp);
      return isWithinInterval(d, { start, end });
    });
  };

  const filteredSales = getFilteredSales();
  const totalSales = filteredSales.reduce((sum, s) => sum + s.total, 0);
  
  // Profit calculation (simplified: assuming current product prices for all past sales)
  // In a real app, you'd store the purchase_price at the time of sale
  const totalProfit = filteredSales.length * 5; // Placeholder logic

  const resetData = async (type: 'sales' | 'full') => {
    if (!confirm('هل أنت متأكد؟ لا يمكن التراجع عن هذه الخطوة.')) return;
    const res = await fetch('/api/manager/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        id: user?.accountType === 'manager' ? user.id : user?.manager_id, 
        type 
      })
    });
    if (res.ok) {
      alert('تمت العملية بنجاح');
      window.location.reload();
    }
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header Stats */}
      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-xl font-black text-gray-800">نظرة عامة</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">إحصائيات متجرك اليوم</p>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {(['daily', 'weekly', 'monthly'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 text-[9px] font-black rounded-lg transition-all duration-200",
                  filter === f ? "bg-white text-blue-600 shadow-sm scale-105" : "text-gray-400"
                )}
              >
                {f === 'daily' && 'يومي'}
                {f === 'weekly' && 'أسبوعي'}
                {f === 'monthly' && 'شهري'}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-gray-100 p-4 rounded-[1.5rem] space-y-2 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
            <div className="bg-blue-600 text-white w-8 h-8 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100 relative z-10">
              <TrendingUp size={16} />
            </div>
            <div className="relative z-10">
              <div className="text-[9px] text-gray-400 font-black uppercase tracking-widest">إجمالي المبيعات</div>
              <div className="text-lg font-black text-gray-800 mt-0.5">{totalSales.toFixed(2)} <span className="text-[10px] opacity-50">{user?.currency || '$'}</span></div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-100 p-4 rounded-[1.5rem] space-y-2 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
            <div className="bg-emerald-600 text-white w-8 h-8 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100 relative z-10">
              <DollarSign size={16} />
            </div>
            <div className="relative z-10">
              <div className="text-[9px] text-gray-400 font-black uppercase tracking-widest">الربح الصافي</div>
              <div className="text-lg font-black text-emerald-600 mt-0.5">{(totalSales * 0.2).toFixed(2)} <span className="text-[10px] opacity-50">{user?.currency || '$'}</span></div>
            </div>
          </div>

          <div className="bg-gray-900 p-5 rounded-[2rem] col-span-2 flex items-center justify-between shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-transparent" />
            <div className="space-y-0.5 relative z-10">
              <div className="text-[9px] text-blue-400 font-black uppercase tracking-widest">حالة المخزون</div>
              <div className="text-xl font-black text-white">{products.length} <span className="text-xs font-bold opacity-50">منتج مسجل</span></div>
              <p className="text-[9px] text-gray-500 font-bold">إجمالي العناصر المتوفرة للبيع</p>
            </div>
            <div className="bg-white/10 w-12 h-12 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/10 relative z-10 group-hover:rotate-12 transition-transform">
              <Package size={24} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">إجراءات سريعة</h3>
        <div className="grid grid-cols-4 gap-3">
          <QuickAction icon={ShoppingCart} label="بيع" color="blue" onClick={() => setActiveTab('sales')} />
          <QuickAction icon={Package} label="مخزون" color="emerald" onClick={() => setActiveTab('inventory')} />
          <QuickAction icon={BookOpen} label="ديون" color="orange" onClick={() => setActiveTab('debt')} />
          <QuickAction icon={FileText} label="فواتير" color="purple" onClick={() => setActiveTab('invoices')} />
        </div>
      </div>

      {/* Recent Sales List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-sm font-black text-gray-800">آخر العمليات</h3>
          <button onClick={() => setActiveTab('invoices')} className="text-blue-600 text-[10px] font-black uppercase tracking-wider hover:underline">عرض الكل</button>
        </div>
        <div className="space-y-3">
          {filteredSales.slice(0, 5).map(sale => (
            <div key={sale.id} className="bg-white border border-gray-100 p-4 rounded-[1.5rem] flex justify-between items-center hover:shadow-md transition-all group">
              <div className="flex items-center gap-4">
                <div className="bg-gray-50 text-gray-400 p-3 rounded-2xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                  <FileText size={20} />
                </div>
                <div>
                  <div className="text-sm font-black text-gray-800">فاتورة #{sale.id}</div>
                  <div className="text-[10px] text-gray-400 font-bold">{format(new Date(sale.timestamp), 'p - yyyy/MM/dd', { locale: ar })}</div>
                </div>
              </div>
              <div className="text-base font-black text-blue-600">+{sale.total.toFixed(2)} <span className="text-[10px] opacity-50">{user?.currency || '$'}</span></div>
            </div>
          ))}
          {filteredSales.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-100">
              <p className="text-xs text-gray-400 font-bold">لا توجد عمليات مسجلة لهذه الفترة</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const QuickAction = ({ icon: Icon, label, color, onClick }: any) => {
  const colors: any = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center gap-2 group"
    >
      <div className={cn(
        "w-full aspect-square rounded-2xl flex items-center justify-center transition-all duration-200 group-hover:scale-110 group-active:scale-95",
        colors[color]
      )}>
        <Icon size={24} />
      </div>
      <span className="text-[10px] font-black text-gray-500 group-hover:text-gray-800">{label}</span>
    </button>
  );
};
