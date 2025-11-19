import React, { useState, useEffect } from 'react';
// Dependencies: lucide-react, firebase

// แยกบรรทัด Import เพื่อป้องกัน Build Error
import { Plus, Wallet, TrendingUp, TrendingDown, Trash2, DollarSign } from 'lucide-react';
import { Activity, Briefcase, Coffee, Home, ShoppingBag } from 'lucide-react';
import { FileSpreadsheet, Cloud, Loader2, HandCoins, ArrowRightLeft } from 'lucide-react';
import { CheckCircle2, User, X, Calendar, BarChart3 } from 'lucide-react';
import { Image as ImageIcon } from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, deleteDoc, doc, query, 
  onSnapshot, updateDoc, arrayUnion 
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ------------------------------------------------------------------
// ⚙️ ส่วนการตั้งค่า Firebase (Config)
// ------------------------------------------------------------------

// 1. Config สำหรับ Standalone (สำหรับการนำไปใช้จริง ใส่ของคุณตรงนี้)
const manualConfig = {
  apiKey: "AIzaSyB8hiKkgTJVd16rjosL-um4q-1ZEfcAsDQ",
  authDomain: "parker-wallet.firebaseapp.com",
  projectId: "parker-wallet",
  storageBucket: "parker-wallet.firebasestorage.app",
  messagingSenderId: "275755260782",
  appId: "1:275755260782:web:38afbe5888f006a6c2bf7f"
};

// 2. Logic ตรวจสอบสภาพแวดล้อม (แก้ไข App ID ให้ปลอดภัย)
const isPreviewEnv = typeof __firebase_config !== 'undefined';
const firebaseConfig = isPreviewEnv ? JSON.parse(__firebase_config) : manualConfig;

// 🛠️ FIX: กรองตัวอักษรพิเศษออกจาก appId เพื่อป้องกัน Error: Invalid collection reference
const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const appId = rawAppId.replace(/[^a-zA-Z0-9_-]/g, '_');

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Helper Functions
const getCollectionRef = (uid, colName) => {
  if (isPreviewEnv) return collection(db, 'artifacts', appId, 'users', uid, colName);
  return collection(db, 'users', uid, colName);
};

const getDocRef = (uid, colName, docId) => {
  if (isPreviewEnv) return doc(db, 'artifacts', appId, 'users', uid, colName, docId);
  return doc(db, 'users', uid, colName, docId);
};

// --- Constants ---
const WALLETS = [
  { id: 'cash', name: 'เงินสด', color: 'bg-green-500' },
  { id: 'kbank', name: 'KBank', color: 'bg-emerald-600' },
  { id: 'scb', name: 'SCB', color: 'bg-purple-600' },
  { id: 'bbl', name: 'Bangkok Bank', color: 'bg-blue-800' },
  { id: 'ktb', name: 'Krungthai', color: 'bg-sky-500' },
  { id: 'ttb', name: 'ttb', color: 'bg-blue-600' },
  { id: 'credit', name: 'บัตรเครดิต', color: 'bg-gray-600' }
];

