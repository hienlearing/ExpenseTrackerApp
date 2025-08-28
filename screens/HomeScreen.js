// ExpenseTrackerApp/screens/HomeScreen.js

import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Modal, Dimensions, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { collection, query, where, onSnapshot, orderBy, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore'; 
import { db, auth } from '../firebaseConfig'; 

// Import chart components
import { PieChart, BarChart } from 'react-native-chart-kit';
// Import DatePicker component for mobile platforms
import DateTimePicker from '@react-native-community/datetimepicker';

// Lấy chiều rộng cửa sổ để làm cho biểu đồ responsive
const screenWidth = Dimensions.get('window').width;

// Predefined categories for editing, including "Income" as it might be an existing transaction
const ALL_CATEGORIES = [
  "Food & Dining", "Transportation", "Shopping", "Utilities", "Housing", 
  "Entertainment", "Health", "Education", "Income", "Other"
];

// Helper function to parse amount string into a valid number (for US format)
const parseAmount = (amountString) => {
  if (typeof amountString !== 'string') {
    return 0;
  }
  let cleanedString = amountString;

  // Remove currency symbols ($, €, VND) and thousands separators (commas or periods before decimal)
  cleanedString = cleanedString.replace(/[^\d.,]/g, '');

  // Handle common European/Vietnamese format (1.234.567,89) -> US format (1234567.89)
  if (cleanedString.includes(',') && cleanedString.includes('.')) {
    // If comma is the decimal separator (e.g., 1.234,50), convert to 1234.50
    if (cleanedString.indexOf(',') > cleanedString.indexOf('.')) { // e.g., 1.234,50
      cleanedString = cleanedString.replace(/\./g, '').replace(',', '.');
    } else { // e.g., 1,234.50 (already US-like but comma as thousands)
      cleanedString = cleanedString.replace(/,/g, '');
    }
  } else if (cleanedString.includes(',')) { // Only comma (e.g., 1234,50)
    cleanedString = cleanedString.replace(',', '.');
  } else if (cleanedString.includes('.')) { // Only period (e.g., 1234.50) - assume US format
    // No change needed
  }

  const parsed = parseFloat(cleanedString);
  return isNaN(parsed) ? 0 : parsed;
};

// Helper function to format date to YYYY-MM-DD
const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  let month = '' + (d.getMonth() + 1);
  let day = '' + d.getDate();
  let year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
};

