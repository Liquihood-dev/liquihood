/**
 * deploy-flash-liquidator.mjs
 *
 * Deploys FlashLiquidator.sol on Robinhood Chain.
 * Saves the address to contracts/deployments/flash-liquidator.json.
 *
 * Run:  cd artifacts/api-server && node scripts/deploy-flash-liquidator.mjs
 *
 * Requires: DEPLOYER_PRIVATE_KEY env var
 */

import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const REPO_ROOT       = resolve(__dirname, '../../..');
const DEPLOYMENTS_DIR = resolve(REPO_ROOT, 'contracts/deployments');
const ARTIFACT_PATH   = resolve(REPO_ROOT, 'contracts/out/FlashLiquidator.sol/FlashLiquidator.json');

const RPC_URL      = 'https://rpc.mainnet.chain.robinhood.com';
const CHAIN_ID     = 4663;
const LENDING_POOL = '0xcf689f3eFAbCE22A0f29FE0D47A5fd5d6e7e7291';

const chain = {
  id: CHAIN_ID, name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
};

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error('DEPLOYER_PRIVATE_KEY not set');

  const account      = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);
  const walletClient = createWalletClient({ account, chain, transport: http() });
  const publicClient = createPublicClient({ chain, transport: http() });

  const ethBal = await publicClient.getBalance({ address: account.address });
  console.log('Deployer:', account.address);
  console.log('ETH balance:', (Number(ethBal) / 1e18).toFixed(6), 'ETH\n');

  // Load compiled artifact from Foundry output
  const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8'));
  const abi      = artifact.abi;
  const bytecode = artifact.bytecode.object; // hex string with 0x prefix

  // Load DEX router address
  const dex = JSON.parse(readFileSync(resolve(DEPLOYMENTS_DIR, 'dex.json'), 'utf8'));

  console.log('⏳ Deploying FlashLiquidator...');
  console.log('  lendingPool:', LENDING_POOL);
  console.log('  router:     ', dex.router);

  const deployHash = await walletClient.deployContract({
    abi,
    bytecode,
    args: [account.address, LENDING_POOL, dex.router],
  });
  console.log('  tx:', deployHash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  const address = receipt.contractAddress;
  if (!address) throw new Error('Deployment failed — no contractAddress in receipt');
  console.log('✅ FlashLiquidator:', address, '| block', receipt.blockNumber.toString());

  const out = {
    network:     'Robinhood Chain',
    chainId:     CHAIN_ID,
    deployedAt:  new Date().toISOString().slice(0, 10),
    address,
    lendingPool: LENDING_POOL,
    router:      dex.router,
  };

  mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  writeFileSync(resolve(DEPLOYMENTS_DIR, 'flash-liquidator.json'), JSON.stringify(out, null, 2) + '\n');

  console.log('\n🎉 Saved to contracts/deployments/flash-liquidator.json');
  console.log(JSON.stringify(out, null, 2));
}

main().catch(e => {
  console.error('FAILED:', e.shortMessage ?? e.message ?? e);
  process.exit(1);
});
