import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import liff from '@line/liff';
import FitbitBindButton from './components/FitbitBindButton.jsx';
import './App.css'; // 引入樣式
// deploy test

function App() {
  // 系統狀態
  const [isLiffInit, setIsLiffInit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [isFitbitBound, setIsFitbitBound] = useState(false); // 預設為未綁定

  // 問卷資料狀態
  const [payload, setPayload] = useState({
    moodScore: 50,
    context: 'Home'
  });
  const [energyScore, setEnergyScore] = useState(50); // 喚起度/活力

  const contexts = ['Home', 'Work/Study', 'Commute', 'Social', 'Other'];

  const MY_LIFF_ID = "2009889443-bwfiYEbv";
  const baseUrl = "https://ema-liff.onrender.com";

  // 2. 新增位置狀態
  const [location, setLocation] = useState({ lat: null, lng: null });

  // 在你的 Component 內新增狀態
  const [historyData, setHistoryData] = useState([]);
  const [userId, setUserId] = useState(null);
  const [viewMode, setViewMode] = useState('form'); // 'form' 為填寫問卷, 'chart' 為看圖表

  // 初始化 LIFF (等同於 Vue 的 onMounted)、在 useEffect 中取得位置 (在 LIFF 初始化區塊內或下方)
  useEffect(() => {
    liff.init({ liffId: MY_LIFF_ID })
      .then(() => {
        setIsLiffInit(true);

        // 初始化成功後，抓取使用者的 LINE ID
        if (liff.isLoggedIn()) {
          liff.getProfile()
            .then((profile) => {
              setUserId(profile.userId); // 把抓到的 U 開頭 ID 存入 state
            })
            .catch((err) => {
              console.error('取得 Profile 失敗', err);
            });
        }
      })
      .catch((err) => {
        console.error('LIFF 初始化失敗', err);
        setMessage('LIFF 載入失敗，請確認在 LINE 內開啟');
      });

    // 取得使用者 GPS
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.warn("無法取得位置，可能使用者拒絕授權:", error);
          // 可以在這裡設定預設座標（例如台北市中心），或是不處理
        },
        // 設定高精確度、10秒超時
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // 當使用者切換到圖表模式時，觸發抓取 (假設 userId 已經從 LIFF 拿到了)
  useEffect(() => {
    // 👇 加上這行：如果有真實 ID 就用真實的，沒有就用測試 ID
    const fetchId = userId || "U00000000000000000000000000000000";

    if (viewMode === 'chart') {
      console.log(`[前端] 準備撈取軌跡，使用的 ID: ${fetchId}`); // 方便你在 F12 觀察
      fetchHistory(fetchId);
    }
  }, [viewMode, userId]);

  // 當拿到 userId 時，檢查是否已經綁定過 Fitbit
  useEffect(() => {
    console.log("🔍 [狀態檢查] useEffect 被觸發，目前的 userId 是:", userId);
    if (userId) {
      console.log(`🚀 [狀態檢查] 準備打 API 查詢綁定狀態: ${baseUrl}/api/fitbit/status?userId=${userId}`);

      fetch(`${baseUrl}/api/fitbit/status?userId=${userId}`)
        .then(res => res.json())
        .then(data => {
          console.log("📥 [狀態檢查] 後端回傳結果:", data);
          if (data.isBound) {
            setIsFitbitBound(true);
          }
        })
        .catch(err => console.error("[前端] 無法取得綁定狀態:", err));
    } else {
      console.log("⏸️ [狀態檢查] 因為 userId 是空的，所以暫不發送 API。");
    }
  }, [userId]);

  // 處理送出
  const submitData = async () => {
    setIsSubmitting(true);
    setMessage('');

    try {
      let userId = "unknown";
      if (liff.isLoggedIn()) {
        const profile = await liff.getProfile();
        userId = profile.userId;
      }

      // 👇 修正 ID 獲取邏輯
      let finalUserId = userId; // 優先使用剛才在 useEffect 存進去的 state

      // 雙重保險：如果 state 沒東西，但 LIFF 有登入，就再抓一次
      if (!finalUserId && liff.isLoggedIn()) {
        const profile = await liff.getProfile();
        finalUserId = profile.userId;
      }

      // 🛡️ 關鍵防呆：如果還是沒有（代表你在電腦 Chrome 測試），給一組符合格式的測試 ID
      if (!finalUserId) {
        finalUserId = "U00000000000000000000000000000000"; // 必須是 U 開頭且 33 碼
        console.warn("⚠️ 目前非 LINE 環境，使用測試用 UserID 送出");
      }

      // 發送給 Go 後端
      const response = await fetch(`${baseUrl}/api/submit-ema`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moodScore: payload.moodScore,
          context: payload.context,
          energyScore: energyScore, // 👈 新增這行：送出喚起度
          userId: finalUserId,            // 👈 新增這行：送出真實的 LINE ID
          // 👇 新增這兩行把座標傳給 Go
          lat: location.lat,
          lng: location.lng
        })
      });

      if (response.ok) {
        setMessage('紀錄成功！即將關閉視窗...');
        setTimeout(() => liff.closeWindow(), 1500);
      } else {
        throw new Error('伺服器回應錯誤');
      }
    } catch (error) {
      console.error(error);
      setMessage('傳送失敗，請稍後再試。');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 新增一個抓取資料的 function
  const fetchHistory = async (uid) => {
    try {
      const response = await fetch(`${baseUrl}/api/history?userId=${uid}`);
      if (response.ok) {
        const data = await response.json();
        console.log("[前端] 從後端收到的軌跡資料:", data); // 👈 新增這行
        setHistoryData(data || []);
      }
    } catch (error) {
      console.error("無法取得歷史紀錄:", error);
    }
  };

  return (
    <div className="container">
      <header>
        <h2>日常脈絡紀錄</h2>
        {!isLiffInit && <p className="loading">系統初始化中...</p>}
      </header>
      {/* 在你的 UI 中加入切換按鈕 */}
      <div className="flex gap-4 mb-4">
        {/* Fitbit 綁定區塊 */}
        <div className="flex justify-center">
          {!isFitbitBound ? (
            <FitbitBindButton />
          ) : (
            <div className="py-2 px-4 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-medium border border-emerald-100 shadow-sm">
              ✅ 已成功綁定 Fitbit 裝置
            </div>
          )}
        </div>
        <br></br>
        <button onClick={() => setViewMode('form')} className="p-2 bg-gray-200 rounded">📝 紀錄當下</button>
        <button onClick={() => setViewMode('chart')} className="p-2 bg-gray-200 rounded">📊 我的軌跡</button>
      </div>

      {isLiffInit && viewMode === 'form' && (
        <main>
          {/* 1. 情緒效價 */}
          <section className="question-block">
            <label>1. 你現在的心情有多愉悅？ ({payload.moodScore})</label>
            <div className="slider-wrapper">
              <span>低落</span>
              <input
                type="range" min="0" max="100"
                value={payload.moodScore}
                onChange={(e) => setPayload({ ...payload, moodScore: parseInt(e.target.value) })}
              />
              <span>愉悅</span>
            </div>
          </section>

          {/* 2. 喚起度 */}
          <section className="question-block">
            <label>2. 你現在感覺有多少活力？ ({energyScore})</label>
            <div className="slider-wrapper">
              <span>疲憊</span>
              <input
                type="range" min="0" max="100"
                value={energyScore}
                onChange={(e) => setEnergyScore(parseInt(e.target.value))}
              />
              <span>充沛</span>
            </div>
          </section>

          {/* 3. 情境選擇 */}
          <section className="question-block">
            <label>3. 你現在主要處於什麼情境？</label>
            <div className="context-buttons">
              {contexts.map((ctx) => (
                <button
                  key={ctx}
                  className={payload.context === ctx ? 'active' : ''}
                  onClick={() => setPayload({ ...payload, context: ctx })}
                >
                  {ctx}
                </button>
              ))}
            </div>
          </section>

          <button
            className="submit-btn"
            disabled={isSubmitting}
            onClick={submitData}
          >
            {isSubmitting ? '傳送中...' : '送出紀錄'}
          </button>

          {message && <p className="status-msg">{message}</p>}
        </main>
      )}

      {/* 條件渲染圖表區塊 */}
      {viewMode === 'chart' && (
        <div className="w-full bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-gray-600 mb-4 font-medium text-center">情緒與能量波動軌跡</h3>
          {historyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={[...historyData].reverse()} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#888' }} />
                <YAxis tick={{ fontSize: 12, fill: '#888' }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend wrapperStyle={{ fontSize: '14px' }} />
                {/* 低飽和紫色代表心情，低飽和綠色代表能量 */}
                <Line type="monotone" name="心情分數" dataKey="moodScore" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" name="能量分數" dataKey="energyScore" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              目前還沒有足夠的軌跡可以顯示喔
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;