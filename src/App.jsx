import React, { useState, useEffect } from 'react';
import { Plus, Wallet, TrendingUp, TrendingDown, Trash2, DollarSign, Edit2, LogOut } from 'lucide-react';
import { Activity, Briefcase, Coffee, Home, ShoppingBag, Star, Heart, Gift, Zap } from 'lucide-react';
import { FileSpreadsheet, Cloud, Loader2, HandCoins, ArrowRightLeft } from 'lucide-react';
import { CheckCircle2, User, X, Calendar, BarChart3, RefreshCcw, Settings } from 'lucide-react';
import { Image as ImageIcon } from 'lucide-react';
import { AlertTriangle } from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, deleteDoc, doc, query, 
  onSnapshot, updateDoc, arrayUnion, setDoc, getDoc 
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ------------------------------------------------------------------
// 🔑 การตั้งค่า Firebase (เจมี่ใส่รหัสจริงให้แล้ว พร้อมใช้!)
// ------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyB8hiKkgTJVd16rjosL-um4q-1ZEfcAsDQ",
  authDomain: "parker-wallet.firebaseapp.com",
  projectId: "parker-wallet",
  storageBucket: "parker-wallet.firebasestorage.app",
  messagingSenderId: "275755260782",
  appId: "1:275755260782:web:38afbe5888f006a6c2bf7f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// Helper Functions
const getCollectionRef = (uid, colName) => collection(db, 'users', uid, colName);
const getDocRef = (uid, colName, docId) => doc(db, 'users', uid, colName, docId);

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

// ไอคอนให้เลือกสำหรับหมวดใหม่
const AVAILABLE_ICONS = [
  { id: 'Star', icon: Star }, { id: 'Heart', icon: Heart }, { id: 'Gift', icon: Gift },
  { id: 'Zap', icon: Zap }, { id: 'Coffee', icon: Coffee }, { id: 'Home', icon: Home },
  { id: 'ShoppingBag', icon: ShoppingBag }, { id: 'Briefcase', icon: Briefcase },
  { id: 'Activity', icon: Activity }
];

// หมวดหมู่เริ่มต้น (Default)
const DEFAULT_CATEGORIES = {
  income: [
    { id: 'freelance', name: 'งาน Freelance', icon: 'Briefcase', color: 'bg-emerald-100 text-emerald-600' },
    { id: 'salary', name: 'เงินเดือน', icon: 'DollarSign', color: 'bg-blue-100 text-blue-600' },
    { id: 'investment', name: 'การลงทุน', icon: 'TrendingUp', color: 'bg-purple-100 text-purple-600' },
    { id: 'other_income', name: 'รายรับอื่นๆ', icon: 'Wallet', color: 'bg-gray-100 text-gray-600' }
  ],
  expense: [
    { id: 'food', name: 'อาหาร/เครื่องดื่ม', icon: 'Coffee', color: 'bg-orange-100 text-orange-600' },
    { id: 'transport', name: 'เดินทาง', icon: 'ShoppingBag', color: 'bg-yellow-100 text-yellow-600' },
    { id: 'health', name: 'สุขภาพ/ยา', icon: 'Activity', color: 'bg-red-100 text-red-600' },
    { id: 'housing', name: 'ที่พัก/น้ำไฟ', icon: 'Home', color: 'bg-indigo-100 text-indigo-600' },
    { id: 'shopping', name: 'ของใช้ส่วนตัว', icon: 'ShoppingBag', color: 'bg-pink-100 text-pink-600' },
    { id: 'debt_payment', name: 'ชำระหนี้', icon: 'HandCoins', color: 'bg-rose-100 text-rose-600' },
    { id: 'other_expense', name: 'จิปาถะ', icon: 'Wallet', color: 'bg-gray-100 text-gray-600' }
  ]
};

