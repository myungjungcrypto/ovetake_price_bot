export async function getBinanceIndexPrice() {
  const url = 'https://fapi.binance.com/fapi/v1/premiumIndex?symbol=TAKEUSDT';
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Binance API error: ${response.status}`);
    const data = await response.json();
    
    return {
      indexPrice: parseFloat(data.indexPrice),
      markPrice: parseFloat(data.markPrice),
      lastFundingRate: parseFloat(data.lastFundingRate),
      nextFundingTime: data.nextFundingTime,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('Failed to fetch Binance index price:', error.message);
    return null;
  }
}

export async function getBnbPrice() {
  const url = 'https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT';
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Binance API error: ${response.status}`);
    const data = await response.json();
    return parseFloat(data.price);
  } catch (error) {
    console.error('Failed to fetch BNB price:', error.message);
    return null;
  }
}
