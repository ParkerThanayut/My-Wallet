import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Wallet, TrendingUp, TrendingDown, Trash2, DollarSign, Edit2, LogOut, 
  UserCircle, PieChart, FileText, Calculator, BellRing, AlertTriangle,
  Activity, Briefcase, Coffee, Home, ShoppingBag, Star, Heart, Gift, Zap,
  HandCoins, ArrowRightLeft, CheckCircle2, X, Calendar, BarChart3, Settings,
  Filter, Download, Landmark, CreditCard
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line 
} from 'recharts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, deleteDoc, doc, query, 
  onSnapshot, updateDoc, arrayUnion, setDoc, getDoc 
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ------------------------------------------------------------------
// 🔑 SETTING: ใส่รหัส Firebase ของคุณตรงนี้
// ------------------------------------------------------------------
const manualConfig = {
  apiKey: "AIzaSy... (ใส่รหัสยาวๆ ของคุณตรงนี้)",
  authDomain: "parker-wallet.firebaseapp.com",
  projectId: "parker-wallet",
  storageBucket: "parker-wallet.appspot.com",
  messagingSenderId: "...",
  appId: "..."
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

// --- Constants ---
const WALLETS_DEFAULT = [
  { id: 'cash', name: 'เงินสด', type: 'cash', icon: Wallet, color: 'bg-green-500' },
  { id: 'kbank', name: 'KBank', type: 'bank', icon: Landmark, color: 'bg-emerald-600' },
  { id: 'scb', name: 'SCB', type: 'bank', icon: Landmark, color: 'bg-purple-600' },
  { id: 'credit', name: 'บัตรเครดิต', type: 'credit', icon: CreditCard, color: 'bg-gray-600' },
  { id: 'ewallet', name: 'TrueMoney', type: 'ewallet', icon: Zap, color: 'bg-orange-500' }
];

const DEFAULT_CATEGORIES = {
  income: [
    { id: 'salary', name: 'เงินเดือน', icon: 'DollarSign', color: 'bg-blue-100 text-blue-600' },
    { id: 'freelance', name: 'รายได้เสริม', icon: 'Briefcase', color: 'bg-emerald-100 text-emerald-600' },
    { id: 'investment', name: 'การลงทุน', icon: 'TrendingUp', color: 'bg-purple-100 text-purple-600' },
    { id: 'loan_in', name: 'กู้ยืม (รับเงิน)', icon: 'HandCoins', color: 'bg-teal-100 text-teal-600' }
  ],
  expense: [
    { id: 'food', name: 'อาหาร', icon: 'Coffee', color: 'bg-orange-100 text-orange-600' },
    { id: 'transport', name: 'เดินทาง', icon: 'ShoppingBag', color: 'bg-yellow-100 text-yellow-600' },
    { id: 'housing', name: 'ที่พัก/น้ำไฟ', icon: 'Home', color: 'bg-indigo-100 text-indigo-600' },
    { id: 'shopping', name: 'ของใช้', icon: 'ShoppingBag', color: 'bg-pink-100 text-pink-600' },
    { id: 'health', name: 'สุขภาพ', icon: 'Activity', color: 'bg-red-100 text-red-600' },
    { id: 'debt_payment', name: 'ชำระหนี้', icon: 'HandCoins', color: 'bg-rose-100 text-rose-600' },
    { id: 'loan_out', name: 'ให้กู้ยืม', icon: 'ArrowRightLeft', color: 'bg-gray-100 text-gray-600' }
  ]
};

const IconMap = { Plus, Wallet, TrendingUp, TrendingDown, Trash2, DollarSign, Activity, Briefcase, Coffee, Home, ShoppingBag, Star, Heart, Gift, Zap, HandCoins, ArrowRightLeft, Landmark, CreditCard, FileText, Calculator };

const formatCurrency = (num) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(num);
const formatDate = (str) => new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(str));
const formatDateShort = (str) => new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' }).format(new Date(str));

