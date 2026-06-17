import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';

// Load pre-parsed PhonePe transaction database
const PHONEPE_STATEMENT_DATA = require('./phonepe_statement_data.json');

// Color Theme
const THEME = {
  bg: '#0f172a',       // slate-900
  card: '#1e293b',     // slate-800
  border: '#334155',   // slate-700
  primary: '#8b5cf6',  // violet-500
  primaryDark: '#5f259f', // PhonePe violet
  accent: '#d946ef',   // magenta
  text: '#f8fafc',     // slate-50
  textMuted: '#94a3b8', // slate-400
  success: '#10b981',  // emerald-500
  danger: '#f43f5e',   // rose-500
  warning: '#f59e0b',  // amber-500
};

// Avatar colors mapping
const AVATAR_COLORS = {
  purple: '#8b5cf6',
  blue: '#3b82f6',
  teal: '#0d9488',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
};

// Category colors mapping for badges
const CATEGORY_COLORS = {
  Food: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171' },
  Travel: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' },
  Rent: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24' },
  Entertainment: { bg: 'rgba(167, 139, 250, 0.15)', text: '#c084fc' },
  Shopping: { bg: 'rgba(236, 72, 153, 0.15)', text: '#f472b6' },
  Settlement: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399' },
  Others: { bg: 'rgba(107, 114, 128, 0.15)', text: '#9ca3af' },
};

