/**
 * deploy-dex.mjs
 *
 * Deploys UniswapV2Factory + UniswapV2Router02 on Robinhood Chain.
 * Saves addresses to contracts/deployments/dex.json.
 *
 * Run from the workspace root:
 *   cd artifacts/api-server && node scripts/deploy-dex.mjs
 *
 * Requires:
 *   - DEPLOYER_PRIVATE_KEY env var
 *   - @uniswap/v2-core and @uniswap/v2-periphery devDependencies installed
 */

import { createWalletClient, createPublicClient, http, decodeEventLog } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync } from 'fs';

const require    = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Load compiled artifacts
const factoryArtifact = require('@uniswap/v2-core/build/UniswapV2Factory.json');
const routerArtifact  = require('@uniswap/v2-periphery/build/UniswapV2Router02.json');

const RPC_URL  = 'https://rpc.mainnet.chain.robinhood.com';
const CHAIN_ID = 4663;
const WETH     = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73';

const chain = {
  id: CHAIN_ID,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
};

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error('DEPLOYER_PRIVATE_KEY not set');

  const account      = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);
  const walletClient = createWalletClient({ account, chain, transport: http() });
  const publicClient = createPublicClient({ chain, transport: http() });

  console.log('Deployer:', account.address);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log('ETH balance:', (Number(balance) / 1e18).toFixed(6), 'ETH');

  // ── Deploy UniswapV2Factory ────────────────────────────────────────────────
  console.log('\n⏳ Deploying UniswapV2Factory...');
  const factoryHash = await walletClient.deployContract({
    abi:      factoryArtifact.abi,
    bytecode: factoryArtifact.bytecode,
    args:     [account.address], // feeToSetter
  });
  console.log('  tx:', factoryHash);
  const factoryReceipt = await publicClient.waitForTransactionReceipt({ hash: factoryHash });
  const factoryAddress = factoryReceipt.contractAddress;
  if (!factoryAddress) throw new Error('Factory deployment failed — no contractAddress in receipt');
  console.log('✅ UniswapV2Factory:', factoryAddress, '| block', factoryReceipt.blockNumber.toString());

  // ── Deploy UniswapV2Router02 ──────────────────────────────────────────────
  console.log('\n⏳ Deploying UniswapV2Router02...');
  const routerHash = await walletClient.deployContract({
    abi:      routerArtifact.abi,
    bytecode: routerArtifact.bytecode,
    args:     [factoryAddress, WETH],
  });
  console.log('  tx:', routerHash);
  const routerReceipt = await publicClient.waitForTransactionReceipt({ hash: routerHash });
  const routerAddress = routerReceipt.contractAddress;
  if (!routerAddress) throw new Error('Router deployment failed — no contractAddress in receipt');
  console.log('✅ UniswapV2Router02:', routerAddress, '| block', routerReceipt.blockNumber.toString());

  // ── Save to dex.json ──────────────────────────────────────────────────────
  const deploymentsDir = resolve(__dirname, '../../../contracts/deployments');
  mkdirSync(deploymentsDir, { recursive: true });

  const dexData = {
    network:    'Robinhood Chain',
    chainId:    CHAIN_ID,
    deployedAt: new Date().toISOString().slice(0, 10),
    factory:    factoryAddress,
    router:     routerAddress,
    weth:       WETH,
    initCodeHash: '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
  };

  writeFileSync(
    resolve(deploymentsDir, 'dex.json'),
    JSON.stringify(dexData, null, 2) + '\n',
  );

  console.log('\n🎉 DEX deployed and saved to contracts/deployments/dex.json');
  console.log(JSON.stringify(dexData, null, 2));
}

main().catch(e => {
  console.error('FAILED:', e.shortMessage ?? e.message ?? e);
  process.exit(1);
});
