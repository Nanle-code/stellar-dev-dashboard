import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContractDeployer } from '../ContractDeployer';

vi.mock('../CostEstimator', () => ({
  CostEstimator: {
    estimate: vi.fn().mockResolvedValue({
      estimatedFeeStroops: 50000,
      footprintKb: 45,
      argCount: 2
    })
  }
}));

describe('ContractDeployer', () => {
  let deployer: ContractDeployer;
  const mockWasm = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
  const mockArgs = ['arg1', 123];
  const mockSourceAccount = 'GB3HXR3XUBYQ6U52KOWF6Q2J7F7B4R4XQ4V4N4F4H7VUXG54R6L3B2XF';

  beforeEach(() => {
    deployer = new ContractDeployer();
  });

  describe('deployContract', () => {
    it('blocks direct deployment on mainnet and forces simulation mode', async () => {
      const result = await deployer.deployContract(
        mockWasm, 
        mockArgs, 
        mockSourceAccount, 
        'mainnet'
      );

      expect(result.status).toBe('pending');
      expect(result.isSimulation).toBe(true);
      expect(result.networkUsed).toBe('mainnet');
      expect(result.error).toContain('simulation only');
      expect(result.txHash).toBeUndefined();
    });

    it('successfully deploys on testnet and generates a tx parameters', async () => {
      const result = await deployer.deployContract(
        mockWasm, 
        mockArgs, 
        mockSourceAccount, 
        'testnet'
      );

      expect(result.status).toBe('submitted');
      expect(result.isSimulation).toBe(false);
      expect(result.contractId).toMatch(/^C[0-9A-F]{16}$/);
      expect(result.txHash).toBeDefined();
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.constructorArgsCount).toBe(2);
    });
  });

  describe('simulateDeployment', () => {
    it('simulates deployment and runs cost estimator logic', async () => {
      const result = await deployer.simulateDeployment(
        mockWasm,
        mockArgs,
        mockSourceAccount,
        'testnet'
      );

      expect(result.status).toBe('pending');
      expect(result.isSimulation).toBe(true);
      expect(result.contractId).toBeDefined();

      const cost = await deployer.estimateDeploymentCost(mockWasm, mockArgs);
      expect(cost.estimatedFeeStroops).toBe(50000);
      expect(cost.footprintKb).toBe(45);
    });
  });
});