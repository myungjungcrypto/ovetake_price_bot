import { ethers } from 'ethers';
import { config } from './config.js';

// PancakeSwap V3 Factory ABI (getPool만 필요)
const FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)',
];

// PancakeSwap V3 Pool ABI (slot0만 필요)
const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint32 feeProtocol, bool unlocked)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
];

// Fee tiers to try (가장 일반적인 순서)
const FEE_TIERS = [2500, 500, 10000, 100]; // 0.25%, 0.05%, 1%, 0.01%

let cachedPoolAddress = null;
let cachedPoolFee = null;

export async function findTakeWbnbPool(provider) {
  if (cachedPoolAddress) {
    return { address: cachedPoolAddress, fee: cachedPoolFee };
  }
  
  const factory = new ethers.Contract(
    config.PANCAKE_V3_FACTORY,
    FACTORY_ABI,
    provider
  );
  
  for (const fee of FEE_TIERS) {
    try {
      const poolAddress = await factory.getPool(
        config.TAKE_TOKEN,
        config.WBNB_TOKEN,
        fee
      );
      
      if (poolAddress && poolAddress !== ethers.ZeroAddress) {
        console.log(`✅ Found TAKE/WBNB pool: ${poolAddress} (fee: ${fee / 10000}%)`);
        cachedPoolAddress = poolAddress;
        cachedPoolFee = fee;
        return { address: poolAddress, fee };
      }
    } catch (error) {
      // Continue to next fee tier
    }
  }
  
  throw new Error('TAKE/WBNB pool not found in any fee tier');
}

export async function getPancakeswapPrice(provider) {
  try {
    // 1. 풀 찾기
    const { address: poolAddress } = await findTakeWbnbPool(provider);
    
    // 2. 풀 컨트랙트 연결
    const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
    
    // 3. slot0에서 sqrtPriceX96 가져오기
    const [slot0, token0, token1] = await Promise.all([
      pool.slot0(),
      pool.token0(),
      pool.token1(),
    ]);
    
    const sqrtPriceX96 = slot0.sqrtPriceX96;
    
    // 4. 가격 계산
    // price = (sqrtPriceX96 / 2^96)^2 = sqrtPriceX96^2 / 2^192
    // 이 가격은 token1/token0
    
    const sqrtPrice = Number(sqrtPriceX96) / (2 ** 96);
    let price = sqrtPrice * sqrtPrice;
    
    // 5. TAKE 가격인지 WBNB 가격인지 확인
    // token0 < token1 (주소 기준)
    // WBNB(0xbb...) < TAKE(0xe7...) 이므로 token0 = WBNB, token1 = TAKE
    // price = token1/token0 = TAKE/WBNB (1 WBNB당 TAKE 개수)
    
    const isToken0Wbnb = token0.toLowerCase() === config.WBNB_TOKEN.toLowerCase();
    
    let takePriceInBnb;
    if (isToken0Wbnb) {
      // price = TAKE/WBNB → 1 TAKE = 1/price WBNB
      takePriceInBnb = 1 / price;
    } else {
      // price = WBNB/TAKE → 1 TAKE = price WBNB
      takePriceInBnb = price;
    }
    
    return {
      takePriceInBnb,
      poolAddress,
      sqrtPriceX96: sqrtPriceX96.toString(),
      tick: Number(slot0.tick),
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('Failed to fetch PancakeSwap price:', error.message);
    return null;
  }
}

// TAKE 가격을 USDT로 변환
export function calculateTakeUsdPrice(takePriceInBnb, bnbUsdPrice) {
  return takePriceInBnb * bnbUsdPrice;
}
