import { ethers } from 'ethers';
import { config } from './config.js';

const FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)',
];

const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint32 feeProtocol, bool unlocked)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
];

const FEE_TIERS = [2500, 500, 10000, 100];

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
    const { address: poolAddress } = await findTakeWbnbPool(provider);
    const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
    
    const [slot0, token0, token1] = await Promise.all([
      pool.slot0(),
      pool.token0(),
      pool.token1(),
    ]);
    
    const sqrtPriceX96 = slot0.sqrtPriceX96;
    
    // 가격 계산: (sqrtPriceX96 / 2^96)^2
    const sqrtPriceX96Num = BigInt(sqrtPriceX96.toString());
    const Q96 = BigInt(2) ** BigInt(96);
    
    // price = (sqrtPriceX96 / 2^96)^2 = sqrtPriceX96^2 / 2^192
    const priceNum = sqrtPriceX96Num * sqrtPriceX96Num;
    const Q192 = Q96 * Q96;
    
    // token1/token0 가격
    const price = Number(priceNum * BigInt(10**18) / Q192) / 10**18;
    
    const isToken0Wbnb = token0.toLowerCase() === config.WBNB_TOKEN.toLowerCase();
    
    // 디버깅 출력
    console.log(`[DEBUG] token0: ${token0}`);
    console.log(`[DEBUG] token1: ${token1}`);
    console.log(`[DEBUG] isToken0Wbnb: ${isToken0Wbnb}`);
    console.log(`[DEBUG] sqrtPriceX96: ${sqrtPriceX96.toString()}`);
    console.log(`[DEBUG] price (token1/token0): ${price}`);
    
    let takePriceInBnb;
    if (isToken0Wbnb) {
      // token0=WBNB, token1=TAKE
      // price = TAKE/WBNB (1 WBNB당 TAKE 개수)
      // 1 TAKE = 1/price WBNB
      takePriceInBnb = 1 / price;
    } else {
      // token0=TAKE, token1=WBNB  
      // price = WBNB/TAKE (1 TAKE당 WBNB 개수)
      takePriceInBnb = price;
    }
    
    console.log(`[DEBUG] takePriceInBnb: ${takePriceInBnb}`);
    
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

export function calculateTakeUsdPrice(takePriceInBnb, bnbUsdPrice) {
  console.log(`[DEBUG] BNB price: $${bnbUsdPrice}`);
  console.log(`[DEBUG] TAKE in BNB: ${takePriceInBnb}`);
  console.log(`[DEBUG] TAKE in USD: $${takePriceInBnb * bnbUsdPrice}`);
  return takePriceInBnb * bnbUsdPrice;
}
