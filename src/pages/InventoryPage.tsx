import { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import useLongPress from '../hooks/useLongPress';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Scan, 
  X, 
  AlertTriangle,
  Save,
  Barcode
} from 'lucide-react';
import { cn } from '../utils/cn';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';

interface Product {
  id: number;
  name: string;
  barcode: string;
  purchase_price: number;
  sale_price: number;
  quantity: number;
}

export default function InventoryPage() {
  const { user, isPro } = useAppContext();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    purchase_price: 0,
    sale_price: 0,
    quantity: 0
  });

  const [longPressedId, setLongPressedId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number, name: string } | null>(null);
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    fetchProducts();
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [user]);

  const fetchProducts = () => {
    if (user && user.id !== 0) {
      fetch(`/api/products/${user.accountType === 'manager' ? user.id : user.manager_id}`)
        .then(res => res.json())
        .then(setProducts);
    }
  };

  const handleSave = async () => {
    if (!isPro && products.length >= 25 && !editingProduct) {
      alert('لقد وصلت للحد الأقصى للنسخة المجانية (25 منتج) — قم بتفعيل PRO');
      return;
    }

    const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
    const method = editingProduct ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        barcode_type: 'EAN-13',
        manager_id: user?.accountType === 'manager' ? user.id : user?.manager_id
      })
    });

    if (res.ok) {
      fetchProducts();
      setShowAddModal(false);
      setEditingProduct(null);
      setFormData({
        name: '',
        barcode: '',
        purchase_price: 0,
        sale_price: 0,
        quantity: 0
      });

      // Audit Log
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_id: user?.accountType === 'manager' ? user.id : user?.manager_id,
          action: `${editingProduct ? 'تعديل' : 'إضافة'} منتج: ${formData.name}`,
          performed_by: user?.name || user?.username
        })
      });
    }
  };

  const handleDelete = async (id: number, name: string, skipConfirm = false) => {
    if (user?.accountType !== 'manager') {
      alert('عذراً، الحذف متاح للمدير فقط');
      return;
    }

    if (!id) {
      alert('خطأ: معرف المنتج غير موجود');
      return;
    }
    
    if (!skipConfirm) {
      setDeleteTarget({ id, name });
      return;
    }
    
    try {
      console.log(`Frontend: Deleting product ${id}`);
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProducts(prev => prev.filter(p => p.id !== id));
        
        // Audit Log
        await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            manager_id: user?.accountType === 'manager' ? user.id : user?.manager_id,
            action: `حذف منتج: ${name}`,
            performed_by: user?.name || user?.username
          })
        });
      } else {
        const errorData = await res.json();
        alert(`حدث خطأ أثناء حذف المنتج: ${errorData.error || 'خطأ غير معروف'}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('فشل الاتصال بالخادم');
    }
  };

  const startScanner = async () => {
    setIsScanning(true);
    const { Html5Qrcode } = await import('html5-qrcode');
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader-inv");
        scannerRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: "environment" }, 
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            setFormData(prev => ({ ...prev, barcode: decodedText }));
            // Stop scanning immediately after success
            html5QrCode.stop().then(() => {
              scannerRef.current = null;
              setIsScanning(false);
            }).catch(console.error);
          },
          () => {} // ignore errors
        );
      } catch (err) {
        console.error("Unable to start scanning", err);
        setIsScanning(false);
      }
    }, 300);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        scannerRef.current = null;
        setIsScanning(false);
      }).catch((err: any) => {
        console.error("Failed to stop scanner", err);
        setIsScanning(false);
      });
    } else {
      setIsScanning(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.barcode.includes(search)
  );

  return (
    <div className="p-4 space-y-4">
      {/* Search & Add */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="بحث في المخزون..." 
            className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button 
          onClick={() => {
            setEditingProduct(null);
            setFormData({
              name: '',
              barcode: '',
              purchase_price: 0,
              sale_price: 0,
              quantity: 0
            });
            setShowAddModal(true);
          }}
          className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Products List */}
      <div className="space-y-3">
        {filteredProducts.map(product => (
          <ProductItem 
            key={product.id} 
            product={product} 
            longPressedId={longPressedId}
            setLongPressedId={setLongPressedId}
            handleDelete={handleDelete}
            setEditingProduct={setEditingProduct}
            setFormData={setFormData}
            setShowAddModal={setShowAddModal}
          />
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">{editingProduct ? 'تعديل منتج' : 'إضافة منتج جديد'}</h2>
              <button onClick={() => setShowAddModal(false)}><X size={24} /></button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">اسم المنتج</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">الباركود</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                    value={formData.barcode}
                    onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))}
                  />
                  <button 
                    onClick={startScanner}
                    className="bg-gray-100 p-2 rounded-xl"
                  >
                    <Scan size={20} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">سعر الشراء</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData(prev => ({ ...prev, purchase_price: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">سعر البيع</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                    value={formData.sale_price}
                    onChange={(e) => setFormData(prev => ({ ...prev, sale_price: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">الكمية</label>
                <input 
                  type="number" 
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                />
              </div>

              <button 
                onClick={handleSave}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <Save size={20} />
                حفظ المنتج
              </button>
            </div>
          </div>
        </div>
      )}

      {isScanning && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex flex-col items-center justify-center p-4">
          <button 
            onClick={stopScanner}
            className="absolute top-4 right-4 text-white"
          >
            <X size={32} />
          </button>
          <div id="reader-inv" className="w-full max-w-md bg-white rounded-xl overflow-hidden"></div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id, deleteTarget.name, true)}
        title="تأكيد حذف المنتج"
        message={`هل أنت متأكد من حذف المنتج "${deleteTarget?.name}" نهائياً؟ لا يمكن التراجع عن هذه الخطوة.`}
      />
    </div>
  );
}

const ProductItem = ({ 
  product, 
  longPressedId, 
  setLongPressedId, 
  handleDelete,
  setEditingProduct,
  setFormData,
  setShowAddModal
}: { 
  product: Product, 
  longPressedId: number | null, 
  setLongPressedId: (id: number | null) => void,
  handleDelete: (id: number, name: string, skipConfirm?: boolean) => void,
  setEditingProduct: (p: Product) => void,
  setFormData: (d: any) => void,
  setShowAddModal: (s: boolean) => void,
  key?: any
}) => {
  const longPressProps = useLongPress({
    onLongPress: () => setLongPressedId(product.id),
    onClick: () => {
      if (longPressedId === product.id) setLongPressedId(null);
    }
  });

  return (
    <div 
      {...longPressProps}
      className="relative bg-white border border-gray-100 p-4 rounded-[1.5rem] flex justify-between items-center hover:shadow-md transition-all group overflow-hidden"
    >
      {longPressedId === product.id && (
        <div className="absolute inset-0 bg-red-600/95 z-10 flex items-center justify-around px-6 animate-in fade-in slide-in-from-right-full duration-300">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(product.id, product.name, true);
              setLongPressedId(null);
            }}
            className="text-white font-black flex items-center gap-2 text-sm"
          >
            <Trash2 size={20} /> تأكيد الحذف النهائي
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
      
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black",
          product.quantity < 3 ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
        )}>
          {product.name.charAt(0)}
        </div>
        <div className="space-y-0.5">
          <div className="font-black text-gray-800">{product.name}</div>
          <div className="text-[10px] text-gray-400 font-bold flex items-center gap-1 uppercase tracking-wider">
            <Barcode size={10} /> {product.barcode}
          </div>
          <div className="flex gap-3 pt-1">
            <div className="flex flex-col">
              <span className="text-[9px] text-gray-400 font-bold uppercase">شراء</span>
              <span className="text-xs font-black text-gray-600">{product.purchase_price}</span>
            </div>
            <div className="flex flex-col border-r border-gray-100 pr-3">
              <span className="text-[9px] text-blue-400 font-bold uppercase">بيع</span>
              <span className="text-xs font-black text-blue-600">{product.sale_price}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-3">
        <div className={cn(
          "text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1.5",
          product.quantity < 3 ? "bg-red-50 text-red-600 border border-red-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
        )}>
          {product.quantity} قطعة
          {product.quantity < 3 && <AlertTriangle size={10} />}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => {
              setEditingProduct(product);
              setFormData({
                name: product.name,
                barcode: product.barcode,
                purchase_price: product.purchase_price,
                sale_price: product.sale_price,
                quantity: product.quantity
              });
              setShowAddModal(true);
            }}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
          >
            <Edit2 size={16} />
          </button>
          <button 
            onClick={() => handleDelete(product.id, product.name)}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

