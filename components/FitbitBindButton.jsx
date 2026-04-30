import React from 'react';
import liff from '@line/liff';

const FitbitBindButton = () => {
    const handleFitbitLogin = async () => {
        try {
            if (!liff.isLoggedIn()) {
                alert("請在 LINE App 內開啟此功能");
                return;
            }
            const profile = await liff.getProfile();
            const realUserId = profile.userId;

            // 指向你部署在 Render 上的 Go 路由
            const loginUrl = `https://ema-liff.onrender.com/api/fitbit/login?userId=${realUserId}`;
            window.location.href = loginUrl;
        } catch (error) {
            console.error("[錯誤] 無法取得 LINE 授權資訊:", error);
            alert("發生錯誤，無法啟動綁定流程。");
        }
    };

    return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
            <p>綁定 Fitbit 帳號以同步您的日常生理數據</p>
            <button
                onClick={handleFitbitLogin}
                style={{
                    backgroundColor: '#00B900',
                    color: 'white',
                    padding: '12px 24px',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    cursor: 'pointer'
                }}
            >
                綁定 Fitbit 手環
            </button>
        </div>
    );
};

export default FitbitBindButton;