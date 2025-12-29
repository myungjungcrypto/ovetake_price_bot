# TAKE Price Alert Bot

PancakeSwap V3 TAKE/WBNB 풀 가격과 Binance Futures Index 가격을 모니터링하고, 설정한 임계값에 도달하면 Telegram으로 알람을 보내는 봇입니다.

## 기능

1. **DEX 가격 알람**: PancakeSwap V3 풀에서 TAKE 가격이 특정 범위를 벗어나면 알람
2. **괴리율 알람**: DEX 가격과 Binance Index 가격의 차이가 임계값을 초과하면 알람
3. **텔레그램 명령어**: 봇에서 직접 설정 변경 가능
4. **알람 쿨다운**: 같은 조건에서 5분간 중복 알람 방지

## 텔레그램 명령어

| 명령어 | 설명 |
|--------|------|
| `/help` | 도움말 보기 |
| `/status` | 현재 설정 확인 |
| `/price` | 현재 가격 조회 |
| `/on` | 알람 켜기 |
| `/off` | 알람 끄기 |
| `/price_upper 0.60` | DEX 가격 상한 설정 |
| `/price_lower 0.35` | DEX 가격 하한 설정 |
| `/div_upper 1.5` | 괴리율 상한 설정 (%) |
| `/div_lower -1.5` | 괴리율 하한 설정 (%) |

## 설정

### 환경변수

```bash
# .env 파일 생성
cp .env.example .env
```

필수 환경변수:
- `ALCHEMY_RPC`: Alchemy BNB Chain RPC URL
- `TELEGRAM_BOT_TOKEN`: Telegram Bot Token
- `TELEGRAM_CHAT_ID`: 알람 받을 Chat ID

### 기본 임계값 (코드에서 설정)

`src/config.js`에서 초기값 설정:

```javascript
export const alertSettings = {
  enabled: true,
  dexPriceUpper: 0.60,    // DEX 가격 상한
  dexPriceLower: 0.35,    // DEX 가격 하한
  divergenceUpper: 1.5,   // 괴리율 상한 (%)
  divergenceLower: -1.5,  // 괴리율 하한 (%)
};
```

## 실행

### 로컬 실행

```bash
npm install
npm start
```

### Railway 배포

1. GitHub에 푸시
2. Railway에서 새 프로젝트 생성
3. GitHub repo 연결
4. 환경변수 설정
5. 자동 배포

## 알람 예시

**DEX 가격 알람:**
```
🚀 TAKE DEX 가격 알람

💰 현재 DEX 가격: $0.610000
🎯 임계값: $0.6000
📊 상태: 가격 상승 돌파
```

**괴리율 알람:**
```
⬆️ TAKE 괴리율 알람

🥞 PancakeSwap: $0.480000
📊 Binance Index: $0.466220
📐 괴리율: +2.954%

🔍 DEX > Index (프리미엄)
```

**현재 가격 조회 (/price):**
```
💹 현재 TAKE 가격

🥞 PancakeSwap: $0.468000
📊 Binance Index: $0.466220
📐 괴리율: +0.381%
```
