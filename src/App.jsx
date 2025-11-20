import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Wallet, TrendingUp, TrendingDown, Trash2, DollarSign, Edit2, LogOut, 
  UserCircle, PieChart, FileText, Calculator, BellRing, AlertTriangle,
  Activity, Briefcase, Coffee, Home, ShoppingBag, Star, Heart, Gift, Zap,
  HandCoins, ArrowRightLeft, CheckCircle2, X, Calendar, BarChart3, Settings,
  Filter, Download, Landmark, CreditCard, ChevronRight, ChevronDown, 
  FileSpreadsheet, Loader2, RefreshCcw // ✅ เพิ่ม FileSpreadsheet และ Loader2 ครบแล้ว!
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line 
} from 'recharts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';

import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut 
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, deleteDoc, doc, query, 
  onSnapshot, updateDoc, arrayUnion, setDoc, getDoc 
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ------------------------------------------------------------------
// 🔑 SETTING: ใส่รหัส Firebase ของคุณตรงนี้
// ------------------------------------------------------------------
const manualConfig = {
  apiKey: "AIzaSyB8hiKkgTJVd16rjosL-um4q-1ZEfcAsDQ",
  authDomain: "parker-wallet.firebaseapp.com",
  projectId: "parker-wallet",
  storageBucket: "parker-wallet.firebasestorage.app",
  messagingSenderId: "275755260782",
  appId: "1:275755260782:web:38afbe5888f006a6c2bf7f",
  measurementId: "G-DGL49EFNRT"
};

const isPreviewEnv = typeof __firebase_config !== 'undefined';
const firebaseConfig = isPreviewEnv ? JSON.parse(__firebase_config) : manualConfig;
const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const appId = rawAppId.replace(/[^a-zA-Z0-9_-]/g, '_');

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// Helper Functions
const getCollectionRef = (uid, colName) => isPreviewEnv ? collection(db, 'artifacts', appId, 'users', uid, colName) : collection(db, 'users', uid, colName);
const getDocRef = (uid, colName, docId) => isPreviewEnv ? doc(db, 'artifacts', appId, 'users', uid, colName, docId) : doc(db, 'users', uid, colName, docId);

// --- Constants & Defaults ---
const WALLETS_DEFAULT = [
  { id: 'cash', name: 'เงินสด', type: 'cash', icon: Wallet, color: 'bg-green-500' },
  { id: 'kbank', name: 'KBank', type: 'bank', icon: Landmark, color: 'bg-emerald-600' },
  { id: 'scb', name: 'SCB', type: 'bank', icon: Landmark, color: 'bg-purple-600' },
  { id: 'credit', name: 'บัตรเครดิต', type: 'credit', icon: CreditCard, color: 'bg-gray-600' },
  { id: 'ewallet', name: 'TrueMoney', type: 'ewallet', icon: Zap, color: 'bg-orange-500' }
];

const DEFAULT_CATEGORIES = {
  income: [
    { id: 'salary', name: 'เงินเดือน', icon: 'DollarSign', color: 'bg-blue-100 text-blue-600', subs: ['เงินเดือน', 'โบนัส', 'ค่าล่วงเวลา'] },
    { id: 'freelance', name: 'รายได้เสริม', icon: 'Briefcase', color: 'bg-emerald-100 text-emerald-600', subs: ['รับจ้าง', 'ขายของ', 'งานเสริม'] },
    { id: 'investment', name: 'การลงทุน', icon: 'TrendingUp', color: 'bg-purple-100 text-purple-600', subs: ['ปันผล', 'ดอกเบี้ย', 'กำไรขายหุ้น'] },
    { id: 'loan_in', name: 'กู้ยืม (รับเงิน)', icon: 'HandCoins', color: 'bg-teal-100 text-teal-600', subs: ['ยืมเพื่อน', 'กู้ธนาคาร'] }
  ],
  expense: [
    { id: 'food', name: 'อาหาร', icon: 'Coffee', color: 'bg-orange-100 text-orange-600', subs: ['เช้า', 'กลางวัน', 'เย็น', 'ขนม/น้ำ', 'วัตถุดิบ'] },
    { id: 'transport', name: 'เดินทาง', icon: 'ShoppingBag', color: 'bg-yellow-100 text-yellow-600', subs: ['รถเมล์/BTS', 'แท็กซี่', 'น้ำมัน', 'ทางด่วน'] },
    { id: 'housing', name: 'ที่พัก/น้ำไฟ', icon: 'Home', color: 'bg-indigo-100 text-indigo-600', subs: ['ค่าเช่า', 'ค่าน้ำ', 'ค่าไฟ', 'เน็ต/มือถือ'] },
    { id: 'shopping', name: 'ของใช้', icon: 'ShoppingBag', color: 'bg-pink-100 text-pink-600', subs: ['เสื้อผ้า', 'เครื่องสำอาง', 'ของใช้ในบ้าน'] },
    { id: 'health', name: 'สุขภาพ', icon: 'Activity', color: 'bg-red-100 text-red-600', subs: ['ยา', 'หาหมอ', 'ออกกำลังกาย'] },
    { id: 'debt_payment', name: 'ชำระหนี้', icon: 'HandCoins', color: 'bg-rose-100 text-rose-600', subs: ['บัตรเครดิต', 'กยศ.', 'ผ่อนของ'] },
    { id: 'loan_out', name: 'ให้กู้ยืม', icon: 'ArrowRightLeft', color: 'bg-gray-100 text-gray-600', subs: ['ให้เพื่อนยืม', 'บริจาค'] }
  ]
};

