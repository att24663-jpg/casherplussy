import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { 
  Settings, 
  Users, 
  Crown, 
  Download, 
  Upload, 
  History, 
  Headset, 
  LogOut, 
  Copy, 
  Check,
  Edit3,
  Lock,
  ChevronLeft,
  Smartphone,
  ShieldCheck,
  User,
  X,
  Shield,
  FileText,
  Info
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '../utils/cn';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';

export default function SummaryPage() {
  const { user, setUser, logout, isPro, setActiveTab } = useAppContext();
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'join'>('login');
  const [copied, setCopied] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [proCode, setProCode] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showEmployees, setShowEmployees] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const [profileForm, setProfileForm] = useState({
    username: '',
    email: '',
    phone: '',
    password: ''
  });
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    phone: '',
    manager_code: '',
    name: ''
  });

  const handleAuth = async () => {
    let endpoint = '';
    if (authMode === 'signup') endpoint = '/api/auth/manager/signup';
    else if (authMode === 'login') endpoint = '/api/auth/manager/login';
    else if (authMode === 'join') endpoint = '/api/auth/employee/join';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (res.ok) {
      const data = await res.json();
      if (authMode === 'join') {
        setUser({ 
          id: data.id, 
          name: formData.name, 
          accountType: 'employee', 
          status: 'pending', 
          role: 'regular' 
        });
        alert('تم إرسال الطلب، بانتظار موافقة المدير');
      } else {
        setUser({ 
          ...data, 
          accountType: authMode === 'signup' || authMode === 'login' ? 'manager' : 'employee',
          role: authMode === 'join' ? 'regular' : 'manager'
        });
        setShowAuth(false);
      }
    } else {
      const err = await res.json();
      alert(err.error || 'حدث خطأ ما');
    }
  };

  const copyCode = () => {
    if (user?.manager_code) {
      navigator.clipboard.writeText(user.manager_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const activatePro = async () => {
    const res = await fetch('/api/pro/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manager_id: user?.id, code: proCode })
    });

    if (res.ok) {
      const data = await res.json();
      setUser({ ...user!, is_pro: true, pro_expiry: data.expiry });
      setShowProModal(false);
      alert('تم تفعيل PRO بنجاح!');
    } else {
      alert('كود غير صالح');
    }
  };

  const [employees, setEmployees] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [settings, setSettings] = useState({
    currency: user?.currency || '$',
    company_name: user?.company_name || 'شركتي'
  });

  useEffect(() => {
    if (showEmployees && user?.accountType === 'manager') {
      fetch(`/api/manager/${user.id}/employees`).then(res => res.json()).then(setEmployees);
    }
  }, [showEmployees]);

  useEffect(() => {
    if (showAudit && isPro) {
      fetch(`/api/audit/${user?.accountType === 'manager' ? user.id : user?.manager_id}`).then(res => res.json()).then(setAuditLogs);
    }
  }, [showAudit]);

  useEffect(() => {
    if (showProfile && user) {
      setProfileForm({
        username: user.username || user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        password: user.password || ''
      });
      setIsEditingProfile(false);
    }
  }, [showProfile, user]);

  const updateProfile = async () => {
    const res = await fetch('/api/manager/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: user?.id,
        username: profileForm.username,
        email: profileForm.email,
        phone: profileForm.phone,
        password: profileForm.password
      })
    });

    if (res.ok) {
      setUser({ ...user!, ...profileForm });
      setIsEditingProfile(false);
      alert('تم تحديث البيانات بنجاح');
    } else {
      const err = await res.json();
      alert(err.error || 'حدث خطأ ما');
    }
  };

  const updateSettings = async () => {
    const res = await fetch('/api/manager/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        id: user?.accountType === 'manager' ? user.id : user?.manager_id, 
        ...settings 
      })
    });
    if (res.ok) {
      setUser({ ...user!, ...settings });
      setShowSettings(false);
      alert('تم حفظ الإعدادات');
    }
  };

  const resetData = async (type: 'sales' | 'full') => {
    const title = type === 'sales' ? 'تصفير الأرباح' : 'حذف كافة البيانات';
    const message = type === 'sales' 
      ? 'هل أنت متأكد من تصفير الأرباح؟ سيتم حذف جميع المبيعات والديون.' 
      : 'هل أنت متأكد من حذف جميع البيانات؟ سيتم حذف المنتجات والمبيعات والديون والسجلات.';
    
    setConfirmConfig({
      isOpen: true,
      title,
      message,
      onConfirm: async () => {
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
      }
    });
  };

  const deleteAccount = async () => {
    setConfirmConfig({
      isOpen: true,
      title: 'حذف الحساب نهائياً',
      message: 'تحذير نهائي: سيتم حذف حسابك وجميع بياناتك نهائياً ولا يمكن استرجاعها. هل أنت متأكد؟',
      onConfirm: async () => {
        const res = await fetch('/api/auth/manager/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: user?.id })
        });
        
        if (res.ok) {
          alert('تم حذف الحساب بنجاح');
          logout();
        } else {
          alert('حدث خطأ أثناء حذف الحساب');
        }
      }
    });
  };
  const updateEmployee = async (id: number, status: string, role: string) => {
    const res = await fetch('/api/manager/employees/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, role })
    });
    if (res.ok) {
      fetch(`/api/manager/${user?.id}/employees`).then(res => res.json()).then(setEmployees);
      // Audit Log
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_id: user?.id,
          action: `تغيير حالة/صلاحية موظف: ${id} إلى ${status}/${role}`,
          performed_by: user?.name || user?.username
        })
      });
    }
  };

  const exportData = async (format: 'pdf' | 'csv' | 'xlsx' | 'txt') => {
    if (!isPro) return;
    const managerId = user?.accountType === 'manager' ? user.id : user?.manager_id;
    const res = await fetch(`/api/products/${managerId}`);
    const data = await res.json();
    
    if (format === 'csv') {
      const headers = ['Name', 'Barcode', 'Purchase Price', 'Sale Price', 'Quantity'];
      const rows = data.map((p: any) => [
        `"${p.name}"`,
        `"${p.barcode}"`,
        p.purchase_price,
        p.sale_price,
        p.quantity
      ]);
      const csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory_${new Date().getTime()}.csv`;
      a.click();
    } else if (format === 'xlsx') {
      const { utils, writeFile } = await import('xlsx');
      const ws = utils.json_to_sheet(data);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Inventory");
      writeFile(wb, "inventory.xlsx");
    } else if (format === 'pdf') {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      doc.text("Inventory Report", 10, 10);
      data.forEach((p: any, i: number) => {
        doc.text(`${p.name} - ${p.barcode} - ${p.sale_price}`, 10, 20 + (i * 10));
      });
      doc.save("inventory.pdf");
    }
  };

  const handleImport = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file || !isPro) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim() !== '');
      const headers = lines[0].split(',');
      
      const products = lines.slice(1).map(line => {
        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // Split by comma not inside quotes
        return {
          name: values[0]?.replace(/"/g, ''),
          barcode: values[1]?.replace(/"/g, ''),
          purchase_price: Number(values[2]),
          sale_price: Number(values[3]),
          quantity: Number(values[4]),
          manager_id: user?.accountType === 'manager' ? user.id : user?.manager_id
        };
      });

      for (const product of products) {
        await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(product)
        });
      }
      alert('تم استيراد البيانات بنجاح');
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Profile Header */}
      <div className="bg-white border border-gray-100 p-8 rounded-[3rem] flex flex-col items-center text-center space-y-4 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-24 bg-blue-600/5 -z-10" />
        <div className="relative">
          <div className="w-28 h-28 bg-blue-100 rounded-[2.5rem] flex items-center justify-center text-blue-600 shadow-inner">
            <User size={56} strokeWidth={1.5} />
          </div>
          <button 
            onClick={() => setShowProfile(true)}
            className="absolute -bottom-1 -right-1 bg-white p-2.5 rounded-2xl shadow-lg border border-gray-100 hover:bg-gray-50 transition-all hover:scale-110 active:scale-90"
          >
            <Edit3 size={18} className="text-blue-600" />
          </button>
        </div>
        <div>
          <h2 className="text-xl font-black text-gray-800 tracking-tight">{user?.username || user?.name || 'حساب ضيف'}</h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">{user?.email || 'قم بتسجيل الدخول لحفظ بياناتك'}</p>
        </div>
        
        <div className="flex gap-2">
          <span className="bg-blue-50 text-blue-600 text-[10px] px-4 py-1.5 rounded-full font-black uppercase tracking-widest">
            {user?.accountType === 'guest' ? 'GUEST' : user?.accountType === 'manager' ? 'MANAGER' : 'EMPLOYEE'}
          </span>
          {isPro && (
            <span className="bg-amber-100 text-amber-600 text-[10px] px-4 py-1.5 rounded-full font-black uppercase tracking-widest flex items-center gap-1.5">
              <Crown size={12} /> PRO
            </span>
          )}
        </div>

        {user?.manager_code && (
          <div className="bg-gray-50 px-5 py-3 rounded-2xl flex items-center gap-4 border border-gray-100 group">
            <div className="text-right">
              <div className="text-[8px] text-gray-400 font-black uppercase tracking-widest">كود المدير</div>
              <span className="text-sm font-mono font-black text-gray-700">{user.manager_code}</span>
            </div>
            <button onClick={copyCode} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm border border-gray-100 hover:bg-blue-50 transition-colors">
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
        )}
      </div>

      {/* Main Menu */}
      <div className="space-y-3">
        {user?.accountType === 'guest' ? (
          <button 
            onClick={() => setShowAuth(true)}
            className="w-full bg-blue-600 text-white py-4 rounded-[2rem] font-black text-base flex items-center justify-center gap-3 shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
          >
            إعداد الحساب (مدير / موظف)
          </button>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3">
              <MenuButton icon={Settings} label="إعدادات المتجر" onClick={() => setShowSettings(true)} />
              <MenuButton icon={Users} label="إدارة الموظفين" onClick={() => setShowEmployees(true)} disabled={user?.accountType !== 'manager'} />
              <MenuButton 
                icon={Crown} 
                label="تفعيل النسخة الاحترافية" 
                onClick={() => setShowProModal(true)} 
                highlight 
                disabled={isPro}
              />
              {isPro && user?.pro_expiry && (
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-[1.5rem] text-center mb-1">
                  <p className="text-[10px] text-amber-600 font-black uppercase tracking-widest">
                    ينتهي اشتراك PRO بعد {differenceInDays(new Date(user.pro_expiry), new Date())} يوم
                  </p>
                </div>
              )}
              <MenuButton 
                icon={FileText} 
                label="سجل الفواتير" 
                onClick={() => setActiveTab('invoices')} 
              />
              <div className="grid grid-cols-2 gap-3">
                <MenuButton icon={Download} label="تصدير" onClick={() => exportData('csv')} locked={!isPro} />
                <div className="relative">
                  <MenuButton icon={Upload} label="استيراد" onClick={() => document.getElementById('import-csv')?.click()} locked={!isPro} />
                  <input 
                    id="import-csv" 
                    type="file" 
                    accept=".csv" 
                    className="hidden" 
                    onChange={handleImport} 
                  />
                </div>
              </div>
              <MenuButton icon={History} label="سجل التتبع" onClick={() => setShowAudit(true)} locked={!isPro} />
              <MenuButton icon={Headset} label="الدعم الفني" onClick={() => window.open('https://wa.me/963934415844', '_blank')} />
              <MenuButton icon={Shield} label="سياسة الخصوصية" onClick={() => setShowPrivacy(true)} />
              <MenuButton icon={LogOut} label="تسجيل الخروج" onClick={logout} danger />
            </div>
          </>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">الإعدادات</h2>
              <button onClick={() => setShowSettings(false)}><X size={24} /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400">اسم الشركة</label>
                <input type="text" className="w-full px-4 py-2 border border-gray-200 rounded-xl" value={settings.company_name} onChange={e => setSettings({...settings, company_name: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400">العملة</label>
                <select className="w-full px-4 py-2 border border-gray-200 rounded-xl" value={settings.currency} onChange={e => setSettings({...settings, currency: e.target.value})}>
                  <option value="$">$ دولار</option>
                  <option value="ل.س">ل.س ليرة سورية</option>
                  <option value="مخصص">مخصص</option>
                </select>
              </div>
              <button onClick={updateSettings} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">حفظ التغييرات</button>
              
              {user?.accountType === 'manager' && (
                <div className="pt-4 border-t space-y-2">
                  <h3 className="text-xs font-bold text-red-500">منطقة الخطر</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => resetData('sales')} className="bg-red-50 text-red-600 py-2 rounded-xl text-[10px] font-bold">تصفير الأرباح</button>
                    <button onClick={() => resetData('full')} className="bg-red-50 text-red-600 py-2 rounded-xl text-[10px] font-bold">حذف البيانات</button>
                  </div>
                  <button onClick={deleteAccount} className="w-full border-2 border-red-600 text-red-600 py-2 rounded-xl text-xs font-bold mt-4">حذف الحساب نهائياً</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Employees Modal */}
      {showEmployees && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-4 max-h-[80vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">إدارة الموظفين</h2>
              <button onClick={() => setShowEmployees(false)}><X size={24} /></button>
            </div>
            <div className="space-y-3">
              {employees.map(emp => (
                <div key={emp.id} className="border border-gray-100 p-4 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="font-bold">{emp.name}</div>
                    <span className={cn(
                      "text-[10px] px-2 py-1 rounded-full font-bold",
                      emp.status === 'pending' ? "bg-yellow-50 text-yellow-600" : "bg-emerald-50 text-emerald-600"
                    )}>{emp.status === 'pending' ? 'بانتظار الموافقة' : 'نشط'}</span>
                  </div>
                  <div className="flex gap-2">
                    <select 
                      className="flex-1 text-xs px-2 py-1 border rounded-lg"
                      value={emp.role}
                      onChange={(e) => updateEmployee(emp.id, emp.status, e.target.value)}
                    >
                      <option value="regular">موظف عادي</option>
                      <option value="advanced">موظف متقدم</option>
                      <option value="deputy">نائب مدير</option>
                    </select>
                    {emp.status === 'pending' ? (
                      <button onClick={() => updateEmployee(emp.id, 'approved', emp.role)} className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-bold">قبول</button>
                    ) : (
                      <button onClick={() => updateEmployee(emp.id, 'rejected', emp.role)} className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-xs font-bold">طرد</button>
                    )}
                  </div>
                </div>
              ))}
              {employees.length === 0 && <p className="text-center text-gray-400 py-8">لا يوجد موظفين حالياً</p>}
            </div>
          </div>
        </div>
      )}

      {/* Audit Logs Modal */}
      {showAudit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-4 max-h-[80vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">سجل التتبع</h2>
              <button onClick={() => setShowAudit(false)}><X size={24} /></button>
            </div>
            <div className="space-y-3">
              {auditLogs.map(log => (
                <div key={log.id} className="text-xs border-b pb-2">
                  <div className="flex justify-between font-bold">
                    <span>{log.action}</span>
                    <span className="text-gray-400">{format(new Date(log.timestamp), 'p - yyyy/MM/dd', { locale: ar })}</span>
                  </div>
                  <div className="text-blue-600">بواسطة: {log.performed_by}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuth && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">
                {authMode === 'login' && 'تسجيل دخول مدير'}
                {authMode === 'signup' && 'إنشاء حساب مدير'}
                {authMode === 'join' && 'انضمام كموظف'}
              </h2>
              <button onClick={() => setShowAuth(false)}><X size={24} /></button>
            </div>

            <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
              <button 
                onClick={() => setAuthMode('login')}
                className={cn("flex-1 py-2 text-xs font-bold rounded-lg", authMode !== 'join' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500")}
              >مدير</button>
              <button 
                onClick={() => setAuthMode('join')}
                className={cn("flex-1 py-2 text-xs font-bold rounded-lg", authMode === 'join' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500")}
              >موظف</button>
            </div>

            <div className="space-y-3">
              {authMode === 'join' ? (
                <>
                  <input type="text" placeholder="الاسم" className="w-full px-4 py-2 border border-gray-200 rounded-xl" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  <input type="text" placeholder="كود المدير" className="w-full px-4 py-2 border border-gray-200 rounded-xl" value={formData.manager_code} onChange={e => setFormData({...formData, manager_code: e.target.value})} />
                </>
              ) : (
                <>
                  {authMode === 'signup' && <input type="text" placeholder="اسم المستخدم" className="w-full px-4 py-2 border border-gray-200 rounded-xl" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />}
                  <input type="email" placeholder="البريد الإلكتروني" className="w-full px-4 py-2 border border-gray-200 rounded-xl" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  <input type="password" placeholder="كلمة السر" className="w-full px-4 py-2 border border-gray-200 rounded-xl" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                  {authMode === 'login' && <input type="text" placeholder="كود المدير" className="w-full px-4 py-2 border border-gray-200 rounded-xl" value={formData.manager_code} onChange={e => setFormData({...formData, manager_code: e.target.value})} />}
                  <input type="text" placeholder="رقم الهاتف" className="w-full px-4 py-2 border border-gray-200 rounded-xl" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </>
              )}
              
              <button onClick={handleAuth} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">
                {authMode === 'login' ? 'دخول' : authMode === 'signup' ? 'إنشاء' : 'إرسال طلب'}
              </button>

              {authMode !== 'join' && (
                <div className="flex justify-center gap-4 text-xs font-bold text-blue-600 pt-2">
                  {authMode === 'login' ? (
                    <button onClick={() => setAuthMode('signup')}>إنشاء حساب</button>
                  ) : (
                    <button onClick={() => setAuthMode('login')}>لديك حساب؟ دخول</button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pro Modal */}
      {showProModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">تفعيل PRO</h2>
              <button onClick={() => setShowProModal(false)}><X size={24} /></button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-amber-50 p-4 rounded-2xl space-y-2 border border-amber-100">
                <div className="flex items-center gap-2 text-amber-700 font-bold">
                  <ShieldCheck size={20} /> ميزات النسخة الاحترافية
                </div>
                <ul className="text-xs text-amber-600 space-y-1 list-disc list-inside">
                  <li>إزالة حد المنتجات (أكثر من 25)</li>
                  <li>تصدير البيانات (PDF, Excel, CSV)</li>
                  <li>نظام تتبع العمليات (Audit Logs)</li>
                  <li>صلاحيات متقدمة للموظفين</li>
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="border border-gray-100 p-4 rounded-2xl text-center space-y-1">
                  <div className="text-[10px] text-gray-400">شهري</div>
                  <div className="text-lg font-bold text-blue-600">$2.99</div>
                </div>
                <div className="border border-blue-200 bg-blue-50 p-4 rounded-2xl text-center space-y-1">
                  <div className="text-[10px] text-blue-400">سنوي</div>
                  <div className="text-lg font-bold text-blue-600">$24</div>
                </div>
              </div>

              <div className="space-y-2">
                <input 
                  type="text" 
                  placeholder="أدخل كود التفعيل" 
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-center font-mono font-bold"
                  value={proCode}
                  onChange={e => setProCode(e.target.value)}
                />
                <button 
                  onClick={activatePro}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold"
                >
                  تفعيل الكود
                </button>
              </div>
              
              <p className="text-[10px] text-center text-gray-400">
                لطلب كود التفعيل تواصل مع الدعم الفني عبر الواتساب
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Privacy Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center sticky top-0 bg-white pb-2">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Shield className="text-blue-600" /> سياسة الخصوصية
              </h2>
              <button onClick={() => setShowPrivacy(false)}><X size={24} /></button>
            </div>
            <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
              <p>نحن نلتزم بحماية بياناتك وخصوصيتك. إليك كيف نتعامل مع المعلومات:</p>
              <div className="space-y-2">
                <h3 className="font-bold text-gray-900">1. البيانات التي نجمعها</h3>
                <p>نجمع فقط البيانات الضرورية لتشغيل حسابك مثل البريد الإلكتروني، اسم المستخدم، ورقم الهاتف لضمان أمان الدخول.</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-gray-900">2. أمان البيانات</h3>
                <p>يتم تخزين بياناتك بشكل آمن ولا يتم مشاركتها مع أي طرف ثالث. جميع العمليات مشفرة ومحمية.</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-gray-900">3. حقوقك</h3>
                <p>لك الحق في الوصول إلى بياناتك، تعديلها، أو حذف حسابك بالكامل في أي وقت من خلال الإعدادات.</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-gray-900">4. التحديثات</h3>
                <p>قد نقوم بتحديث هذه السياسة من وقت لآخر، وسيتم إخطارك بأي تغييرات جوهرية.</p>
              </div>
            </div>
            <button 
              onClick={() => {
                setPrivacyAccepted(true);
                setShowPrivacy(false);
              }}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold mt-4"
            >
              هل تقبل؟ نعم، أوافق
            </button>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <User className="text-blue-600" /> معلومات الحساب
              </h2>
              <button onClick={() => setShowProfile(false)}><X size={24} /></button>
            </div>
            
            <div className="space-y-4">
              {user?.accountType === 'employee' ? (
                <div className="bg-red-50 p-8 rounded-2xl text-center">
                  <Lock className="mx-auto text-red-400 mb-2" size={32} />
                  <p className="text-red-600 font-bold">بيانات مديرك محجوبة</p>
                </div>
              ) : (
                <div className="bg-gray-50 p-4 rounded-2xl space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-bold">الاسم</label>
                    {isEditingProfile ? (
                      <input 
                        type="text" 
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                        value={profileForm.username}
                        onChange={e => setProfileForm({...profileForm, username: e.target.value})}
                      />
                    ) : (
                      <div className="text-sm font-bold">{user?.username || user?.name}</div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-bold">البريد الإلكتروني</label>
                    {isEditingProfile ? (
                      <input 
                        type="email" 
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                        value={profileForm.email}
                        onChange={e => setProfileForm({...profileForm, email: e.target.value})}
                      />
                    ) : (
                      <div className="text-sm font-bold">{user?.email || 'غير متوفر'}</div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-bold">رقم الهاتف</label>
                    {isEditingProfile ? (
                      <input 
                        type="text" 
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                        value={profileForm.phone}
                        onChange={e => setProfileForm({...profileForm, phone: e.target.value})}
                      />
                    ) : (
                      <div className="text-sm font-bold">{user?.phone || 'غير متوفر'}</div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-bold">كلمة السر</label>
                    {isEditingProfile ? (
                      <input 
                        type="text" 
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                        value={profileForm.password}
                        onChange={e => setProfileForm({...profileForm, password: e.target.value})}
                      />
                    ) : (
                      <div className="text-sm font-bold">{user?.password || 'غير متوفر'}</div>
                    )}
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-[10px] text-gray-400 font-bold">نوع الحساب</span>
                    <span className="text-sm font-bold text-blue-600">
                      {user?.accountType === 'manager' ? 'مدير' : 'موظف'}
                    </span>
                  </div>
                </div>
              )}

              {user?.accountType === 'manager' && (
                <div className="bg-blue-50 p-4 rounded-2xl flex items-start gap-3">
                  <Info size={18} className="text-blue-600 mt-0.5" />
                  <p className="text-[10px] text-blue-600 leading-relaxed">
                    يمكنك تعديل بياناتك مرة واحدة فقط كل 24 ساعة. تأكد من صحة المعلومات قبل الحفظ.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {user?.accountType === 'manager' && (
                isEditingProfile ? (
                  <>
                    <button 
                      onClick={updateProfile}
                      className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold"
                    >
                      حفظ
                    </button>
                    <button 
                      onClick={() => setIsEditingProfile(false)}
                      className="flex-1 bg-gray-100 text-gray-800 py-3 rounded-xl font-bold"
                    >
                      إلغاء
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setIsEditingProfile(true)}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold"
                  >
                    تعديل البيانات
                  </button>
                )
              )}
              {!isEditingProfile && (
                <button 
                  onClick={() => setShowProfile(false)}
                  className={cn(
                    "py-3 rounded-xl font-bold",
                    user?.accountType === 'manager' ? "flex-1 bg-gray-100 text-gray-800" : "w-full bg-blue-600 text-white"
                  )}
                >
                  إغلاق
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
      />
    </div>
  );
}

const MenuButton = ({ icon: Icon, label, onClick, danger, highlight, locked, disabled }: any) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "w-full flex items-center justify-between p-5 rounded-[1.5rem] transition-all duration-200 group",
      danger ? "bg-red-50 text-red-600 hover:bg-red-100" : 
      highlight ? "bg-blue-600 text-white shadow-lg shadow-blue-100 hover:bg-blue-700" : 
      "bg-white border border-gray-100 text-gray-700 hover:shadow-md",
      disabled && "opacity-50 cursor-not-allowed grayscale"
    )}
  >
    <div className="flex items-center gap-4">
      <div className={cn(
        "p-3 rounded-2xl transition-colors",
        highlight ? "bg-white/20" : danger ? "bg-red-100" : "bg-gray-50 group-hover:bg-blue-50 group-hover:text-blue-600"
      )}>
        <Icon size={20} strokeWidth={2.5} />
      </div>
      <span className="text-sm font-black uppercase tracking-wide">{label}</span>
    </div>
    <div className="flex items-center gap-2">
      {locked && <Lock size={14} className="text-gray-400" />}
      {!highlight && <ChevronLeft size={18} className={cn("transition-transform group-hover:translate-x-[-4px]", danger ? "text-red-300" : "text-gray-300")} />}
    </div>
  </button>
);
