// functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");
// Không còn cần thư viện @google-cloud/vision nữa
// const {ImageAnnotatorClient} = require("@google-cloud/vision");

// Khởi tạo Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// Khởi tạo Google Vision AI Client không còn cần nữa
// const visionClient = new ImageAnnotatorClient();

// Hàm hỗ trợ để phân loại chi tiêu dựa trên từ khóa trong văn bản.
// Có thể giữ lại nếu n8n workflow chỉ trả về rawText và bạn muốn phân loại ở đây.
// Hoặc có thể xóa nếu n8n workflow trả về danh mục đã được phân loại.
function categorizeExpense(text) {
  text = text.toLowerCase();
  if (text.includes("cafe") || text.includes("phở") ||
      text.includes("bánh mì") || text.includes("nhà hàng") ||
      text.includes("ăn uống")) {
    return "Ăn uống";
  }
  if (text.includes("xăng") || text.includes("xe buýt") ||
      text.includes("taxi") || text.includes("đi lại")) {
    return "Đi lại";
  }
  if (text.includes("siêu thị") || text.includes("mua sắm") ||
      text.includes("shop")) {
    return "Mua sắm";
  }
  if (text.includes("điện") || text.includes("nước") ||
      text.includes("internet")) {
    return "Tiện ích";
  }
  if (text.includes("thuê nhà") || text.includes("trọ")) {
    return "Nhà ở";
  }
  return "Khác"; // Mặc định nếu không khớp
}

// Cloud Function để xử lý OCR hóa đơn thông qua n8n Workflow
exports.processReceipt = functions.https.onCall(async (data, context) => {
  // 1. Xác thực người dùng
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "Chỉ người dùng đã đăng nhập mới có thể gọi chức năng này.",
    );
  }
  const userId = context.auth.uid;
  const base64Image = data.image; // Ảnh Base64 từ ứng dụng

  if (!base64Image) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Không có dữ liệu ảnh được cung cấp.",
    );
  }

  // **RẤT QUAN TRỌNG:** Thay thế bằng Webhook URL thực tế của n8n Workflow của bạn
  const N8N_WEBHOOK_URL = "YOUR_N8N_WEBHOOK_URL_HERE"; 

  if (N8N_WEBHOOK_URL === "YOUR_N8N_WEBHOOK_URL_HERE") {
    throw new functions.https.HttpsError(
        "failed-precondition",
        "Webhook URL của n8n chưa được cấu hình. Vui lòng cung cấp URL.",
    );
  }

  try {
    // 2. Gửi ảnh Base64 đến n8n Workflow
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64Image }),
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error("Lỗi từ n8n Workflow:", n8nResponse.status, errorText);
      throw new functions.https.HttpsError(
          "unavailable",
          `N8n Workflow trả về lỗi: ${n8nResponse.status}.`,
          errorText,
      );
    }

    const n8nResult = await n8nResponse.json();
    console.log("Kết quả từ n8n Workflow:", n8nResult);

    // 3. Xử lý kết quả từ n8n Workflow
    // Giả định n8n Workflow trả về dữ liệu đã được xử lý theo định dạng mong muốn:
    // { total: "150,000 VND", category: "Ăn uống", items: [{name: "...", price: "..."}, ...], rawText: "..." }
    // Nếu n8n chỉ trả về rawText, bạn có thể dùng categorizeExpense(n8nResult.rawText);
    const ocrResult = n8nResult.ocrResult || { // Điều chỉnh nếu cấu trúc trả về của n8n khác
        total: n8nResult.total || "N/A",
        category: n8nResult.category || categorizeExpense(n8nResult.rawText || ""),
        items: n8nResult.items || [],
        rawText: n8nResult.rawText || "Không có văn bản gốc.",
    };

    // 4. Lưu dữ liệu vào Firestore
    const transactionData = {
      userId: userId,
      fullText: ocrResult.rawText, // Văn bản gốc từ hóa đơn
      totalAmount: ocrResult.total,
      items: ocrResult.items,
      category: ocrResult.category,
      date: admin.firestore.FieldValue.serverTimestamp(), // Thời gian giao dịch
      receiptImageBase64: base64Image.substring(0, 200) + "...",
    };

    const docRef = await db.collection("transactions").add(transactionData);
    console.log("Giao dịch đã được lưu với ID:", docRef.id);

    // 5. Trả về kết quả cho ứng dụng di động
    return {
      success: true,
      message: "Hóa đơn đã được xử lý thành công!",
      ocrResult: ocrResult,
      transactionId: docRef.id,
    };
  } catch (error) {
    console.error("Lỗi Cloud Function OCR với n8n:", error);
    throw new functions.https.HttpsError(
        "internal",
        "Có lỗi xảy ra khi xử lý hóa đơn với n8n Workflow.",
        error.message,
    );
  }
});