// Custom DatePicker Input Component
const DatePickerInput = ({ value, onChange, placeholder, style }) => {
  const [showPicker, setShowPicker] = useState(false);

  const handleDateChange = (event, selectedDate) => {
    // For iOS, picker remains open. For Android, it closes automatically.
    setShowPicker(Platform.OS === 'ios'); 
    if (selectedDate) {
      onChange(formatDate(selectedDate));
    }
  };

  const handleWebChange = (event) => {
    onChange(event.target.value);
  };

  if (Platform.OS === 'web') {
    return (
      <input
        type="date"
        value={value}
        onChange={handleWebChange}
        placeholder={placeholder}
        style={style} // Apply React Native styles directly to the web input
        className="web-datepicker-input" // Add a class for potential custom web styling
      />
    );
  }

  return (
    <View>
      <TouchableOpacity onPress={() => setShowPicker(true)} style={styles.dateInputTouchable}>
        <TextInput
          style={style}
          placeholder={placeholder}
          value={value}
          editable={false} // Make it not directly editable to force date picker usage
        />
      </TouchableOpacity>
      {showPicker && (
        <DateTimePicker
          testID="dateTimePicker"
          value={value ? new Date(value) : new Date()}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
    </View>
  );
};


const HomeScreen = () => {
  const navigation = useNavigation();
  const [allTransactions, setAllTransactions] = useState([]); // Stores all transactions for client-side filtering
  const [filteredTransactions, setFilteredTransactions] = useState([]); // Transactions after applying filters
  const [totalSpent, setTotalSpent] = useState(0); // Total of filtered expenses
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter States
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return formatDate(firstDayOfMonth);
  }); // YYYY-MM-DD, defaults to first day of month
  const [endDate, setEndDate] = useState(() => formatDate(new Date())); // YYYY-MM-DD, defaults to today
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // State for Edit/Delete Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  // States for editing transaction details
  const [editDate, setEditDate] = useState('');
  const [editSupplier, setEditSupplier] = useState('');
  const [editTotal, setEditTotal] = useState('');
  const [editCategory, setEditCategory] = useState('Other');
  const [editDescription, setEditDescription] = useState('');

  // States for Custom Confirmation/Success/Error Modals
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalMessage, setConfirmModalMessage] = useState('');
  const [onConfirmAction, setOnConfirmAction] = useState(() => () => {}); // Default no-op function
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');

  // Function to show custom confirmation modal
  const showConfirmation = (message, action) => {
    setConfirmModalMessage(message);
    setOnConfirmAction(() => action); // Use a functional update for state setter
    setShowConfirmModal(true);
  };

  // Function to hide custom confirmation modal
  const hideConfirmation = () => {
    setShowConfirmModal(false);
    setConfirmModalMessage('');
    setOnConfirmAction(() => () => {});
  };

  // Function to show custom success modal
  const showSuccessMessage = (message) => {
    setSuccessModalMessage(message);
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 2000); // Hide after 2 seconds
  };

  // Function to show custom error modal
  const showErrorMessage = (message) => {
    setErrorModalMessage(message);
    setShowErrorModal(true);
    // No auto-hide for error, user must close
  };

  const hideErrorMessage = () => {
    setErrorModalMessage('');
    setShowErrorError(false);
  };

  useEffect(() => {
    if (!auth.currentUser) {
      setError("User not logged in.");
      setIsLoading(false);
      return;
    }

    const userId = auth.currentUser.uid;
    const transactionsRef = collection(db, 'transactions');
    
    // Fetch all transactions for the user, ordered by date
    // No specific date range filter here as filtering will be client-side.
    const q = query(
      transactionsRef,
      where('userId', '==', userId),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const transactionsList = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const amount = parseAmount(data.totalAmount); 
        transactionsList.push({ id: doc.id, ...data, parsedAmount: amount });
      });
      setAllTransactions(transactionsList); // Store all transactions
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching transactions:", err);
      setError(`Failed to load transactions: ${err.message}`);
      setIsLoading(false);
    });

    return () => unsubscribe(); 
  }, [auth.currentUser]);

  // Apply filters whenever allTransactions or filter states change
  useEffect(() => {
    let tempFilteredTransactions = allTransactions;

    // 1. Filter by Date Range
    if (startDate) {
      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
      const startTimestamp = Timestamp.fromDate(startOfDay);
      tempFilteredTransactions = tempFilteredTransactions.filter(
        (t) => t.date && t.date.seconds >= startTimestamp.seconds
      );
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999); // Include end day
      const endTimestamp = Timestamp.fromDate(endOfDay); 
      tempFilteredTransactions = tempFilteredTransactions.filter(
        (t) => t.date && t.date.seconds <= endTimestamp.seconds
      );
    }

    // 2. Filter by Category
    if (selectedCategories.length > 0) {
      tempFilteredTransactions = tempFilteredTransactions.filter(
        (t) => t.category && selectedCategories.includes(t.category)
      );
    }

    // 3. Search Transaction (by supplier, description, category, or amount)
    if (searchQuery) {
      const lowerCaseSearchQuery = searchQuery.toLowerCase();
      tempFilteredTransactions = tempFilteredTransactions.filter((t) => {
        const supplierName = t.supplierName?.toLowerCase() || '';
        const category = t.category?.toLowerCase() || '';
        const description = (t.items && t.items.length > 0
          ? t.items.map(item => item.name).join(', ')
          : t.fullText || '').toLowerCase();
        const totalAmount = t.parsedAmount?.toString().toLowerCase() || '';

        return (
          supplierName.includes(lowerCaseSearchQuery) ||
          category.includes(lowerCaseSearchQuery) ||
          description.includes(lowerCaseSearchQuery) ||
          totalAmount.includes(lowerCaseSearchQuery)
        );
      });
    }

    // Calculate total expenses for filtered transactions
    let currentTotalExpenses = 0;
    tempFilteredTransactions.forEach((t) => {
      if (t.category && t.category !== "Income") { // Only sum expenses
        currentTotalExpenses += t.parsedAmount;
      }
    });

    setFilteredTransactions(tempFilteredTransactions);
    setTotalSpent(currentTotalExpenses);
  }, [allTransactions, startDate, endDate, selectedCategories, searchQuery]);

  // Toggles category selection
  const toggleCategory = (category) => {
    setSelectedCategories((prevSelected) =>
      prevSelected.includes(category)
        ? prevSelected.filter((c) => c !== category)
        : [...prevSelected, category]
    );
  };

  // Function to open the edit/delete modal
  const openEditModal = (transaction) => {
    setSelectedTransaction(transaction);
    
    // Ensure date is in YYYY-MM-DD format for TextInput
    let dateToSet = '';
    if (transaction.invoiceDate && transaction.invoiceDate !== "N/A") {
      dateToSet = formatDate(new Date(transaction.invoiceDate)); // Try parsing from invoiceDate string
    } else if (transaction.date instanceof Timestamp) {
      dateToSet = formatDate(transaction.date.toDate()); // Convert Firestore Timestamp to Date object and format
    } else if (typeof transaction.date === 'string' && transaction.date !== "N/A") {
      dateToSet = formatDate(new Date(transaction.date)); // Try parsing from string (e.g., manual entry)
    }

    setEditDate(dateToSet);
    setEditSupplier(transaction.supplierName || '');
    setEditTotal(transaction.parsedAmount ? transaction.parsedAmount.toString() : '');
    setEditCategory(transaction.category || 'Other');
    // For description, we combine existing items or fullText if available
    const initialDescription = transaction.items && transaction.items.length > 0
        ? transaction.items.map(item => item.name).join(', ')
        : transaction.fullText || '';
    setEditDescription(initialDescription);
    setShowEditModal(true);
  };

  // Function to close the edit/delete modal
  const closeModal = () => {
    setShowEditModal(false);
    setSelectedTransaction(null);
    // Clear edit states
    setEditDate('');
    setEditSupplier('');
    setEditTotal('');
    setEditCategory('Other');
    setEditDescription('');
  };

  // Function to handle updating a transaction
  const handleUpdateTransaction = async () => {
    console.log("handleUpdateTransaction called for transaction ID:", selectedTransaction?.id); // Added ID to log
    if (!selectedTransaction || !auth.currentUser) {
        showErrorMessage("No transaction selected or you are not logged in.");
        return;
    }

    // Basic validation
    if (!editDate || !editSupplier || !editTotal || !editCategory) {
      showErrorMessage("Validation Error: Please fill in all required fields (Date, Supplier, Total Amount, Category).");
      return;
    }
    if (isNaN(parseFloat(editTotal))) {
      showErrorMessage("Validation Error: Total Amount must be a valid number.");
      return;
    }

    setIsLoading(true); // Show loading indicator during update
    try {
      const transactionRef = doc(db, 'transactions', selectedTransaction.id);
      
      // Construct updated items array (simple for now, just description)
      const updatedItems = [{
        name: editDescription || editCategory,
        quantity: "1", // Default quantity for manual/edited
        unitPrice: editTotal,
        itemTotal: editTotal
      }];

      await updateDoc(transactionRef, {
        invoiceDate: editDate,
        supplierName: editSupplier,
        totalAmount: editTotal, // Store as string
        category: editCategory,
        fullText: editDescription, // Update fullText with new description
        items: updatedItems,
        // Update the 'date' field if the 'invoiceDate' changes to keep queries consistent
        date: Timestamp.fromDate(new Date(editDate + 'T00:00:00')) // Use a standard time for comparison
      });
      console.log("Transaction updated with ID:", selectedTransaction.id);
      showSuccessMessage("Transaction updated successfully!");
      closeModal();
    } catch (error) {
      console.error("Error updating transaction (Firestore permission/data issue?):", error); // More specific error log
      console.error("Full update error object:", JSON.stringify(error, null, 2));
      showErrorMessage(`Failed to update transaction: ${error.message}. Check console for details.`);
    } finally {
      setIsLoading(false); // Hide loading indicator
    }
  };

  // Function to handle deleting a transaction (directly from list item or from modal)
  const confirmDeleteTransaction = (transactionToDelete) => {
    if (!auth.currentUser) {
      showErrorMessage("You are not logged in.");
      return;
    }

    showConfirmation(
      "Are you sure you want to delete this transaction?",
      async () => {
        setIsLoading(true); // Show loading indicator during delete
        try {
          const transactionRef = doc(db, 'transactions', transactionToDelete.id);
          await deleteDoc(transactionRef);
          console.log("Transaction deleted with ID:", transactionToDelete.id);
          showSuccessMessage("Transaction deleted successfully!");
          closeModal(); // Close modal if open after deletion
        } catch (error) {
          console.error("Error deleting transaction (Firestore permission issue?):", error); 
          console.error("Full delete error object:", JSON.stringify(error, null, 2)); // <-- ADDED FOR DETAILED DEBUGGING
          showErrorMessage(`Failed to delete transaction: ${error.message}. Check console for details.`);
        } finally {
          setIsLoading(false); // Hide loading indicator
          hideConfirmation(); // Hide confirmation modal after action
        }
      }
    );
  };

  // --- Chart Data Preparation (for Pie and Bar Charts) ---
  const { pieChartData, barChartData } = useMemo(() => {
    const categoryTotals = {};
    const dailyTotals = {}; // For simplicity, let's aggregate daily

    filteredTransactions.forEach(transaction => {
      // For Pie Chart (Category-wise)
      const category = transaction.category || 'Other';
      if (category !== "Income") { // Only count expenses for pie chart
        categoryTotals[category] = (categoryTotals[category] || 0) + transaction.parsedAmount;
      }

      // For Bar Chart (Daily totals)
      const dateKey = transaction.date?.toDate().toLocaleDateString('en-US') || 'N/A'; // Format: M/D/YYYY
      if (dateKey !== 'N/A' && transaction.category !== "Income") { // Only count expenses for bar chart
        dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + transaction.parsedAmount;
      }
    });

    // Convert categoryTotals to a format suitable for a pie chart (e.g., [{name: 'Food', value: 100}])
    const formattedPieData = Object.keys(categoryTotals).map(category => ({
      name: category,
      // For react-native-chart-kit PieChart, 'population' is used for value
      population: categoryTotals[category], 
      color: '#' + Math.floor(Math.random()*16777215).toString(16), // Random color for now
      legendFontColor: "#7F7F7F", // Default legend color
      legendFontSize: 12,
    }));

    // Convert dailyTotals to a format suitable for a bar chart (e.g., [{label: '1/1', value: 50}])
    // Sort by date for better visualization
    const sortedDailyTotalsKeys = Object.keys(dailyTotals).sort((a, b) => new Date(a) - new Date(b));
    const barChartLabels = sortedDailyTotalsKeys.map(date => date);
    const barChartValues = sortedDailyTotalsKeys.map(date => dailyTotals[date]);

    const formattedBarData = {
      labels: barChartLabels.length > 0 ? barChartLabels : ["No Data"],
      datasets: [
        {
          data: barChartValues.length > 0 ? barChartValues : [0]
        }
      ]
    };

    return { pieChartData: formattedPieData, barChartData: formattedBarData };
  }, [filteredTransactions]);

  // Chart configuration for react-native-chart-kit
  const chartConfig = {
    backgroundGradientFrom: "#ffffff",
    backgroundGradientFromOpacity: 0, // Make transparent
    backgroundGradientTo: "#ffffff",
    backgroundGradientToOpacity: 0, // Make transparent
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`, // Text color
    strokeWidth: 2, // optional, default 3
    barPercentage: 0.5,
    useShadowColorFromDataset: false, // optional
    decimalPlaces: 0, // Only show whole numbers for axis labels
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Scanner')}>
            <Text style={styles.buttonText}>Add New Expense</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    // Bọc toàn bộ nội dung chính trong một ScrollView để cho phép cuộn
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Expense Overview & Reports</Text>

      {/* Filter Section */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterSection}>
        {/* From Date Datepicker */}
        <DatePickerInput
            value={startDate}
            onChange={setStartDate}
            placeholder="From Date (YYYY-MM-DD)"
            style={styles.filterInput}
        />
        
        {/* To Date Datepicker */}
        <DatePickerInput
            value={endDate}
            onChange={setEndDate}
            placeholder="To Date (YYYY-MM-DD)"
            style={styles.filterInput}
        />

        <TextInput
          style={styles.filterInput}
          placeholder="Search Transactions"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </ScrollView>

      {/* Category Filter Buttons */}
      <View style={styles.categoryFilterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilterScroll}>
          {ALL_CATEGORIES.map(cat => (
            <TouchableOpacity 
              key={cat} 
              style={[styles.categoryButton, selectedCategories.includes(cat) && styles.selectedCategoryButton]}
              onPress={() => toggleCategory(cat)}
            >
              <Text style={[styles.categoryButtonText, selectedCategories.includes(cat) && styles.selectedCategoryButtonText]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Summary Card for Filtered Transactions */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Total Expenses (Filtered):</Text>
        <Text style={styles.totalAmount}>
          {totalSpent.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
        </Text>
      </View>

      {/* Charts Section */}
      <Text style={styles.sectionTitle}>Expense Distribution</Text>
      <ScrollView horizontal style={styles.chartsContainer} showsHorizontalScrollIndicator={false}>
        {/* Pie Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>By Category</Text>
          {pieChartData.length > 0 && pieChartData.some(d => d.population > 0) ? (
            <PieChart
              data={pieChartData}
              width={screenWidth - 60} // Adjusted width to fit card
              height={200}
              chartConfig={chartConfig}
              accessor="population" // Use 'population' as value accessor
              backgroundColor="transparent"
              paddingLeft="15"
              absolute // Show absolute values in legend if needed
            />
          ) : (
            <Text>No data for Pie Chart</Text>
          )}
        </View>

        {/* Bar Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Daily Expenses</Text>
          {barChartData.datasets[0].data.some(d => d > 0) ? (
            <BarChart
              data={barChartData}
              width={screenWidth - 60} // Adjusted width to fit card
              height={200}
              yAxisLabel="$"
              chartConfig={chartConfig}
              verticalLabelRotation={30} // Rotate labels if many dates
              fromZero={true} // Ensure Y-axis starts from zero
              style={{
                marginVertical: 8,
                borderRadius: 16
              }}
            />
          ) : (
            <Text>No data for Bar Chart</Text>
          )}
        </View>
      </ScrollView>


      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Filtered Transactions</Text>
      </View>

      {/* Danh sách giao dịch không cần ScrollView riêng vì ScrollView bao ngoài đã xử lý */}
        {filteredTransactions.length > 0 ? (
          filteredTransactions.map((transaction) => (
            <View key={transaction.id} style={styles.transactionItem}>
              <View style={styles.transactionDetails}>
                <Text style={styles.transactionCategory}>
                    {transaction.category} {transaction.category === "Income" ? " (Income)" : ""}
                </Text>
                {/* Display Supplier Name */}
                {transaction.supplierName && transaction.supplierName !== "N/A" && (
                  <Text style={styles.transactionSupplierName}>{transaction.supplierName}</Text>
                )}
                <Text style={styles.transactionDescription}>
                  {transaction.items && transaction.items.length > 0 
                   ? transaction.items[0].name + (transaction.items.length > 1 ? ` and ${transaction.items.length - 1} other items` : '')
                   : transaction.supplierName && transaction.supplierName !== "N/A" ? transaction.supplierName : 'Unspecified transaction'}
                </Text>
                <Text style={styles.transactionDate}>
                  {transaction.date?.toDate().toLocaleDateString('en-US') || 'N/A'}
                </Text>
              </View>
              {/* Edit Button moved after amount, Delete button removed */}
              <View style={styles.transactionActions}>
                <Text style={styles.transactionAmount}>
                  {transaction.category === "Income" ? "+" : "-"}
                  {transaction.parsedAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </Text>
                <TouchableOpacity onPress={() => openEditModal(transaction)} style={styles.actionButton}>
                  <Text style={styles.actionButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noTransactionsText}>
            No transactions found for the current filters.
          </Text>
        )}
      {/* FAB (Floating Action Button) cũng phải nằm trong ScrollView nếu muốn nó cuộn theo */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => navigation.navigate('Scanner')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Edit/Delete Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showEditModal}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit/Delete Transaction</Text>

            {/* Label for Transaction Date */}
            <Text style={styles.inputLabel}>Transaction Date:</Text>
            <DatePickerInput
              value={editDate}
              onChange={setEditDate}
              placeholder="YYYY-MM-DD"
              style={styles.modalInput}
            />

            {/* Label for Supplier Name */}
            <Text style={styles.inputLabel}>Supplier Name:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g., ABC Store"
              value={editSupplier}
              onChangeText={setEditSupplier}
            />

            {/* Label for Total Amount */}
            <Text style={styles.inputLabel}>Total Amount:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g., 100.00"
              value={editTotal}
              onChangeText={setEditTotal}
              keyboardType="numeric"
            />
            
            {/* Category Picker in Modal */}
            <View style={styles.categoryPickerContainerModal}>
              <Text style={styles.inputLabel}>Category:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPickerScrollModal}>
                  {ALL_CATEGORIES.map(cat => (
                      <TouchableOpacity 
                          key={cat} 
                          style={[styles.categoryButtonModal, editCategory === cat && styles.selectedCategoryButtonModal]}
                          onPress={() => setEditCategory(cat)}
                      >
                          <Text style={[styles.categoryButtonTextModal, editCategory === cat && styles.selectedCategoryButtonTextModal]}>
                              {cat}
                          </Text>
                      </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>
            
            {/* Label for Description */}
            <Text style={styles.inputLabel}>Description:</Text>
            <TextInput
              style={[styles.modalInput, { height: 80 }]}
              placeholder="e.g., Dinner at ABC Restaurant"
              value={editDescription}
              onChangeText={setEditDescription}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSaveButton} onPress={handleUpdateTransaction}>
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalDeleteButton} onPress={() => confirmDeleteTransaction(selectedTransaction)}>
                <Text style={styles.modalButtonText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelButton} onPress={closeModal}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showConfirmModal}
        onRequestClose={hideConfirmation}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <Text style={styles.confirmModalMessage}>{confirmModalMessage}</Text>
            <View style={styles.confirmModalActions}>
              <TouchableOpacity style={styles.confirmModalCancelButton} onPress={hideConfirmation}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmModalDeleteButton} onPress={onConfirmAction}>
                <Text style={styles.modalButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Success Message Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showSuccessModal}
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModalContent}>
            <Text style={styles.successModalMessage}>{successModalMessage}</Text>
          </View>
        </View>
      </Modal>

      {/* Custom Error Message Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showErrorModal}
        onRequestClose={hideErrorMessage}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.errorModalContent}>
            <Text style={styles.errorModalTitle}>Error!</Text>
            <Text style={styles.errorModalMessage}>{errorModalMessage}</Text>
            <TouchableOpacity style={styles.errorModalButton} onPress={hideErrorMessage}>
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f0f2f5', 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: 'red',
    textAlign: 'center',
    marginBottom: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 6,
  },
  summaryTitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 10,
  },
  totalAmount: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#28a745', 
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 20, // Added margin for spacing
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  viewAllText: { // Retained for consistency, though not actively used for navigation to Reports now
    fontSize: 16,
    color: '#007AFF', 
  },
  transactionsList: {
    // Removed flex: 1 from here as the outer ScrollView now handles scrolling
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionCategory: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF', 
  },
  transactionSupplierName: { // New style for supplier name
    fontSize: 14,
    color: '#555',
    marginTop: 2,
  },
  transactionDescription: {
    fontSize: 14,
    color: '#555',
    marginTop: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 5,
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  noTransactionsText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#666',
  },
  fab: {
    position: 'absolute', // Giữ nguyên position: 'absolute'
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    right: 30,
    bottom: 30,
    backgroundColor: '#007AFF',
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    zIndex: 10, // Đảm bảo FAB nổi lên trên các nội dung khác
  },
  fabText: {
    fontSize: 30,
    color: '#fff',
    lineHeight: 32, 
  },
  button: { 
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
  },
  buttonText: { 
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // --- New styles for Edit/Delete functionality ---
  transactionActions: {
    flexDirection: 'row',
    marginLeft: 10,
    alignItems: 'center', // Align items vertically in the center
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    marginLeft: 10, // Increased margin to separate from amount
  },
  deleteButton: {
    backgroundColor: '#dc3545',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  deleteButtonText: {
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  modalInput: {
    width: '100%',
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  modalSaveButton: {
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  modalDeleteButton: {
    backgroundColor: '#dc3545',
    padding: 12,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#6c757d',
    padding: 12,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  categoryPickerContainerModal: {
    width: '100%',
    marginBottom: 10,
  },
  categoryPickerScrollModal: {
    // Styles for horizontal scroll view
  },
  categoryButtonModal: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
    marginRight: 8,
    backgroundColor: '#e9f5ff', // Light blue background for unselected
  },
  selectedCategoryButtonModal: {
    backgroundColor: '#007AFF', // Darker blue for selected
  },
  categoryButtonTextModal: {
    color: '#007AFF',
    fontSize: 14,
  },
  selectedCategoryButtonTextModal: {
    color: '#fff',
  },
  controlLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 8,
  },
  // New style for input labels in the modal
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 5,
    marginTop: 10, // Add some top margin for spacing
  },
  // --- Styles for Custom Confirmation Modal ---
  confirmModalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: '80%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  confirmModalMessage: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  confirmModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  confirmModalCancelButton: {
    backgroundColor: '#6c757d',
    padding: 12,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  confirmModalDeleteButton: {
    backgroundColor: '#dc3545',
    padding: 12,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  // --- Styles for Custom Success Message Modal ---
  successModalContent: {
    backgroundColor: '#28a745', // Green background
    borderRadius: 15,
    padding: 20,
    width: '80%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  successModalMessage: {
    fontSize: 18,
    textAlign: 'center',
    color: '#fff', // White text
    fontWeight: 'bold',
  },
  // --- Styles for Custom Error Message Modal ---
  errorModalContent: {
    backgroundColor: '#dc3545', // Red background
    borderRadius: 15,
    padding: 20,
    width: '80%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  errorModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  errorModalMessage: {
    fontSize: 16,
    textAlign: 'center',
    color: '#fff',
    marginBottom: 20,
  },
  errorModalButton: {
    backgroundColor: '#6c757d',
    padding: 12,
    borderRadius: 10,
    width: '50%',
    alignItems: 'center',
  },
  // --- New Styles for Filter and Charts ---
  filterSection: {
    flexDirection: 'row',
    marginBottom: 15,
    paddingVertical: 5,
  },
  filterInput: {
    height: 40,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginRight: 10,
    minWidth: 150,
    backgroundColor: '#fff',
  },
  dateInputTouchable: { // New style for TouchableOpacity wrapping TextInput
    marginRight: 10,
    minWidth: 150, // Ensure touchable area is wide enough
    height: 40, // Ensure touchable area is tall enough
    justifyContent: 'center', // Center text vertically
    backgroundColor: '#fff',
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  categoryFilterContainer: {
    marginBottom: 20,
  },
  categoryFilterScroll: {
    paddingVertical: 5,
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
    marginRight: 8,
    backgroundColor: '#e9f5ff',
  },
  selectedCategoryButton: {
    backgroundColor: '#007AFF',
  },
  categoryButtonText: {
    color: '#007AFF',
    fontSize: 14,
  },
  selectedCategoryButtonText: {
    color: '#fff',
  },
  chartsContainer: {
    marginBottom: 20,
    paddingVertical: 10,
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginRight: 15,
    width: screenWidth - 40, // Adjust width for responsiveness and padding
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 250, // Minimum height for chart cards, increased for better visualization
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
});

export default HomeScreen;
