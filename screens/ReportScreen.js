// ExpenseTrackerApp/screens/ReportScreen.js

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions, TouchableOpacity, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { PieChart, BarChart } from 'react-native-chart-kit'; // Import chart components

const screenWidth = Dimensions.get('window').width;

// Helper function to parse amount string into a valid number (for US format)
const parseAmount = (amountString) => {
  if (typeof amountString !== 'string') {
    return 0;
  }
  let cleanedString = amountString;

  // Remove currency symbols ($, €) and thousands separators (commas)
  cleanedString = cleanedString.replace(/[^0-9.]/g, ''); 

  // Ensure only one decimal point, the last one
  const parts = cleanedString.split('.');
  if (parts.length > 2) {
      cleanedString = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
  }

  const parsed = parseFloat(cleanedString);
  return isNaN(parsed) ? 0 : parsed;
};

const ReportScreen = () => {
  const navigation = useNavigation();
  const [allTransactions, setAllTransactions] = useState([]); // Store all fetched transactions
  const [filteredTransactions, setFilteredTransactions] = useState([]); // Transactions after filtering/sorting
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterCategory, setFilterCategory] = useState('All'); // State for category filter
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc' for amount
  const [searchText, setSearchText] = useState(''); // State for search text

  useEffect(() => {
    if (!auth.currentUser) {
      setError("User not logged in.");
      setIsLoading(false);
      return;
    }

    const userId = auth.currentUser.uid;
    const transactionsRef = collection(db, 'transactions');
    
    // Query to get all transactions for the current user
    const q = query(
      transactionsRef,
      where('userId', '==', userId),
      // orderBy('date', 'desc'), // Temporarily remove orderBy to avoid index errors. Sorting on client-side.
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const transactionsList = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const amount = parseAmount(data.totalAmount);
        transactionsList.push({ id: doc.id, ...data, parsedAmount: amount });
      });

      // Sort on the client-side
      transactionsList.sort((a, b) => {
        const dateA = a.date?.toDate() || new Date(0);
        const dateB = b.date?.toDate() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      }); 

      setAllTransactions(transactionsList);
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching transactions:", err);
      setError("Failed to load transactions. Please try again.");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  // Apply filters and sorting whenever allTransactions, filterCategory, sortOrder, or searchText changes
  useEffect(() => {
    let tempTransactions = [...allTransactions];

    // Apply category filter
    if (filterCategory !== 'All') {
      tempTransactions = tempTransactions.filter(t => t.category === filterCategory);
    }

    // Apply search filter (on description, supplier name, or raw text)
    if (searchText) {
      const lowerSearchText = searchText.toLowerCase();
      tempTransactions = tempTransactions.filter(t => 
        (t.items && t.items.some(item => item.name.toLowerCase().includes(lowerSearchText))) ||
        (t.supplierName && t.supplierName.toLowerCase().includes(lowerSearchText)) ||
        (t.fullText && t.fullText.toLowerCase().includes(lowerSearchText))
      );
    }

    // Apply sorting
    tempTransactions.sort((a, b) => {
      if (sortOrder === 'asc') {
        return a.parsedAmount - b.parsedAmount;
      }
      return b.parsedAmount - a.parsedAmount;
    });

    setFilteredTransactions(tempTransactions);
  }, [allTransactions, filterCategory, sortOrder, searchText]);

  // --- Data processing for charts ---
  const getPieChartData = () => {
    const categoryExpenses = {}; // { category: totalAmount }
    filteredTransactions.forEach(t => {
      if (t.category !== "Income") { // Only count expenses for pie chart
        categoryExpenses[t.category] = (categoryExpenses[t.category] || 0) + t.parsedAmount;
      }
    });

    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#E7E9ED', '#8B0000', '#008000', '#ADD8E6']; // More distinct colors
    let colorIndex = 0;

    return Object.keys(categoryExpenses).map(category => {
      const value = categoryExpenses[category];
      const color = colors[colorIndex % colors.length];
      colorIndex++;
      return {
        name: category,
        population: value, // 'population' is used by PieChart for value
        color: color,
        legendFontColor: '#7F7F7F',
        legendFontSize: 15,
      };
    }).filter(data => data.population > 0); // Filter out categories with 0 expense
  };

  const getBarChartData = () => {
    const monthlyExpenses = {}; // { 'YYYY-MM': totalAmount }
    filteredTransactions.forEach(t => {
      if (t.date && t.category !== "Income") { // Only count expenses
        const month = t.date.toDate().toISOString().substring(0, 7); // 'YYYY-MM'
        monthlyExpenses[month] = (monthlyExpenses[month] || 0) + t.parsedAmount;
      }
    });

    const sortedMonths = Object.keys(monthlyExpenses).sort(); // Sort months chronologically
    const labels = sortedMonths.map(month => {
      const [year, mon] = month.split('-');
      return `${mon}/${year.substring(2)}`; // e.g., '08/25'
    });
    const data = sortedMonths.map(month => monthlyExpenses[month]);

    return {
      labels: labels,
      datasets: [
        {
          data: data,
        },
      ],
    };
  };
  // --- End Data processing for charts ---

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading transactions...</Text>
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

  const pieChartData = getPieChartData();
  const barChartData = getBarChartData();
  const availableCategories = ['All', ...new Set(allTransactions.map(t => t.category).filter(c => c !== "Income"))]; // Get unique expense categories

  const chartConfig = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 2, // Optional, defaults to 2
    color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#ffa726',
    },
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Expense Reports</Text>

      {/* Filter and Sort Controls */}
      <View style={styles.controlsContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search transactions..."
          value={searchText}
          onChangeText={setSearchText}
        />

        <View style={styles.filterSortRow}>
            <Text style={styles.controlLabel}>Category:</Text>
            <ScrollView horizontal style={styles.categoryFilterScroll} showsHorizontalScrollIndicator={false}>
                {availableCategories.map(cat => (
                    <TouchableOpacity 
                        key={cat} 
                        style={[styles.categoryButton, filterCategory === cat && styles.selectedCategoryButton]}
                        onPress={() => setFilterCategory(cat)}
                    >
                        <Text style={[styles.categoryButtonText, filterCategory === cat && styles.selectedCategoryButtonText]}>
                            {cat}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>

        <View style={styles.filterSortRow}>
            <Text style={styles.controlLabel}>Sort by Amount:</Text>
            <TouchableOpacity 
                style={[styles.sortButton, sortOrder === 'desc' && styles.selectedSortButton]}
                onPress={() => setSortOrder('desc')}
            >
                <Text style={[styles.sortButtonText, sortOrder === 'desc' && styles.selectedSortButtonText]}>Highest</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.sortButton, sortOrder === 'asc' && styles.selectedSortButton]}
                onPress={() => setSortOrder('asc')}
            >
                <Text style={[styles.sortButtonText, sortOrder === 'asc' && styles.selectedSortButtonText]}>Lowest</Text>
            </TouchableOpacity>
        </View>
      </View>
      
      {allTransactions.length === 0 ? (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No transactions to display reports.</Text>
          <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Scanner')}>
              <Text style={styles.buttonText}>Add Your First Expense</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Expenses by Category</Text>
            {pieChartData.length > 0 ? (
              <PieChart
                data={pieChartData}
                width={screenWidth - 40} // Subtract padding
                height={220}
                chartConfig={chartConfig}
                accessor={"population"}
                backgroundColor={"transparent"}
                paddingLeft={"15"}
                absolute // Show absolute values in legend
              />
            ) : (
              <Text style={styles.noChartDataText}>No expense data for category chart.</Text>
            )}
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Monthly Expenses</Text>
            {barChartData.datasets[0].data.length > 0 ? (
              <BarChart
                data={barChartData}
                width={screenWidth - 40} // Subtract padding
                height={220}
                yAxisLabel="$"
                chartConfig={chartConfig}
                verticalLabelRotation={30}
              />
            ) : (
              <Text style={styles.noChartDataText}>No expense data for monthly chart.</Text>
            )}
          </View>

          <Text style={styles.sectionTitle}>All Transactions</Text>
          {filteredTransactions.map((transaction) => (
            <View key={transaction.id} style={styles.transactionItem}>
              <View style={styles.transactionDetails}>
                <Text style={styles.transactionCategory}>
                    {transaction.category} {transaction.category === "Income" ? " (Income)" : ""}
                </Text>
                <Text style={styles.transactionDescription}>
                  {transaction.items && transaction.items.length > 0 
                   ? transaction.items[0].name + (transaction.items.length > 1 ? ` and ${transaction.items.length - 1} other items` : '')
                   : transaction.supplierName && transaction.supplierName !== "N/A" ? transaction.supplierName : 'Unspecified transaction'}
                </Text>
                <Text style={styles.transactionDate}>
                  {transaction.date?.toDate().toLocaleDateString('en-US') || 'N/A'}
                </Text>
              </View>
              <Text style={styles.transactionAmount}>
                {transaction.category === "Income" ? "+" : "-"}
                {transaction.parsedAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </Text>
            </View>
          ))}
        </>
      )}
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
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 6,
  },
  noDataText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 6,
    alignItems: 'center', // Center chart content
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  noChartDataText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    marginTop: 10,
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
  // --- New Styles for Filter and Sort Controls ---
  controlsContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 6,
  },
  searchInput: {
    height: 40,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  filterSortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap', // Allow items to wrap
  },
  controlLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
    marginRight: 10,
    minWidth: 70, // Ensure label doesn't shrink too much
  },
  categoryFilterScroll: {
    flexGrow: 1, // Allow scroll view to take remaining space
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
    marginRight: 8,
    marginBottom: 8, // For wrapping
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
  sortButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#6c757d',
    marginRight: 8,
    marginBottom: 8, // For wrapping
  },
  selectedSortButton: {
    backgroundColor: '#6c757d',
  },
  sortButtonText: {
    color: '#6c757d',
    fontSize: 14,
  },
  selectedSortButtonText: {
    color: '#fff',
  },
});

export default ReportScreen;
