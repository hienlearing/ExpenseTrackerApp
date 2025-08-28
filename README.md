Expense Tracker App
🚀 Introduction
Welcome to the Expense Tracker App – a personal finance management application designed to help you easily track and analyze your spending in a smart and efficient way. With automatic invoice scanning (OCR) and flexible manual entry, you'll always know where your money goes.

This project was built as part of my portfolio, aiming to showcase my skills in mobile application development with React Native and integration with powerful backend services.

✨ Key Features
User Authentication: Secure registration and login using email/password.

Smart Invoice Scanning (OCR): Capture or select invoice images from your gallery to automatically extract expense details (vendor, total amount, category).

Manual Expense Entry: Easily add detailed transactions when a physical invoice is not available.

Transaction Management: View, edit, and delete recorded transactions.

Intuitive Reports: Track your overall spending by category and over time with easy-to-understand charts.

Mobile-First Design: A responsive, user-friendly interface that works seamlessly on both Android and iOS.

🛠️ Technologies Used
Frontend:

React Native

Expo (Managed Workflow)

React Navigation

expo-image-picker

expo-image-manipulator

@react-native-community/datetimepicker

react-native-chart-kit (for charting)

Backend & Services:

Firebase Authentication (for user authentication)

Firebase Firestore (NoSQL database)

n8n Workflow (for automating invoice processing, OCR integration)

Google Cloud Vision AI (via n8n, for OCR functionality)

⚙️ Setup & Run Guide
To set up and run this application in your development environment:

1. Prerequisites
Node.js (LTS version recommended)

npm or Yarn

Expo CLI (npm install -g expo-cli)

Firebase Project: Firestore Database and Authentication set up.

n8n Instance: n8n Workflow deployed and configured for OCR processing.

Android Studio (for running on Android Emulator/Device)

Xcode (macOS only, for running on iOS Simulator/Device)

2. Clone the Repository
git clone https://github.com/hienlearing/ExpenseTrackerApp.git
cd ExpenseTrackerApp

3. Install Dependencies
npm install
# Or if you use Yarn
# yarn install

4. Configure Environment Variables
Create a file named .env in the root directory of your project.

Populate this file with your API keys and webhook URL. Do NOT push this file to GitHub.

EXPO_PUBLIC_FIREBASE_API_KEY="your_firebase_api_key"
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN="your_firebase_auth_domain"
EXPO_PUBLIC_FIREBASE_PROJECT_ID="your_firebase_project_id"
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET="your_firebase_storage_bucket"
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your_firebase_messaging_sender_id"
EXPO_PUBLIC_FIREBASE_APP_ID="your_firebase_app_id"
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID="your_firebase_measurement_id"
EXPO_PUBLIC_N8N_WEBHOOK_URL="your_n8n_webhook_url"

Note: You can obtain Firebase values from your Firebase Console project settings. The n8n Webhook URL is from your deployed n8n Workflow.

5. Run the Application
npm start

Once the Metro Bundler starts, you can:

Scan the QR code with the Expo Go app on your Android/iOS phone.

Press a in the terminal to open on an Android Emulator.

Press i in the terminal to open on an iOS Simulator (macOS only).

🐛 Challenges & Solutions
During development, I encountered and resolved several key technical challenges:

TypeError: Cannot read properties of undefined (reading 'Images'): Occurred due to an incorrect constant reference for ImagePicker.MediaType.Images.

Solution: Adjusted to use the literal string 'Images' directly for the mediaTypes property.

Firestore write failed: Missing or insufficient permissions (403): Firebase Firestore access error when saving data.

Solution: Strictly updated Firestore Security Rules to grant create/read permissions to authenticated users and update/delete permissions to the data owner.

Transaction Date displayed incorrectly in Edit Modal: Caused by inconsistent date formats from different data sources.

Solution: Implemented robust date parsing and formatting logic within the openEditModal function to always display the date in YYYY-MM-DD format.

n8n workflow returned error: 413 (Request Entity Too Large): Occurred when sending large invoice images to n8n.

Solution: Integrated expo-image-manipulator to compress images (reducing pixel dimensions and JPEG quality) directly on the device before sending to n8n.

eas.json configuration and standalone .apk build errors: Faced difficulties in creating a standalone Android build.

Solution: Refined the eas.json file to correctly configure developmentClient: false and android.buildType: "apk" for the preview profile, ensuring the generation of a standalone .apk file.

🔮 Future Enhancements
This project still has significant potential for expansion:

Third-Party Login Integration: Support Google, Facebook, or other third-party logins for enhanced user convenience.

Budgeting Feature: Allow users to set and track budgets for specific expense categories or time periods.

Invoice Reminders: Add notification functionality for upcoming invoice due dates or recurring expenses.

Advanced Reporting & Analytics: Expand reporting options, add interactive charts, and provide more detailed financial analysis.

Localization Support: Implement localization to make the application usable in multiple languages.

🤝 Contact
If you have any questions or feedback regarding this project, please feel free to reach out:

Name: Harry Huynh

Email: huynhthehien@gmail.com

LinkedIn: https://www.linkedin.com/in/the-hien-huynh-6b1ab5126/

Thank you for visiting my project!