// Map string icon names to components
const IconMap = {
  Plus, Wallet, TrendingUp, TrendingDown, Trash2, DollarSign, Activity, Briefcase, 
  Coffee, Home, ShoppingBag, Star, Heart, Gift, Zap, HandCoins
};

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard'); 
  
  // Data State
  const [transactions, setTransactions] = useState([]);
  const [debts, setDebts] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES); // ใช้ State แทนค่าคงที่
  
  // Form State
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState('');
  const [wallet, setWallet] = useState('cash');
  const [image, setImage] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [debtAmount, setDebtAmount] = useState('');
  const [debtPerson, setDebtPerson] = useState('');
  const [debtType, setDebtType] = useState('payable');
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [repayModal, setRepayModal] = useState(null);
  const [repayAmount, setRepayAmount] = useState('');

  // Category Management State
  const [showCatManager, setShowCatManager] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('Star');
  const [newCatType, setNewCatType] = useState('expense');

  // Auth & Data Sync
  useEffect(() => {
    const timer = setTimeout(() => { if (!user && loading) setLoading(false); }, 5000);
    
    // Auth listener
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) setLoading(false);
    });
    
    // Try anonymous login if not logged in
    if (!auth.currentUser) {
        signInAnonymously(auth).catch(e => {
            console.error(e);
            setLoading(false);
        });
    }

    return () => { unsubscribe(); clearTimeout(timer); };
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error(error);
      setErrorMsg("Google Login failed: " + error.message);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
      await signOut(auth);
      // Optional: Clear local state
      setTransactions([]);
      setDebts([]);
      setCategories(DEFAULT_CATEGORIES);
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    
    // 1. Load Transactions
    const qTrans = query(getCollectionRef(user.uid, 'transactions'));
    const unsubTrans = onSnapshot(qTrans, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(data);
      setLoading(false);
    });

    // 2. Load Debts
    const qDebts = query(getCollectionRef(user.uid, 'debts'));
    const unsubDebts = onSnapshot(qDebts, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDebts(data);
    });

    // 3. Load Categories (ถ้ามี Custom จะโหลดมาทับ Default)
    const loadCategories = async () => {
      const docSnap = await getDoc(doc(db, 'users', user.uid, 'settings', 'categories'));
      if (docSnap.exists()) {
        setCategories(docSnap.data());
      }
    };
    loadCategories();

    return () => { unsubTrans(); unsubDebts(); };
  }, [user]);

  // --- Handlers ---
  const handleAddCategory = async () => {
    if (!newCatName || !user) return;
    
    const newCat = {
      id: Date.now().toString(),
      name: newCatName,
      icon: newCatIcon,
      color: 'bg-gray-100 text-gray-600' // Default color
    };

    const updatedCategories = {
      ...categories,
      [newCatType]: [...categories[newCatType], newCat]
    };

    setCategories(updatedCategories); // Update UI immediately
    
    // Save to Firebase
    try {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'categories'), updatedCategories);
      setNewCatName('');
      setShowCatManager(false);
    } catch (error) {
      console.error("Save category failed:", error);
    }
  };

  const handleDeleteCategory = async (catId, catType) => {
    if (!user) return;
    const updatedList = categories[catType].filter(c => c.id !== catId);
    const updatedCategories = { ...categories, [catType]: updatedList };
    
    setCategories(updatedCategories);
    await setDoc(doc(db, 'users', user.uid, 'settings', 'categories'), updatedCategories);
  };

  const handleImageUpload = async (file) => { if (!file) return null; try { const storageRef = ref(storage, `users/${user.uid}/slips/${Date.now()}_${file.name}`); const snapshot = await uploadBytes(storageRef, file); return await getDownloadURL(snapshot.ref); } catch (error) { console.error("Upload failed:", error); return null; } };
  const handleTransSubmit = async (e) => { e.preventDefault(); if (!amount || !category || !user) return; setIsUploading(true); try { const imageUrl = await handleImageUpload(image); await addDoc(getCollectionRef(user.uid, 'transactions'), { amount: Number(amount), description: description || (type === 'income' ? 'รายรับ' : 'รายจ่าย'), type, category, wallet, imageUrl, date: new Date().toISOString() }); setAmount(''); setDescription(''); setCategory(''); setImage(null); setShowForm(false); } catch (error) { console.error(error); } setIsUploading(false); };
  const handleDebtSubmit = async (e) => { e.preventDefault(); if (!debtAmount || !debtPerson || !user) return; await addDoc(getCollectionRef(user.uid, 'debts'), { totalAmount: Number(debtAmount), remainingAmount: Number(debtAmount), person: debtPerson, type: debtType, isSettled: false, history: [], date: new Date().toISOString() }); setDebtAmount(''); setDebtPerson(''); setShowDebtForm(false); };
  const handleRepayment = async () => { if (!repayModal || !repayAmount || !user) return; const payAmt = Number(repayAmount); if (payAmt <= 0) return; const newRemaining = Math.max(0, repayModal.remainingAmount - payAmt); const isFullyPaid = newRemaining === 0; await updateDoc(getDocRef(user.uid, 'debts', repayModal.id), { remainingAmount: newRemaining, isSettled: isFullyPaid, history: arrayUnion({ date: new Date().toISOString(), amount: payAmt, note: 'ผ่อนชำระ' }) }); if (repayModal.type === 'payable') { await addDoc(getCollectionRef(user.uid, 'transactions'), { amount: payAmt, description: `ผ่อนหนี้: ${repayModal.person}`, type: 'expense', category: 'debt_payment', wallet: 'cash', date: new Date().toISOString() }); } setRepayModal(null); setRepayAmount(''); };
  const deleteTransaction = async (id) => { if (user) await deleteDoc(getDocRef(user.uid, 'transactions', id)); };
  const deleteDebt = async (id) => { if (user) await deleteDoc(getDocRef(user.uid, 'debts', id)); };
  const formatCurrency = (num) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(num);
  const formatDate = (str) => new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(str));
  const getMonthlyStats = () => { const stats = {}; transactions.forEach(t => { const date = new Date(t.date); const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; if (!stats[key]) stats[key] = { income: 0, expense: 0, key }; if (t.type === 'income') stats[key].income += Number(t.amount); else stats[key].expense += Number(t.amount); }); return Object.values(stats).sort((a, b) => b.key.localeCompare(a.key)); };

  // ... (Loading / Error / Login UI - Same as before) ...
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={40}/></div>;
  
  // LOGIN SCREEN (แสดงเมื่อยังไม่ Login)
  if (!user) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-blue-100 max-w-sm w-full">
        <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
            <Wallet size={32}/>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Parker's Wallet</h2>
        <p className="text-gray-500 mb-6">ซิงค์ข้อมูลได้ทุกที่ แค่ล็อกอินด้วย Google</p>
        
        {errorMsg && <p className="text-red-500 text-xs bg-red-50 p-2 rounded mb-4">{errorMsg}</p>}

        <button 
            onClick={handleGoogleLogin}
            className="w-full py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold shadow-sm hover:bg-gray-50 transition-transform active:scale-95 flex items-center justify-center gap-2 mb-3"
        >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google"/>
            Login with Google
        </button>
        
         <button 
            onClick={() => { setLoading(true); signInAnonymously(auth).catch(e => setErrorMsg(e.message)); }}
            className="text-sm text-gray-400 hover:text-gray-600 underline"
        >
            ใช้งานแบบไม่ล็อกอิน (ข้อมูลไม่ซิงค์)
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-24 md:pb-0">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 pb-24 rounded-b-[2rem] shadow-lg text-white relative">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2"><h1 className="text-xl font-bold">Parker's Wallet Pro 🚀</h1><div className="bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center gap-1"><Cloud size={12} /></div></div>
          <div className="flex gap-2">
            <button onClick={() => setShowCatManager(true)} className="bg-white/20 p-2 rounded-full hover:bg-white/30"><Settings size={20}/></button>
            <button onClick={handleLogout} className="bg-white/20 p-2 rounded-full hover:bg-red-500/50 transition-colors"><LogOut size={20}/></button>
          </div>
        </div>
        <div className="text-center mb-2"><p className="text-sm text-blue-100">ความมั่งคั่งสุทธิ</p><h2 className="text-4xl font-bold">{formatCurrency(transactions.reduce((acc, t) => acc + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0))}</h2></div>
        <div className="flex gap-3 overflow-x-auto pb-2 mt-4 no-scrollbar" style={{scrollbarWidth: 'none'}}>{WALLETS.map(w => { const bal = transactions.filter(t => t.wallet === w.id).reduce((acc, t) => acc + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0); return ( <div key={w.id} className="flex-shrink-0 bg-white/10 backdrop-blur-md p-3 rounded-xl min-w-[120px] border border-white/10"><div className="flex items-center gap-1 mb-1"><div className={`w-2 h-2 rounded-full ${w.color}`}></div><span className="text-xs text-blue-50">{w.name}</span></div><p className="font-bold text-sm">{formatCurrency(bal)}</p></div> ) })}</div>
      </div>

      {/* Tabs */}
      <div className="px-4 -mt-8 relative z-20 mb-6"><div className="bg-white rounded-full shadow-lg p-1 flex justify-between">{[{ id: 'dashboard', label: 'ภาพรวม', icon: BarChart3 }, { id: 'transactions', label: 'จดบันทึก', icon: Wallet }, { id: 'debts', label: 'หนี้สิน', icon: HandCoins }].map(tab => ( <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 py-2 rounded-full text-xs font-bold flex flex-col items-center gap-1 transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}><tab.icon size={18} /> {tab.label}</button> ))}</div></div>
      
      <div className="p-4 max-w-md mx-auto pb-24">
        {activeTab === 'dashboard' && ( <div className="space-y-4 animation-fade-in"><h3 className="font-bold text-gray-700 flex items-center gap-2"><Calendar size={18}/> สรุปรายเดือน</h3>{getMonthlyStats().length === 0 ? <div className="text-center text-gray-400 py-8">ยังไม่มีข้อมูล</div> : getMonthlyStats().map(stat => ( <div key={stat.key} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100"><div className="flex justify-between mb-3 font-bold text-gray-600"><span>{stat.key}</span><span className={stat.income - stat.expense >= 0 ? 'text-emerald-500' : 'text-rose-500'}>{stat.income - stat.expense > 0 ? '+' : ''}{formatCurrency(stat.income - stat.expense)}</span></div><div className="space-y-2"><div className="flex items-center gap-2"><span className="text-xs w-12 text-emerald-600">รายรับ</span><div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden"><div className="bg-emerald-400 h-full" style={{ width: `${Math.min((stat.income / (stat.income + stat.expense || 1)) * 100, 100)}%` }}></div></div><span className="text-xs w-16 text-right">{formatCurrency(stat.income)}</span></div><div className="flex items-center gap-2"><span className="text-xs w-12 text-rose-600">รายจ่าย</span><div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden"><div className="bg-rose-400 h-full" style={{ width: `${Math.min((stat.expense / (stat.income + stat.expense || 1)) * 100, 100)}%` }}></div></div><span className="text-xs w-16 text-right">{formatCurrency(stat.expense)}</span></div></div></div> ))}</div> )}
        {activeTab === 'transactions' && ( <div className="animation-fade-in">{showForm ? ( <div className="bg-white p-6 rounded-2xl shadow-xl mb-6 border border-blue-100 relative"><button onClick={()=>setShowForm(false)} className="absolute top-4 right-4 text-gray-400"><X size={20}/></button><h3 className="text-lg font-bold mb-4 text-gray-700">บันทึกรายการใหม่</h3><div className="flex bg-gray-100 rounded-lg p-1 mb-4"><button onClick={() => setType('income')} className={`flex-1 py-2 rounded-md text-sm font-bold ${type === 'income' ? 'bg-emerald-500 text-white' : 'text-gray-500'}`}>รายรับ</button><button onClick={() => setType('expense')} className={`flex-1 py-2 rounded-md text-sm font-bold ${type === 'expense' ? 'bg-rose-500 text-white' : 'text-gray-500'}`}>รายจ่าย</button></div><input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" className="w-full p-3 text-2xl font-bold bg-gray-50 rounded-xl mb-4 border text-center focus:ring-2 focus:ring-blue-500 outline-none" autoFocus /><div className="mb-4 overflow-x-auto no-scrollbar" style={{scrollbarWidth: 'none'}}><div className="flex gap-2">{WALLETS.map(w => (<button key={w.id} onClick={()=>setWallet(w.id)} className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs border whitespace-nowrap ${wallet === w.id ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-gray-50 border-transparent'}`}><div className={`w-2 h-2 rounded-full ${w.color}`}></div> {w.name}</button>))}</div></div><div className="grid grid-cols-3 gap-2 mb-4">{(type === 'income' ? categories.income : categories.expense).map(cat => { const IconComp = IconMap[cat.icon] || Wallet; return ( <button key={cat.id} onClick={() => setCategory(cat.id)} className={`p-2 rounded-lg flex flex-col items-center text-xs border-2 ${category === cat.id ? 'border-blue-500 bg-blue-50' : 'border-transparent bg-gray-50'}`}><div className={`p-1.5 rounded-full mb-1 ${cat.color}`}><IconComp size={16} /></div><span className="truncate w-full text-center">{cat.name}</span></button> ); })}</div><input type="text" value={description} onChange={e=>setDescription(e.target.value)} placeholder="รายละเอียด..." className="w-full p-3 text-sm bg-gray-50 rounded-xl mb-4 border" /><div className="mb-4"><label className="flex items-center gap-2 text-sm text-gray-500 p-3 border border-dashed rounded-xl cursor-pointer hover:bg-gray-50"><ImageIcon size={18} />{image ? <span className="text-blue-600 truncate">{image.name}</span> : "แนบรูปสลิป"}<input type="file" accept="image/*" onChange={(e)=>setImage(e.target.files[0])} className="hidden" /></label></div><button onClick={handleTransSubmit} disabled={!amount || !category || isUploading} className={`w-full py-3 text-white rounded-xl font-bold shadow-lg flex justify-center gap-2 ${!amount || !category || isUploading ? 'bg-gray-300' : 'bg-blue-600'}`}>{isUploading ? <Loader2 className="animate-spin"/> : 'บันทึก'}</button></div> ) : ( <button onClick={() => setShowForm(true)} className="w-full bg-white border-2 border-dashed border-blue-200 text-blue-500 p-4 rounded-xl font-bold mb-6 flex justify-center gap-2 hover:bg-blue-50 transition-colors"><Plus/> จดรายรับ/รายจ่าย</button> )}<div className="space-y-3">{transactions.map(t => { const catList = t.type === 'income' ? categories.income : categories.expense; const cat = catList.find(c => c.id === t.category) || {icon:'Wallet', color:'bg-gray-100', name:'-'}; const IconComp = IconMap[cat.icon] || Wallet; const w = WALLETS.find(wal => wal.id === t.wallet) || WALLETS[0]; return ( <div key={t.id} className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center border border-gray-50"><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full flex items-center justify-center ${cat.color}`}><IconComp size={20}/></div><div><p className="font-bold text-sm text-gray-700">{t.description}</p><div className="flex items-center gap-2 text-xs text-gray-400"><span>{formatDate(t.date)}</span><span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 flex items-center gap-1"><div className={`w-1.5 h-1.5 rounded-full ${w.color}`}></div> {w.name}</span>{t.imageUrl && <a href={t.imageUrl} target="_blank" rel="noreferrer" className="text-blue-500"><ImageIcon size={12}/></a>}</div></div></div><div className="flex items-center gap-2"><span className={`font-bold ${t.type==='income'?'text-emerald-500':'text-rose-500'}`}>{t.type==='income'?'+':'-'}{formatCurrency(t.amount)}</span><button onClick={()=>deleteTransaction(t.id)} className="text-gray-300 hover:text-rose-500"><Trash2 size={16}/></button></div></div> ) })}</div></div> )}
        {activeTab === 'debts' && ( <div className="animation-fade-in"><div className="grid grid-cols-2 gap-3 mb-6"><div className="bg-rose-50 p-3 rounded-xl border border-rose-100 text-center"><p className="text-xs text-rose-400">ต้องผ่อนเขา</p><p className="text-xl font-bold text-rose-600">{formatCurrency(debts.filter(d => d.type === 'payable' && !d.isSettled).reduce((acc, c) => acc + Number(c.remainingAmount), 0))}</p></div><div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-center"><p className="text-xs text-emerald-400">เขายืมเรา</p><p className="text-xl font-bold text-emerald-600">{formatCurrency(debts.filter(d => d.type === 'receivable' && !d.isSettled).reduce((acc, c) => acc + Number(c.remainingAmount), 0))}</p></div></div>{showDebtForm ? ( <div className="bg-white p-6 rounded-2xl shadow-md mb-6 border border-indigo-100"><h3 className="text-lg font-bold mb-4 text-gray-700">สร้างหนี้ก้อนใหม่</h3><div className="flex bg-gray-100 rounded-lg p-1 mb-4"><button onClick={() => setDebtType('payable')} className={`flex-1 py-2 rounded-md text-sm font-bold ${debtType === 'payable' ? 'bg-rose-500 text-white' : 'text-gray-500'}`}>ฉันยืมเขา (คืน)</button><button onClick={() => setDebtType('receivable')} className={`flex-1 py-2 rounded-md text-sm font-bold ${debtType === 'receivable' ? 'bg-emerald-500 text-white' : 'text-gray-500'}`}>เขายืมฉัน (ทวง)</button></div><input type="number" value={debtAmount} onChange={e=>setDebtAmount(e.target.value)} placeholder="จำนวนเงินต้น..." className="w-full p-3 text-xl font-bold bg-gray-50 rounded-xl mb-4 border outline-none" /><div className="relative mb-4"><User size={18} className="absolute left-3 top-3.5 text-gray-400"/><input type="text" value={debtPerson} onChange={e=>setDebtPerson(e.target.value)} placeholder="ชื่อคน / รายการหนี้" className="w-full p-3 pl-10 text-sm bg-gray-50 rounded-xl border outline-none" /></div><div className="flex gap-3"><button onClick={() => setShowDebtForm(false)} className="flex-1 py-3 bg-gray-100 rounded-xl text-gray-500">ยกเลิก</button><button onClick={handleDebtSubmit} disabled={!debtAmount || !debtPerson} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold">สร้างหนี้</button></div></div> ) : ( <button onClick={() => setShowDebtForm(true)} className="w-full bg-white border-2 border-dashed border-indigo-200 text-indigo-500 p-4 rounded-xl font-bold mb-6 flex justify-center gap-2 hover:bg-indigo-50"><Plus/> เพิ่มหนี้สิน</button> )}<div className="space-y-3">{debts.map(d => { const percent = ((d.totalAmount - d.remainingAmount) / d.totalAmount) * 100; return ( <div key={d.id} className={`bg-white p-4 rounded-xl shadow-sm border relative overflow-hidden ${d.isSettled ? 'opacity-60 border-gray-100' : 'border-gray-100'}`}><div className="flex justify-between items-start mb-2"><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full flex items-center justify-center ${d.type === 'payable' ? 'bg-rose-100 text-rose-500' : 'bg-emerald-100 text-emerald-500'}`}>{d.isSettled ? <CheckCircle2 size={20}/> : <ArrowRightLeft size={20}/>}</div><div><p className="font-bold text-gray-700">{d.person}</p><p className="text-xs text-gray-400">ต้นเงิน: {formatCurrency(d.totalAmount)}</p></div></div><div className="text-right"><p className="text-xs text-gray-400">คงเหลือ</p><span className={`text-lg font-bold ${d.type === 'payable' ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(d.remainingAmount)}</span></div></div><div className="w-full bg-gray-100 rounded-full h-2 mb-3"><div className={`h-2 rounded-full transition-all ${d.isSettled ? 'bg-green-500' : 'bg-blue-500'}`} style={{width: `${percent}%`}}></div></div>{!d.isSettled && (<button onClick={() => setRepayModal(d)} className="w-full py-2 bg-indigo-50 text-indigo-600 font-bold rounded-lg hover:bg-indigo-100 text-xs flex items-center justify-center gap-2"><HandCoins size={14}/> ทยอยจ่าย / รับเงินคืน</button>)}</div> ); })}</div></div> )}
      </div>

      {showCatManager && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">จัดการหมวดหมู่</h3>
              <button onClick={() => setShowCatManager(false)}><X size={20} className="text-gray-400"/></button>
            </div>
            {/* ... (Category Manager Content same as before) ... */}
            <div className="flex bg-gray-100 rounded-lg p-1 mb-4"><button onClick={() => setNewCatType('income')} className={`flex-1 py-2 rounded-md text-sm font-bold ${newCatType === 'income' ? 'bg-emerald-500 text-white' : 'text-gray-500'}`}>รายรับ</button><button onClick={() => setNewCatType('expense')} className={`flex-1 py-2 rounded-md text-sm font-bold ${newCatType === 'expense' ? 'bg-rose-500 text-white' : 'text-gray-500'}`}>รายจ่าย</button></div>
            <div className="mb-4"><label className="text-xs font-bold text-gray-600">ชื่อหมวดหมู่ใหม่</label><input type="text" value={newCatName} onChange={e=>setNewCatName(e.target.value)} placeholder="เช่น ค่ากาแฟ, ค่าหวย" className="w-full p-3 text-sm border rounded-xl mt-1 outline-none" /></div>
            <label className="text-xs font-bold text-gray-600 mb-2 block">เลือกไอคอน</label>
            <div className="grid grid-cols-5 gap-2 mb-6">{AVAILABLE_ICONS.map(icon => ( <button key={icon.id} onClick={() => setNewCatIcon(icon.id)} className={`p-2 rounded-lg flex items-center justify-center border ${newCatIcon === icon.id ? 'bg-blue-100 border-blue-500 text-blue-600' : 'border-gray-200'}`}><icon.icon size={20} /></button> ))}</div>
            <button onClick={handleAddCategory} disabled={!newCatName} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold mb-6">เพิ่มหมวดหมู่</button>
            <div className="border-t pt-4"><p className="text-xs font-bold text-gray-500 mb-2">รายการปัจจุบัน (กดเพื่อลบ)</p><div className="space-y-2">{categories[newCatType].map(cat => ( <div key={cat.id} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg"><div className="flex items-center gap-2">{(() => { const Icon = IconMap[cat.icon] || Wallet; return <Icon size={16} className="text-gray-500"/>; })()}<span className="text-sm">{cat.name}</span></div><button onClick={() => handleDeleteCategory(cat.id, newCatType)} className="text-red-400 hover:text-red-600"><X size={16}/></button></div> ))}</div></div>
          </div>
        </div>
      )}

      {repayModal && ( <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animation-fade-in"><h3 className="text-lg font-bold text-gray-800 mb-1">บันทึกการชำระ</h3><p className="text-sm text-gray-500 mb-4">รายการ: {repayModal.person}</p><div className="mb-4"><label className="text-xs font-bold text-gray-600">จำนวน (บาท)</label><input type="number" value={repayAmount} onChange={e=>setRepayAmount(e.target.value)} className="w-full p-3 text-2xl font-bold border rounded-xl mt-1 focus:ring-2 focus:ring-indigo-500 outline-none" autoFocus /></div><div className="flex gap-3"><button onClick={()=>{setRepayModal(null); setRepayAmount('');}} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-500">ยกเลิก</button><button onClick={handleRepayment} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700">บันทึก</button></div></div></div> )}
    </div>
  );
};

export default App;
