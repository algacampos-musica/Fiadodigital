import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Package, TrendingUp, CreditCard, Plus, Trash2, 
  Search, ExternalLink, MessageCircle, AlertCircle, ShoppingCart, 
  Banknote, ArrowLeft, Bot, Sparkles, Pencil, Calendar, Tag, Download
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Debtor, Product, Transaction, TransactionType, TransactionItem, DebtorStatus } from './types';
import { generateReminderMessage, analyzeFinancialStatus } from './services/geminiService';
import { Modal } from './components/Modal';

const APP_VERSION = '1.3.0';

// Mock Data Generators for Initial Load
const initialProducts: Product[] = [
  { id: '1', name: 'Cerveja Lata', defaultPrice: 4.50 },
  { id: '2', name: 'Refrigerante 2L', defaultPrice: 9.00 },
  { id: '3', name: 'Salgadinho', defaultPrice: 7.00 },
  { id: '4', name: 'Pão (kg)', defaultPrice: 12.00 },
];

const App: React.FC = () => {
  // --- State ---
  const [activeView, setActiveView] = useState<'DASHBOARD' | 'DEBTORS' | 'PRODUCTS' | 'DEBTOR_DETAILS'>('DASHBOARD');
  const [selectedDebtorId, setSelectedDebtorId] = useState<string | null>(null);

  const [debtors, setDebtors] = useState<Debtor[]>(() => {
    const saved = localStorage.getItem('debtors');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('products');
    return saved ? JSON.parse(saved) : initialProducts;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('transactions');
    return saved ? JSON.parse(saved) : [];
  });

  // Search State
  const [searchTerm, setSearchTerm] = useState('');

  // Modals State
  const [isAddDebtorOpen, setIsAddDebtorOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<TransactionType>(TransactionType.DEBT);

  // Editing State
  const [editingDebtor, setEditingDebtor] = useState<Debtor | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Transaction Form State
  const [transactionCart, setTransactionCart] = useState<{product: Product, qty: number}[]>([]);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Dinheiro');
  const [transactionDate, setTransactionDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // AI State
  const [aiMessage, setAiMessage] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiAction, setAiAction] = useState<'REMINDER' | 'ANALYSIS'>('REMINDER');

  // --- Effects ---
  useEffect(() => {
    // Version Check / Migration Placeholder
    const savedVersion = localStorage.getItem('app_version');
    if (savedVersion !== APP_VERSION) {
      console.log(`Atualizando versão de ${savedVersion} para ${APP_VERSION}`);
      localStorage.setItem('app_version', APP_VERSION);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('debtors', JSON.stringify(debtors));
  }, [debtors]);

  useEffect(() => {
    localStorage.setItem('products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('transactions', JSON.stringify(transactions));
  }, [transactions]);

  // --- Calculated Values ---
  const getDebtorBalance = (id: string) => {
    return transactions
      .filter(t => t.debtorId === id)
      .reduce((acc, t) => {
        return t.type === TransactionType.DEBT ? acc + t.totalAmount : acc - t.totalAmount;
      }, 0);
  };

  const totalOutstanding = useMemo(() => {
    return debtors.reduce((acc, d) => acc + getDebtorBalance(d.id), 0);
  }, [debtors, transactions]);

  const topDebtors = useMemo(() => {
    return debtors
      .map(d => ({ ...d, balance: getDebtorBalance(d.id) }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5);
  }, [debtors, transactions]);

  // --- Handlers ---
  const handleSaveDebtor = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const phone = formData.get('phone') as string;
    const status = formData.get('status') as DebtorStatus;

    if (editingDebtor) {
      setDebtors(debtors.map(d => d.id === editingDebtor.id ? { ...d, name, phone, status } : d));
      setEditingDebtor(null);
    } else {
      const newDebtor: Debtor = {
        id: crypto.randomUUID(),
        name,
        phone,
        status,
        createdAt: new Date().toISOString(),
      };
      setDebtors([...debtors, newDebtor]);
    }
    setIsAddDebtorOpen(false);
  };

  const handleSaveProduct = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const price = parseFloat(formData.get('price') as string);

    if (editingProduct) {
      setProducts(products.map(p => p.id === editingProduct.id ? { ...p, name, defaultPrice: price } : p));
      setEditingProduct(null);
    } else {
      const newProduct: Product = {
        id: crypto.randomUUID(),
        name,
        defaultPrice: price,
      };
      setProducts([...products, newProduct]);
    }
    setIsAddProductOpen(false);
  };

  const handleAddTransaction = () => {
    if (!selectedDebtorId) return;

    // Combine selected date with current time to maintain relative order within that day
    const now = new Date();
    const timeString = now.toTimeString().split(' ')[0]; // HH:MM:SS
    const finalDate = new Date(`${transactionDate}T${timeString}`).toISOString();

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      debtorId: selectedDebtorId,
      type: transactionType,
      date: finalDate,
      totalAmount: 0,
    };

    if (transactionType === TransactionType.DEBT) {
      const items: TransactionItem[] = transactionCart.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.qty,
        unitPrice: item.product.defaultPrice,
        total: item.qty * item.product.defaultPrice
      }));
      newTransaction.items = items;
      newTransaction.totalAmount = items.reduce((sum, item) => sum + item.total, 0);
    } else {
      newTransaction.totalAmount = parseFloat(paymentAmount);
      newTransaction.paymentMethod = paymentMethod;
    }

    setTransactions([...transactions, newTransaction]);
    setIsAddTransactionOpen(false);
    setTransactionCart([]);
    setPaymentAmount('');
  };

  const handleExportData = () => {
    // Cabeçalho do CSV
    const headers = ['Nome do Cliente', 'Telefone', 'Classificação', 'Saldo Atual (R$)'];
    
    // Processar dados
    const rows = debtors.map(debtor => {
      const balance = getDebtorBalance(debtor.id);
      return [
        debtor.name,
        debtor.phone,
        debtor.status || 'REGULAR',
        balance.toFixed(2).replace('.', ',') // Formato BR
      ];
    });

    // Montar conteúdo CSV com BOM para suportar acentos no Excel
    const csvContent = "\uFEFF" + [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    // Criar blob e link de download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_fiado_digital_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateAiContent = async (tone?: 'polite' | 'firm' | 'funny') => {
    if (!selectedDebtorId) return;
    const debtor = debtors.find(d => d.id === selectedDebtorId);
    if (!debtor) return;

    setIsAiLoading(true);
    setAiMessage('');
    
    try {
      if (aiAction === 'REMINDER' && tone) {
        const balance = getDebtorBalance(debtor.id);
        const msg = await generateReminderMessage(debtor, balance, tone);
        setAiMessage(msg);
      } else if (aiAction === 'ANALYSIS') {
        const debtorTransactions = transactions.filter(t => t.debtorId === debtor.id);
        const msg = await analyzeFinancialStatus(debtor, debtorTransactions);
        setAiMessage(msg);
      }
    } catch (e) {
      setAiMessage("Ocorreu um erro ao consultar a IA.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const openTransactionModal = (type: TransactionType) => {
    setTransactionType(type);
    setTransactionDate(new Date().toISOString().split('T')[0]); // Reset to today
    setIsAddTransactionOpen(true);
  };

  const getStatusBadge = (status?: DebtorStatus) => {
    switch (status) {
      case 'OTIMO':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">Ótimo</span>;
      case 'BOM':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Bom</span>;
      case 'REGULAR':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">Regular</span>;
      case 'CALOTEIRO':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Caloteiro</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">Novo</span>;
    }
  };

  // --- Render Functions ---

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-500 text-sm font-medium">Total a Receber</h3>
            <div className="p-2 bg-rose-100 rounded-full text-rose-600"><TrendingUp size={20} /></div>
          </div>
          <p className="text-3xl font-bold text-slate-800 mt-2">
            R$ {totalOutstanding.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-500 text-sm font-medium">Clientes Ativos</h3>
            <div className="p-2 bg-blue-100 rounded-full text-blue-600"><Users size={20} /></div>
          </div>
          <p className="text-3xl font-bold text-slate-800 mt-2">{debtors.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-500 text-sm font-medium">Produtos Cadastrados</h3>
            <div className="p-2 bg-emerald-100 rounded-full text-emerald-600"><Package size={20} /></div>
          </div>
          <p className="text-3xl font-bold text-slate-800 mt-2">{products.length}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Maiores Devedores</h3>
        <div className="h-64">
           {topDebtors.length > 0 ? (
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={topDebtors}>
                 <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                 <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val}`}/>
                 <Tooltip 
                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Dívida']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                 />
                 <Bar dataKey="balance" fill="#f43f5e" radius={[4, 4, 0, 0]}>
                    {topDebtors.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.balance > 100 ? '#e11d48' : '#f43f5e'} />
                    ))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
           ) : (
             <div className="h-full flex items-center justify-center text-gray-400">Sem dados ainda</div>
           )}
        </div>
      </div>
    </div>
  );

  const renderDebtorList = () => {
    const filteredDebtors = debtors.filter(debtor => 
      debtor.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      debtor.phone.includes(searchTerm)
    );

    return (
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-xl font-bold text-slate-800">Clientes</h2>
          <button 
            onClick={() => { setEditingDebtor(null); setIsAddDebtorOpen(true); }}
            className="bg-primary hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors w-full md:w-auto justify-center"
          >
            <Plus size={18} /> Novo Cliente
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDebtors.map(debtor => {
            const balance = getDebtorBalance(debtor.id);
            return (
              <div 
                key={debtor.id} 
                onClick={() => { setSelectedDebtorId(debtor.id); setActiveView('DEBTOR_DETAILS'); }}
                className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer group relative"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">{debtor.name}</h3>
                      {getStatusBadge(debtor.status)}
                    </div>
                    <p className="text-sm text-gray-500">{debtor.phone}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className={`px-2 py-1 rounded text-xs font-bold ${balance > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      R$ {balance.toFixed(2)}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingDebtor(debtor);
                        setIsAddDebtorOpen(true);
                      }}
                      className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {debtors.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <Users className="mx-auto text-gray-300 mb-2" size={48} />
            <p className="text-gray-500">Nenhum cliente cadastrado ainda.</p>
          </div>
        ) : filteredDebtors.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Nenhum cliente encontrado com "{searchTerm}".</p>
          </div>
        ) : null}
      </div>
    );
  };

  const renderProducts = () => (
    <div className="space-y-4">
       <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800">Produtos</h2>
        <button 
          onClick={() => { setEditingProduct(null); setIsAddProductOpen(true); }}
          className="bg-primary hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={18} /> Novo Produto
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-600 text-sm">
            <tr>
              <th className="p-4">Nome</th>
              <th className="p-4">Preço Padrão</th>
              <th className="p-4 w-32 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map(product => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="p-4 font-medium text-slate-800">{product.name}</td>
                <td className="p-4 text-slate-600">R$ {product.defaultPrice.toFixed(2)}</td>
                <td className="p-4 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setEditingProduct(product);
                      setIsAddProductOpen(true);
                    }}
                    className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Pencil size={18} />
                  </button>
                  <button 
                    onClick={() => setProducts(products.filter(p => p.id !== product.id))}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderDebtorDetails = () => {
    const debtor = debtors.find(d => d.id === selectedDebtorId);
    if (!debtor) return null;

    const debtorTransactions = transactions
      .filter(t => t.debtorId === debtor.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const balance = getDebtorBalance(debtor.id);

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setActiveView('DEBTORS')} 
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft size={24} className="text-gray-600" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-800">{debtor.name}</h1>
                <button
                  onClick={() => {
                    setEditingDebtor(debtor);
                    setIsAddDebtorOpen(true);
                  }}
                  className="text-gray-400 hover:text-blue-600 transition-colors"
                  title="Editar cadastro"
                >
                  <Pencil size={18} />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1">
                 {getStatusBadge(debtor.status)}
                 <p className="text-gray-500 text-sm">{debtor.phone}</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Saldo Devedor</p>
            <p className={`text-3xl font-bold ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              R$ {balance.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button 
            onClick={() => openTransactionModal(TransactionType.DEBT)}
            className="flex flex-col items-center justify-center p-4 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl transition-colors gap-2 border border-rose-200"
          >
            <ShoppingCart size={24} />
            <span className="font-medium">Vender Fiado</span>
          </button>
          <button 
            onClick={() => openTransactionModal(TransactionType.PAYMENT)}
            className="flex flex-col items-center justify-center p-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-colors gap-2 border border-emerald-200"
          >
            <Banknote size={24} />
            <span className="font-medium">Receber Pagamento</span>
          </button>
          <button 
            onClick={() => { setAiAction('REMINDER'); setIsAiModalOpen(true); setAiMessage(''); }}
            className="flex flex-col items-center justify-center p-4 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition-colors gap-2 border border-blue-200"
          >
            <MessageCircle size={24} />
            <span className="font-medium">Cobrar (IA)</span>
          </button>
          <button 
            onClick={() => { setAiAction('ANALYSIS'); setIsAiModalOpen(true); setAiMessage(''); generateAiContent(); }}
            className="flex flex-col items-center justify-center p-4 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl transition-colors gap-2 border border-purple-200"
          >
            <Sparkles size={24} />
            <span className="font-medium">Análise (IA)</span>
          </button>
        </div>

        {/* Ledger */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50 font-semibold text-gray-700">
            Extrato de Movimentações
          </div>
          <div className="divide-y divide-gray-100">
            {debtorTransactions.length === 0 ? (
              <div className="p-8 text-center text-gray-400">Nenhuma movimentação registrada.</div>
            ) : (
              debtorTransactions.map(t => (
                <div key={t.id} className="p-4 hover:bg-gray-50 transition-colors flex justify-between items-center">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 p-2 rounded-full ${t.type === 'DEBT' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {t.type === 'DEBT' ? <ShoppingCart size={16} /> : <Banknote size={16} />}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">
                        {t.type === 'DEBT' ? 'Compra Fiado' : `Pagamento via ${t.paymentMethod}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(t.date).toLocaleDateString()} às {new Date(t.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                      {t.items && (
                        <div className="mt-1 text-xs text-gray-600">
                          {t.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className={`font-bold ${t.type === 'DEBT' ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {t.type === 'DEBT' ? '-' : '+'} R$ {t.totalAmount.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar Navigation */}
      <aside className="w-20 md:w-64 bg-primary text-white flex-shrink-0 flex flex-col transition-all">
        <div className="p-6 flex items-center gap-3 border-b border-slate-700">
          <div className="bg-accent p-2 rounded-lg">
            <CreditCard className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold hidden md:block tracking-tight">FiadoDigital</h1>
            <p className="text-xs text-slate-400 hidden md:block font-medium">By - Campos</p>
          </div>
        </div>
        
        <nav className="flex-1 py-6 space-y-2 px-2 md:px-4">
          <button 
            onClick={() => { setActiveView('DASHBOARD'); setSearchTerm(''); }}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${activeView === 'DASHBOARD' ? 'bg-secondary text-accent' : 'text-gray-400 hover:text-white hover:bg-slate-800'}`}
          >
            <TrendingUp size={22} />
            <span className="hidden md:block">Visão Geral</span>
          </button>
          <button 
            onClick={() => { setActiveView('DEBTORS'); setSearchTerm(''); }}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${activeView === 'DEBTORS' || activeView === 'DEBTOR_DETAILS' ? 'bg-secondary text-accent' : 'text-gray-400 hover:text-white hover:bg-slate-800'}`}
          >
            <Users size={22} />
            <span className="hidden md:block">Clientes</span>
          </button>
          <button 
            onClick={() => { setActiveView('PRODUCTS'); setSearchTerm(''); }}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${activeView === 'PRODUCTS' ? 'bg-secondary text-accent' : 'text-gray-400 hover:text-white hover:bg-slate-800'}`}
          >
            <Package size={22} />
            <span className="hidden md:block">Produtos</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-700 space-y-2">
           <button 
             onClick={handleExportData}
             className="w-full flex items-center justify-center gap-2 p-2 rounded text-xs text-gray-400 hover:text-white hover:bg-slate-800 transition-colors"
           >
             <Download size={14} />
             <span className="hidden md:block">Exportar Relatório</span>
           </button>
           <p className="text-xs text-slate-500 text-center md:text-left">v{APP_VERSION}</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {activeView === 'DASHBOARD' && renderDashboard()}
          {activeView === 'DEBTORS' && renderDebtorList()}
          {activeView === 'PRODUCTS' && renderProducts()}
          {activeView === 'DEBTOR_DETAILS' && renderDebtorDetails()}
        </div>
      </main>

      {/* Modals */}
      <Modal 
        isOpen={isAddDebtorOpen} 
        onClose={() => { setIsAddDebtorOpen(false); setEditingDebtor(null); }} 
        title={editingDebtor ? "Editar Cliente" : "Cadastrar Novo Cliente"}
      >
        <form onSubmit={handleSaveDebtor} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
            <input 
              required 
              name="name" 
              type="text" 
              defaultValue={editingDebtor?.name}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-accent focus:ring focus:ring-accent focus:ring-opacity-50 border p-2" 
              placeholder="Ex: João da Silva" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Telefone / WhatsApp</label>
            <input 
              required 
              name="phone" 
              type="text" 
              defaultValue={editingDebtor?.phone}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-accent focus:ring focus:ring-accent focus:ring-opacity-50 border p-2" 
              placeholder="(00) 00000-0000" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Classificação</label>
            <select
              name="status"
              defaultValue={editingDebtor?.status || 'REGULAR'}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-accent focus:ring focus:ring-accent focus:ring-opacity-50 border p-2"
            >
              <option value="OTIMO">Ótimo (Excelente Pagador)</option>
              <option value="BOM">Bom (Paga em dia)</option>
              <option value="REGULAR">Regular (Atrasos eventuais)</option>
              <option value="CALOTEIRO">Caloteiro (Cuidado!)</option>
            </select>
          </div>
          <button type="submit" className="w-full bg-primary text-white py-2 rounded-lg hover:bg-slate-800 transition">
            {editingDebtor ? "Salvar Alterações" : "Salvar Cadastro"}
          </button>
        </form>
      </Modal>

      <Modal 
        isOpen={isAddProductOpen} 
        onClose={() => { setIsAddProductOpen(false); setEditingProduct(null); }} 
        title={editingProduct ? "Editar Produto" : "Cadastrar Produto"}
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome do Item</label>
            <input 
              required 
              name="name" 
              type="text" 
              defaultValue={editingProduct?.name}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-accent focus:ring focus:ring-accent focus:ring-opacity-50 border p-2" 
              placeholder="Ex: Coca Cola" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Preço Padrão (R$)</label>
            <input 
              required 
              name="price" 
              type="number" 
              step="0.01" 
              defaultValue={editingProduct?.defaultPrice}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-accent focus:ring focus:ring-accent focus:ring-opacity-50 border p-2" 
              placeholder="0.00" 
            />
          </div>
          <button type="submit" className="w-full bg-primary text-white py-2 rounded-lg hover:bg-slate-800 transition">
            {editingProduct ? "Salvar Alterações" : "Salvar Produto"}
          </button>
        </form>
      </Modal>

      <Modal isOpen={isAddTransactionOpen} onClose={() => { setIsAddTransactionOpen(false); setTransactionCart([]); }} title={transactionType === TransactionType.DEBT ? "Lançar Dívida (Venda)" : "Baixar Pagamento"}>
        <div className="space-y-4">
          {/* Date Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Data da Movimentação</label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="block w-full pl-10 rounded-md border-gray-300 border p-2 text-sm focus:ring-accent focus:border-accent"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Útil para lançar notas ou pagamentos antigos.
            </p>
          </div>
          
          <hr className="border-gray-200" />

          {transactionType === TransactionType.DEBT ? (
            <>
              {/* Product Selector */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">Adicionar Item</label>
                <div className="flex gap-2">
                  <select id="productSelect" className="flex-1 rounded-md border-gray-300 border p-2 text-sm">
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} - R${p.defaultPrice.toFixed(2)}</option>)}
                  </select>
                  <input id="qtyInput" type="number" min="1" defaultValue="1" className="w-20 rounded-md border-gray-300 border p-2 text-sm" />
                  <button 
                    type="button"
                    onClick={() => {
                      const select = document.getElementById('productSelect') as HTMLSelectElement;
                      const input = document.getElementById('qtyInput') as HTMLInputElement;
                      const product = products.find(p => p.id === select.value);
                      const qty = parseInt(input.value);
                      if (product) {
                        setTransactionCart([...transactionCart, { product, qty }]);
                      }
                    }}
                    className="bg-accent text-white px-3 rounded-md hover:bg-blue-600"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Cart List */}
              <div className="max-h-40 overflow-y-auto border rounded-md p-2">
                {transactionCart.length === 0 ? <p className="text-gray-400 text-center text-sm">Carrinho vazio</p> : (
                  <ul className="space-y-2">
                    {transactionCart.map((item, idx) => (
                      <li key={idx} className="flex justify-between text-sm border-b pb-1 last:border-0">
                        <span>{item.qty}x {item.product.name}</span>
                        <span className="font-semibold">R$ {(item.qty * item.product.defaultPrice).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex justify-between items-center font-bold text-lg pt-2">
                <span>Total:</span>
                <span>R$ {transactionCart.reduce((acc, item) => acc + (item.qty * item.product.defaultPrice), 0).toFixed(2)}</span>
              </div>
            </>
          ) : (
            /* Payment Form */
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Valor do Pagamento</label>
                <input 
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  type="number" step="0.01" 
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring focus:ring-emerald-500 focus:ring-opacity-50 border p-2 text-lg font-semibold text-emerald-700" 
                  placeholder="0.00" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Forma de Pagamento</label>
                <select 
                  value={paymentMethod} 
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2"
                >
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="PIX">PIX</option>
                  <option value="Cartão">Cartão</option>
                  <option value="Serviço">Troca de Serviço</option>
                </select>
              </div>
            </>
          )}

          <button 
            onClick={handleAddTransaction}
            disabled={transactionType === TransactionType.DEBT ? transactionCart.length === 0 : !paymentAmount}
            className={`w-full py-3 rounded-lg text-white font-semibold transition shadow-md ${transactionType === TransactionType.DEBT ? 'bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300' : 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300'}`}
          >
            {transactionType === TransactionType.DEBT ? 'Confirmar Fiado' : 'Confirmar Pagamento'}
          </button>
        </div>
      </Modal>

      <Modal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} title={aiAction === 'REMINDER' ? "Gerador de Cobrança IA" : "Análise de Perfil IA"}>
        <div className="space-y-4">
          {aiAction === 'REMINDER' && (
            <div className="grid grid-cols-3 gap-2">
               <button onClick={() => generateAiContent('polite')} className="p-2 border rounded-lg hover:bg-blue-50 text-sm">😇 Educado</button>
               <button onClick={() => generateAiContent('firm')} className="p-2 border rounded-lg hover:bg-gray-100 text-sm">😐 Sério</button>
               <button onClick={() => generateAiContent('funny')} className="p-2 border rounded-lg hover:bg-yellow-50 text-sm">🤪 Engraçado</button>
            </div>
          )}

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 min-h-[100px] relative">
            {isAiLoading ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400 gap-2">
                <Bot className="animate-bounce" />
                <span>Pensando...</span>
              </div>
            ) : (
              <p className="text-slate-700 whitespace-pre-wrap">{aiMessage || "Selecione uma opção acima para gerar."}</p>
            )}
          </div>
          
          {aiMessage && !isAiLoading && (
             <button 
               onClick={() => { navigator.clipboard.writeText(aiMessage); alert('Copiado!'); }}
               className="w-full border border-gray-300 py-2 rounded-lg text-gray-600 hover:bg-gray-50 text-sm"
             >
               Copiar Texto
             </button>
          )}
        </div>
      </Modal>

    </div>
  );
};

export default App;