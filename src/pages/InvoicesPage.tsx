import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { 
  FileText, 
  Search, 
  Printer, 
  Share2, 
  X,
  ChevronLeft,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface Sale {
  id: number;
  total: number;
  discount: number;
  timestamp: string;
  invoice_token: string;
}

export default function InvoicesPage() {
  const { user } = useAppContext();
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      const managerId = user.accountType === 'manager' ? user.id : user.manager_id;
      fetch(`/api/sales/${managerId}`).then(res => res.json()).then(setSales);
    }
  }, [user]);

  const openInvoice = async (sale: Sale) => {
    setSelectedSale(sale);
    const res = await fetch(`/api/sale-items/${sale.id}`);
    const items = await res.json();
    setSaleItems(items);
  };

  const filteredSales = sales.filter(s => 
    s.id.toString().includes(search) || 
    s.invoice_token.includes(search)
  );

  return (
    <div className="p-4 space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input 
          type="text" 
          placeholder="بحث برقم الفاتورة..." 
          className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Invoices List */}
      <div className="space-y-3">
        {filteredSales.map(sale => (
          <button 
            key={sale.id}
            onClick={() => openInvoice(sale)}
            className="w-full bg-white border border-gray-100 p-4 rounded-[1.5rem] flex justify-between items-center hover:shadow-md transition-all group text-right"
          >
            <div className="flex items-center gap-4">
              <div className="bg-gray-50 text-gray-400 p-3 rounded-2xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                <FileText size={20} />
              </div>
              <div>
                <div className="text-sm font-black text-gray-800">فاتورة #{sale.id}</div>
                <div className="text-[10px] text-gray-400 font-bold">{format(new Date(sale.timestamp), 'p - yyyy/MM/dd', { locale: ar })}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-base font-black text-blue-600">{sale.total.toFixed(2)} <span className="text-[10px] opacity-50">{user?.currency || '$'}</span></div>
              <ChevronLeft size={16} className="text-gray-300 group-hover:translate-x-[-4px] transition-transform" />
            </div>
          </button>
        ))}
        {filteredSales.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-100">
            <p className="text-xs text-gray-400 font-bold">لا توجد فواتير مطابقة للبحث</p>
          </div>
        )}
      </div>

      {/* Invoice Detail Modal */}
      {selectedSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div id="invoice-print" className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-blue-600" />
            
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl mb-2">
                <FileText size={32} />
              </div>
              <h2 className="text-2xl font-black text-gray-800">{user?.company_name || 'كاشير بلس'}</h2>
              <div className="flex justify-center items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                <span>فاتورة مبيعات</span>
                <span className="w-1 h-1 bg-gray-300 rounded-full" />
                <span>#{selectedSale.id}</span>
              </div>
              <p className="text-[10px] text-gray-400 font-medium">{format(new Date(selectedSale.timestamp), 'PPpp', { locale: ar })}</p>
            </div>

            <div className="border-y border-gray-100 py-4 space-y-3">
              <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-wider">
                <span className="w-1/2">المنتج</span>
                <span className="w-1/4 text-center">الكمية</span>
                <span className="w-1/4 text-left">السعر</span>
              </div>
              
              <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                {saleItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs font-bold text-gray-700">
                    <span className="w-1/2 truncate">{item.name}</span>
                    <span className="w-1/4 text-center text-gray-400">×{item.quantity}</span>
                    <span className="w-1/4 text-left">{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-bold text-gray-400">الإجمالي النهائي</span>
              <span className="text-2xl font-black text-blue-600">{selectedSale.total.toFixed(2)} <span className="text-xs">{user?.currency || '$'}</span></span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button 
                onClick={() => window.print()}
                className="bg-gray-900 text-white py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 hover:bg-black transition-colors"
              >
                <Printer size={18} /> طباعة
              </button>
              <button 
                className="bg-blue-600 text-white py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
              >
                <Share2 size={18} /> مشاركة
              </button>
            </div>
            <button 
              onClick={() => setSelectedSale(null)} 
              className="w-full text-gray-400 text-xs font-bold py-2 hover:text-gray-600 transition-colors"
            >
              إغلاق النافذة
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
