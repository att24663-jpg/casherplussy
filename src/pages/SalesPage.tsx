import { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Scan, 
  X, 
  CheckCircle,
  Tag,
  Share2,
  Printer
} from 'lucide-react';
import { cn } from '../utils/cn';

interface Product {
  id: number;
  name: string;
  barcode: string;
  sale_price: number;
  quantity: number;
}

interface CartItem extends Product {
  cartQuantity: number;
  discount: number;
}

export default function SalesPage() {
  const { user, isPro } = useAppContext();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanLock, setScanLock] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<number | null>(null);
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    if (user && user.id !== 0) {
      fetch(`/api/products/${user.accountType === 'manager' ? user.id : user.manager_id}`)
        .then(res => res.json())
        .then(setProducts);
    }
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [user]);

  const addToCart = (product: Product) => {
    if (user?.role === 'guest') return;
    
    if (product.quantity <= 0) {
      alert('عذراً، الكمية نفذت من هذا المنتج');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.cartQuantity >= product.quantity) {
          alert('عذراً، لا توجد كمية كافية في المخزون');
          return prev;
        }
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, cartQuantity: item.cartQuantity + 1 } 
            : item
        );
      }
      return [...prev, { ...product, cartQuantity: 1, discount: 0 }];
    });
  };

  const updateCartQuantity = (id: number, delta: number) => {
    const product = products.find(p => p.id === id);
    if (!product) return;

    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.cartQuantity + delta;
        if (delta > 0 && newQty > product.quantity) {
          alert('عذراً، لا توجد كمية كافية في المخزون');
          return item;
        }
        return { ...item, cartQuantity: Math.max(1, newQty) };
      }
      return item;
    }));
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const total = cart.reduce((sum, item) => sum + (item.sale_price * item.cartQuantity) - item.discount, 0);

  const handleCheckout = async (isDebt = false) => {
    if (cart.length === 0) return;
    
    const invoice_token = Math.random().toString(36).substring(2, 15);
    const saleData = {
      manager_id: user?.accountType === 'manager' ? user.id : user?.manager_id,
      employee_id: user?.id,
      total,
      discount: 0,
      invoice_token,
      items: cart.map(item => ({
        product_id: item.id,
        quantity: item.cartQuantity,
        price: item.sale_price,
        discount: item.discount
      }))
    };

    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saleData)
    });

    if (res.ok) {
      const { id } = await res.json();
      setLastSaleId(id);
      setShowInvoice(true);
      setCart([]);
      
      // Audit Log
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_id: saleData.manager_id,
          action: `بيع فاتورة #${id}`,
          performed_by: user?.name || user?.username
        })
      });
    }
  };

  const startScanner = async () => {
    setIsScanning(true);
    setScanLock(false);
    const { Html5Qrcode } = await import('html5-qrcode');
    setTimeout(async () => {
      const html5QrCode = new Html5Qrcode("reader");
      scannerRef.current = html5QrCode;
      try {
        await html5QrCode.start(
          { facingMode: "environment" }, 
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            if (scanLock) return;
            setScanLock(true);
            const product = products.find(p => p.barcode === decodedText);
            if (product) {
              addToCart(product);
              stopScanner();
            } else {
              alert('المنتج غير متوفر');
              setScanLock(false);
            }
          },
          (errorMessage) => {
            // parse error, ignore
          }
        );
      } catch (err) {
        console.error("Unable to start scanning", err);
        setIsScanning(false);
      }
    }, 100);
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

  const handlePrint = () => {
    // Ensure the invoice is visible for printing
    const printContent = document.getElementById('invoice-print');
    if (!printContent) return;
    
    window.print();
  };

  const handleShare = async () => {
    const text = `فاتورة مبيعات من ${user?.company_name}\nرقم الفاتورة: ${lastSaleId}\nالمجموع: ${total.toFixed(2)} ${user?.currency || '$'}\nشكراً لزيارتكم!`;
    
    const fallbackCopy = () => {
      navigator.clipboard.writeText(text).then(() => {
        alert('تم نسخ تفاصيل الفاتورة للحافظة بنجاح للمشاركة');
      }).catch(err => {
        console.error('Clipboard error:', err);
        alert('فشل نسخ النص، يرجى المحاولة مرة أخرى');
      });
    };

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'فاتورة مبيعات',
          text: text,
          url: window.location.href
        });
      } catch (err: any) {
        // If it's not a cancellation, or if sharing is blocked by iframe, fallback to clipboard
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
          fallbackCopy();
        }
      }
    } else {
      fallbackCopy();
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Search & Scan */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="بحث عن منتج أو باركود..." 
            className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button 
          onClick={startScanner}
          className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Scan size={24} />
        </button>
      </div>

      {isScanning && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
          <button 
            onClick={stopScanner}
            className="absolute top-4 right-4 text-white"
          >
            <X size={32} />
          </button>
          <div id="reader" className="w-full max-w-md bg-white rounded-xl overflow-hidden"></div>
          <p className="text-white mt-4">ضع الباركود أمام الكاميرا</p>
        </div>
      )}

      {/* Products Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {filteredProducts.map(product => (
          <button 
            key={product.id}
            onClick={() => addToCart(product)}
            disabled={user?.role === 'guest'}
            className="group bg-white border border-gray-100 p-3 rounded-2xl text-right hover:shadow-lg hover:border-blue-100 transition-all active:scale-95 disabled:opacity-50 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="font-black text-sm text-gray-800 truncate">{product.name}</div>
            <div className="flex justify-between items-end mt-2">
              <div className="text-blue-600 font-black text-base">{product.sale_price} <span className="text-[10px] font-bold opacity-70">{user?.currency || '$'}</span></div>
              <div className={cn(
                "text-[9px] font-bold px-1.5 py-0.5 rounded-md",
                product.quantity < 5 ? "bg-red-50 text-red-500" : "bg-gray-50 text-gray-400"
              )}>
                {product.quantity} متوفر
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Cart Drawer Placeholder (Simplified for now) */}
      {cart.length > 0 && (
        <div className="fixed bottom-20 left-4 right-4 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 z-30 animate-in slide-in-from-bottom">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold">السلة ({cart.length})</h3>
            <button onClick={() => setCart([])} className="text-red-500 text-xs">مسح الكل</button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-3 mb-4 no-scrollbar">
            {cart.map(item => (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-xs font-medium">{item.name}</div>
                  <div className="text-[10px] text-gray-500">{item.sale_price} × {item.cartQuantity}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateCartQuantity(item.id, -1)} className="p-1 bg-gray-100 rounded-lg"><Minus size={14}/></button>
                  <span className="text-xs font-bold w-4 text-center">{item.cartQuantity}</span>
                  <button onClick={() => updateCartQuantity(item.id, 1)} className="p-1 bg-gray-100 rounded-lg"><Plus size={14}/></button>
                  <button onClick={() => removeFromCart(item.id)} className="p-1 text-red-500"><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t pt-4 space-y-3">
            <div className="flex justify-between font-bold text-lg">
              <span>الإجمالي:</span>
              <span>{total.toFixed(2)} {user?.currency || '$'}</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => handleCheckout(false)}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <CheckCircle size={18} />
                إتمام البيع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal Placeholder */}
      {showInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div id="invoice-print" className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-blue-600" />
            
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl mb-2">
                <CheckCircle size={32} />
              </div>
              <h2 className="text-2xl font-black text-gray-800">{user?.company_name || 'كاشير بلس'}</h2>
              <div className="flex justify-center items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                <span>فاتورة مبيعات</span>
                <span className="w-1 h-1 bg-gray-300 rounded-full" />
                <span>#{lastSaleId}</span>
              </div>
              <p className="text-[10px] text-gray-400 font-medium">{new Date().toLocaleString('ar-EG')}</p>
            </div>

            <div className="border-y border-gray-100 py-4 space-y-3">
              <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-wider">
                <span className="w-1/2">المنتج</span>
                <span className="w-1/4 text-center">الكمية</span>
                <span className="w-1/4 text-left">السعر</span>
              </div>
              
              <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                {cart.length === 0 && lastSaleId ? (
                  <p className="text-center text-xs text-blue-600 font-bold py-2">تم حفظ الفاتورة بنجاح</p>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="flex justify-between text-xs font-bold text-gray-700">
                      <span className="w-1/2 truncate">{item.name}</span>
                      <span className="w-1/4 text-center text-gray-400">×{item.cartQuantity}</span>
                      <span className="w-1/4 text-left">{(item.sale_price * item.cartQuantity).toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-bold text-gray-400">الإجمالي النهائي</span>
              <span className="text-2xl font-black text-blue-600">{total.toFixed(2)} <span className="text-xs">{user?.currency || '$'}</span></span>
            </div>

            <div className="text-center text-[10px] font-bold text-gray-400 py-2 bg-gray-50 rounded-xl">
              شكراً لتعاملكم معنا! نتمنى رؤيتكم قريباً
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button 
                onClick={handlePrint}
                className="bg-gray-900 text-white py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 hover:bg-black transition-colors"
              >
                <Printer size={18} /> طباعة
              </button>
              <button 
                onClick={handleShare}
                className="bg-blue-600 text-white py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
              >
                <Share2 size={18} /> مشاركة
              </button>
            </div>
            <button 
              onClick={() => {
                setShowInvoice(false);
                setCart([]); // Clear cart after closing invoice
              }} 
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
