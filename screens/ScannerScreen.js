// ExpenseTrackerApp/screens/ScannerScreen.js

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, ScrollView, Alert, TextInput, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator'; // NEW: Import ImageManipulator
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'; 
import { db, auth } from '../firebaseConfig'; 
import DateTimePicker from '@react-native-community/datetimepicker'; 

// Helper function to categorize expenses based on English keywords for MANUAL ENTRIES ONLY.
// This function will NOT return "Income" as all scanned receipts are considered expenses.
function categorizeExpense(text) {
  text = text.toLowerCase();
  if (text.includes("cafe") || text.includes("restaurant") ||
      text.includes("food") || text.includes("meal") ||
      text.includes("coffee") || text.includes("drink")) {
    return "Food & Dining";
  }
  if (text.includes("gas") || text.includes("bus") ||
      text.includes("taxi") || text.includes("travel") ||
      text.includes("transport") || text.includes("fuel")) {
    return "Transportation";
  }
  if (text.includes("supermarket") || text.includes("shopping") ||
      text.includes("store") || text.includes("market") ||
      text.includes("groceries")) {
    return "Shopping";
  }
  if (text.includes("electricity") || text.includes("water") ||
      text.includes("internet") || text.includes("utilities") ||
      text.includes("bill")) {
    return "Utilities";
  }
  if (text.includes("rent") || text.includes("housing") ||
      text.includes("home")) {
    return "Housing";
  }
  // For manual entries, income is handled separately or through a specific 'Income' screen.
  // For scanned receipts, "Income" is not expected.
  return "Other"; 
}

// Predefined categories for manual entry. Excludes "Income" here.
const EXPENSE_CATEGORIES = [
  "Food & Dining", "Transportation", "Shopping", "Utilities", "Housing", "Entertainment", "Health", "Education", "Other"
];

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

