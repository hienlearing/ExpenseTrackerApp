// ExpenseTrackerApp/index.js
// Đây là file index.js gốc của dự án React Native (Expo)

import { registerRootComponent } from 'expo'; // Import hàm cần thiết từ Expo

import App from './App'; // Import component chính của ứng dụng bạn

// registerRootComponent gọi AppRegistry.registerComponent cho bạn
// Nó cũng đảm bảo rằng bạn render component APP phổ biến trong editor.
registerRootComponent(App);
