import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import useLongPress from '../hooks/useLongPress';
import { 
  Plus, 
  Search, 
  User, 
  DollarSign, 
  Trash2, 
  X,
  CheckCircle,
  History
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '../utils/cn';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';

interface Debt {
  id: number;
  customer_name: string;
  amount: number;
  paid: number;
  details: string;
  timestamp: string;
}

export default function DebtLedgerPage() {
  const { user } = useAppContext();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState<Debt | null>(null);
  const [payAmount, setPayAmount] = useState('');
  
  const [showDetails, setShowDetails] = useState<Debt | null>(null);
  
  const [longPressedId, setLongPressedId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number, name: string } | null>(null);
  
  const [formData, setFormData] = useState({
    customer_name: '',
    amount: 0,
    details: ''
  });

  useEffect(() => {
    fetchDebts();
  }, [user]);

  const fetchDebts = () => {
    if (user) {
      const managerId = user.accountType === 'manager' ? user.id : user.manager_id;
      fetch(`/api/debt/${managerId}`).then(res => res.json()).then(setDebts);
    }
  };

  const handleAdd = async () => {
    const res = await fetch('/api/debt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        manager_id: user?.accountType === 'manager' ? user.id : user?.manager_id
      })
    });

    if (res.ok) {
      fetchDebts();
      setShowAddModal(false);
      setFormData({ customer_name: '', amount: 0, details: '' });
    }
  };

  const handlePay = async () => {
    if (!showPayModal) return;
    const res = await fetch('/api/debt/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: showPayModal.id, amount: Number(payAmount) })
    });

    if (res.ok) {
      fetchDebts();
      setShowPayModal(null);
      setPayAmount('');
    }
  };

  const handleDelete = async (id: number, customerName: string, skipConfirm = false) => {
    if (user?.accountType !== 'manager') {
      alert('عذراً، الحذف متاح للمدير فقط');
      return;
    }

    if (!id) {
      alert('خطأ: معرف السجل غير موجود');
      return;
    }
    
    if (!skipConfirm) {
      setDeleteTarget({ id, name: customerName });
      return;
    }
    
    try {
      console.log(`Frontend: Deleting debt ${id}`);
      const res = await fetch(`/api/debt/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDebts(prev => prev.filter(d => d.id !== id));
        
        // Audit Log
        await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            manager_id: user?.accountType === 'manager' ? user.id : user?.manager_id,
            action: `حذف سجل دين: ${customerName}`,
            performed_by: user?.name || user?.username
          })
        });
      } else {
        const errorData = await res.json();
        alert(`حدث خطأ أثناء حذف السجل: ${errorData.error || 'خطأ غير معروف'}`);
      }
    } catch (error) {
      console.error('Delete debt error:', error);
      alert('فشل الاتصال بالخادم');
    }
  };

  const filteredDebts = debts.filter(d => 
    d.customer_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 space-y-4">
      {/* Search & Add */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="بحث عن اسم العميل..." 
            className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Debts List */}
      <div className="space-y-3">
        {filteredDebts.map(debt => (
          <DebtItem 
            key={debt.id} 
            debt={debt} 
            longPressedId={longPressedId}
            setLongPressedId={setLongPressedId}
            handleDelete={handleDelete}
            setShowPayModal={setShowPayModal}
            setShowDetails={setShowDetails}
          />
        ))}
      </div>

      {/* Add Debt Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">إضافة دين جديد</h2>
              <button onClick={() => setShowAddModal(false)}><X size={24} /></button>
            </div>
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="اسم الشخص" 
                className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                value={formData.customer_name}
                onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
              />
              <input 
                type="number" 
                placeholder="المبلغ" 
                className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                value={formData.amount || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: Number(e.target.value) }))}
              />
              <textarea 
                placeholder="تفاصيل (اختياري)" 
                className="w-full px-4 py-2 border border-gray-200 rounded-xl h-24"
                value={formData.details}
                onChange={(e) => setFormData(prev => ({ ...prev, details: e.target.value }))}
              />
              <button 
                onClick={handleAdd}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Modal */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-4">
            <h2 className="font-bold">تسجيل دفعة لـ {showPayModal.customer_name}</h2>
            <input 
              type="number" 
              placeholder="المبلغ المدفوع" 
              className="w-full px-4 py-2 border border-gray-200 rounded-xl"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handlePay} className="bg-emerald-600 text-white py-2 rounded-xl font-bold">تأكيد</button>
              <button onClick={() => setShowPayModal(null)} className="bg-gray-100 py-2 rounded-xl font-bold">إلغاء</button>
            </div>
          </div>
        </div>
      )}
      {/* Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">تفاصيل الدين</h2>
              <button onClick={() => setShowDetails(null)}><X size={24} /></button>
            </div>
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-2xl">
                <div className="text-xs text-gray-400 mb-1">العميل</div>
                <div className="font-bold">{showDetails.customer_name}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl">
                <div className="text-xs text-gray-400 mb-1">التفاصيل</div>
                <div className="text-sm whitespace-pre-wrap">{showDetails.details || 'لا توجد تفاصيل إضافية'}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 p-3 rounded-2xl">
                  <div className="text-[10px] text-blue-400">إجمالي الدين</div>
                  <div className="font-bold text-blue-600">{showDetails.amount}</div>
                </div>
                <div className="bg-emerald-50 p-3 rounded-2xl">
                  <div className="text-[10px] text-emerald-400">المبلغ المدفوع</div>
                  <div className="font-bold text-emerald-600">{showDetails.paid}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id, deleteTarget.name, true)}
        title="تأكيد حذف سجل الدين"
        message={`هل أنت متأكد من حذف سجل الدين الخاص بـ "${deleteTarget?.name}"؟ لا يمكن التراجع عن هذه الخطوة.`}
      />
    </div>
  );
}

const DebtItem = ({ 
  debt, 
  longPressedId, 
  setLongPressedId, 
  handleDelete,
  setShowPayModal,
  setShowDetails
}: { 
  debt: Debt, 
  longPressedId: number | null, 
  setLongPressedId: (id: number | null) => void,
  handleDelete: (id: number, name: string, skipConfirm?: boolean) => void,
  setShowPayModal: (d: Debt | null) => void,
  setShowDetails: (d: Debt | null) => void,
  key?: any
}) => {
  const longPressProps = useLongPress({
    onLongPress: () => setLongPressedId(debt.id),
    onClick: () => {
      if (longPressedId === debt.id) setLongPressedId(null);
    }
  });

  const remaining = debt.amount - debt.paid;

  return (
    <div 
      {...longPressProps}
      className="relative bg-white border border-gray-100 p-5 rounded-[2rem] space-y-4 overflow-hidden hover:shadow-md transition-all group"
    >
      {longPressedId === debt.id && (
        <div className="absolute inset-0 bg-red-600/95 z-10 flex items-center justify-around px-6 animate-in fade-in slide-in-from-right-full duration-300">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(debt.id, debt.customer_name, true);
              setLongPressedId(null);
            }}
            className="text-white font-black flex items-center gap-2 text-sm"
          >
            <Trash2 size={20} /> تأكيد حذف السجل
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setLongPressedId(null);
            }}
            className="text-white/80 text-xs font-bold"
          >
            إلغاء
          </button>
        </div>
      )}
      
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-xl font-black">
            {debt.customer_name.charAt(0)}
          </div>
          <div>
            <div className="font-black text-gray-800">{debt.customer_name}</div>
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{format(new Date(debt.timestamp), 'yyyy/MM/dd', { locale: ar })}</div>
          </div>
        </div>
        <button 
          onClick={() => handleDelete(debt.id, debt.customer_name)} 
          className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
        >
          <Trash2 size={18}/>
        </button>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 p-3 rounded-2xl text-center space-y-1">
          <div className="text-[9px] text-gray-400 font-black uppercase tracking-widest">المبلغ</div>
          <div className="text-sm font-black text-gray-700">{debt.amount}</div>
        </div>
        <div className="bg-emerald-50 p-3 rounded-2xl text-center space-y-1">
          <div className="text-[9px] text-emerald-400 font-black uppercase tracking-widest">المدفوع</div>
          <div className="text-sm font-black text-emerald-600">{debt.paid}</div>
        </div>
        <div className={cn(
          "p-3 rounded-2xl text-center space-y-1",
          remaining > 0 ? "bg-orange-50" : "bg-blue-50"
        )}>
          <div className={cn(
            "text-[9px] font-black uppercase tracking-widest",
            remaining > 0 ? "text-orange-400" : "text-blue-400"
          )}>المتبقي</div>
          <div className={cn(
            "text-sm font-black",
            remaining > 0 ? "text-orange-600" : "text-blue-600"
          )}>{remaining}</div>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button 
          onClick={() => setShowPayModal(debt)}
          className="flex-1 bg-gray-900 text-white py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-2 hover:bg-black transition-colors"
        >
          <DollarSign size={16} /> تسجيل دفعة
        </button>
        <button 
          onClick={() => setShowDetails(debt)}
          className="flex-1 bg-blue-50 text-blue-600 py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors"
        >
          <History size={16} /> التفاصيل
        </button>
      </div>
    </div>
  );
};