// Custom DatePicker Input Component (duplicated for self-contained file)
const DatePickerInput = ({ value, onChange, placeholder, style }) => {
  const [showPicker, setShowPicker] = useState(false);

  const handleDateChange = (event, selectedDate) => {
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
        style={style} 
        className="web-datepicker-input" 
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
          editable={false} 
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


const ScannerScreen = () => {
  const [imageUri, setImageUri] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  
  // States for structured manual entry
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualDate, setManualDate] = useState(''); // YYYY-MM-DD
  const [manualSupplier, setManualSupplier] = useState('');
  const [manualTotal, setManualTotal] = useState('');
  const [manualCategory, setManualCategory] = useState('Other'); // Default category
  const [manualDescription, setManualDescription] = useState('');


  // **VERY IMPORTANT:** Replace with your actual n8n Workflow Webhook URL
  const N8N_WEBHOOK_URL = process.env.EXPO_PUBLIC_N8N_WEBHOOK_URL; 

  // Request Camera and Media Library permissions
  const requestPermissions = async () => {
    if (Platform.OS === 'web') {
      return true;
    }
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: galleryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraStatus !== 'granted' || galleryStatus !== 'granted') {
      Alert.alert(
        'Permission Denied',
        'To use this feature, you need to grant access to your Camera and Photo Library.'
      );
      return false;
    }
    return true;
  };

  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.log("Gallery permission not granted.");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'Images',
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1, // Capture at highest quality, we'll compress later
      base64: false, // Set to false to get URI for ImageManipulator
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
      
      // NEW: Manipulate and compress the image before sending to n8n
      await compressAndProcessImage(result.assets[0].uri);
      
    } else if (result.canceled) {
        console.log("Image picking cancelled.");
    } else {
        Alert.alert("Error", "Could not get image from gallery. Please try again.");
    }
  };

  const takePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.log("Camera permission not granted.");
      return;
    }

    if (Platform.OS === 'web') {
        Alert.alert("Web Camera Not Fully Supported", "On web, 'Take Photo' acts as a file upload. For webcam access, a more complex setup is needed.");
    }

    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'Images',
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1, // Capture at highest quality, we'll compress later
      base64: false, // Set to false to get URI for ImageManipulator
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);

      // NEW: Manipulate and compress the image before sending to n8n
      await compressAndProcessImage(result.assets[0].uri);
      
    } else if (result.canceled) {
        console.log("Photo taking cancelled.");
    } else {
        Alert.alert("Error", "Could not take photo. Please try again.");
    }
  };

  // NEW: Centralized function to compress and process the image
  const compressAndProcessImage = async (uri) => {
    setIsProcessing(true);
    setOcrResult(null);
    setShowManualEntry(false);
    
    try {
      console.log("Compressing image...");
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }], // Resize image to 800px width
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true } // Compress to 70% JPEG and get base64
      );

      console.log(`Image compressed. New Base64 size: ${manipResult.base64.length} characters.`);
      await processImageWithN8n(manipResult.base64);

    } catch (error) {
      console.error("Error during image manipulation:", error);
      Alert.alert("Image Processing Error", `Could not compress image: ${error.message}.`);
      setIsProcessing(false);
      // Fallback to manual entry if compression fails
      setShowManualEntry(true); 
    }
  };

  // Function to send Base64 image directly to n8n Workflow
  const processImageWithN8n = async (base64Image) => { // Accepts Base64 string
    setIsProcessing(true);
    setOcrResult(null);
    setShowManualEntry(false);

    if (N8N_WEBHOOK_URL === "YOUR_N8N_WEBHOOK_URL_HERE") {
        Alert.alert("Configuration Error", "Please replace YOUR_N8N_WEBHOOK_URL_HERE with your actual n8n Webhook URL.");
        setIsProcessing(false);
        return;
    }

    try {
      console.log("Sending Base64 image to n8n Workflow...");

      const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', // IMPORTANT: Send as JSON
        },
        body: JSON.stringify({ image: base64Image }), // Send Base64 string in JSON body
      });

      if (!n8nResponse.ok) {
        const errorText = await n8nResponse.text();
        console.error("Error from n8n Workflow:", n8nResponse.status, errorText);
        Alert.alert(
          "n8n Workflow Error",
          `n8n Workflow returned error: ${n8nResponse.status}. Please check console for details.`
        );
        setIsProcessing(false);
        return;
      }

      const n8nResultRaw = await n8nResponse.json();
      console.log("Result from n8n Workflow:", n8nResultRaw);

      // --- START ADJUSTING LOGIC TO PARSE N8N RESULT ACCORDING TO NEW FORMAT ---
      // Fix: n8nResultRaw is an array, and actual invoice data is in n8nResultRaw[0].output
      const n8nResult = n8nResultRaw[0]?.output || {}; 
      if (!n8nResult) {
        throw new Error("Invalid n8n result structure. Missing 'output' field.");
      }

      // Extract key information from n8nResult
      let category = n8nResult.category || "Other"; // Get category directly from n8n
      const supplierName = n8nResult.supplier_name || "N/A";
      const supplierAddress = n8nResult.supplier_address || "N/A"; 
      const supplierPhone = n8nResult.supplier_phone || "N/A"; 
      const invoiceDate = n8nResult.invoice_date || "N/A";
      const invoiceNumber = n8nResult.invoice_number || "N/A";
      let totalAmount = n8nResult.total_amount || "N/A";
      const subtotal = n8nResult.subtotal || "N/A";
      const taxAmount = n8nResult.tax_amount || "N/A";
      const paymentMethod = n8nResult.payment_method || "N/A";
      
      let items = [];
      if (n8nResult.line_items && Array.isArray(n8nResult.line_items)) {
        items = n8nResult.line_items.map(item => ({
          name: item.description || "Unknown Item",
          quantity: item.quantity || "N/A",
          unitPrice: item.unit_price || "N/A",
          itemTotal: item.item_total || "N/A"
        }));
      }

      // Create a raw text string from all extracted information for categorization and storage
      const rawTextFromN8n = `Category: ${category}\nSupplier: ${supplierName} (${supplierAddress}, ${supplierPhone})\nDate: ${invoiceDate}\nInvoice #: ${invoiceNumber}\nTotal: ${totalAmount}\nSubtotal: ${subtotal}\nTax: ${taxAmount}\nPayment: ${paymentMethod}\nItems: ${items.map(item => item.name + " x" + item.quantity + " @" + item.unitPrice + " = " + item.itemTotal).join(", ")}`;
      
      // If totalAmount is "N/A", try to find it in rawText or set to "N/A"
      if (totalAmount === "N/A" || totalAmount === "0" && n8nResult.rawText) { 
          const totalMatch = n8nResult.rawText.match(/(total|amount)[:\s]*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/i);
          if (totalMatch && totalMatch[2]) {
            totalAmount = totalMatch[2].replace(/[^0-9.]/g, ''); // Clean for US format
          }
      }

      // NEW CONDITION: If n8n returns "Uncategorized", use the local categorizeExpense function
      if (category === "Uncategorized" || category === "Other") { // Also re-categorize if "Other"
        console.log("n8n returned 'Uncategorized' or 'Other'. Attempting local categorization.");
        category = categorizeExpense(rawTextFromN8n); // Re-categorize using local function
      }

      const finalOcrResult = { // Renamed to avoid conflict
          supplierName: supplierName,
          supplierAddress: supplierAddress,
          supplierPhone: supplierPhone,
          invoiceDate: invoiceDate,
          invoiceNumber: invoiceNumber,
          total: totalAmount,
          subtotal: subtotal,
          taxAmount: taxAmount,
          paymentMethod: paymentMethod,
          category: category, // Use potentially re-categorized category
          items: items,
          rawText: rawTextFromN8n, // Store aggregated raw text
      };
      // --- END ADJUSTING LOGIC TO PARSE N8N RESULT ACCORDING TO NEW FORMAT ---

      setOcrResult(finalOcrResult);
      Alert.alert("Success", "Invoice processed!");

      // Save data to Firestore directly from client
      if (auth.currentUser) {
        const transactionData = {
          userId: auth.currentUser.uid,
          supplierName: finalOcrResult.supplierName,
          supplierAddress: finalOcrResult.supplierAddress,
          supplierPhone: finalOcrResult.supplierPhone,
          invoiceDate: finalOcrResult.invoiceDate,
          invoiceNumber: finalOcrResult.invoiceNumber,
          fullText: finalOcrResult.rawText,
          totalAmount: finalOcrResult.total, // Store as string for now, parse on display
          subtotal: finalOcrResult.subtotal,
          taxAmount: finalOcrResult.taxAmount,
          paymentMethod: finalOcrResult.paymentMethod,
          items: finalOcrResult.items,
          category: finalOcrResult.category,
          date: serverTimestamp(),
          receiptImageBase64: base64Image.substring(0, 200) + "...", // Store a part for debugging
        };
        await addDoc(collection(db, "transactions"), transactionData);
        console.log("Transaction saved to Firestore!");
      } else {
        Alert.alert("Error", "No logged-in user found to save transaction.");
      }
    } catch (error) {
      console.error("Error processing with n8n Workflow:", error);
      Alert.alert("Error", `Could not process invoice: ${error.message}.`);
      setShowManualEntry(true); // Offer manual entry if OCR/n8n fails
      setManualDate(formatDate(new Date())); // Pre-fill current date using helper
      setManualDescription(base64Image ? "OCR scan failed. Please enter details manually." : "");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualEntrySubmit = async () => {
    if (!auth.currentUser) {
      Alert.alert("Error", "You need to be logged in to save manual transactions.");
      return;
    }
    // Basic validation for manual entry
    if (!manualDate || !manualSupplier || !manualTotal || !manualCategory) {
      Alert.alert("Validation Error", "Please fill in all required fields (Date, Supplier, Total Amount, Category).");
      return;
    }
    if (isNaN(parseFloat(manualTotal))) {
      Alert.alert("Validation Error", "Total Amount must be a valid number.");
      return;
    }
    try {
      const fullTextDescription = `Manual Entry - Date: ${manualDate}, Supplier: ${manualSupplier}, Total: ${manualTotal}, Category: ${manualCategory}, Description: ${manualDescription}`;
      const transactionData = {
        userId: auth.currentUser.uid,
        supplierName: manualSupplier || "Manual Entry",
        invoiceDate: manualDate || "N/A", // Use entered date
        totalAmount: manualTotal || "0.00", // Use entered total
        category: manualCategory,
        fullText: fullTextDescription,
        items: [{name: manualDescription || manualCategory, quantity: "1", unitPrice: manualTotal, itemTotal: manualTotal}], // Create a simple item for manual entry
        date: serverTimestamp(), // Use server timestamp for consistency
        receiptImageBase64: "Manual Entry",
      };
      const docRef = await addDoc(collection(db, "transactions"), transactionData);
      console.log("Manual transaction saved to Firestore with ID:", docRef.id);
      Alert.alert("Success", `Manual expense saved! Transaction ID: ${docRef.id}`);
      // Reset manual entry fields
      setManualDate('');
      setManualSupplier('');
      setManualTotal('');
      setManualCategory('Other');
      setManualDescription('');
      setShowManualEntry(false);
    } catch (error) {
      console.error("Error saving manual transaction:", error);
      Alert.alert("Error", `Could not save manual expense: ${error.message}.`);
    }
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Invoice Scanner</Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={pickImage}>
          <Text style={styles.buttonText}>Select from Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={takePhoto}>
          <Text style={styles.buttonText}>Take Photo</Text>
        </TouchableOpacity>
      </View>
      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.imagePreview} />
      )}
      {isProcessing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Processing Invoice...</Text>
        </View>
      )}
      {ocrResult && !isProcessing && (
        <View style={styles.ocrResultContainer}>
          <Text style={styles.sectionTitle}>Invoice Details</Text>
          <Text style={styles.resultText}>Category: {ocrResult.category}</Text>
          <Text style={styles.resultText}>Supplier: {ocrResult.supplierName}</Text>
          <Text style={styles.resultText}>Date: {ocrResult.invoiceDate}</Text>
          <Text style={styles.resultText}>Total Amount: {ocrResult.total}</Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.saveButton]} 
              onPress={async () => {
                // When saving the transaction, we save the receiptImageBase64 from the state
                const transactionData = {
                  userId: auth.currentUser.uid,
                  supplierName: ocrResult.supplierName,
                  totalAmount: ocrResult.total,
                  category: ocrResult.category,
                  fullText: ocrResult.rawText,
                  date: serverTimestamp(),
                  receiptImageBase64: ocrResult.receiptImageBase64,
                };
                
                try {
                  const docRef = await addDoc(collection(db, "transactions"), transactionData);
                  Alert.alert("Success", `Transaction saved with ID: ${docRef.id}`);
                  setOcrResult(null); // Clear result after saving
                  setImageUri(null); // Clear image preview
                } catch (e) {
                  console.error("Error adding document: ", e);
                  Alert.alert("Error", "Could not save transaction to Firestore.");
                }
              }}
            >
              <Text style={styles.buttonText}>Save Transaction</Text>
            </TouchableOpacity>
          </View>

        </View>
      )}

      {!isProcessing && !imageUri && !ocrResult && (
        <View style={styles.manualEntryOptionContainer}>
          <Text style={styles.manualEntryTitle}>OR</Text>
          <TouchableOpacity 
            style={styles.manualEntryButton} 
            onPress={() => {
              setShowManualEntry(true);
              setManualDate(formatDate(new Date())); // Pre-fill with today's date
            }}
          >
            <Text style={styles.manualEntryButtonText}>Enter Manually</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Manual Entry Form */}
      {showManualEntry && (
        <View style={styles.manualEntryContainer}>
          <Text style={styles.manualEntryTitle}>Manual Expense Entry</Text>
          <View style={styles.formGroup}>
            <Text style={styles.controlLabel}>Date</Text>
            <DatePickerInput
              style={styles.manualEntryInput}
              value={manualDate}
              onChange={setManualDate}
              placeholder="YYYY-MM-DD"
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.controlLabel}>Supplier</Text>
            <TextInput
              style={styles.manualEntryInput}
              placeholder="e.g., Starbuck, Lotte Mart..."
              value={manualSupplier}
              onChangeText={setManualSupplier}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.controlLabel}>Total Amount</Text>
            <TextInput
              style={styles.manualEntryInput}
              placeholder="e.g., 150000"
              keyboardType="numeric"
              value={manualTotal}
              onChangeText={setManualTotal}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.controlLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPickerScroll}>
              {EXPENSE_CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryButton,
                    manualCategory === category && styles.selectedCategoryButton,
                  ]}
                  onPress={() => setManualCategory(category)}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      manualCategory === category && styles.selectedCategoryButtonText,
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.controlLabel}>Description</Text>
            <TextInput
              style={styles.manualEntryInput}
              placeholder="Optional description"
              value={manualDescription}
              onChangeText={setManualDescription}
            />
          </View>

          <View style={styles.manualEntryButtonRow}>
            <TouchableOpacity style={styles.manualEntrySubmitButton} onPress={handleManualEntrySubmit}>
              <Text style={styles.manualEntryButtonText}>Save Manually</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.manualEntryCancelButton} onPress={() => setShowManualEntry(false)}>
              <Text style={styles.manualEntryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  imagePreview: {
    width: 250,
    height: 350,
    resizeMode: 'contain',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  ocrResultContainer: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  resultText: {
    fontSize: 16,
    marginBottom: 5,
    color: '#555',
  },
  saveButton: {
    backgroundColor: '#28a745',
  },
  manualEntryOptionContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  manualEntryButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  manualEntryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  manualEntryContainer: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  manualEntryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center',
  },
  manualEntryInput: {
    width: '100%',
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  manualEntrySubmitButton: {
    backgroundColor: '#28a745',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
    flex: 1,
    marginRight: 5,
  },
  manualEntryCancelButton: {
    backgroundColor: '#dc3545',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1,
    marginLeft: 5,
  },
  manualEntryButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  formGroup: {
    marginBottom: 15,
  },
  controlLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 8,
  },
  categoryPickerScroll: {
    maxHeight: 40,
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
  dateInputTouchable: { 
    marginRight: 10, 
  },
});

export default ScannerScreen;