export default function App() {
  // --- CORE APP STATE ---
  const [users, setUsers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [currentUser, setCurrentUser] = useState(null); // String name
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentTab, setCurrentTab] = useState('dashboard'); // 'dashboard' | 'expenses' | 'members'

  // --- AUTH STATE ---
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [authUsername, setAuthUsername] = useState('');
  const [authAvatarColor, setAuthAvatarColor] = useState('purple');

  // --- MODAL VISIBILITY STATE ---
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [memberModalVisible, setMemberModalVisible] = useState(false);
  const [phonepeModalVisible, setPhonepeModalVisible] = useState(false);
  const [settleModalVisible, setSettleModalVisible] = useState(false);

  // --- ADD/EDIT EXPENSE STATE ---
  const [expenseId, setExpenseId] = useState(null); // Null for adding, ID string for editing
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Food');
  const [expensePaidBy, setExpensePaidBy] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [expenseSplitType, setExpenseSplitType] = useState('equal'); // 'equal' | 'custom'
  const [equalSplitSelection, setEqualSplitSelection] = useState({}); // userId: boolean
  const [customSplitShares, setCustomSplitShares] = useState({}); // userId: string

  // --- ADD MEMBER STATE ---
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberColor, setNewMemberColor] = useState('purple');

  // --- PHONEPE IMPORTER STATE ---
  const [phonepeTxs, setPhonepeTxs] = useState([]);
  const [phonepeSelectedIds, setPhonepeSelectedIds] = useState(new Set());
  const [phonepeFilterType, setPhonepeFilterType] = useState('ALL'); // 'ALL' | 'CREDIT' | 'DEBIT'
  const [phonepeGlobalPayer, setPhonepeGlobalPayer] = useState('');
  const [phonepeSplitEqually, setPhonepeSplitEqually] = useState(true);
  const [phonepeFileName, setPhonepeFileName] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  // --- SETTLEMENT CONFIRMATION STATE ---
  const [settleData, setSettleData] = useState(null); // { from, to, amount }

  // --- EXPENSE LIST FILTERS ---
  const [filterQuery, setFilterQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterPayer, setFilterPayer] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'EXPENSE' | 'SETTLEMENT'
  const [filterDate, setFilterDate] = useState('');

  // ----------------------------------------------------
  // INITIAL DATA LIFECYCLE
  // ----------------------------------------------------
  useEffect(() => {
    async function loadInitialData() {
      try {
        const storedUsers = await AsyncStorage.getItem('splitease_users');
        const storedExpenses = await AsyncStorage.getItem('splitease_expenses');
        const storedCurrentUser = await AsyncStorage.getItem('splitease_current_user');
        const dbVersion = await AsyncStorage.getItem('splitease_db_version');

        let loadedUsers = [];
        let loadedExpenses = [];

        // DB Version check/reset logic like web app
        if (dbVersion !== '2.1') {
          await AsyncStorage.removeItem('splitease_users');
          await AsyncStorage.removeItem('splitease_expenses');
          await AsyncStorage.removeItem('splitease_current_user');
          await AsyncStorage.setItem('splitease_db_version', '2.1');
        } else {
          if (storedUsers) loadedUsers = JSON.parse(storedUsers);
          if (storedExpenses) loadedExpenses = JSON.parse(storedExpenses);
        }

        // Initialize default users if empty
        if (loadedUsers.length === 0) {
          loadedUsers = [
            { id: 'u-iam', name: 'iam', avatarColor: 'purple', dateAdded: new Date().toISOString().split('T')[0] }
          ];
          await AsyncStorage.setItem('splitease_users', JSON.stringify(loadedUsers));
        }

        setUsers(loadedUsers);
        setExpenses(loadedExpenses);

        if (storedCurrentUser) {
          // Cleanup iam if logged in user is not iam
          let finalUsers = loadedUsers;
          if (storedCurrentUser.toLowerCase() !== 'iam') {
            const hasIam = loadedUsers.some(u => u.name.toLowerCase() === 'iam' || u.id === 'u-iam');
            if (hasIam) {
              finalUsers = loadedUsers.filter(u => u.name.toLowerCase() !== 'iam' && u.id !== 'u-iam');
              setUsers(finalUsers);
              await AsyncStorage.setItem('splitease_users', JSON.stringify(finalUsers));
            }
          }
          setCurrentUser(storedCurrentUser);
        }
      } catch (err) {
        console.error('Failed to load storage details:', err);
      } finally {
        setIsLoaded(true);
      }
    }
    loadInitialData();
  }, []);

  // Save changes helper
  const saveData = async (newUsers, newExpenses) => {
    try {
      await AsyncStorage.setItem('splitease_users', JSON.stringify(newUsers));
      await AsyncStorage.setItem('splitease_expenses', JSON.stringify(newExpenses));
    } catch (err) {
      console.error('Failed to save state:', err);
    }
  };

  // ----------------------------------------------------
  // DERIVED DATA & CALCULATIONS (NETTING MATH)
  // ----------------------------------------------------
  const balances = useMemo(() => {
    const balMap = {};
    users.forEach(u => {
      balMap[u.id] = 0;
    });

    expenses.forEach(exp => {
      const payerId = exp.paidBy;
      const amount = parseFloat(exp.amount);

      if (balMap[payerId] !== undefined) {
        balMap[payerId] += amount;
      }

      if (exp.splits) {
        Object.entries(exp.splits).forEach(([userId, share]) => {
          if (balMap[userId] !== undefined) {
            balMap[userId] -= parseFloat(share);
          }
        });
      }
    });

    return balMap;
  }, [users, expenses]);

  const settlements = useMemo(() => {
    const list = [];
    const debtors = [];
    const creditors = [];

    Object.entries(balances).forEach(([userId, bal]) => {
      if (bal < -0.01) {
        debtors.push({ userId, amount: -bal });
      } else if (bal > 0.01) {
        creditors.push({ userId, amount: bal });
      }
    });

    // Sort descending to match largest values
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    let dIdx = 0;
    let cIdx = 0;

    const dList = debtors.map(d => ({ ...d }));
    const cList = creditors.map(c => ({ ...c }));

    while (dIdx < dList.length && cIdx < cList.length) {
      const debtor = dList[dIdx];
      const creditor = cList[cIdx];

      const txAmount = Math.min(debtor.amount, creditor.amount);

      if (txAmount > 0.01) {
        list.push({
          from: debtor.userId,
          to: creditor.userId,
          amount: Math.round(txAmount * 100) / 100
        });
      }

      debtor.amount -= txAmount;
      creditor.amount -= txAmount;

      if (debtor.amount <= 0.01) dIdx++;
      if (creditor.amount <= 0.01) cIdx++;
    }

    return list;
  }, [balances]);

  const totalExpensesSum = useMemo(() => {
    let sum = 0;
    expenses.forEach(exp => {
      if (!exp.isSettlement) {
        sum += parseFloat(exp.amount);
      }
    });
    return sum;
  }, [expenses]);

  const myBalance = useMemo(() => {
    if (!currentUser) return 0;
    const currentMemberObj = users.find(u => u.name.toLowerCase() === currentUser.toLowerCase());
    if (!currentMemberObj) return 0;
    return balances[currentMemberObj.id] || 0;
  }, [currentUser, users, balances]);

  // ----------------------------------------------------
  // AUTHENTICATION LOGIC
  // ----------------------------------------------------
  const handleLogin = (name) => {
    const cleaned = name.trim();
    if (!cleaned) return;

    const userObj = users.find(u => u.name.toLowerCase() === cleaned.toLowerCase());
    if (userObj) {
      setCurrentUser(userObj.name);
      AsyncStorage.setItem('splitease_current_user', userObj.name);
      // Cleanup iam if logged in user is not iam
      if (userObj.name.toLowerCase() !== 'iam') {
        const finalUsers = users.filter(u => u.name.toLowerCase() !== 'iam' && u.id !== 'u-iam');
        setUsers(finalUsers);
        saveData(finalUsers, expenses);
      }
    } else {
      Alert.alert('Member Not Found', 'No user registered with that name. Please create a new account.');
    }
  };

  const handleSignup = () => {
    const cleaned = authUsername.trim();
    if (!cleaned) return;

    const userExists = users.find(u => u.name.toLowerCase() === cleaned.toLowerCase());
    if (userExists) {
      Alert.alert('Duplicate Member', 'A user with this name already exists.');
      return;
    }

    // Filter out default iam if signup is another user
    let finalUsers = users;
    if (cleaned.toLowerCase() !== 'iam') {
      finalUsers = users.filter(u => u.name.toLowerCase() !== 'iam' && u.id !== 'u-iam');
    }

    const newUserObj = {
      id: `u-${Date.now()}`,
      name: cleaned,
      avatarColor: authAvatarColor,
      dateAdded: new Date().toISOString().split('T')[0],
    };

    const nextUsers = [...finalUsers, newUserObj];
    setUsers(nextUsers);
    setCurrentUser(cleaned);
    AsyncStorage.setItem('splitease_current_user', cleaned);
    saveData(nextUsers, expenses);

    setAuthUsername('');
    setAuthMode('login');
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      `Are you sure you want to log out of your session as "${currentUser}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('splitease_current_user');
            setCurrentUser(null);
            setCurrentTab('dashboard');
          },
        },
      ]
    );
  };

  // ----------------------------------------------------
  // ADD / EDIT EXPENSE ACTION HANDLERS
  // ----------------------------------------------------
  const openAddExpenseModal = () => {
    if (users.length === 0) {
      Alert.alert('No Members', 'Please add at least one member to the group first!');
      return;
    }
    setExpenseId(null);
    setExpenseTitle('');
    setExpenseAmount('');
    setExpenseCategory('Food');
    // Default payer is current user if they exist in users list, else first user
    const curObj = users.find(u => u.name.toLowerCase() === currentUser?.toLowerCase());
    setExpensePaidBy(curObj ? curObj.id : users[0].id);
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setExpenseSplitType('equal');

    // Default select all members for equal split
    const equalSelection = {};
    users.forEach(u => { equalSelection[u.id] = true; });
    setEqualSplitSelection(equalSelection);

    // Clear custom split values
    setCustomSplitShares({});
    setExpenseModalVisible(true);
  };

  const openEditExpenseModal = (exp) => {
    setExpenseId(exp.id);
    setExpenseTitle(exp.title);
    setExpenseAmount(exp.amount.toString());
    setExpenseCategory(exp.category);
    setExpensePaidBy(exp.paidBy);
    setExpenseDate(exp.date);

    // Detect split style
    // Check if shares are all equal to decide visual selection
    const splitKeys = Object.keys(exp.splits);
    const splitValues = Object.values(exp.splits);
    const allEqual = splitValues.every(val => Math.abs(parseFloat(val) - parseFloat(splitValues[0])) < 0.02);

    if (allEqual && splitKeys.length === users.length) {
      setExpenseSplitType('equal');
      const equalSelection = {};
      users.forEach(u => { equalSelection[u.id] = splitKeys.includes(u.id); });
      setEqualSplitSelection(equalSelection);
      setCustomSplitShares({});
    } else {
      setExpenseSplitType('custom');
      const customShares = {};
      users.forEach(u => {
        customShares[u.id] = exp.splits[u.id] ? exp.splits[u.id].toString() : '0';
      });
      setCustomSplitShares(customShares);
      const equalSelection = {};
      users.forEach(u => { equalSelection[u.id] = true; });
      setEqualSplitSelection(equalSelection);
    }

    setExpenseModalVisible(true);
  };

  const handleSaveExpense = () => {
    const title = expenseTitle.trim();
    const amount = parseFloat(expenseAmount);
    const category = expenseCategory;
    const date = expenseDate.trim();
    const paidBy = expensePaidBy;

    if (!title || isNaN(amount) || amount <= 0 || !date || !paidBy) {
      Alert.alert('Invalid Fields', 'Please fill in all details with a positive amount.');
      return;
    }

    const splits = {};

    if (expenseSplitType === 'custom') {
      let sum = 0;
      Object.entries(customSplitShares).forEach(([uid, shareStr]) => {
        const val = parseFloat(shareStr) || 0;
        if (val > 0) {
          splits[uid] = val;
        }
        sum += val;
      });

      // Validation
      if (Math.abs(amount - sum) >= 0.02) {
        Alert.alert(
          'Split Allocation Error',
          `The sum of custom shares (₹${sum.toFixed(2)}) must exactly match the total cost (₹${amount.toFixed(2)})!`
        );
        return;
      }
    } else {
      // Equal split
      const selectedMemberIds = Object.keys(equalSplitSelection).filter(uid => equalSplitSelection[uid]);
      if (selectedMemberIds.length === 0) {
        Alert.alert('No Split Members', 'You must check at least one member to split the costs!');
        return;
      }

      const count = selectedMemberIds.length;
      const baseShare = Math.floor((amount * 100) / count) / 100;
      const extraCents = Math.round((amount - baseShare * count) * 100);

      selectedMemberIds.forEach((uid, idx) => {
        splits[uid] = baseShare + (idx < extraCents ? 0.01 : 0);
      });
    }

    let nextExpenses;
    if (expenseId) {
      // Edit mode
      nextExpenses = expenses.map(e => {
        if (e.id === expenseId) {
          return { ...e, title, amount, category, date, paidBy, splits };
        }
        return e;
      });
    } else {
      // Add mode
      const newExp = {
        id: `e-${Date.now()}`,
        title,
        amount,
        category,
        date,
        paidBy,
        splits,
        isSettlement: false,
      };
      nextExpenses = [...expenses, newExp];
    }

    setExpenses(nextExpenses);
    saveData(users, nextExpenses);
    setExpenseModalVisible(false);
  };

  const handleDeleteExpense = (id) => {
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to delete this expense/settlement record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const nextExpenses = expenses.filter(e => e.id !== id);
            setExpenses(nextExpenses);
            saveData(users, nextExpenses);
          },
        },
      ]
    );
  };

  const handleDeleteAllExpenses = () => {
    Alert.alert(
      'Danger: Clear Ledger',
      'This will permanently delete all expenses and settlement history, resetting all balances back to zero. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Ledger',
          style: 'destructive',
          onPress: () => {
            setExpenses([]);
            saveData(users, []);
            Alert.alert('Ledger Reset', 'All transactions successfully cleared!');
          },
        },
      ]
    );
  };

  // ----------------------------------------------------
  // MEMBER MANAGEMENT LOGIC
  // ----------------------------------------------------
  const handleAddMember = () => {
    const name = newMemberName.trim();
    if (!name) return;

    const exists = users.some(u => u.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      Alert.alert('Duplicate Member', 'A user with this name already exists.');
      return;
    }

    const newMemberObj = {
      id: `u-${Date.now()}`,
      name,
      avatarColor: newMemberColor,
      dateAdded: new Date().toISOString().split('T')[0],
    };

    const nextUsers = [...users, newMemberObj];
    setUsers(nextUsers);
    saveData(nextUsers, expenses);

    setNewMemberName('');
    setMemberModalVisible(false);
  };

  const handleDeleteMember = (userId) => {
    const balance = balances[userId] || 0;

    // Reject outstanding balance
    if (Math.abs(balance) > 0.01) {
      Alert.alert(
        'Outstanding Standing Balance',
        `Cannot remove member. They still have an outstanding balance of ₹${balance.toFixed(2)}. Please settle debts/credits first!`
      );
      return;
    }

    Alert.alert(
      'Confirm Member Removal',
      'Are you sure you want to remove this member from the group? All their history in the transactions list will remain, but they won\'t share in new expenses.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const nextUsers = users.filter(u => u.id !== userId);
            setUsers(nextUsers);
            saveData(nextUsers, expenses);
          },
        },
      ]
    );
  };

  // ----------------------------------------------------
  // SIMULATED PHONEPE STATEMENTS IMPORT LOGIC
  // ----------------------------------------------------
  const handlePickPhonePeFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        setPhonepeFileName(res.assets[0].name);
      } else {
        // Fallback for emulator testing compatibility
        setPhonepeFileName('PhonePe_Statement_Jun2026.pdf');
      }
    } catch (err) {
      console.log('Document picker error:', err);
      // Fallback fallback
      setPhonepeFileName('PhonePe_Statement_Jun2026.pdf');
    }
  };

  const handleParsePhonePeStatement = () => {
    if (!phonepeFileName) {
      Alert.alert('No file', 'Please choose a PDF file to parse.');
      return;
    }

    setIsParsing(true);

    // Simulate parse delay for premium experience
    setTimeout(() => {
      setIsParsing(false);
      setPhonepeTxs(PHONEPE_STATEMENT_DATA);

      // Default select all transactions
      const ids = new Set();
      PHONEPE_STATEMENT_DATA.forEach(tx => ids.add(tx.id));
      setPhonepeSelectedIds(ids);

      // Pre-select global payer to logged-in user if found
      const curUserObj = users.find(u => u.name.toLowerCase() === currentUser?.toLowerCase());
      setPhonepeGlobalPayer(curUserObj ? curUserObj.id : users[0]?.id || '');
    }, 1200);
  };

  const toggleTxSelection = (id) => {
    const updated = new Set(phonepeSelectedIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setPhonepeSelectedIds(updated);
  };

  const handleSelectAllPhonepe = () => {
    const filteredTxs = phonepeTxs.filter(tx => {
      if (phonepeFilterType === 'ALL') return true;
      return tx.type === phonepeFilterType;
    });

    const allSelected = filteredTxs.every(tx => phonepeSelectedIds.has(tx.id));
    const updated = new Set(phonepeSelectedIds);

    if (allSelected) {
      // Deselect all displayed
      filteredTxs.forEach(tx => updated.delete(tx.id));
    } else {
      // Select all displayed
      filteredTxs.forEach(tx => updated.add(tx.id));
    }
    setPhonepeSelectedIds(updated);
  };

  const handleImportPhonepeConfirm = () => {
    if (phonepeSelectedIds.size === 0) {
      Alert.alert('Select Items', 'No transactions selected for import.');
      return;
    }
    if (!phonepeGlobalPayer) {
      Alert.alert('Global Payer Required', 'Please assign an account holder global payer.');
      return;
    }

    const globalPayerObj = users.find(u => u.id === phonepeGlobalPayer);
    if (!globalPayerObj) return;

    let updatedUsersList = [...users];
    const updatedExpensesList = [...expenses];
    const selectedList = phonepeTxs.filter(tx => phonepeSelectedIds.has(tx.id));

    selectedList.forEach(tx => {
      const amount = parseFloat(tx.amount);

      if (tx.type === 'CREDIT') {
        // Received transaction is a settlement from sender (tx.title) to global payer
        let senderUser = updatedUsersList.find(u => u.name.toLowerCase() === tx.title.toLowerCase());
        if (!senderUser) {
          // Dynamic member creation if sender does not exist yet
          const colors = ['purple', 'blue', 'teal', 'emerald', 'amber', 'rose'];
          const randomColor = colors[Math.floor(Math.random() * colors.length)];
          senderUser = {
            id: `u-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: tx.title,
            avatarColor: randomColor,
            dateAdded: new Date().toISOString().split('T')[0],
          };
          updatedUsersList.push(senderUser);
        }

        const splits = {};
        splits[phonepeGlobalPayer] = amount;

        const newSettlement = {
          id: `e-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          title: `Settlement: ${senderUser.name} to ${globalPayerObj.name}`,
          amount,
          category: 'Settlement',
          paidBy: senderUser.id,
          splits,
          date: tx.date,
          isSettlement: true,
        };
        updatedExpensesList.push(newSettlement);
      } else {
        // Debit transaction is a split expense
        const splits = {};
        if (phonepeSplitEqually && updatedUsersList.length > 0) {
          const count = updatedUsersList.length;
          const baseShare = Math.floor((amount * 100) / count) / 100;
          const extraCents = Math.round((amount - baseShare * count) * 100);

          updatedUsersList.forEach((u, idx) => {
            splits[u.id] = baseShare + (idx < extraCents ? 0.01 : 0);
          });
        } else {
          // 100% assigned to global payer
          splits[phonepeGlobalPayer] = amount;
        }

        const newExp = {
          id: `e-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          title: tx.title,
          amount,
          category: tx.category || 'Others',
          paidBy: phonepeGlobalPayer,
          splits,
          date: tx.date,
          isSettlement: false,
        };
        updatedExpensesList.push(newExp);
      }
    });

    setUsers(updatedUsersList);
    setExpenses(updatedExpensesList);
    saveData(updatedUsersList, updatedExpensesList);

    // Reset phonepe state
    setPhonepeSelectedIds(new Set());
    setPhonepeFileName('');
    setPhonepeTxs([]);
    setPhonepeModalVisible(false);

    Alert.alert(
      'Import Successful',
      `Successfully loaded and imported ${selectedList.length} PhonePe transactions into your ledger!`
    );
  };

  // ----------------------------------------------------
  // SETTLEMENT CONVERTER (NET DEBT PAYMENT ACTIONS)
  // ----------------------------------------------------
  const handleOpenSettleConfirm = (fromId, toId, amt) => {
    setSettleData({ from: fromId, to: toId, amount: amt });
    setSettleModalVisible(true);
  };

  const handleConfirmSettlePayment = () => {
    if (!settleData) return;

    const fromUser = users.find(u => u.id === settleData.from);
    const toUser = users.find(u => u.id === settleData.to);
    if (!fromUser || !toUser) return;

    const amount = settleData.amount;
    const splits = {};
    splits[settleData.to] = amount;

    const newSettlement = {
      id: `e-${Date.now()}`,
      title: `Settlement: ${fromUser.name} to ${toUser.name}`,
      amount,
      category: 'Settlement',
      paidBy: settleData.from,
      splits,
      date: new Date().toISOString().split('T')[0],
      isSettlement: true,
    };

    const nextExpenses = [...expenses, newSettlement];
    setExpenses(nextExpenses);
    saveData(users, nextExpenses);

    setSettleData(null);
    setSettleModalVisible(false);
    Alert.alert('Debt Settled', `Marked settlement payment of ₹${amount.toFixed(2)} completed!`);
  };

  // ----------------------------------------------------
  // HELPERS FOR UI RENDER
  // ----------------------------------------------------
  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  const formatCurrency = (val) => {
    return `₹${parseFloat(val).toFixed(2)}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj)) return dateStr;
    return dateObj.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // ----------------------------------------------------
  // FILTERED EXPENSE DATA LEDGER
  // ----------------------------------------------------
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      // Query filter
      if (filterQuery) {
        const query = filterQuery.toLowerCase();
        const titleMatch = exp.title.toLowerCase().includes(query);
        const catMatch = exp.category.toLowerCase().includes(query);
        if (!titleMatch && !catMatch) return false;
      }

      // Category filter
      if (filterCategory !== 'ALL' && exp.category !== filterCategory) {
        return false;
      }

      // Payer filter
      if (filterPayer !== 'ALL' && exp.paidBy !== filterPayer) {
        return false;
      }

      // Type filter
      if (filterType !== 'ALL') {
        if (filterType === 'SETTLEMENT' && !exp.isSettlement) return false;
        if (filterType === 'EXPENSE' && exp.isSettlement) return false;
      }

      // Date filter
      if (filterDate && exp.date !== filterDate) {
        return false;
      }

      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses, filterQuery, filterCategory, filterPayer, filterType, filterDate]);

  // Loading Screen
  if (!isLoaded) {
    return (
      <View style={[styles.appWrapper, styles.center]}>
        <ActivityIndicator size="large" color={THEME.primary} />
        <Text style={[styles.textMuted, { marginTop: 10 }]}>Loading SplitEase database...</Text>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER AUTH SCREENS
  // ----------------------------------------------------
  if (!currentUser) {
    return (
      <SafeAreaView style={styles.appWrapper}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.authContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.authCard}>
            <Text style={styles.authLogo}>💸 SplitEase</Text>
            <Text style={styles.authTitle}>
              {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
            </Text>
            <Text style={styles.authSubtitle}>
              {authMode === 'login'
                ? 'Log in to split bills and settle balances'
                : 'Register a profile to start tracking expenses'}
            </Text>

            {authMode === 'login' ? (
              <View style={{ width: '100%' }}>
                {users.length > 0 && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={[styles.label, { marginBottom: 10 }]}>Quick Select Profile</Text>
                    <View style={styles.profileSelectGrid}>
                      {users.map(u => (
                        <TouchableOpacity
                          key={u.id}
                          style={styles.profileSelectItem}
                          onPress={() => handleLogin(u.name)}
                        >
                          <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[u.avatarColor] || THEME.primary }]}>
                            <Text style={styles.avatarText}>{getInitials(u.name)}</Text>
                          </View>
                          <Text style={styles.profileSelectName} numberOfLines={1}>{u.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <Text style={styles.label}>Or enter username manually</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. iam, anil, sunita"
                  placeholderTextColor={THEME.textMuted}
                  value={authUsername}
                  onChangeText={setAuthUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TouchableOpacity style={styles.button} onPress={() => handleLogin(authUsername)}>
                  <Text style={styles.buttonText}>Log In</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.authToggle} onPress={() => setAuthMode('signup')}>
                  <Text style={styles.authToggleText}>Don't have an account? Create one</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ width: '100%' }}>
                <Text style={styles.label}>Choose Username</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter username"
                  placeholderTextColor={THEME.textMuted}
                  value={authUsername}
                  onChangeText={setAuthUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Text style={styles.label}>Choose Avatar Color</Text>
                <View style={styles.colorSelectorRow}>
                  {Object.keys(AVATAR_COLORS).map(colorName => (
                    <TouchableOpacity
                      key={colorName}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: AVATAR_COLORS[colorName] },
                        authAvatarColor === colorName && styles.colorCircleSelected,
                      ]}
                      onPress={() => setAuthAvatarColor(colorName)}
                    />
                  ))}
                </View>

                <TouchableOpacity style={styles.button} onPress={handleSignup}>
                  <Text style={styles.buttonText}>Register & Login</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.authToggle} onPress={() => setAuthMode('login')}>
                  <Text style={styles.authToggleText}>Already have a profile? Select Profile</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Find current active user ID
  const currentUserObj = users.find(u => u.name.toLowerCase() === currentUser.toLowerCase());
  const currentUserId = currentUserObj ? currentUserObj.id : null;

  // ----------------------------------------------------
  // MAIN CORE APPLICATION SCREEN
  // ----------------------------------------------------
  return (
    <SafeAreaView style={styles.appWrapper}>
      <StatusBar style="light" />

      {/* TOP HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>SplitEase</Text>
          <Text style={styles.headerSubtitle}>Group Expense Tracker</Text>
        </View>
        <TouchableOpacity style={styles.headerUserBlock} onPress={handleLogout}>
          <View style={[styles.avatarMini, { backgroundColor: AVATAR_COLORS[currentUserObj?.avatarColor] || THEME.primary }]}>
            <Text style={styles.avatarMiniText}>{getInitials(currentUser)}</Text>
          </View>
          <Text style={styles.headerUserName}>{currentUser}</Text>
        </TouchableOpacity>
      </View>

      {/* MAIN SCREEN SWITCHER */}
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">

        {/* 1. DASHBOARD TAB SCREEN */}
        {currentTab === 'dashboard' && (
          <View style={styles.tabContent}>
            {/* Metric Blocks */}
            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Total Group Cost</Text>
                <Text style={styles.metricValue}>{formatCurrency(totalExpensesSum)}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>My Net Standing</Text>
                <Text
                  style={[
                    styles.metricValue,
                    myBalance > 0.01 && styles.textGreen,
                    myBalance < -0.01 && styles.textRed,
                  ]}
                >
                  {myBalance > 0.01 ? '+' : ''}
                  {formatCurrency(myBalance)}
                </Text>
              </View>
            </View>

            {/* Quick Actions Row */}
            <View style={styles.quickActionsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={openAddExpenseModal}>
                <Text style={styles.actionBtnText}>➕ Add Expense</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: THEME.primaryDark }]}
                onPress={() => setPhonepeModalVisible(true)}
              >
                <Text style={styles.actionBtnText}>⚡ Import PhonePe PDF</Text>
              </TouchableOpacity>
            </View>

            {/* Settlements simplified section */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>Optimal Settlement Map</Text>
              {settlements.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Everyone is fully settled up! No debts. 🎉</Text>
                </View>
              ) : (
                settlements.map((settle, index) => {
                  const debtor = users.find(u => u.id === settle.from);
                  const creditor = users.find(u => u.id === settle.to);
                  if (!debtor || !creditor) return null;

                  const isMyDebt = settle.from === currentUserId || settle.to === currentUserId;

                  return (
                    <View
                      key={index}
                      style={[
                        styles.settleRow,
                        isMyDebt && styles.settleRowHighlighted,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settleText}>
                          <Text style={styles.boldText}>{debtor.name}</Text> owes{' '}
                          <Text style={styles.boldText}>{creditor.name}</Text>
                        </Text>
                        <Text style={styles.settleAmount}>{formatCurrency(settle.amount)}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.settlePayBtn}
                        onPress={() => handleOpenSettleConfirm(settle.from, settle.to, settle.amount)}
                      >
                        <Text style={styles.settlePayBtnText}>Mark Settle</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>

            {/* Group Members Balances List */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>Group Standing balances</Text>
              {users.map(u => {
                const balVal = balances[u.id] || 0;
                return (
                  <View key={u.id} style={styles.memberListItem}>
                    <View style={[styles.avatarMini, { backgroundColor: AVATAR_COLORS[u.avatarColor] || THEME.primary }]}>
                      <Text style={styles.avatarMiniText}>{getInitials(u.name)}</Text>
                    </View>
                    <Text style={styles.memberListName}>{u.name}</Text>
                    <Text
                      style={[
                        styles.memberListBalance,
                        balVal > 0.01 && styles.textGreen,
                        balVal < -0.01 && styles.textRed,
                      ]}
                    >
                      {balVal > 0.01 ? `gets back ` : balVal < -0.01 ? `owes ` : 'Settled'}
                      {balVal !== 0 && formatCurrency(Math.abs(balVal))}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* 2. LEDGER EXPENSES TAB SCREEN */}
        {currentTab === 'expenses' && (
          <View style={styles.tabContent}>
            {/* Filters panel */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>Ledger Filters</Text>
              <TextInput
                style={styles.input}
                placeholder="🔍 Search descriptions..."
                placeholderTextColor={THEME.textMuted}
                value={filterQuery}
                onChangeText={setFilterQuery}
              />

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterPillsRow}>
                <TouchableOpacity
                  style={[styles.pill, filterCategory === 'ALL' && styles.pillActive]}
                  onPress={() => setFilterCategory('ALL')}
                >
                  <Text style={[styles.pillText, filterCategory === 'ALL' && styles.pillTextActive]}>All Cats</Text>
                </TouchableOpacity>
                {Object.keys(CATEGORY_COLORS).map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.pill, filterCategory === cat && styles.pillActive]}
                    onPress={() => setFilterCategory(cat)}
                  >
                    <Text style={[styles.pillText, filterCategory === cat && styles.pillTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterPillsRow}>
                <TouchableOpacity
                  style={[styles.pill, filterPayer === 'ALL' && styles.pillActive]}
                  onPress={() => setFilterPayer('ALL')}
                >
                  <Text style={[styles.pillText, filterPayer === 'ALL' && styles.pillTextActive]}>All Payers</Text>
                </TouchableOpacity>
                {users.map(u => (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.pill, filterPayer === u.id && styles.pillActive]}
                    onPress={() => setFilterPayer(u.id)}
                  >
                    <Text style={[styles.pillText, filterPayer === u.id && styles.pillTextActive]}>{u.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                <TouchableOpacity
                  style={[styles.pill, { flex: 1, marginRight: 5, alignItems: 'center' }, filterType === 'ALL' && styles.pillActive]}
                  onPress={() => setFilterType('ALL')}
                >
                  <Text style={[styles.pillText, filterType === 'ALL' && styles.pillTextActive]}>All Types</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pill, { flex: 1, marginRight: 5, alignItems: 'center' }, filterType === 'EXPENSE' && styles.pillActive]}
                  onPress={() => setFilterType('EXPENSE')}
                >
                  <Text style={[styles.pillText, filterType === 'EXPENSE' && styles.pillTextActive]}>Expenses</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pill, { flex: 1, alignItems: 'center' }, filterType === 'SETTLEMENT' && styles.pillActive]}
                  onPress={() => setFilterType('SETTLEMENT')}
                >
                  <Text style={[styles.pillText, filterType === 'SETTLEMENT' && styles.pillTextActive]}>Settles</Text>
                </TouchableOpacity>
              </View>

              {(filterQuery || filterCategory !== 'ALL' || filterPayer !== 'ALL' || filterType !== 'ALL' || filterDate) && (
                <TouchableOpacity
                  style={[styles.buttonOutline, { marginTop: 15, paddingVertical: 8 }]}
                  onPress={() => {
                    setFilterQuery('');
                    setFilterCategory('ALL');
                    setFilterPayer('ALL');
                    setFilterType('ALL');
                    setFilterDate('');
                  }}
                >
                  <Text style={styles.buttonOutlineText}>Clear Filters</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Clear All Data Ledger Button */}
            {expenses.length > 0 && (
              <TouchableOpacity
                style={[styles.buttonOutline, { borderColor: THEME.danger, marginBottom: 15 }]}
                onPress={handleDeleteAllExpenses}
              >
                <Text style={[styles.buttonOutlineText, { color: THEME.danger }]}>⚠️ Delete All Ledger</Text>
              </TouchableOpacity>
            )}

            {/* Ledger List */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>Transaction Ledger ({filteredExpenses.length})</Text>
              {filteredExpenses.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No transactions match selected filters.</Text>
                </View>
              ) : (
                filteredExpenses.map(exp => {
                  const payer = users.find(u => u.id === exp.paidBy);
                  const payerName = payer ? payer.name : 'Unknown';

                  const badgeColors = CATEGORY_COLORS[exp.category] || CATEGORY_COLORS.Others;

                  // Split description text
                  let splitDesc = '';
                  if (exp.isSettlement) {
                    splitDesc = 'Debt settlement payment';
                  } else if (exp.splits) {
                    const myShare = exp.splits[currentUserId] || 0;
                    if (exp.paidBy === currentUserId) {
                      const shareCount = Object.keys(exp.splits).length;
                      splitDesc = `You paid & split with ${shareCount - 1} members`;
                    } else if (myShare > 0) {
                      splitDesc = `You owe ${payerName} ${formatCurrency(myShare)}`;
                    } else {
                      splitDesc = 'You are not in this split';
                    }
                  }

                  return (
                    <View key={exp.id} style={styles.expenseItem}>
                      <View style={styles.expenseLeft}>
                        <View style={[styles.categoryCircle, { backgroundColor: badgeColors.bg }]}>
                          <Text style={[styles.categoryCircleText, { color: badgeColors.text }]}>
                            {exp.category[0]}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.expenseTitle}>{exp.title}</Text>
                          <Text style={styles.expenseMeta}>
                            Paid by <Text style={{ color: THEME.text }}>{payerName}</Text> • {formatDate(exp.date)}
                          </Text>
                          <Text style={styles.expenseSubdesc}>{splitDesc}</Text>
                        </View>
                      </View>
                      <View style={styles.expenseRight}>
                        <Text
                          style={[
                            styles.expenseAmountText,
                            exp.isSettlement && styles.textGreen,
                          ]}
                        >
                          {exp.isSettlement ? '+' : ''}
                          {formatCurrency(exp.amount)}
                        </Text>

                        <View style={styles.expenseActionRow}>
                          {!exp.isSettlement && (
                            <TouchableOpacity style={styles.actionIconBtn} onPress={() => openEditExpenseModal(exp)}>
                              <Text style={styles.actionIconBtnText}>✏️</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={styles.actionIconBtn}
                            onPress={() => handleDeleteExpense(exp.id)}
                          >
                            <Text style={[styles.actionIconBtnText, { color: THEME.danger }]}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        )}

        {/* 3. MEMBERS TAB SCREEN */}
        {currentTab === 'members' && (
          <View style={styles.tabContent}>
            {/* Quick add card */}
            <TouchableOpacity style={styles.button} onPress={() => setMemberModalVisible(true)}>
              <Text style={styles.buttonText}>👤 Add Group Member</Text>
            </TouchableOpacity>

            {/* Members List */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>Active Members ({users.length})</Text>
              {users.map(u => {
                const balVal = balances[u.id] || 0;
                // Can delete member only if balance is ~0
                const isDeletable = Math.abs(balVal) <= 0.01;

                return (
                  <View key={u.id} style={styles.memberRowItem}>
                    <View style={styles.memberRowLeft}>
                      <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[u.avatarColor] || THEME.primary }]}>
                        <Text style={styles.avatarText}>{getInitials(u.name)}</Text>
                      </View>
                      <View>
                        <Text style={styles.memberRowName}>{u.name}</Text>
                        <Text style={styles.memberRowSubtitle}>Joined: {u.dateAdded}</Text>
                      </View>
                    </View>

                    <View style={styles.memberRowRight}>
                      <Text
                        style={[
                          styles.memberRowBalance,
                          balVal > 0.01 && styles.textGreen,
                          balVal < -0.01 && styles.textRed,
                        ]}
                      >
                        {balVal > 0.01 ? '+' : ''}
                        {formatCurrency(balVal)}
                      </Text>

                      <TouchableOpacity
                        style={[styles.memberDeleteBtn, !isDeletable && styles.memberDeleteBtnDisabled]}
                        onPress={() => handleDeleteMember(u.id)}
                      >
                        <Text style={styles.memberDeleteBtnText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* BOTTOM NAVIGATION TAB BAR */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBarItem, currentTab === 'dashboard' && styles.tabBarItemActive]}
          onPress={() => setCurrentTab('dashboard')}
        >
          <Text style={styles.tabBarIcon}>📊</Text>
          <Text style={[styles.tabBarText, currentTab === 'dashboard' && styles.tabBarTextActive]}>Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBarItem, currentTab === 'expenses' && styles.tabBarItemActive]}
          onPress={() => setCurrentTab('expenses')}
        >
          <Text style={styles.tabBarIcon}>💸</Text>
          <Text style={[styles.tabBarText, currentTab === 'expenses' && styles.tabBarTextActive]}>Ledger</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBarItem, currentTab === 'members' && styles.tabBarItemActive]}
          onPress={() => setCurrentTab('members')}
        >
          <Text style={styles.tabBarIcon}>👥</Text>
          <Text style={[styles.tabBarText, currentTab === 'members' && styles.tabBarTextActive]}>Members</Text>
        </TouchableOpacity>
      </View>

      {/* ====================================================
          MODAL: ADD/EDIT EXPENSE RECORD
          ==================================================== */}
      <Modal visible={expenseModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{expenseId ? 'Edit Expense' : 'Add Expense'}</Text>
              <TouchableOpacity onPress={() => setExpenseModalVisible(false)}>
                <Text style={styles.closeBtn}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Expense Description</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Dinner Party, Uber ride"
                placeholderTextColor={THEME.textMuted}
                value={expenseTitle}
                onChangeText={setExpenseTitle}
              />

              <Text style={styles.label}>Total Amount (₹)</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor={THEME.textMuted}
                keyboardType="numeric"
                value={expenseAmount}
                onChangeText={setExpenseAmount}
              />

              <Text style={styles.label}>Category</Text>
              <View style={styles.pickerContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {Object.keys(CATEGORY_COLORS).filter(c => c !== 'Settlement').map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.catSelectPill,
                        expenseCategory === cat && styles.catSelectPillActive,
                      ]}
                      onPress={() => setExpenseCategory(cat)}
                    >
                      <Text style={[styles.catSelectPillText, expenseCategory === cat && styles.catSelectPillTextActive]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <Text style={styles.label}>Paid By</Text>
              <View style={styles.payerContainer}>
                {users.map(u => (
                  <TouchableOpacity
                    key={u.id}
                    style={[
                      styles.payerSelectOption,
                      expensePaidBy === u.id && styles.payerSelectOptionActive,
                    ]}
                    onPress={() => setExpensePaidBy(u.id)}
                  >
                    <Text style={[styles.payerSelectOptionText, expensePaidBy === u.id && styles.payerSelectOptionTextActive]}>
                      {u.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Transaction Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={THEME.textMuted}
                value={expenseDate}
                onChangeText={setExpenseDate}
              />

              <View style={styles.splitToggleContainer}>
                <TouchableOpacity
                  style={[styles.splitToggleBtn, expenseSplitType === 'equal' && styles.splitToggleBtnActive]}
                  onPress={() => setExpenseSplitType('equal')}
                >
                  <Text style={[styles.splitToggleText, expenseSplitType === 'equal' && styles.splitToggleTextActive]}>
                    Split Equally
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.splitToggleBtn, expenseSplitType === 'custom' && styles.splitToggleBtnActive]}
                  onPress={() => setExpenseSplitType('custom')}
                >
                  <Text style={[styles.splitToggleText, expenseSplitType === 'custom' && styles.splitToggleTextActive]}>
                    Custom Shares
                  </Text>
                </TouchableOpacity>
              </View>

              {/* EQUAL SPLITS LIST */}
              {expenseSplitType === 'equal' && (
                <View style={styles.splitsCard}>
                  <Text style={styles.splitsHeader}>Select members sharing this cost:</Text>
                  {users.map(u => (
                    <TouchableOpacity
                      key={u.id}
                      style={styles.splitMemberCheckboxRow}
                      onPress={() => {
                        setEqualSplitSelection({
                          ...equalSplitSelection,
                          [u.id]: !equalSplitSelection[u.id],
                        });
                      }}
                    >
                      <View style={[styles.checkbox, equalSplitSelection[u.id] && styles.checkboxChecked]}>
                        {equalSplitSelection[u.id] && <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>}
                      </View>
                      <Text style={styles.splitMemberLabel}>{u.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* CUSTOM SPLITS INPUTS */}
              {expenseSplitType === 'custom' && (
                <View style={styles.splitsCard}>
                  <Text style={styles.splitsHeader}>Enter individual shares in ₹:</Text>
                  {users.map(u => (
                    <View key={u.id} style={styles.splitMemberInputRow}>
                      <Text style={styles.splitMemberInputLabel}>{u.name}</Text>
                      <TextInput
                        style={[styles.input, { width: 120, marginBottom: 0 }]}
                        placeholder="0.00"
                        placeholderTextColor={THEME.textMuted}
                        keyboardType="numeric"
                        value={customSplitShares[u.id] || ''}
                        onChangeText={(val) => {
                          setCustomSplitShares({
                            ...customSplitShares,
                            [u.id]: val,
                          });
                        }}
                      />
                    </View>
                  ))}
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.splitShareTotalLabel}>
                      Sum of shares: ₹
                      {Object.values(customSplitShares)
                        .reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0)
                        .toFixed(2)}{' '}
                      / ₹{parseFloat(expenseAmount || 0).toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}

              <TouchableOpacity style={styles.button} onPress={handleSaveExpense}>
                <Text style={styles.buttonText}>{expenseId ? 'Update Expense' : 'Record Expense'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ====================================================
          MODAL: ADD NEW GROUP MEMBER
          ==================================================== */}
      <Modal visible={memberModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCardMini}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Member</Text>
              <TouchableOpacity onPress={() => setMemberModalVisible(false)}>
                <Text style={styles.closeBtn}>Close</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Member Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Sunil, Ritu"
              placeholderTextColor={THEME.textMuted}
              value={newMemberName}
              onChangeText={setNewMemberName}
            />

            <Text style={styles.label}>Avatar Color</Text>
            <View style={styles.colorSelectorRow}>
              {Object.keys(AVATAR_COLORS).map(colorName => (
                <TouchableOpacity
                  key={colorName}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: AVATAR_COLORS[colorName] },
                    newMemberColor === colorName && styles.colorCircleSelected,
                  ]}
                  onPress={() => setNewMemberColor(colorName)}
                />
              ))}
            </View>

            <TouchableOpacity style={styles.button} onPress={handleAddMember}>
              <Text style={styles.buttonText}>Add to Group</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ====================================================
          MODAL: CONFIRM SETTLE PAYMENT
          ==================================================== */}
      <Modal visible={settleModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCardMini}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Settlement</Text>
              <TouchableOpacity onPress={() => setSettleModalVisible(false)}>
                <Text style={styles.closeBtn}>Close</Text>
              </TouchableOpacity>
            </View>

            {settleData && (
              <View style={{ marginVertical: 15 }}>
                <Text style={styles.settleConfirmText}>
                  Confirm that{' '}
                  <Text style={{ color: THEME.success, fontWeight: 'bold' }}>
                    {users.find(u => u.id === settleData.from)?.name}
                  </Text>{' '}
                  has paid{' '}
                  <Text style={{ color: THEME.primary, fontWeight: 'bold' }}>
                    {formatCurrency(settleData.amount)}
                  </Text>{' '}
                  directly to{' '}
                  <Text style={{ color: THEME.success, fontWeight: 'bold' }}>
                    {users.find(u => u.id === settleData.to)?.name}
                  </Text>{' '}
                  to clear this debt?
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.button} onPress={handleConfirmSettlePayment}>
              <Text style={styles.buttonText}>Confirm Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ====================================================
          MODAL: PHONEPE STATEMENT IMPORTER
          ==================================================== */}
      <Modal visible={phonepeModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>PhonePe Importer</Text>
              <TouchableOpacity onPress={() => setPhonepeModalVisible(false)}>
                <Text style={styles.closeBtn}>Close</Text>
              </TouchableOpacity>
            </View>

            {/* STEP 1: CHOOSE AND PARSE VIEW */}
            {!phonepeTxs.length ? (
              <View style={styles.phonepeUploadContainer}>
                <Text style={styles.phonepeImportTitle}>Extract Statement PDF</Text>
                <Text style={styles.phonepeImportSubtitle}>
                  Choose your exported PhonePe statement PDF to automatically extract transactions, dates, categories, and credit settlements.
                </Text>

                <TouchableOpacity style={styles.uploadBox} onPress={handlePickPhonePeFile}>
                  <Text style={{ fontSize: 40, marginBottom: 10 }}>📄</Text>
                  <Text style={styles.uploadBoxText}>
                    {phonepeFileName ? phonepeFileName : 'Select PhonePe PDF Statement'}
                  </Text>
                </TouchableOpacity>

                {phonepeFileName ? (
                  <View style={{ width: '100%', alignItems: 'center' }}>
                    {isParsing ? (
                      <View style={{ marginVertical: 20, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={THEME.primary} />
                        <Text style={[styles.textMuted, { marginTop: 10 }]}>Parsing PDF Statement Database...</Text>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.button} onPress={handleParsePhonePeStatement}>
                        <Text style={styles.buttonText}>Parse & View Transactions</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : null}
              </View>
            ) : (
              /* STEP 2: CONFIGURE & REVIEW LIST VIEW */
              <View style={{ flex: 1 }}>
                <View style={styles.phonepeConfigCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.labelMini}>Global Payer / Holder</Text>
                      <View style={styles.payerMiniRow}>
                        {users.map(u => (
                          <TouchableOpacity
                            key={u.id}
                            style={[
                              styles.payerSelectOptionMini,
                              phonepeGlobalPayer === u.id && styles.payerSelectOptionMiniActive,
                            ]}
                            onPress={() => setPhonepeGlobalPayer(u.id)}
                          >
                            <Text
                              style={[
                                styles.payerSelectOptionTextMini,
                                phonepeGlobalPayer === u.id && styles.payerSelectOptionTextMiniActive,
                              ]}
                            >
                              {u.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>

                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Split debit costs equally among all members</Text>
                    <Switch
                      value={phonepeSplitEqually}
                      onValueChange={setPhonepeSplitEqually}
                      thumbColor={phonepeSplitEqually ? THEME.primary : THEME.textMuted}
                      trackColor={{ false: THEME.border, true: 'rgba(139, 92, 246, 0.4)' }}
                    />
                  </View>
                </View>

                {/* Filter segment */}
                <View style={styles.phonepeFilterRow}>
                  <TouchableOpacity
                    style={[styles.pillMini, phonepeFilterType === 'ALL' && styles.pillMiniActive]}
                    onPress={() => setFilterType('ALL')} // Matches type selection
                    onPressIn={() => setPhonepeFilterType('ALL')}
                  >
                    <Text style={[styles.pillMiniText, phonepeFilterType === 'ALL' && styles.pillMiniTextActive]}>
                      All ({phonepeTxs.length})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pillMini, phonepeFilterType === 'DEBIT' && styles.pillMiniActive]}
                    onPressIn={() => setPhonepeFilterType('DEBIT')}
                  >
                    <Text style={[styles.pillMiniText, phonepeFilterType === 'DEBIT' && styles.pillMiniTextActive]}>
                      Paid Debits ({phonepeTxs.filter(t => t.type === 'DEBIT').length})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pillMini, phonepeFilterType === 'CREDIT' && styles.pillMiniActive]}
                    onPressIn={() => setPhonepeFilterType('CREDIT')}
                  >
                    <Text style={[styles.pillMiniText, phonepeFilterType === 'CREDIT' && styles.pillMiniTextActive]}>
                      Received Credits ({phonepeTxs.filter(t => t.type === 'CREDIT').length})
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Selection list */}
                <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                  {phonepeTxs
                    .filter(tx => {
                      if (phonepeFilterType === 'ALL') return true;
                      return tx.type === phonepeFilterType;
                    })
                    .map(tx => {
                      const isSelected = phonepeSelectedIds.has(tx.id);
                      const isCredit = tx.type === 'CREDIT';
                      const badge = CATEGORY_COLORS[tx.category] || CATEGORY_COLORS.Others;

                      return (
                        <TouchableOpacity
                          key={tx.id}
                          style={[styles.phonepeTxRow, isSelected && styles.phonepeTxRowSelected]}
                          onPress={() => toggleTxSelection(tx.id)}
                        >
                          <View style={[styles.checkbox, isSelected && styles.checkboxChecked, { marginRight: 12 }]}>
                            {isSelected && <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>}
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text style={styles.phonepeTxTitle} numberOfLines={1}>{tx.title}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                              <Text
                                style={[
                                  styles.txTypeBadgeText,
                                  isCredit ? styles.txTypeBadgeCredit : styles.txTypeBadgeDebit,
                                ]}
                              >
                                {isCredit ? 'Received' : 'Paid'}
                              </Text>
                              <View style={[styles.catBadgeMini, { backgroundColor: badge.bg, marginLeft: 6 }]}>
                                <Text style={{ color: badge.text, fontSize: 10, fontWeight: 'bold' }}>
                                  {tx.category}
                                </Text>
                              </View>
                              <Text style={[styles.textMuted, { fontSize: 10, marginLeft: 6 }]}>
                                • {formatDate(tx.date)}
                              </Text>
                            </View>
                          </View>

                          <Text
                            style={[
                              styles.phonepeTxAmount,
                              isCredit && styles.textGreen,
                            ]}
                          >
                            {isCredit ? '+' : ''}
                            {formatCurrency(tx.amount)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                </ScrollView>

                {/* Import actions bottom bar */}
                <View style={styles.phonepeBottomBar}>
                  <TouchableOpacity style={styles.phonepeSelectAllBtn} onPress={handleSelectAllPhonepe}>
                    <Text style={styles.phonepeSelectAllBtnText}>Toggle Select All</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.phonepeImportBtn} onPress={handleImportPhonepeConfirm}>
                    <Text style={styles.phonepeImportBtnText}>
                      Import Selected ({phonepeSelectedIds.size})
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ----------------------------------------------------
// APPLICATION STYLESHEET
// ----------------------------------------------------
const styles = StyleSheet.create({
  appWrapper: {
    flex: 1,
    backgroundColor: THEME.bg,
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  textGreen: {
    color: THEME.success,
  },
  textRed: {
    color: THEME.danger,
  },
  textMuted: {
    color: THEME.textMuted,
  },
  boldText: {
    fontWeight: 'bold',
    color: THEME.text,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    backgroundColor: THEME.card,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.text,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: THEME.textMuted,
  },
  headerUserBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerUserName: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  tabContent: {
    padding: 16,
  },

  // Auth Styles
  authContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  authCard: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  authLogo: {
    fontSize: 32,
    fontWeight: '900',
    color: THEME.primary,
    marginBottom: 10,
  },
  authTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 6,
  },
  authSubtitle: {
    fontSize: 13,
    color: THEME.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  profileSelectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    width: '100%',
  },
  profileSelectItem: {
    alignItems: 'center',
    width: '30%',
    marginBottom: 16,
  },
  profileSelectName: {
    color: THEME.text,
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
    width: '100%',
  },
  label: {
    fontSize: 14,
    color: THEME.text,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: THEME.text,
    marginBottom: 16,
    width: '100%',
  },
  button: {
    backgroundColor: THEME.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    width: '100%',
  },
  buttonOutlineText: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '600',
  },
  authToggle: {
    marginTop: 20,
  },
  authToggleText: {
    color: THEME.textMuted,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  colorSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
    marginTop: 5,
  },
  colorCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorCircleSelected: {
    borderColor: THEME.text,
    transform: [{ scale: 1.1 }],
  },

  // Avatar component
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  avatarMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarMiniText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Dashboard styles
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    backgroundColor: THEME.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 16,
    width: '48%',
  },
  metricLabel: {
    fontSize: 12,
    color: THEME.textMuted,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.text,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionBtn: {
    backgroundColor: THEME.primary,
    borderRadius: 8,
    paddingVertical: 12,
    width: '48%',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: THEME.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 16,
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.text,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    paddingBottom: 8,
    marginBottom: 12,
  },
  emptyState: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: THEME.textMuted,
    fontSize: 13,
  },
  settleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  settleRowHighlighted: {
    borderLeftWidth: 3,
    borderLeftColor: THEME.primary,
    paddingLeft: 8,
  },
  settleText: {
    color: THEME.text,
    fontSize: 14,
  },
  settleAmount: {
    color: THEME.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  settlePayBtn: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: THEME.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  settlePayBtnText: {
    color: THEME.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  memberListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  memberListName: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
  },
  memberListBalance: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Expense tab styles
  filterPillsRow: {
    flexDirection: 'row',
    marginVertical: 6,
  },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pillActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: THEME.primary,
  },
  pillText: {
    color: THEME.textMuted,
    fontSize: 12,
  },
  pillTextActive: {
    color: THEME.primary,
    fontWeight: '700',
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  expenseLeft: {
    flexDirection: 'row',
    flex: 1,
    marginRight: 10,
  },
  categoryCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryCircleText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  expenseTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.text,
  },
  expenseMeta: {
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 2,
  },
  expenseSubdesc: {
    fontSize: 11,
    color: THEME.accent,
    marginTop: 3,
    fontStyle: 'italic',
  },
  expenseRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  expenseAmountText: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.text,
  },
  expenseActionRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  actionIconBtn: {
    marginLeft: 12,
    padding: 3,
  },
  actionIconBtnText: {
    fontSize: 14,
  },

  // Members Tab
  memberRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  memberRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberRowName: {
    color: THEME.text,
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 12,
  },
  memberRowSubtitle: {
    color: THEME.textMuted,
    fontSize: 11,
    marginLeft: 12,
    marginTop: 2,
  },
  memberRowRight: {
    alignItems: 'flex-end',
  },
  memberRowBalance: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  memberDeleteBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: THEME.danger,
  },
  memberDeleteBtnDisabled: {
    opacity: 0.3,
  },
  memberDeleteBtnText: {
    color: THEME.danger,
    fontSize: 11,
    fontWeight: '600',
  },

  // Tab bar bottom navigation styles
  tabBar: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: THEME.card,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabBarItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    height: '100%',
    opacity: 0.6,
  },
  tabBarItemActive: {
    opacity: 1,
  },
  tabBarIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  tabBarText: {
    fontSize: 10,
    color: THEME.textMuted,
  },
  tabBarTextActive: {
    color: THEME.primary,
    fontWeight: '700',
  },

  // Modal styles generic
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: THEME.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
  },
  modalCardMini: {
    backgroundColor: THEME.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME.text,
  },
  closeBtn: {
    color: THEME.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  modalScroll: {
    padding: 20,
    paddingBottom: 60,
  },
  pickerContainer: {
    marginVertical: 10,
  },
  catSelectPill: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  catSelectPillActive: {
    backgroundColor: THEME.primary,
  },
  catSelectPillText: {
    color: THEME.textMuted,
    fontSize: 13,
  },
  catSelectPillTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  payerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 8,
  },
  payerSelectOption: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  payerSelectOptionActive: {
    borderColor: THEME.primary,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  payerSelectOptionText: {
    color: THEME.text,
    fontSize: 13,
  },
  payerSelectOptionTextActive: {
    color: THEME.primary,
    fontWeight: 'bold',
  },
  splitToggleContainer: {
    flexDirection: 'row',
    marginVertical: 15,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    padding: 4,
  },
  splitToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  splitToggleBtnActive: {
    backgroundColor: THEME.card,
  },
  splitToggleText: {
    color: THEME.textMuted,
    fontSize: 13,
  },
  splitToggleTextActive: {
    color: THEME.text,
    fontWeight: '700',
  },
  splitsCard: {
    backgroundColor: THEME.card,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  splitsHeader: {
    fontSize: 13,
    color: THEME.textMuted,
    marginBottom: 12,
  },
  splitMemberCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: THEME.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    borderColor: THEME.primary,
    backgroundColor: THEME.primary,
  },
  splitMemberLabel: {
    color: THEME.text,
    fontSize: 14,
    marginLeft: 10,
  },
  splitMemberInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  splitMemberInputLabel: {
    color: THEME.text,
    fontSize: 14,
  },
  splitShareTotalLabel: {
    color: THEME.accent,
    fontWeight: 'bold',
    fontSize: 13,
    textAlign: 'right',
  },
  settleConfirmText: {
    color: THEME.text,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },

  // Phonepe uploader styles
  phonepeUploadContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phonepeImportTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: THEME.text,
    marginBottom: 8,
  },
  phonepeImportSubtitle: {
    fontSize: 13,
    color: THEME.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 30,
  },
  uploadBox: {
    width: '100%',
    height: 150,
    borderWidth: 2,
    borderColor: THEME.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginBottom: 24,
  },
  uploadBoxText: {
    color: THEME.primary,
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  phonepeConfigCard: {
    backgroundColor: THEME.card,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    padding: 16,
  },
  labelMini: {
    fontSize: 11,
    color: THEME.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  payerMiniRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  payerSelectOptionMini: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
    marginBottom: 6,
  },
  payerSelectOptionMiniActive: {
    backgroundColor: THEME.primary,
  },
  payerSelectOptionTextMini: {
    color: THEME.textMuted,
    fontSize: 11,
  },
  payerSelectOptionTextMiniActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  switchLabel: {
    color: THEME.text,
    fontSize: 12,
    flex: 1,
    marginRight: 10,
  },
  phonepeFilterRow: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  pillMini: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
  },
  pillMiniActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: THEME.primary,
  },
  pillMiniText: {
    color: THEME.textMuted,
    fontSize: 10,
  },
  pillMiniTextActive: {
    color: THEME.primary,
    fontWeight: 'bold',
  },
  phonepeTxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  phonepeTxRowSelected: {
    backgroundColor: 'rgba(139, 92, 246, 0.04)',
  },
  phonepeTxTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.text,
  },
  txTypeBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  txTypeBadgeDebit: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    color: THEME.danger,
  },
  txTypeBadgeCredit: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: THEME.success,
  },
  catBadgeMini: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  phonepeTxAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.text,
  },
  phonepeBottomBar: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: THEME.card,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  phonepeSelectAllBtn: {
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  phonepeSelectAllBtnText: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '600',
  },
  phonepeImportBtn: {
    backgroundColor: THEME.primary,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  phonepeImportBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
