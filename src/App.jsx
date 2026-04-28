import { useState, useEffect } from 'react';
import liff from '@line/liff';
import './App.css'; // 引入樣式
// deploy test

function App() {
  // 系統狀態
  const [isLiffInit, setIsLiffInit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

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

  // 初始化 LIFF (等同於 Vue 的 onMounted)、在 useEffect 中取得位置 (在 LIFF 初始化區塊內或下方)
  useEffect(() => {
    liff.init({ liffId: MY_LIFF_ID })
      .then(() => {
        setIsLiffInit(true);
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

      // 發送給 Go 後端
      const response = await fetch(`${baseUrl}/api/submit-ema`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moodScore: payload.moodScore,
          context: payload.context,
          energyScore: energyScore, // 👈 新增這行：送出喚起度
          userId: userId,            // 👈 新增這行：送出真實的 LINE ID
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

  return (
    <div className="container">
      <header>
        <h2>日常脈絡紀錄</h2>
        {!isLiffInit && <p className="loading">系統初始化中...</p>}
      </header>

      {isLiffInit && (
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
    </div>
  );
}

export default App;