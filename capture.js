import puppeteer from 'puppeteer-core';
import path from 'path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\e9c532d6-760d-4225-9cf7-98e98524ed90';

async function capture() {
    console.log("🚀 Khởi chạy trình duyệt Chrome chụp ảnh màn hình...");
    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        defaultViewport: { width: 1440, height: 900 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Step 1: Mở trang login để khởi tạo localStorage
    console.log("🔗 Đang điều hướng đến trang Đăng nhập...");
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
    
    // Step 2: Tiêm token xác thực Admin Demo trực tiếp vào localStorage
    console.log("🔑 Đang tự động tiêm token xác thực tài khoản Admin...");
    await page.evaluate(() => {
        localStorage.setItem('token', 'demo_token_12345');
        localStorage.setItem('user', JSON.stringify({
            id: 1,
            username: 'admin',
            email: 'admin@richland.net',
            name: 'Admin Demo',
            role: 'admin'
        }));
    });
    
    // Hàm phụ điều hướng và chụp ảnh
    const takeScreenshot = async (urlPath, fileName) => {
        const fullUrl = `http://localhost:5173${urlPath}`;
        console.log(`📸 Chụp ảnh trang: ${fullUrl}...`);
        await page.goto(fullUrl, { waitUntil: 'networkidle2' });
        // Chờ 2.5 giây để các biểu đồ, animation load xong hoàn toàn
        await new Promise(r => setTimeout(r, 2500));
        
        const savePath = path.join(artifactDir, fileName);
        await page.screenshot({ path: savePath });
        console.log(`✅ Đã lưu ảnh: ${savePath}`);
    };
    
    // Thực hiện chụp các trang chính
    await takeScreenshot('/', 'app_dashboard.png');
    await takeScreenshot('/contacts', 'app_contacts.png');
    await takeScreenshot('/workspace', 'app_workspace.png');
    await takeScreenshot('/ai-training', 'app_ai_training.png');
    
    console.log("🔒 Đóng trình duyệt...");
    await browser.close();
    console.log("🎉 Hoàn thành chụp ảnh toàn bộ trang ứng dụng!");
}

capture().catch(err => {
    console.error("❌ Lỗi trong quá trình chụp ảnh:", err);
});