const CATEGORIES = {
  income: [
    { id: 'freelance', name: 'งาน Freelance', icon: Briefcase, color: 'bg-emerald-100 text-emerald-600' },
    { id: 'salary', name: 'เงินเดือน', icon: DollarSign, color: 'bg-blue-100 text-blue-600' },
    { id: 'investment', name: 'การลงทุน', icon: TrendingUp, color: 'bg-purple-100 text-purple-600' },
    { id: 'other_income', name: 'รายรับอื่นๆ', icon: Wallet, color: 'bg-gray-100 text-gray-600' }
  ],
  expense: [
    { id: 'food', name: 'อาหาร/เครื่องดื่ม', icon: Coffee, color: 'bg-orange-100 text-orange-600' },
    { id: 'transport', name: 'เดินทาง', icon: ShoppingBag, color: 'bg-yellow-100 text-yellow-600' },
    { id: 'health', name: 'สุขภาพ/ยา', icon: Activity, color: 'bg-red-100 text-red-600' },
    { id: 'housing', name: 'ที่พัก/น้ำไฟ', icon: Home, color: 'bg-indigo-100 text-indigo-600' },
    { id: 'shopping', name: 'ของใช้ส่วนตัว', icon: ShoppingBag, color: 'bg-pink-100 text-pink-600' },
    { id: 'debt_payment', name: 'ชำระหนี้', icon: HandCoins, color: 'bg-rose-100 text-rose-600' },
    { id: 'other_expense', name: 'จิปาถะ', icon: Wallet, color: 'bg-gray-100 text-gray-600' }
  ]
};

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, transactions, debts
  
  // Data State
  const [transactions, setTransactions] = useState([]);
  const [debts, setDebts] = useState([]);
  
  // Transaction Form State
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState('');
  const [wallet, setWallet] = useState('cash');
  const [image, setImage] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Debt Form State
  const [debtAmount, setDebtAmount] = useState('');
  const [debtPerson, setDebtPerson] = useState('');
  const [debtType, setDebtType] = useState('payable');
  const [showDebtForm, setShowDebtForm] = useState(false);
  
  // Repayment Modal State
  const [repayModal, setRepayModal] = useState(null);
  const [repayAmount, setRepayAmount] = useState('');

  // Auth & Data Sync
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (isPreviewEnv && typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth Error", err); }
    };
    initAuth();
    return onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    // Fetch Transactions
    const qTrans = query(getCollectionRef(user.uid, 'transactions'));
    const unsubTrans = onSnapshot(qTrans, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(data);
    });

    // Fetch Debts
    const qDebts = query(getCollectionRef(user.uid, 'debts'));
    const unsubDebts = onSnapshot(qDebts, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (a.isSettled === b.isSettled ? new Date(b.date) - new Date(a.date) : a.isSettled ? 1 : -1));
      setDebts(data);
      setLoading(false);
    });

    return () => { unsubTrans(); unsubDebts(); };
  }, [user]);

  // --- Handlers ---
  const handleImageUpload = async (file) => {
    if (!file) return null;
    try {
      const storageRef = ref(storage, `users/${user.uid}/slips/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (error) {
      console.error("Upload failed:", error);
      if (!isPreviewEnv) alert("การอัปโหลดรูปล้มเหลว (ตรวจสอบ Storage ใน Firebase)");
      return null;
    }
  };

  const handleTransSubmit = async (e) => {
    e.preventDefault();
    if (!amount || !category || !user) return;
    
    setIsUploading(true);
    const imageUrl = await handleImageUpload(image);
    setIsUploading(false);

    try {
      await addDoc(getCollectionRef(user.uid, 'transactions'), {
        amount: Number(amount),
        description: description || (type === 'income' ? 'รายรับ' : 'รายจ่าย'),
        type, category, wallet, imageUrl,
        date: new Date().toISOString()
      });
      setAmount(''); setDescription(''); setCategory(''); setImage(null); setShowForm(false);
    } catch (error) { console.error(error); setIsUploading(false); }
  };

  const handleDebtSubmit = async (e) => {
    e.preventDefault();
    if (!debtAmount || !debtPerson || !user) return;
    try {
      await addDoc(getCollectionRef(user.uid, 'debts'), {
        totalAmount: Number(debtAmount),
        remainingAmount: Number(debtAmount),
        person: debtPerson,
        type: debtType,
        isSettled: false,
        history: [],
        date: new Date().toISOString()
      });
      setDebtAmount(''); setDebtPerson(''); setShowDebtForm(false);
    } catch (error) { console.error(error); }
  };

  const handleRepayment = async () => {
    if (!repayModal || !repayAmount || !user) return;
    const payAmt = Number(repayAmount);
    if (payAmt <= 0) return;

    try {
      const newRemaining = Math.max(0, repayModal.remainingAmount - payAmt);
      const isFullyPaid = newRemaining === 0;
      await updateDoc(getDocRef(user.uid, 'debts', repayModal.id), {
        remainingAmount: newRemaining,
        isSettled: isFullyPaid,
        history: arrayUnion({ date: new Date().toISOString(), amount: payAmt, note: 'ผ่อนชำระ' })
      });
      if (repayModal.type === 'payable') {
         await addDoc(getCollectionRef(user.uid, 'transactions'), {
            amount: payAmt,
            description: `ผ่อนหนี้: ${repayModal.person}`,
            type: 'expense',
            category: 'debt_payment',
            wallet: 'cash',
            date: new Date().toISOString()
         });
      }
      setRepayModal(null); setRepayAmount('');
    } catch (error) { console.error(error); }
  };

  const deleteTransaction = async (id) => { if (user) await deleteDoc(getDocRef(user.uid, 'transactions', id)); };
  const deleteDebt = async (id) => { if (user) await deleteDoc(getDocRef(user.uid, 'debts', id)); };

  // --- Utilities ---
  const formatCurrency = (num) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(num);
  const formatDate = (str) => new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(str));

  // --- Dashboard Logic ---
  const getMonthlyStats = () => {
    const stats = {};
    transactions.forEach(t => {
      const date = new Date(t.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!stats[key]) stats[key] = { income: 0, expense: 0, key };
      if (t.type === 'income') stats[key].income += Number(t.amount);
      else stats[key].expense += Number(t.amount);
    });
    return Object.values(stats).sort((a, b) => b.key.localeCompare(a.key));
  };

  if (!user && loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-24 md:pb-0">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 pb-24 rounded-b-[2rem] shadow-lg text-white relative">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Parker's Wallet Pro 🚀</h1>
            <div className="bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center gap-1">
               {loading ? <Loader2 size={12} className="animate-spin" /> : <Cloud size={12} />}
            </div>
          </div>
        </div>
        <div className="text-center mb-2">
          <p className="text-sm text-blue-100">ความมั่งคั่งสุทธิ</p>
          <h2 className="text-4xl font-bold">{formatCurrency(transactions.reduce((acc, t) => acc + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0))}</h2>
        </div>
        {/* Wallet Cards */}
        <div className="flex gap-3 overflow-x-auto pb-2 mt-4 no-scrollbar" style={{scrollbarWidth: 'none'}}>
           {WALLETS.map(w => {
             const bal = transactions.filter(t => t.wallet === w.id).reduce((acc, t) => acc + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
             return (
               <div key={w.id} className="flex-shrink-0 bg-white/10 backdrop-blur-md p-3 rounded-xl min-w-[120px] border border-white/10">
                 <div className="flex items-center gap-1 mb-1">
                   <div className={`w-2 h-2 rounded-full ${w.color}`}></div>
                   <span className="text-xs text-blue-50">{w.name}</span>
                 </div>
                 <p className="font-bold text-sm">{formatCurrency(bal)}</p>
               </div>
             )
           })}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 -mt-8 relative z-20 mb-6">
        <div className="bg-white rounded-full shadow-lg p-1 flex justify-between">
          {[{ id: 'dashboard', label: 'ภาพรวม', icon: BarChart3 }, { id: 'transactions', label: 'จดบันทึก', icon: Wallet }, { id: 'debts', label: 'หนี้สิน', icon: HandCoins }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 py-2 rounded-full text-xs font-bold flex flex-col items-center gap-1 transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}>
              <tab.icon size={18} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto pb-24">
        {activeTab === 'dashboard' && (
          <div className="space-y-4 animation-fade-in">
             <h3 className="font-bold text-gray-700 flex items-center gap-2"><Calendar size={18}/> สรุปรายเดือน</h3>
             {getMonthlyStats().length === 0 ? <div className="text-center text-gray-400 py-8">ยังไม่มีข้อมูล</div> : getMonthlyStats().map(stat => (
               <div key={stat.key} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                 <div className="flex justify-between mb-3 font-bold text-gray-600">
                    <span>{stat.key}</span>
                    <span className={stat.income - stat.expense >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                      {stat.income - stat.expense > 0 ? '+' : ''}{formatCurrency(stat.income - stat.expense)}
                    </span>
                 </div>
                 <div className="space-y-2">
                   <div className="flex items-center gap-2">
                     <span className="text-xs w-12 text-emerald-600">รายรับ</span>
                     <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden"><div className="bg-emerald-400 h-full" style={{ width: `${Math.min((stat.income / (stat.income + stat.expense || 1)) * 100, 100)}%` }}></div></div>
                     <span className="text-xs w-16 text-right">{formatCurrency(stat.income)}</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <span className="text-xs w-12 text-rose-600">รายจ่าย</span>
                     <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden"><div className="bg-rose-400 h-full" style={{ width: `${Math.min((stat.expense / (stat.income + stat.expense || 1)) * 100, 100)}%` }}></div></div>
                     <span className="text-xs w-16 text-right">{formatCurrency(stat.expense)}</span>
                   </div>
                 </div>
               </div>
             ))}
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="animation-fade-in">
            {showForm ? (
              <div className="bg-white p-6 rounded-2xl shadow-xl mb-6 border border-blue-100 relative">
                <button onClick={()=>setShowForm(false)} className="absolute top-4 right-4 text-gray-400"><X size={20}/></button>
                <h3 className="text-lg font-bold mb-4 text-gray-700">บันทึกรายการใหม่</h3>
                <div className="flex bg-gray-100 rounded-lg p-1 mb-4">
                  <button onClick={() => setType('income')} className={`flex-1 py-2 rounded-md text-sm font-bold ${type === 'income' ? 'bg-emerald-500 text-white' : 'text-gray-500'}`}>รายรับ</button>
                  <button onClick={() => setType('expense')} className={`flex-1 py-2 rounded-md text-sm font-bold ${type === 'expense' ? 'bg-rose-500 text-white' : 'text-gray-500'}`}>รายจ่าย</button>
                </div>
                <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" className="w-full p-3 text-2xl font-bold bg-gray-50 rounded-xl mb-4 border text-center focus:ring-2 focus:ring-blue-500 outline-none" autoFocus />
                <div className="mb-4 overflow-x-auto no-scrollbar" style={{scrollbarWidth: 'none'}}>
                  <div className="flex gap-2">{WALLETS.map(w => (<button key={w.id} onClick={()=>setWallet(w.id)} className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs border whitespace-nowrap ${wallet === w.id ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-gray-50 border-transparent'}`}><div className={`w-2 h-2 rounded-full ${w.color}`}></div> {w.name}</button>))}</div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {(type === 'income' ? CATEGORIES.income : CATEGORIES.expense).map(cat => (
                    <button key={cat.id} onClick={() => setCategory(cat.id)} className={`p-2 rounded-lg flex flex-col items-center text-xs border-2 ${category === cat.id ? 'border-blue-500 bg-blue-50' : 'border-transparent bg-gray-50'}`}>
                      <div className={`p-1.5 rounded-full mb-1 ${cat.color}`}><cat.icon size={16} /></div><span className="truncate w-full text-center">{cat.name}</span>
                    </button>
                  ))}
                </div>
                <input type="text" value={description} onChange={e=>setDescription(e.target.value)} placeholder="รายละเอียด..." className="w-full p-3 text-sm bg-gray-50 rounded-xl mb-4 border" />
                <div className="mb-4"><label className="flex items-center gap-2 text-sm text-gray-500 p-3 border border-dashed rounded-xl cursor-pointer hover:bg-gray-50"><ImageIcon size={18} />{image ? <span className="text-blue-600 truncate">{image.name}</span> : "แนบรูปสลิป"}<input type="file" accept="image/*" onChange={(e)=>setImage(e.target.files[0])} className="hidden" /></label></div>
                <button onClick={handleTransSubmit} disabled={!amount || !category || isUploading} className={`w-full py-3 text-white rounded-xl font-bold shadow-lg flex justify-center gap-2 ${!amount || !category || isUploading ? 'bg-gray-300' : 'bg-blue-600'}`}>{isUploading ? <Loader2 className="animate-spin"/> : 'บันทึก'}</button>
              </div>
            ) : (
              <button onClick={() => setShowForm(true)} className="w-full bg-white border-2 border-dashed border-blue-200 text-blue-500 p-4 rounded-xl font-bold mb-6 flex justify-center gap-2 hover:bg-blue-50 transition-colors"><Plus/> จดรายรับ/รายจ่าย</button>
            )}
            <div className="space-y-3">
              {transactions.map(t => {
                const cat = (t.type === 'income' ? CATEGORIES.income : CATEGORIES.expense).find(c => c.id === t.category) || {icon:Wallet, color:'bg-gray-100', name:'-'};
                const w = WALLETS.find(wal => wal.id === t.wallet) || WALLETS[0];
                return (
                  <div key={t.id} className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center border border-gray-50">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cat.color}`}><cat.icon size={20}/></div>
                      <div><p className="font-bold text-sm text-gray-700">{t.description}</p><div className="flex items-center gap-2 text-xs text-gray-400"><span>{formatDate(t.date)}</span><span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 flex items-center gap-1"><div className={`w-1.5 h-1.5 rounded-full ${w.color}`}></div> {w.name}</span>{t.imageUrl && <a href={t.imageUrl} target="_blank" rel="noreferrer" className="text-blue-500"><ImageIcon size={12}/></a>}</div></div>
                    </div>
                    <div className="flex items-center gap-2"><span className={`font-bold ${t.type==='income'?'text-emerald-500':'text-rose-500'}`}>{t.type==='income'?'+':'-'}{formatCurrency(t.amount)}</span><button onClick={()=>deleteTransaction(t.id)} className="text-gray-300 hover:text-rose-500"><Trash2 size={16}/></button></div>
                  </div>
                )
              })}
              {transactions.length === 0 && <div className="text-center text-gray-400 py-8">ยังไม่มีรายการ</div>}
            </div>
          </div>
        )}

        {activeTab === 'debts' && (
          <div className="animation-fade-in">
            <div className="grid grid-cols-2 gap-3 mb-6">
               <div className="bg-rose-50 p-3 rounded-xl border border-rose-100 text-center"><p className="text-xs text-rose-400">ต้องผ่อนเขา</p><p className="text-xl font-bold text-rose-600">{formatCurrency(debts.filter(d => d.type === 'payable' && !d.isSettled).reduce((acc, c) => acc + Number(c.remainingAmount), 0))}</p></div>
               <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-center"><p className="text-xs text-emerald-400">เขายืมเรา</p><p className="text-xl font-bold text-emerald-600">{formatCurrency(debts.filter(d => d.type === 'receivable' && !d.isSettled).reduce((acc, c) => acc + Number(c.remainingAmount), 0))}</p></div>
            </div>
            {showDebtForm ? (
              <div className="bg-white p-6 rounded-2xl shadow-md mb-6 border border-indigo-100">
                <h3 className="text-lg font-bold mb-4 text-gray-700">สร้างหนี้ก้อนใหม่</h3>
                <div className="flex bg-gray-100 rounded-lg p-1 mb-4">
                  <button onClick={() => setDebtType('payable')} className={`flex-1 py-2 rounded-md text-sm font-bold ${debtType === 'payable' ? 'bg-rose-500 text-white' : 'text-gray-500'}`}>ฉันยืมเขา (คืน)</button>
                  <button onClick={() => setDebtType('receivable')} className={`flex-1 py-2 rounded-md text-sm font-bold ${debtType === 'receivable' ? 'bg-emerald-500 text-white' : 'text-gray-500'}`}>เขายืมฉัน (ทวง)</button>
                </div>
                <input type="number" value={debtAmount} onChange={e=>setDebtAmount(e.target.value)} placeholder="จำนวนเงินต้น..." className="w-full p-3 text-xl font-bold bg-gray-50 rounded-xl mb-4 border outline-none" />
                <div className="relative mb-4"><User size={18} className="absolute left-3 top-3.5 text-gray-400"/><input type="text" value={debtPerson} onChange={e=>setDebtPerson(e.target.value)} placeholder="ชื่อคน / รายการหนี้" className="w-full p-3 pl-10 text-sm bg-gray-50 rounded-xl border outline-none" /></div>
                <div className="flex gap-3"><button onClick={() => setShowDebtForm(false)} className="flex-1 py-3 bg-gray-100 rounded-xl text-gray-500">ยกเลิก</button><button onClick={handleDebtSubmit} disabled={!debtAmount || !debtPerson} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold">สร้างหนี้</button></div>
              </div>
            ) : (
              <button onClick={() => setShowDebtForm(true)} className="w-full bg-white border-2 border-dashed border-indigo-200 text-indigo-500 p-4 rounded-xl font-bold mb-6 flex justify-center gap-2 hover:bg-indigo-50"><Plus/> เพิ่มหนี้สิน</button>
            )}
            <div className="space-y-3">
              {debts.map(d => {
                const percent = ((d.totalAmount - d.remainingAmount) / d.totalAmount) * 100;
                return (
                  <div key={d.id} className={`bg-white p-4 rounded-xl shadow-sm border relative overflow-hidden ${d.isSettled ? 'opacity-60 border-gray-100' : 'border-gray-100'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full flex items-center justify-center ${d.type === 'payable' ? 'bg-rose-100 text-rose-500' : 'bg-emerald-100 text-emerald-500'}`}>{d.isSettled ? <CheckCircle2 size={20}/> : <ArrowRightLeft size={20}/>}</div><div><p className="font-bold text-gray-700">{d.person}</p><p className="text-xs text-gray-400">ต้นเงิน: {formatCurrency(d.totalAmount)}</p></div></div>
                      <div className="text-right"><p className="text-xs text-gray-400">คงเหลือ</p><span className={`text-lg font-bold ${d.type === 'payable' ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(d.remainingAmount)}</span></div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 mb-3"><div className={`h-2 rounded-full transition-all ${d.isSettled ? 'bg-green-500' : 'bg-blue-500'}`} style={{width: `${percent}%`}}></div></div>
                    {!d.isSettled && (<button onClick={() => setRepayModal(d)} className="w-full py-2 bg-indigo-50 text-indigo-600 font-bold rounded-lg hover:bg-indigo-100 text-xs flex items-center justify-center gap-2"><HandCoins size={14}/> ทยอยจ่าย / รับเงินคืน</button>)}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {repayModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animation-fade-in">
            <h3 className="text-lg font-bold text-gray-800 mb-1">บันทึกการชำระ</h3>
            <p className="text-sm text-gray-500 mb-4">รายการ: {repayModal.person}</p>
            <div className="mb-4"><label className="text-xs font-bold text-gray-600">จำนวน (บาท)</label><input type="number" value={repayAmount} onChange={e=>setRepayAmount(e.target.value)} className="w-full p-3 text-2xl font-bold border rounded-xl mt-1 focus:ring-2 focus:ring-indigo-500 outline-none" autoFocus /></div>
            <div className="flex gap-3"><button onClick={()=>{setRepayModal(null); setRepayAmount('');}} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-500">ยกเลิก</button><button onClick={handleRepayment} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700">บันทึก</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