// --- App Component ---
const App = () => {
  // Core State
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Data State
  const [transactions, setTransactions] = useState([]);
  const [debts, setDebts] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [budgets, setBudgets] = useState({}); // { categoryId: limitAmount }
  const [wallets, setWallets] = useState(WALLETS_DEFAULT);

  // UI State
  const [showForm, setShowForm] = useState(false);
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // Form Inputs (Transaction)
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState('');
  const [wallet, setWallet] = useState('cash');
  const [image, setImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Form Inputs (Debt)
  const [debtAmount, setDebtAmount] = useState('');
  const [debtPerson, setDebtPerson] = useState('');
  const [debtType, setDebtType] = useState('payable');
  const [debtDueDate, setDebtDueDate] = useState('');
  const [isInstallment, setIsInstallment] = useState(false);
  const [installMonths, setInstallMonths] = useState('');
  const [installInterest, setInstallInterest] = useState('');

  // Repayment Modal
  const [repayModal, setRepayModal] = useState(null);
  const [repayAmount, setRepayAmount] = useState('');

  // --- Auth & Initial Load ---
  useEffect(() => {
    const timer = setTimeout(() => { if (!user && loading) setLoading(false); }, 5000);
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setLoading(false);
    });
    if (!auth.currentUser) signInAnonymously(auth).catch(console.error);
    return () => { unsubscribe(); clearTimeout(timer); };
  }, []);

  // --- Data Sync ---
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    // Transactions
    const qTrans = query(getCollectionRef(user.uid, 'transactions'));
    const unsubTrans = onSnapshot(qTrans, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(data);
      setLoading(false);
    });

    // Debts
    const qDebts = query(getCollectionRef(user.uid, 'debts'));
    const unsubDebts = onSnapshot(qDebts, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDebts(data);
    });

    // Settings (Categories & Budgets)
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

  // --- Calculated Values (Smart Logic) ---
  
  // 1. Net Worth (Assets - Liabilities)
  // Asset = Sum of all wallets
  // Liability = Sum of payable debts
  const wealthData = useMemo(() => {
    const totalAssets = transactions.reduce((acc, t) => {
       // ไม่รวมรายการที่เกี่ยวกับหนี้สินในการคำนวณ Asset โดยตรง เพราะเราจะดูยอดคงเหลือในกระเป๋า
       // แต่จริงๆ แล้ว Asset คือ "เงินในกระเป๋า" ซึ่ง Transaction มันสะท้อนอยู่แล้ว
       // โจทย์ข้อ 9: ยืมเงินมา ไม่บวกความมั่งคั่ง -> แปลว่า Net Worth = Assets - Liabilities
       return acc + (t.type === 'income' ? Number(t.amount) : -Number(t.amount));
    }, 0);

    const totalLiabilities = debts
      .filter(d => d.type === 'payable' && !d.isSettled)
      .reduce((acc, d) => acc + Number(d.remainingAmount), 0);
      
    return {
      assets: totalAssets,
      liabilities: totalLiabilities,
      netWorth: totalAssets - totalLiabilities
    };
  }, [transactions, debts]);

  // 2. Budget Status
  const budgetStatus = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyExpenses = transactions.filter(t => t.type === 'expense' && t.date.startsWith(currentMonth));
    
    const status = {};
    Object.keys(budgets).forEach(catId => {
      const spent = monthlyExpenses.filter(t => t.category === catId).reduce((acc, t) => acc + Number(t.amount), 0);
      const limit = Number(budgets[catId]);
      status[catId] = { spent, limit, percent: (spent / limit) * 100 };
    });
    return status;
  }, [transactions, budgets]);

  // --- Actions ---

  const handleImageUpload = async (file) => {
    if (!file) return null;
    // Resize logic simplified for brevity
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
        description, type, category, wallet, imageUrl,
        date: new Date().toISOString()
      });
      setAmount(''); setDescription(''); setImage(null); setShowForm(false);
    } catch (e) { alert(e.message); }
    setIsUploading(false);
  };

  const handleDebtSubmit = async (e) => {
    e.preventDefault();
    if (!debtAmount || !debtPerson) return;
    
    // คำนวณผ่อนชำระ
    let installmentPlan = null;
    if (isInstallment && installMonths) {
      const principal = Number(debtAmount);
      const interest = Number(installInterest || 0) / 100;
      const totalWithInterest = principal + (principal * interest); // Simple Interest
      const monthlyPay = totalWithInterest / Number(installMonths);
      installmentPlan = {
        totalWithInterest,
        months: Number(installMonths),
        monthlyPay,
        nextDue: debtDueDate // วันครบกำหนดงวดแรก
      };
    }

    try {
      // 1. Create Debt Record
      const debtRef = await addDoc(getCollectionRef(user.uid, 'debts'), {
        totalAmount: isInstallment ? installmentPlan.totalWithInterest : Number(debtAmount),
        remainingAmount: isInstallment ? installmentPlan.totalWithInterest : Number(debtAmount),
        person: debtPerson,
        type: debtType,
        isSettled: false,
        dueDate: debtDueDate,
        installment: installmentPlan,
        history: [],
        date: new Date().toISOString()
      });

      // 2. Create Transaction (Link to Wallet)
      // กู้ยืม (Payable) -> เงินเข้า (Income)
      // ให้กู้ (Receivable) -> เงินออก (Expense)
      const transType = debtType === 'payable' ? 'income' : 'expense';
      const transCat = debtType === 'payable' ? 'loan_in' : 'loan_out';
      
      await addDoc(getCollectionRef(user.uid, 'transactions'), {
        amount: Number(debtAmount), // ยอดเงินสดที่ได้รับจริง (ไม่รวมดอกเบี้ย)
        description: `${debtType === 'payable' ? 'กู้เงิน' : 'ให้ยืม'}: ${debtPerson}`,
        type: transType,
        category: transCat,
        wallet: 'cash',
        refDebtId: debtRef.id,
        date: new Date().toISOString()
      });

      setDebtAmount(''); setDebtPerson(''); setIsInstallment(false); setShowDebtForm(false);
    } catch (e) { console.error(e); }
  };

  const handleRepayment = async () => {
    if (!repayModal || !repayAmount) return;
    const payAmt = Number(repayAmount);
    
    try {
      const newRemaining = Math.max(0, repayModal.remainingAmount - payAmt);
      const isFullyPaid = newRemaining === 0;

      await updateDoc(getDocRef(user.uid, 'debts', repayModal.id), {
        remainingAmount: newRemaining,
        isSettled: isFullyPaid,
        history: arrayUnion({ date: new Date().toISOString(), amount: payAmt })
      });

      // สร้าง Transaction การผ่อน
      const transType = repayModal.type === 'payable' ? 'expense' : 'income';
      const transCat = repayModal.type === 'payable' ? 'debt_payment' : 'loan_in'; // คืนหนี้ = expense, รับคืน = income
      
      await addDoc(getCollectionRef(user.uid, 'transactions'), {
        amount: payAmt,
        description: `ผ่อน: ${repayModal.person}`,
        type: transType,
        category: transCat,
        wallet: 'cash',
        refDebtId: repayModal.id,
        date: new Date().toISOString()
      });

      setRepayModal(null); // ปิด Pop-up (แก้ Bug ข้อ 8)
      setRepayAmount('');
    } catch (e) { console.error(e); }
  };

  const handleSaveBudget = async (catId, limit) => {
    const newBudgets = { ...budgets, [catId]: limit };
    setBudgets(newBudgets);
    await setDoc(doc(db, 'users', user.uid, 'settings', 'budgets'), newBudgets);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.addFont('https://fonts.gstatic.com/s/sarabun/v13/DtVjJx26TKEr37c9aAFJn2QN.woff2', 'Sarabun', 'normal'); // ใช้ Font มาตรฐาน (อาจต้อง setup เพิ่มถ้าต้องการภาษาไทยเป๊ะๆ ใน PDF แต่อันนี้ใช้ Basic ไปก่อน)
    doc.text("Parker's Wallet Report", 14, 20);
    
    const tableData = transactions.map(t => [
      formatDateShort(t.date),
      t.description,
      t.category,
      t.type === 'income' ? `+${t.amount}` : `-${t.amount}`
    ]);

    doc.autoTable({
      head: [['Date', 'Description', 'Category', 'Amount']],
      body: tableData,
      startY: 30,
    });

    doc.save(`report_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  // --- UI Render ---
  if (!user && !loading) return <div className="h-screen flex items-center justify-center"><button onClick={()=>signInWithPopup(auth, googleProvider)} className="bg-blue-600 text-white p-4 rounded-xl font-bold">เข้าสู่ระบบด้วย Google</button></div>;
  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600"/></div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-24 md:pb-0">
      {/* Header & Net Worth */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 p-6 pb-24 rounded-b-[2.5rem] shadow-xl text-white">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <div className="bg-white/20 p-2 rounded-full"><Wallet size={20}/></div>
            <div>
               <h1 className="font-bold text-lg">Parker's ERP</h1>
               <p className="text-xs text-indigo-200">ระบบจัดการการเงินอัจฉริยะ</p>
            </div>
          </div>
          <div className="flex gap-2">
             <button onClick={exportPDF} className="bg-white/20 p-2 rounded-full hover:bg-white/30" title="Export Report"><Download size={20}/></button>
             <button onClick={() => setShowProfile(true)} className="bg-white/20 p-2 rounded-full hover:bg-white/30"><UserCircle size={20}/></button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
           <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
              <p className="text-xs text-indigo-100 mb-1">สินทรัพย์ (Assets)</p>
              <p className="text-xl font-bold">{formatCurrency(wealthData.assets)}</p>
           </div>
           <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
              <p className="text-xs text-rose-100 mb-1">หนี้สิน (Liabilities)</p>
              <p className="text-xl font-bold">{formatCurrency(wealthData.liabilities)}</p>
           </div>
        </div>
        
        <div className="text-center">
           <p className="text-xs text-indigo-200">ความมั่งคั่งสุทธิ (Net Worth)</p>
           <h2 className="text-3xl font-bold mt-1">{formatCurrency(wealthData.netWorth)}</h2>
        </div>
      </div>

      {/* Menu Tabs */}
      <div className="px-4 -mt-8 relative z-20 mb-4">
        <div className="bg-white rounded-full shadow-lg p-1 flex justify-between overflow-x-auto no-scrollbar">
          {['dashboard', 'transactions', 'debts', 'budget'].map(t => (
            <button key={t} onClick={()=>setActiveTab(t)} className={`px-4 py-2 rounded-full text-xs font-bold capitalize transition-all ${activeTab===t ? 'bg-indigo-600 text-white shadow' : 'text-gray-500'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto pb-24">
        
        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animation-fade-in">
             {/* Chart */}
             <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 h-64">
                <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><BarChart3 size={18}/> กระแสเงินสด (30 วันล่าสุด)</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={transactions.slice(-10)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={formatDateShort} fontSize={10}/>
                    <RechartsTooltip />
                    <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
             </div>

             {/* Recent Wallets */}
             <div>
               <h3 className="font-bold text-gray-700 mb-3">กระเป๋าเงิน</h3>
               <div className="grid grid-cols-2 gap-3">
                 {wallets.map(w => {
                   const bal = transactions.filter(t => t.wallet === w.id).reduce((acc, t) => acc + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
                   return (
                     <div key={w.id} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
                       <div className={`p-2 rounded-full ${w.color} text-white`}><w.icon size={16}/></div>
                       <div><p className="text-xs text-gray-500">{w.name}</p><p className="font-bold text-sm">{formatCurrency(bal)}</p></div>
                     </div>
                   )
                 })}
               </div>
             </div>
          </div>
        )}

        {/* TRANSACTIONS */}
        {activeTab === 'transactions' && (
          <div className="animation-fade-in">
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-700">รายการล่าสุด</h3>
                <button onClick={()=>setShowForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1 shadow-lg hover:bg-indigo-700"><Plus size={16}/> เพิ่มรายการ</button>
             </div>
             
             {/* Filter */}
             <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
               <input type="month" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} className="border rounded-lg px-3 py-1 text-sm bg-white" />
               {/* Add more filters here if needed */}
             </div>

             <div className="space-y-3">
               {transactions.filter(t => t.date.startsWith(filterMonth)).map(t => {
                 const catList = t.type === 'income' ? categories.income : categories.expense;
                 const cat = catList.find(c => c.id === t.category) || { name: t.category, icon: 'Wallet', color: 'bg-gray-100' };
                 const Icon = IconMap[cat.icon] || Wallet;
                 return (
                   <div key={t.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cat.color}`}><Icon size={18}/></div>
                        <div>
                          <p className="font-bold text-sm text-gray-700">{t.description}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>{formatDateShort(t.date)}</span>
                            {t.imageUrl && <a href={t.imageUrl} target="_blank" className="text-indigo-500 flex items-center gap-1"><ImageIcon size={12}/> สลิป</a>}
                          </div>
                        </div>
                      </div>
                      <div className={`font-bold ${t.type==='income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {t.type==='income' ? '+' : '-'}{formatCurrency(t.amount)}
                      </div>
                   </div>
                 )
               })}
             </div>
          </div>
        )}

        {/* BUDGET */}
        {activeTab === 'budget' && (
          <div className="animation-fade-in">
            <h3 className="font-bold text-gray-700 mb-4">งบประมาณรายเดือน (Budget)</h3>
            <div className="space-y-4">
              {categories.expense.map(cat => {
                const stat = budgetStatus[cat.id] || { spent: 0, limit: 0, percent: 0 };
                const isOver = stat.spent > stat.limit && stat.limit > 0;
                const isWarning = stat.percent > 80 && !isOver;
                
                return (
                  <div key={cat.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between mb-2">
                      <div className="flex items-center gap-2">
                         <div className={`w-2 h-2 rounded-full ${cat.color.split(' ')[0]}`}></div>
                         <span className="font-bold text-sm">{cat.name}</span>
                      </div>
                      <button onClick={() => {
                        const limit = prompt(`ตั้งงบประมาณสำหรับ ${cat.name}`, stat.limit || 0);
                        if (limit) handleSaveBudget(cat.id, limit);
                      }} className="text-xs text-indigo-500 font-bold">ตั้งเป้า</button>
                    </div>
                    
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>ใช้ไป {formatCurrency(stat.spent)}</span>
                      <span>เป้า {formatCurrency(stat.limit)}</span>
                    </div>
                    
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                       <div 
                         className={`h-full transition-all ${isOver ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-green-500'}`} 
                         style={{width: `${Math.min(stat.percent, 100)}%`}}
                       ></div>
                    </div>
                    {isOver && <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1"><AlertTriangle size={10}/> งบเกินแล้ว!</p>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* DEBTS & INSTALLMENTS */}
        {activeTab === 'debts' && (
          <div className="animation-fade-in">
            <button onClick={()=>setShowDebtForm(true)} className="w-full bg-indigo-600 text-white p-3 rounded-xl font-bold mb-4 shadow-lg flex justify-center gap-2"><Plus/> สร้างหนี้ใหม่</button>
            
            <div className="space-y-4">
              {debts.map(d => (
                <div key={d.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                         <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${d.type==='payable'?'bg-rose-100 text-rose-600':'bg-teal-100 text-teal-600'}`}>
                           {d.type==='payable' ? 'ต้องจ่าย' : 'รอรับ'}
                         </span>
                         <h4 className="font-bold text-gray-800">{d.person}</h4>
                      </div>
                      {d.installment && <p className="text-xs text-gray-400 mt-1">ผ่อน {d.installment.months} งวด (ดอก {formatCurrency(d.installment.totalWithInterest - d.totalAmount)})</p>}
                    </div>
                    <div className="text-right">
                       <p className="text-xs text-gray-400">คงเหลือ</p>
                       <p className="text-lg font-bold text-indigo-600">{formatCurrency(d.remainingAmount)}</p>
                    </div>
                  </div>
                  
                  {/* Progress */}
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                     <div className="bg-indigo-500 h-1.5 rounded-full" style={{width: `${((d.totalAmount - d.remainingAmount)/d.totalAmount)*100}%`}}></div>
                  </div>

                  {!d.isSettled && (
                    <button onClick={() => setRepayModal(d)} className="w-full py-2 bg-indigo-50 text-indigo-600 rounded-lg font-bold text-xs hover:bg-indigo-100 transition-colors">
                      {d.type==='payable' ? 'จ่ายค่างวด / คืนเงิน' : 'บันทึกรับเงินคืน'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* --- MODALS --- */}

      {/* Transaction Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animation-slide-up max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between mb-4"><h3 className="font-bold text-lg">บันทึกรายการ</h3><button onClick={()=>setShowForm(false)}><X/></button></div>
             <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
               <button onClick={()=>setType('income')} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${type==='income'?'bg-white shadow text-emerald-600':'text-gray-500'}`}>รายรับ</button>
               <button onClick={()=>setType('expense')} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${type==='expense'?'bg-white shadow text-rose-600':'text-gray-500'}`}>รายจ่าย</button>
             </div>
             <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" className="w-full text-3xl font-bold text-center py-4 border-b-2 outline-none focus:border-indigo-500 mb-4"/>
             
             <div className="grid grid-cols-4 gap-2 mb-4">
               {(type==='income'?categories.income:categories.expense).map(cat => {
                 const Icon = IconMap[cat.icon] || Wallet;
                 return (
                   <button key={cat.id} onClick={()=>setCategory(cat.id)} className={`flex flex-col items-center gap-1 p-2 rounded-xl border ${category===cat.id?'border-indigo-500 bg-indigo-50':'border-transparent hover:bg-gray-50'}`}>
                     <div className={`p-1.5 rounded-full ${cat.color}`}><Icon size={16}/></div>
                     <span className="text-[10px] truncate w-full text-center">{cat.name}</span>
                   </button>
                 )
               })}
             </div>

             <div className="space-y-3 mb-6">
                <input type="text" value={description} onChange={e=>setDescription(e.target.value)} placeholder="บันทึกช่วยจำ..." className="w-full p-3 bg-gray-50 rounded-xl text-sm outline-none"/>
                <select value={wallet} onChange={e=>setWallet(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl text-sm outline-none">
                   {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <label className="flex items-center gap-2 w-full p-3 bg-gray-50 rounded-xl text-sm text-gray-500 cursor-pointer">
                   <ImageIcon size={18}/> {image ? 'แนบรูปแล้ว' : 'แนบสลิป/ใบเสร็จ'}
                   <input type="file" accept="image/*" className="hidden" onChange={e=>setImage(e.target.files[0])} />
                </label>
                {image && <div className="h-20 w-full rounded-xl bg-gray-100 overflow-hidden"><img src={URL.createObjectURL(image)} className="h-full w-full object-cover"/></div>}
             </div>
             
             <button onClick={handleTransSubmit} disabled={isUploading} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg">{isUploading ? 'กำลังบันทึก...' : 'บันทึก'}</button>
          </div>
        </div>
      )}

      {/* Debt Form Modal */}
      {showDebtForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between mb-4"><h3 className="font-bold text-lg">สร้างหนี้/เงินกู้</h3><button onClick={()=>setShowDebtForm(false)}><X/></button></div>
              <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
                 <button onClick={()=>setDebtType('payable')} className={`flex-1 py-2 rounded-lg font-bold text-sm ${debtType==='payable'?'bg-white shadow text-rose-600':'text-gray-500'}`}>ฉันยืมเขา</button>
                 <button onClick={()=>setDebtType('receivable')} className={`flex-1 py-2 rounded-lg font-bold text-sm ${debtType==='receivable'?'bg-white shadow text-teal-600':'text-gray-500'}`}>ให้เขายืม</button>
              </div>
              
              <div className="space-y-3 mb-4">
                 <input type="number" value={debtAmount} onChange={e=>setDebtAmount(e.target.value)} placeholder="จำนวนเงินต้น" className="w-full p-3 border rounded-xl text-lg font-bold"/>
                 <input type="text" value={debtPerson} onChange={e=>setDebtPerson(e.target.value)} placeholder="ชื่อคน / สถาบันการเงิน" className="w-full p-3 border rounded-xl"/>
                 
                 <div className="flex items-center gap-2 bg-indigo-50 p-3 rounded-xl">
                    <input type="checkbox" checked={isInstallment} onChange={e=>setIsInstallment(e.target.checked)} className="w-5 h-5 accent-indigo-600"/>
                    <span className="text-sm font-bold text-indigo-700">มีระบบผ่อนชำระ?</span>
                 </div>

                 {isInstallment && (
                   <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl animate-fade-in">
                      <div>
                        <label className="text-xs text-gray-500">จำนวนงวด</label>
                        <input type="number" value={installMonths} onChange={e=>setInstallMonths(e.target.value)} className="w-full p-2 border rounded-lg"/>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">ดอกเบี้ยรวม (%)</label>
                        <input type="number" value={installInterest} onChange={e=>setInstallInterest(e.target.value)} className="w-full p-2 border rounded-lg"/>
                      </div>
                   </div>
                 )}
                 
                 <div>
                   <label className="text-xs text-gray-500">วันครบกำหนด (เริ่ม)</label>
                   <input type="date" value={debtDueDate} onChange={e=>setDebtDueDate(e.target.value)} className="w-full p-3 border rounded-xl"/>
                 </div>
              </div>

              <button onClick={handleDebtSubmit} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg">บันทึกหนี้สิน</button>
           </div>
        </div>
      )}

      {/* Repay Modal */}
      {repayModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
              <h3 className="font-bold text-lg mb-1">บันทึกการชำระ</h3>
              <p className="text-sm text-gray-500 mb-4">รายการ: {repayModal.person}</p>
              <input type="number" value={repayAmount} onChange={e=>setRepayAmount(e.target.value)} placeholder="ระบุยอดเงิน" className="w-full p-4 text-2xl font-bold text-center border rounded-xl mb-4 outline-none focus:border-indigo-500" autoFocus/>
              <div className="flex gap-3">
                 <button onClick={()=>setRepayModal(null)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-500">ยกเลิก</button>
                 <button onClick={handleRepayment} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg">ยืนยัน</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
