import type { ReactElement, Dispatch, SetStateAction } from "react";
type Tab = "learning" | "gift" | "monitor" | "rewards" | "security";
export function ParentLockTabs({activeTab,setActiveTab,pendingCount}:{activeTab:Tab;setActiveTab:Dispatch<SetStateAction<Tab>>;pendingCount:number}):ReactElement {
 return (<div className="parent-tabs-bar">
            <button
              className={`parent-tab-item ${activeTab === "learning" ? "active" : ""}`}
              onClick={() => setActiveTab("learning")}
            >
              🎒 學習步調
            </button>
            <button
              className={`parent-tab-item ${activeTab === "gift" ? "active" : ""}`}
              onClick={() => setActiveTab("gift")}
            >
              🎁 贈送點數
            </button>
            <button
              className={`parent-tab-item ${activeTab === "monitor" ? "active" : ""}`}
              onClick={() => setActiveTab("monitor")}
            >
              📊 進度監督
            </button>
            <button
              className={`parent-tab-item ${activeTab === "rewards" ? "active" : ""}`}
              onClick={() => setActiveTab("rewards")}
            >
              🛍️ 獎勵庫管理
              {pendingCount > 0 && <span className="parent-tab-badge">{pendingCount} 待審批</span>}
            </button>
            <button
              className={`parent-tab-item ${activeTab === "security" ? "active" : ""}`}
              onClick={() => setActiveTab("security")}
            >
              🔒 安全 PIN 碼
            </button>
          </div>
 );
}
