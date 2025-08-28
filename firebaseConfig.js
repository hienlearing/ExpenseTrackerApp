// ExpenseTrackerApp/firebaseConfig.js

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Lấy biến môi trường từ process.env
// Đảm bảo các biến này được định nghĩa trong file .env và bắt đầu bằng EXPO_PUBLIC_
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID // Thêm dòng này nếu bạn có measurementId
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);

// Lấy các dịch vụ cần thiết cho frontend
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