const IconMap = { Plus, Wallet, TrendingUp, TrendingDown, Trash2, DollarSign, Activity, Briefcase, Coffee, Home, ShoppingBag, Star, Heart, Gift, Zap, HandCoins, ArrowRightLeft, Landmark, CreditCard, FileText, Calculator };

const formatCurrency = (num) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(num);
const formatDateShort = (str) => format(new Date(str), 'dd MMM yy', { locale: th });

// --- App Component ---
const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Data
  const [transactions, setTransactions] = useState([]);
  const [debts, setDebts] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [budgets, setBudgets] = useState({});
  const [wallets, setWallets] = useState(WALLETS_DEFAULT);

  // UI State
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBudgetManager, setShowBudgetManager] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  
  // Filters
  const [dateRange, setDateRange] = useState('3months'); 

  // Transaction Form
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [wallet, setWallet] = useState('cash');
  const [image, setImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Debt Form
  const [debtAmount, setDebtAmount] = useState('');
  const [debtPerson, setDebtPerson] = useState('');
  const [debtType, setDebtType] = useState('payable');
  const [debtDueDate, setDebtDueDate] = useState('');
  const [isInstallment, setIsInstallment] = useState(false);
  const [installMonths, setInstallMonths] = useState('');
  const [installInterest, setInstallInterest] = useState('');

  // Repayment
  const [repayModal, setRepayModal] = useState(null);
  const [repayAmount, setRepayAmount] = useState('');

  // --- Auth (Redirect Mode for Stability) ---
  useEffect(() => {
    const checkRedirect = async () => {
        try {
            const result = await getRedirectResult(auth);
            if (result) {
                setUser(result.user);
                setLoading(false);
            }
        } catch (error) {
            console.error("Redirect Auth Error:", error);
            setErrorMsg(error.message);
            setLoading(false);
        }
    };
    checkRedirect();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setLoading(false);
      else {
          // ถ้าไม่มี user และไม่ได้กำลังโหลดจาก redirect ให้หยุดโหลด
          setTimeout(() => setLoading(false), 3000); 
      }
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = () => {
    setLoading(true);
    setErrorMsg('');
    // ใช้ signInWithRedirect แทน Popup (เสถียรกว่าบนมือถือ)
    signInWithRedirect(auth, googleProvider);
  };

  // --- Data Sync ---
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const qTrans = query(getCollectionRef(user.uid, 'transactions'));
    const unsubTrans = onSnapshot(qTrans, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(data);
      setLoading(false);
    });

    const qDebts = query(getCollectionRef(user.uid, 'debts'));
    const unsubDebts = onSnapshot(qDebts, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDebts(data);
    });

    const loadSettings = async () => {
      try {
        const catSnap = await getDoc(doc(db, 'users', user.uid, 'settings', 'categories'));
        if (catSnap.exists()) setCategories(catSnap.data());
        const budgetSnap = await getDoc(doc(db, 'users', user.uid, 'settings', 'budgets'));
        if (budgetSnap.exists()) setBudgets(budgetSnap.data());
      } catch (e) { console.log("New user/Offline"); }
    };
    loadSettings();

    return () => { unsubTrans(); unsubDebts(); };
  }, [user]);

  // --- Filtered Transactions ---
  const filteredTransactions = useMemo(() => {
    if (dateRange === 'all') return transactions;
    const now = new Date();
    let startDate;
    if (dateRange === '1month') startDate = startOfMonth(now);
    else startDate = subMonths(now, 3);
    
    return transactions.filter(t => new Date(t.date) >= startDate);
  }, [transactions, dateRange]);

  // --- Wealth Calculation ---
  const wealthData = useMemo(() => {
    const totalAssets = transactions.reduce((acc, t) => acc + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
    const totalLiabilities = debts.filter(d => d.type === 'payable' && !d.isSettled).reduce((acc, d) => acc + Number(d.remainingAmount), 0);
    return { assets: totalAssets, liabilities: totalLiabilities, netWorth: totalAssets - totalLiabilities };
  }, [transactions, debts]);

  // --- Actions ---
  const handleImageUpload = async (file) => {
    if (!file) return null;
    try {
       const storageRef = ref(storage, `users/${user.uid}/slips/${Date.now()}_${file.name}`);
       const snapshot = await uploadBytes(storageRef, file);
       return await getDownloadURL(snapshot.ref);
    } catch (e) { return null; }
  };

  const handleTransSubmit = async (e) => {
    e.preventDefault();
    if (!amount || !category) return;
    setIsUploading(true);
    try {
      const imageUrl = await handleImageUpload(image);
      await addDoc(getCollectionRef(user.uid, 'transactions'), {
        amount: Number(amount),
        description: description || (type === 'income' ? 'รายรับ' : 'รายจ่าย'),
        type, category, subCategory, wallet, imageUrl,
        date: new Date().toISOString()
      });
      setAmount(''); setDescription(''); setImage(null); setShowForm(false); setShowActionSheet(false);
    } catch (e) { alert(e.message); }
    setIsUploading(false);
  };

  const handleDebtSubmit = async (e) => {
    e.preventDefault();
    if (!debtAmount || !debtPerson) return;
    let installmentPlan = null;
    if (isInstallment && installMonths) {
      const principal = Number(debtAmount);
      const interest = Number(installInterest || 0) / 100;
      const totalWithInterest = principal + (principal * interest);
      installmentPlan = { totalWithInterest, months: Number(installMonths), monthlyPay: totalWithInterest / Number(installMonths), nextDue: debtDueDate };
    }
    try {
      const debtRef = await addDoc(getCollectionRef(user.uid, 'debts'), {
        totalAmount: isInstallment ? installmentPlan.totalWithInterest : Number(debtAmount),
        remainingAmount: isInstallment ? installmentPlan.totalWithInterest : Number(debtAmount),
        person: debtPerson, type: debtType, isSettled: false, dueDate: debtDueDate, installment: installmentPlan, history: [],
        date: new Date().toISOString()
      });
      const transType = debtType === 'payable' ? 'income' : 'expense';
      const transCat = debtType === 'payable' ? 'loan_in' : 'loan_out';
      await addDoc(getCollectionRef(user.uid, 'transactions'), {
        amount: Number(debtAmount), description: `${debtType === 'payable' ? 'กู้เงิน' : 'ให้ยืม'}: ${debtPerson}`,
        type: transType, category: transCat, subCategory: 'Principal', wallet: 'cash', refDebtId: debtRef.id, date: new Date().toISOString()
      });
      setDebtAmount(''); setDebtPerson(''); setIsInstallment(false); setShowDebtForm(false); setShowActionSheet(false);
    } catch (e) { console.error(e); }
  };

  const handleRepayment = async () => {
    if (!repayModal || !repayAmount) return;
    const payAmt = Number(repayAmount);
    try {
      const newRemaining = Math.max(0, repayModal.remainingAmount - payAmt);
      const isFullyPaid = newRemaining === 0;
      await updateDoc(getDocRef(user.uid, 'debts', repayModal.id), {
        remainingAmount: newRemaining, isSettled: isFullyPaid,
        history: arrayUnion({ date: new Date().toISOString(), amount: payAmt })
      });
      const transType = repayModal.type === 'payable' ? 'expense' : 'income';
      const transCat = repayModal.type === 'payable' ? 'debt_payment' : 'loan_in';
      await addDoc(getCollectionRef(user.uid, 'transactions'), {
        amount: payAmt, description: `ผ่อน: ${repayModal.person}`,
        type: transType, category: transCat, subCategory: 'Repayment', wallet: 'cash', refDebtId: repayModal.id, date: new Date().toISOString()
      });
      setRepayModal(null);
      setRepayAmount('');
    } catch (e) { console.error(e); }
  };

  const handleSaveBudget = async (catId, limit) => {
    const newBudgets = { ...budgets, [catId]: limit };
    setBudgets(newBudgets);
    await setDoc(doc(db, 'users', user.uid, 'settings', 'budgets'), newBudgets);
  };

  // --- Exports ---
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.addFont('https://fonts.gstatic.com/s/sarabun/v13/DtVjJx26TKEr37c9aAFJn2QN.woff2', 'Sarabun', 'normal');
    doc.text("Parker's Wallet Report", 14, 20);
    const tableData = filteredTransactions.map(t => [formatDateShort(t.date), t.description, t.category, t.subCategory || '-', t.type === 'income' ? `+${t.amount}` : `-${t.amount}`]);
    doc.autoTable({ head: [['Date', 'Description', 'Category', 'Sub', 'Amount']], body: tableData, startY: 30 });
    doc.save(`report_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const exportExcel = () => {
    const data = filteredTransactions.map(t => ({
      Date: formatDateShort(t.date),
      Type: t.type,
      Category: t.category,
      SubCategory: t.subCategory || '-',
      Description: t.description,
      Amount: t.amount,
      Wallet: wallets.find(w => w.id === t.wallet)?.name || t.wallet
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    XLSX.writeFile(wb, `Parker_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={48}/></div>;
  
  // LOGIN UI
  if (!user) return (
    <div className="h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="text-center bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full">
        <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600">
           <Wallet size={40}/>
        </div>
        <h1 className="text-2xl font-bold mb-2 text-slate-800">Parker's ERP</h1>
        <p className="text-slate-500 mb-8 text-sm">ระบบบัญชีส่วนตัวระดับ CEO</p>
        
        {errorMsg && <div className="bg-red-50 text-red-500 p-3 rounded-xl text-xs mb-4 break-words">{errorMsg}</div>}

        <button 
          onClick={handleGoogleLogin} 
          className="bg-blue-600 text-white px-6 py-4 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-3 w-full hover:bg-blue-700 transition-transform active:scale-95"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6"/> 
          Login with Google
        </button>
        
        <button 
           onClick={() => signInAnonymously(auth).catch(alert)}
           className="mt-4 text-xs text-slate-400 hover:text-slate-600 underline"
        >
           ทดลองใช้งาน (ไม่ซิงค์ข้อมูล)
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-24 md:pb-0">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-900 to-blue-900 p-6 pb-20 rounded-b-[2.5rem] shadow-xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
        
        <div className="flex justify-between items-center mb-6 relative z-10">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm text-xl">👑</div>
             <div><h1 className="font-bold text-lg">Parker's ERP</h1><p className="text-[10px] text-indigo-200 uppercase tracking-wider">Enterprise Edition</p></div>
          </div>
          <button onClick={() => setShowProfile(true)} className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-all">
             {user.photoURL ? <img src={user.photoURL} className="w-full h-full rounded-full p-0.5"/> : <UserCircle/>}
          </button>
        </div>

        <div className="text-center relative z-10">
           <p className="text-xs text-indigo-200 mb-1">Net Worth (ความมั่งคั่งสุทธิ)</p>
           <h2 className="text-4xl font-bold tracking-tight">{formatCurrency(wealthData.netWorth)}</h2>
           <div className="flex justify-center gap-4 mt-4 text-xs">
              <div className="bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30 text-emerald-100">Assets: {formatCurrency(wealthData.assets)}</div>
              <div className="bg-rose-500/20 px-3 py-1 rounded-full border border-rose-500/30 text-rose-100">Liabilities: {formatCurrency(wealthData.liabilities)}</div>
           </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="px-4 -mt-10 relative z-20 pb-24">
        
        {/* Tab Navigation */}
        <div className="bg-white rounded-2xl shadow-lg p-1.5 flex justify-between mb-6">
          {['dashboard', 'transactions', 'debts'].map(t => (
            <button key={t} onClick={()=>setActiveTab(t)} className={`flex-1 py-2.5 rounded-xl text-xs font-bold capitalize transition-all ${activeTab===t ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animation-fade-in">
             {/* Chart Card */}
             <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="font-bold text-gray-700 flex items-center gap-2"><BarChart3 size={18} className="text-indigo-500"/> Cash Flow</h3>
                   <select className="text-xs bg-gray-50 border rounded-lg px-2 py-1" value={dateRange} onChange={e=>setDateRange(e.target.value)}>
                      <option value="1month">เดือนนี้</option>
                      <option value="3months">3 เดือนล่าสุด</option>
                      <option value="all">ทั้งหมด</option>
                   </select>
                </div>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredTransactions.slice(-7)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0"/>
                      <XAxis dataKey="date" tickFormatter={formatDateShort} fontSize={10} axisLine={false} tickLine={false}/>
                      <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}/>
                      <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
             </div>

             {/* Export Tools */}
             <div className="grid grid-cols-2 gap-3">
                <button onClick={exportPDF} className="bg-rose-50 p-4 rounded-2xl flex flex-col items-center gap-2 border border-rose-100 hover:bg-rose-100 transition-colors text-rose-600">
                   <FileText size={24}/> <span className="text-xs font-bold">Export PDF</span>
                </button>
                <button onClick={exportExcel} className="bg-emerald-50 p-4 rounded-2xl flex flex-col items-center gap-2 border border-emerald-100 hover:bg-emerald-100 transition-colors text-emerald-600">
                   <FileSpreadsheet size={24}/> <span className="text-xs font-bold">Export Excel</span>
                </button>
             </div>
          </div>
        )}

        {/* TRANSACTIONS TAB */}
        {activeTab === 'transactions' && (
          <div className="animation-fade-in space-y-4">
             <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-700 text-lg">ประวัติรายการ</h3>
                <input type="month" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-medium shadow-sm"/>
             </div>
             
             {filteredTransactions.filter(t => t.date.startsWith(filterMonth)).length === 0 ? (
               <div className="text-center py-12 text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
                  <p>ไม่มีรายการในเดือนนี้</p>
               </div>
             ) : (
               <div className="space-y-3">
                 {filteredTransactions.filter(t => t.date.startsWith(filterMonth)).map(t => {
                   const catList = t.type === 'income' ? categories.income : categories.expense;
                   const cat = catList.find(c => c.id === t.category) || { name: t.category, icon: 'Wallet', color: 'bg-gray-100' };
                   const Icon = IconMap[cat.icon] || Wallet;
                   return (
                     <div key={t.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${cat.color} shadow-sm`}>
                             <Icon size={20}/>
                          </div>
                          <div>
                            <p className="font-bold text-sm text-gray-800">{t.description}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                              <span>{cat.name}</span>
                              {t.subCategory && <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">{t.subCategory}</span>}
                              <span>• {formatDateShort(t.date)}</span>
                            </div>
                          </div>
                        </div>
                        <div className={`font-bold text-sm ${t.type==='income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.type==='income' ? '+' : '-'}{formatCurrency(t.amount)}
                        </div>
                     </div>
                   )
                 })}
               </div>
             )}
          </div>
        )}
        
        {/* DEBTS TAB */}
        {activeTab === 'debts' && (
             <div className="space-y-4 animation-fade-in">
              {debts.map(d => (
                <div key={d.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                         <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${d.type==='payable'?'bg-rose-50 text-rose-600':'bg-teal-50 text-teal-600'}`}>
                           {d.type==='payable' ? 'PAYABLE' : 'RECEIVABLE'}
                         </span>
                      </div>
                      <h4 className="font-bold text-gray-800 text-lg">{d.person}</h4>
                      {d.installment && <p className="text-xs text-gray-400">ผ่อน {d.installment.months} งวด (ดอกเบี้ยรวม {formatCurrency(d.installment.totalWithInterest - d.totalAmount)})</p>}
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] text-gray-400 uppercase tracking-wide">Remaining</p>
                       <p className="text-xl font-bold text-indigo-600">{formatCurrency(d.remainingAmount)}</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-4"><div className="bg-indigo-500 h-2 rounded-full transition-all" style={{width: `${((d.totalAmount - d.remainingAmount)/d.totalAmount)*100}%`}}></div></div>
                  {!d.isSettled && (
                    <button onClick={() => setRepayModal(d)} className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-100 transition-colors flex justify-center gap-2">
                      <HandCoins size={18}/> {d.type==='payable' ? 'บันทึกการจ่ายคืน' : 'บันทึกการรับเงิน'}
                    </button>
                  )}
                </div>
              ))}
            </div>
        )}

      </div>

      {/* CENTRAL FAB (Super Button) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
         <button onClick={() => setShowActionSheet(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white w-16 h-16 rounded-full shadow-2xl shadow-indigo-500/40 flex items-center justify-center transition-transform hover:scale-105 active:scale-95">
            <Plus size={32} strokeWidth={2.5}/>
         </button>
      </div>

      {/* --- MODALS & OVERLAYS --- */}

      {/* Action Sheet (Central Menu) */}
      {showActionSheet && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center" onClick={(e) => e.target === e.currentTarget && setShowActionSheet(false)}>
           <div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-10 animation-slide-up">
              <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6"></div>
              <h3 className="font-bold text-gray-800 text-lg mb-4 text-center">ทำรายการใหม่</h3>
              <div className="grid grid-cols-3 gap-4">
                 <button onClick={()=>{setType('income'); setShowActionSheet(false); setShowForm(true);}} className="flex flex-col items-center gap-2 p-4 bg-emerald-50 rounded-2xl text-emerald-600 hover:bg-emerald-100 transition-colors"><div className="bg-white p-3 rounded-full shadow-sm"><TrendingUp size={24}/></div><span className="text-xs font-bold">รายรับ</span></button>
                 <button onClick={()=>{setType('expense'); setShowActionSheet(false); setShowForm(true);}} className="flex flex-col items-center gap-2 p-4 bg-rose-50 rounded-2xl text-rose-600 hover:bg-rose-100 transition-colors"><div className="bg-white p-3 rounded-full shadow-sm"><TrendingDown size={24}/></div><span className="text-xs font-bold">รายจ่าย</span></button>
                 <button onClick={()=>{setShowActionSheet(false); setShowDebtForm(true);}} className="flex flex-col items-center gap-2 p-4 bg-purple-50 rounded-2xl text-purple-600 hover:bg-purple-100 transition-colors"><div className="bg-white p-3 rounded-full shadow-sm"><HandCoins size={24}/></div><span className="text-xs font-bold">หนี้สิน</span></button>
              </div>
           </div>
        </div>
      )}

      {/* Transaction Form */}
      {showForm && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col animate-fade-in">
           <div className="p-4 flex items-center justify-between border-b">
              <button onClick={()=>setShowForm(false)}><X className="text-gray-500"/></button>
              <h3 className="font-bold text-lg">บันทึก{type==='income'?'รายรับ':'รายจ่าย'}</h3>
              <div className="w-6"></div>
           </div>
           <div className="p-6 flex-1 overflow-y-auto">
              <div className="text-center mb-8">
                 <p className="text-gray-400 text-xs mb-1">จำนวนเงิน</p>
                 <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} className="text-5xl font-bold text-center w-full outline-none text-gray-800 placeholder-gray-200" placeholder="0"/>
              </div>
              
              <div className="space-y-6">
                 <div>
                    <label className="text-xs font-bold text-gray-500 mb-3 block">หมวดหมู่</label>
                    <div className="grid grid-cols-4 gap-3">
                       {(type==='income'?categories.income:categories.expense).map(cat => (
                          <button key={cat.id} onClick={()=>setCategory(cat.id)} className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${category===cat.id ? `border-${cat.color.split('-')[1]}-500 bg-${cat.color.split('-')[1]}-50` : 'border-gray-100 bg-gray-50/50'}`}>
                             <div className={`text-2xl`}>{React.createElement(IconMap[cat.icon] || Wallet, {size:20, className: category===cat.id ? '' : 'text-gray-400'})}</div>
                             <span className={`text-[10px] font-bold ${category===cat.id ? 'text-gray-800' : 'text-gray-400'}`}>{cat.name}</span>
                          </button>
                       ))}
                    </div>
                 </div>

                 {/* Sub-Category Selector (Show only if category selected) */}
                 {category && (type==='income'?categories.income:categories.expense).find(c=>c.id===category)?.subs && (
                    <div>
                       <label className="text-xs font-bold text-gray-500 mb-2 block">หมวดหมู่ย่อย</label>
                       <div className="flex flex-wrap gap-2">
                          {(type==='income'?categories.income:categories.expense).find(c=>c.id===category).subs.map(sub => (
                             <button key={sub} onClick={()=>setSubCategory(sub)} className={`px-4 py-2 rounded-xl text-xs font-bold border ${subCategory===sub ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-500'}`}>{sub}</button>
                          ))}
                       </div>
                    </div>
                 )}

                 <div className="space-y-4">
                    <div className="bg-gray-50 p-3 rounded-xl flex items-center gap-3">
                       <FileText size={20} className="text-gray-400"/>
                       <input type="text" value={description} onChange={e=>setDescription(e.target.value)} placeholder="บันทึกช่วยจำ..." className="bg-transparent w-full text-sm outline-none"/>
                    </div>
                    <label className="bg-gray-50 p-3 rounded-xl flex items-center gap-3 w-full cursor-pointer">
                       <div className="bg-white p-1 rounded shadow-sm"><ImageIcon size={16} className="text-gray-500"/></div>
                       <span className="text-sm text-gray-500 flex-1">{image ? 'แนบรูปแล้ว' : 'แนบสลิป'}</span>
                       <input type="file" accept="image/*" className="hidden" onChange={e=>setImage(e.target.files[0])}/>
                    </label>
                 </div>
              </div>
           </div>
           <div className="p-4 border-t bg-white">
              <button onClick={handleTransSubmit} disabled={isUploading} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-indigo-700 transition-transform active:scale-95 disabled:bg-gray-300">
                 {isUploading ? 'กำลังบันทึก...' : 'ยืนยัน'}
              </button>
           </div>
        </div>
      )}

      {/* Debt Form */}
      {showDebtForm && (
         <div className="fixed inset-0 bg-white z-50 flex flex-col animate-fade-in">
            <div className="p-4 flex items-center justify-between border-b">
              <button onClick={()=>setShowDebtForm(false)}><X className="text-gray-500"/></button>
              <h3 className="font-bold text-lg">สร้างหนี้สินใหม่</h3>
              <div className="w-6"></div>
           </div>
           <div className="p-6 flex-1 overflow-y-auto space-y-6">
              <div className="flex bg-gray-100 p-1 rounded-xl">
                 <button onClick={()=>setDebtType('payable')} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${debtType==='payable'?'bg-white shadow text-rose-600':'text-gray-400'}`}>ฉันยืมเขา (หนี้)</button>
                 <button onClick={()=>setDebtType('receivable')} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${debtType==='receivable'?'bg-white shadow text-teal-600':'text-gray-400'}`}>ให้เขายืม (ลูกหนี้)</button>
              </div>

              <div>
                 <label className="text-xs font-bold text-gray-500 mb-2 block">จำนวนเงินต้น</label>
                 <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-3 border border-gray-100">
                    <span className="text-2xl text-gray-400">฿</span>
                    <input type="number" value={debtAmount} onChange={e=>setDebtAmount(e.target.value)} className="bg-transparent text-3xl font-bold w-full outline-none" placeholder="0"/>
                 </div>
              </div>

              <div>
                 <label className="text-xs font-bold text-gray-500 mb-2 block">ชื่อคู่สัญญา / สถาบันการเงิน</label>
                 <input type="text" value={debtPerson} onChange={e=>setDebtPerson(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none font-bold" placeholder="ระบุชื่อ..."/>
              </div>

              <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                 <div className="flex items-center justify-between mb-4">
                    <span className="font-bold text-indigo-900">ผ่อนชำระเป็นงวด?</span>
                    <input type="checkbox" checked={isInstallment} onChange={e=>setIsInstallment(e.target.checked)} className="w-6 h-6 accent-indigo-600"/>
                 </div>
                 {isInstallment && (
                    <div className="grid grid-cols-2 gap-4 animate-fade-in">
                       <div>
                          <label className="text-[10px] font-bold text-indigo-400 mb-1 block">จำนวนงวด</label>
                          <input type="number" value={installMonths} onChange={e=>setInstallMonths(e.target.value)} className="w-full p-3 bg-white rounded-xl border border-indigo-100 outline-none"/>
                       </div>
                       <div>
                          <label className="text-[10px] font-bold text-indigo-400 mb-1 block">ดอกเบี้ยรวม (%)</label>
                          <input type="number" value={installInterest} onChange={e=>setInstallInterest(e.target.value)} className="w-full p-3 bg-white rounded-xl border border-indigo-100 outline-none"/>
                       </div>
                    </div>
                 )}
              </div>
           </div>
           <div className="p-4 border-t bg-white">
              <button onClick={handleDebtSubmit} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg">บันทึก</button>
           </div>
         </div>
      )}

      {/* Profile & Settings Modal */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={(e)=>e.target===e.currentTarget && setShowProfile(false)}>
           <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 animation-slide-up">
              <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6"></div>
              <div className="text-center mb-8">
                 <div className="w-24 h-24 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl overflow-hidden">
                    {user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover"/> : "😎"}
                 </div>
                 <h3 className="font-bold text-xl">{user?.displayName || 'CEO Parker'}</h3>
                 <p className="text-sm text-gray-500">{user?.email}</p>
              </div>

              <div className="space-y-3">
                 <button onClick={()=>{setShowBudgetManager(true); setShowProfile(false);}} className="w-full p-4 bg-gray-50 rounded-2xl flex items-center justify-between hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3"><div className="bg-orange-100 p-2 rounded-full text-orange-600"><PieChart size={20}/></div> <span className="font-bold text-gray-700">ตั้งงบประมาณ (Budget)</span></div>
                    <ChevronRight size={18} className="text-gray-400"/>
                 </button>
                 <button onClick={()=>{setShowProfile(false); alert('Coming Soon: Edit Categories');}} className="w-full p-4 bg-gray-50 rounded-2xl flex items-center justify-between hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3"><div className="bg-blue-100 p-2 rounded-full text-blue-600"><Settings size={20}/></div> <span className="font-bold text-gray-700">จัดการหมวดหมู่</span></div>
                    <ChevronRight size={18} className="text-gray-400"/>
                 </button>
                 <button onClick={async ()=>{await signOut(auth); setShowProfile(false);}} className="w-full p-4 bg-rose-50 rounded-2xl flex items-center justify-center gap-2 text-rose-600 font-bold hover:bg-rose-100 transition-colors mt-6">
                    <LogOut size={20}/> ออกจากระบบ
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Budget Manager Modal */}
      {showBudgetManager && (
         <div className="fixed inset-0 bg-white z-50 flex flex-col">
            <div className="p-4 flex items-center gap-3 border-b">
               <button onClick={()=>setShowBudgetManager(false)} className="p-2 bg-gray-100 rounded-full"><ArrowRightLeft className="rotate-180" size={20}/></button>
               <h3 className="font-bold text-lg">ตั้งงบประมาณรายเดือน</h3>
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
               {categories.expense.map(cat => {
                  const currentLimit = budgets[cat.id] || '';
                  const Icon = IconMap[cat.icon] || Wallet;
                  return (
                     <div key={cat.id} className="bg-white p-4 border rounded-2xl flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                           <div className={`p-3 rounded-xl ${cat.color} bg-opacity-20`}><Icon size={20}/></div>
                           <span className="font-bold text-gray-700">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-gray-400">฿</span>
                           <input 
                              type="number" 
                              className="w-24 p-2 bg-gray-50 rounded-lg font-bold text-right outline-none focus:ring-2 ring-indigo-500" 
                              placeholder="0"
                              value={currentLimit}
                              onChange={(e) => handleSaveBudget(cat.id, e.target.value)}
                           />
                        </div>
                     </div>
                  )
               })}
            </div>
         </div>
      )}
      
      {/* Repay Modal */}
      {repayModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animation-scale-in">
              <h3 className="font-bold text-lg mb-1">บันทึกการชำระ</h3>
              <p className="text-sm text-gray-500 mb-6">รายการ: {repayModal.person}</p>
              <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-2 mb-6 border border-gray-100">
                 <span className="text-2xl text-gray-400 font-bold">฿</span>
                 <input type="number" value={repayAmount} onChange={e=>setRepayAmount(e.target.value)} placeholder="ระบุยอดเงิน" className="w-full bg-transparent text-3xl font-bold outline-none" autoFocus/>
              </div>
              <div className="flex gap-3">
                 <button onClick={()=>{setRepayModal(null); setRepayAmount('');}} className="flex-1 py-3.5 bg-gray-100 rounded-xl font-bold text-gray-500 hover:bg-gray-200">ยกเลิก</button>
                 <button onClick={handleRepayment} className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700">ยืนยัน</button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default App;
